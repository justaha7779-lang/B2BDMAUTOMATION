"""
Google Sheets pipeline service.

Automatically streams qualified leads to an external Google Sheet
via async HTTP POST the moment a prospect passes the 3-criteria
qualification filter and its personalized script is compiled.

Row format:
  Column A: Company Name
  Column B: Direct Messenger Link (https://m.me/...)
  Column C: Fully Customized Outreach Script Text
  Column D: Status (defaults to "Pending")
"""

import asyncio
import aiohttp
import structlog
from typing import List

from config.settings import config
from services.qualification import QualifiedLead

logger = structlog.get_logger()


class GoogleSheetsPipeline:
    """
    Handles streaming of qualified leads to Google Sheets via webhook.

    Connected via Make/Zapier/Apps Script webhook. Each qualified lead
    is POSTed immediately upon qualification -- no batch delay, zero
    data loss if the local machine shuts down.
    """

    SHEETS_ROW_STATUS = "Pending"

    def __init__(self):
        self.webhook_url = config.google_sheets_webhook_url
        self._queue: List[QualifiedLead] = []
        self._max_retries = 3

    def _build_sheets_payload(self, lead: QualifiedLead) -> dict:
        """
        Build the Google Sheets row payload matching the required column layout.

        Column A: Company Name
        Column B: Direct Messenger Link (https://m.me/...)
        Column C: Fully Customized Outreach Script Text
        Column D: Status (defaults to "Pending")
        """
        return {
            'company_name': lead.company_name,           # Column A
            'dm_link': lead.facebook_link,                # Column B
            'outreach_script': lead.customized_script,    # Column C
            'status': self.SHEETS_ROW_STATUS,             # Column D
        }

    async def stream_lead(self, lead: QualifiedLead) -> bool:
        """
        Immediately stream a single qualified lead to Google Sheets.

        Fires an async HTTP POST the moment the lead passes the
        3-criteria filter and its personalized script is compiled.

        Args:
            lead: QualifiedLead that passed all 3 criteria

        Returns:
            True if POST succeeded, False otherwise
        """
        if not self.webhook_url:
            logger.debug(
                "Google Sheets webhook not configured. Skipping export.",
                company=lead.company_name
            )
            return False

        if not lead.dm_eligible:
            logger.debug(
                "Lead not DM-eligible. Skipping sheets export.",
                company=lead.company_name,
                reason=lead.disqualification_reason
            )
            return False

        payload = self._build_sheets_payload(lead)

        for attempt in range(1, self._max_retries + 1):
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.post(
                        self.webhook_url,
                        json=payload,
                        headers={'Content-Type': 'application/json'},
                        timeout=aiohttp.ClientTimeout(total=30)
                    ) as response:
                        if response.status in (200, 201, 202):
                            logger.info(
                                "Lead streamed to Google Sheets",
                                company=lead.company_name,
                                dm_link=lead.facebook_link,
                                status=payload['status']
                            )
                            return True
                        else:
                            body = await response.text()
                            logger.warning(
                                "Google Sheets webhook returned non-2xx",
                                status=response.status,
                                company=lead.company_name,
                                attempt=attempt,
                                body=body[:200]
                            )

            except asyncio.TimeoutError:
                logger.warning(
                    "Google Sheets webhook timeout",
                    company=lead.company_name,
                    attempt=attempt
                )
            except aiohttp.ClientError as e:
                logger.warning(
                    "Google Sheets connection error",
                    error=str(e),
                    company=lead.company_name,
                    attempt=attempt
                )
            except Exception as e:
                logger.error(
                    "Google Sheets unexpected error",
                    error=str(e),
                    company=lead.company_name,
                    attempt=attempt
                )

            # Exponential backoff before retry
            if attempt < self._max_retries:
                backoff = 2 ** attempt
                logger.info("Retrying sheets POST", backoff_seconds=backoff)
                await asyncio.sleep(backoff)

        logger.error(
            "Google Sheets POST failed after all retries",
            company=lead.company_name,
            retries=self._max_retries
        )
        self._queue.append(lead)
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

            # 100ms delay between posts to respect webhook rate limits
            await asyncio.sleep(0.1)

        logger.info(
            "Batch sheets stream complete",
            total=len(leads),
            qualified=sum(1 for l in leads if l.dm_eligible),
            streamed=success_count
        )
        return success_count

    async def flush_retry_queue(self) -> int:
        """
        Retry any leads that previously failed to stream.
        Call this at the start of each scan cycle.
        """
        if not self._queue:
            return 0

        retry_leads = self._queue.copy()
        self._queue.clear()
        logger.info("Flushing sheets retry queue", count=len(retry_leads))

        return await self.stream_multiple(retry_leads)

    @property
    def pending_retry_count(self) -> int:
        """Number of leads queued for retry."""
        return len(self._queue)


# Global instance
sheets_pipeline = GoogleSheetsPipeline()
