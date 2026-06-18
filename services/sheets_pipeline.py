"""
Google Sheets Automated Synchronization Module.

Streams qualified leads to an external Google Sheet via async HTTP POST
the instant a prospect passes the 3-criteria qualification check and its
customized script is compiled.

Row format:
  Column A: Company Name
  Column B: Direct Messenger Link (https://m.me/...)
  Column C: Fully Customized Outreach Script Text
  Column D: Status (defaults to "Pending")

Offline Queue Recovery:
- On webhook failure, the lead row is persisted to a JSON retry queue.
- At the start of each scan cycle, queued rows are re-transmitted with
  exponential backoff so zero records are ever lost.
"""

import asyncio
import aiohttp
import structlog
from typing import List

from config.settings import config
from services.qualification import QualifiedLead
from services.json_cache import json_cache

logger = structlog.get_logger()


class GoogleSheetsPipeline:
    """
    Handles streaming of qualified leads to Google Sheets via webhook.

    Connected via Make / Zapier / Apps Script webhook. Each qualified lead
    is POSTed immediately upon qualification -- no batch delay.
    """

    SHEETS_ROW_STATUS = "Pending"
    MAX_RETRIES = 3
    WEBHOOK_TIMEOUT = 30
    RATE_LIMIT_DELAY = 0.1

    def __init__(self):
        self.webhook_url = config.google_sheets_webhook_url

    def _build_sheets_payload(self, lead: QualifiedLead) -> dict:
        """
        Build the Google Sheets row payload matching the required column layout.

        Column A: Company Name
        Column B: Direct Messenger Link (https://m.me/...)
        Column C: Fully Customized Outreach Script Text
        Column D: Status (defaults to "Pending")
        """
        return {
            "company_name": lead.company_name,
            "dm_link": lead.facebook_link,
            "outreach_script": lead.customized_script,
            "status": self.SHEETS_ROW_STATUS,
        }

    async def _post(self, lead: QualifiedLead, payload: dict, attempt: int) -> bool:
        """Execute a single POST attempt. Return True on 2xx."""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    self.webhook_url,
                    json=payload,
                    headers={"Content-Type": "application/json"},
                    timeout=aiohttp.ClientTimeout(total=self.WEBHOOK_TIMEOUT),
                ) as response:
                    if response.status in (200, 201, 202):
                        logger.info(
                            "Lead streamed to Google Sheets",
                            company=lead.company_name,
                            dm_link=lead.facebook_link,
                            status=payload["status"],
                        )
                        return True
                    body = await response.text()
                    logger.warning(
                        "Google Sheets webhook returned non-2xx",
                        status=response.status,
                        company=lead.company_name,
                        attempt=attempt,
                        body=body[:200],
                    )
                    return False
        except asyncio.TimeoutError:
            logger.warning(
                "Google Sheets webhook timeout",
                company=lead.company_name,
                attempt=attempt,
            )
            return False
        except aiohttp.ClientError as e:
            logger.warning(
                "Google Sheets connection error",
                error=str(e),
                company=lead.company_name,
                attempt=attempt,
            )
            return False
        except Exception as e:
            logger.error(
                "Google Sheets unexpected error",
                error=str(e),
                company=lead.company_name,
                attempt=attempt,
            )
            return False

    async def stream_lead(self, lead: QualifiedLead) -> bool:
        """
        Immediately stream a single qualified lead to Google Sheets.

        Fires an async HTTP POST the moment the lead passes the
        3-criteria filter and its personalized script is compiled.

        On persistent failure the lead is persisted to the JSON retry queue
        so re-transmission can happen at the next scan cycle.

        Args:
            lead: QualifiedLead that passed all 3 criteria

        Returns:
            True if POST succeeded, False otherwise
        """
        if not self.webhook_url:
            logger.debug(
                "Google Sheets webhook not configured. Skipping export.",
                company=lead.company_name,
            )
            return False

        if not lead.dm_eligible:
            logger.debug(
                "Lead not DM-eligible. Skipping sheets export.",
                company=lead.company_name,
                reason=lead.disqualification_reason,
            )
            return False

        payload = self._build_sheets_payload(lead)

        for attempt in range(1, self.MAX_RETRIES + 1):
            if await self._post(lead, payload, attempt):
                return True

            if attempt < self.MAX_RETRIES:
                backoff = 2 ** attempt
                logger.info("Retrying sheets POST", backoff_seconds=backoff)
                await asyncio.sleep(backoff)

        logger.error(
            "Google Sheets POST failed after all retries",
            company=lead.company_name,
            retries=self.MAX_RETRIES,
        )
        # Persist to the background retry queue for the next scan cycle
        json_cache.add_to_retry_queue(lead, attempts=0)
        return False

    async def stream_multiple(self, leads: List[QualifiedLead]) -> int:
        """
        Stream multiple qualified leads to Google Sheets.
        Each lead is POSTed individually with a small delay to avoid
        webhook rate limits.

        Returns count of successfully streamed leads.
        """
        success_count = 0
        for lead in leads:
            if not lead.dm_eligible:
                continue
            if await self.stream_lead(lead):
                success_count += 1
            await asyncio.sleep(self.RATE_LIMIT_DELAY)

        logger.info(
            "Batch sheets stream complete",
            total=len(leads),
            qualified=sum(1 for l in leads if l.dm_eligible),
            streamed=success_count,
        )
        return success_count

    async def flush_retry_queue(self) -> int:
        """
        Retry any leads that previously failed to stream.

        Called at the start of each scan cycle. Pulls leads from the
        persistent JSON retry queue, applies exponential backoff gating,
        increments attempt counters, and removes entries on success.

        Returns:
            Number of leads successfully re-transmitted.
        """
        # Prune entries that have exceeded max attempts
        json_cache.prune_retry_queue()

        leads = json_cache.retry_queue_to_leads()
        if not leads:
            return 0

        logger.info("Flushing persistent sheets retry queue", count=len(leads))

        success_count = 0
        for lead in leads:
            payload = self._build_sheets_payload(lead)

            transmitted = False
            for attempt in range(1, self.MAX_RETRIES + 1):
                if await self._post(lead, payload, attempt):
                    transmitted = True
                    break
                if attempt < self.MAX_RETRIES:
                    backoff = 2 ** attempt
                    await asyncio.sleep(backoff)

            if transmitted:
                json_cache.pop_retry_queue(lead.id)
                json_cache.mark_lead_synced(lead.id)
                json_cache.increment_sheets_sync(1)
                success_count += 1
            else:
                # Bump the attempt counter in the persistent queue
                json_cache.increment_retry_attempt(lead.id)
                logger.error(
                    "Retry transmission failed",
                    company=lead.company_name,
                    lead_id=lead.id,
                )

        return success_count

    @property
    def pending_retry_count(self) -> int:
        """Number of leads queued for retry (from persistent cache)."""
        return json_cache.get_retry_queue_stats()["pending"]


# Global instance
sheets_pipeline = GoogleSheetsPipeline()
