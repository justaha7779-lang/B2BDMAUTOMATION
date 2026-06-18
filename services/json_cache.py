"""
JSON State Cache - Permanent local database endpoint.

All discovered leads are written to leads_cache.json in the project root.
This file acts as a zero-loss persistent store that survives restarts,
container redeployments, and local machine shutdowns.

The cache is loaded on startup and appended to on every scan cycle.
"""

import json
import os
import threading
from datetime import datetime, timedelta
from typing import List, Dict, Any
from dataclasses import asdict

import structlog

from services.qualification import QualifiedLead

logger = structlog.get_logger()

CACHE_FILENAME = "leads_cache.json"
MAX_RETRY_ATTEMPTS = 10


class JsonStateCache:
    """
    Thread-safe JSON file cache for lead data.

    File location: <project_root>/leads_cache.json

    Structure:
    {
      "metadata": {
        "created_at": "...",
        "last_updated": "...",
        "total_records": 2500,
        "total_qualified": 1800,
        "total_synced_to_sheets": 1500,
        "scan_cycles_completed": 42
      },
      "leads": [ ... ]
    }
    """

    def __init__(self, root_dir: str = None):
        if root_dir is None:
            root_dir = os.path.dirname(os.path.abspath(__file__))
            # Go up one level since this file is in /services
            root_dir = os.path.dirname(root_dir)
        self.filepath = os.path.join(root_dir, CACHE_FILENAME)
        self._lock = threading.Lock()
        self._cache = self._load_cache()

    def _load_cache(self) -> dict:
        """Load cache from disk, or initialize empty structure."""
        if os.path.exists(self.filepath):
            try:
                with open(self.filepath, 'r') as f:
                    data = json.load(f)
                logger.info(
                    "Cache loaded from disk",
                    records=len(data.get('leads', [])),
                    path=self.filepath
                )
                return data
            except (json.JSONDecodeError, IOError) as e:
                logger.warning("Cache file corrupted, starting fresh", error=str(e))

        return {
            'metadata': {
                'created_at': datetime.now().isoformat(),
                'last_updated': datetime.now().isoformat(),
                'total_records': 0,
                'total_qualified': 0,
                'total_synced_to_sheets': 0,
                'scan_cycles_completed': 0,
            },
            'leads': []
        }

    def _save_cache(self):
        """Write cache to disk."""
        try:
            with open(self.filepath, 'w') as f:
                json.dump(self._cache, f, indent=2, default=str)
            logger.debug("Cache written to disk", records=self._cache['metadata']['total_records'])
        except IOError as e:
            logger.error("Failed to write cache to disk", error=str(e))

    def add_lead(self, lead: QualifiedLead) -> None:
        """Add a single lead to the cache and persist to disk."""
        with self._lock:
            self._cache['leads'].append(asdict(lead))
            self._cache['metadata']['total_records'] = len(self._cache['leads'])
            self._cache['metadata']['total_qualified'] = sum(
                1 for l in self._cache['leads'] if l.get('dm_eligible')
            )
            self._cache['metadata']['last_updated'] = datetime.now().isoformat()
            self._save_cache()

    def add_leads(self, leads: List[QualifiedLead]) -> None:
        """Add multiple leads to the cache and persist to disk."""
        with self._lock:
            for lead in leads:
                self._cache['leads'].append(asdict(lead))

            self._cache['metadata']['total_records'] = len(self._cache['leads'])
            self._cache['metadata']['total_qualified'] = sum(
                1 for l in self._cache['leads'] if l.get('dm_eligible')
            )
            self._cache['metadata']['last_updated'] = datetime.now().isoformat()
            self._save_cache()

        logger.info(
            "Leads cached to JSON",
            added=len(leads),
            total_records=self._cache['metadata']['total_records']
        )

    def increment_scan_cycles(self) -> None:
        """Increment the scan cycle counter."""
        with self._lock:
            self._cache['metadata']['scan_cycles_completed'] += 1
            self._cache['metadata']['last_updated'] = datetime.now().isoformat()
            self._save_cache()

    def increment_sheets_sync(self, count: int) -> None:
        """Increment the sheets sync counter."""
        with self._lock:
            self._cache['metadata']['total_synced_to_sheets'] += count
            self._cache['metadata']['last_updated'] = datetime.now().isoformat()
            self._save_cache()

    def get_metadata(self) -> dict:
        """Get cache metadata without loading all leads."""
        return dict(self._cache.get('metadata', {}))

    def get_all_leads(self) -> List[dict]:
        """Get all cached leads."""
        return list(self._cache.get('leads', []))

    def get_qualified_leads(self) -> List[dict]:
        """Get only qualified leads (passed all 3 criteria)."""
        return [l for l in self._cache.get('leads', []) if l.get('dm_eligible')]

    def get_pending_leads(self) -> List[dict]:
        """Get qualified leads not yet synced to sheets."""
        return [
            l for l in self._cache.get('leads', [])
            if l.get('dm_eligible') and not l.get('sheets_synced', False)
        ]

    def mark_lead_synced(self, lead_id: str) -> None:
        """Mark a lead as synced to Google Sheets."""
        with self._lock:
            for lead in self._cache['leads']:
                if lead.get('id') == lead_id:
                    lead['sheets_synced'] = True
                    break
            self._cache['metadata']['last_updated'] = datetime.now().isoformat()
            self._save_cache()

    def get_stats(self) -> dict:
        """Get summary statistics."""
        meta = self._cache.get('metadata', {})
        leads = self._cache.get('leads', [])

        niche_counts = {}
        for lead in leads:
            niche = lead.get('niche', 'Unknown')
            niche_counts[niche] = niche_counts.get(niche, 0) + 1

        city_counts = {}
        for lead in leads:
            city = lead.get('city', 'Unknown')
            city_counts[city] = city_counts.get(city, 0) + 1

        return {
            'total_records': meta.get('total_records', 0),
            'total_qualified': meta.get('total_qualified', 0),
            'total_synced_to_sheets': meta.get('total_synced_to_sheets', 0),
            'scan_cycles_completed': meta.get('scan_cycles_completed', 0),
            'last_updated': meta.get('last_updated'),
            'niche_breakdown': niche_counts,
            'city_breakdown': city_counts,
        }

    # ───────────────────────────────────────────────
    # Retry queue (persistent background cache)
    # ───────────────────────────────────────────────

    def _ensure_retry_queue(self) -> None:
        """Guarantee the retry queue structure exists in cache."""
        if 'sheets_retry_queue' not in self._cache:
            self._cache['sheets_retry_queue'] = []

    def get_retry_queue(self) -> List[Dict[str, Any]]:
        """Return the persistent sheets retry queue entries."""
        self._ensure_retry_queue()
        return list(self._cache.get('sheets_retry_queue', []))

    def add_to_retry_queue(self, lead: QualifiedLead, attempts: int = 0) -> None:
        """Append a failed lead to the persistent retry queue."""
        self._ensure_retry_queue()
        with self._lock:
            entry = {
                'lead_id': lead.id,
                'company_name': lead.company_name,
                'phone': lead.phone,
                'website': lead.website,
                'facebook_link': lead.facebook_link,
                'city': lead.city,
                'state': lead.state,
                'niche': lead.niche,
                'dm_eligible': lead.dm_eligible,
                'contact_form_present': lead.contact_form_present,
                'has_live_chat_widget': lead.has_live_chat_widget,
                'messenger_button_active': lead.messenger_button_active,
                'qualification_score': lead.qualification_score,
                'disqualification_reason': lead.disqualification_reason,
                'customized_script': lead.customized_script,
                'created_at': lead.created_at,
                'scan_session_id': lead.scan_session_id,
                'attempts': attempts,
                'last_attempt': datetime.now().isoformat(),
            }
            # Prevent duplicates
            if not any(e.get('lead_id') == lead.id for e in self._cache['sheets_retry_queue']):
                self._cache['sheets_retry_queue'].append(entry)
                self._cache['metadata']['last_updated'] = datetime.now().isoformat()
                self._save_cache()
                logger.info(
                    "Lead added to persistent retry queue",
                    company=lead.company_name,
                    lead_id=lead.id,
                    attempts=attempts
                )

    def pop_retry_queue(self, lead_id: str) -> None:
        """Remove a successfully re-transmitted lead from the retry queue."""
        self._ensure_retry_queue()
        with self._lock:
            original = len(self._cache['sheets_retry_queue'])
            self._cache['sheets_retry_queue'] = [
                e for e in self._cache['sheets_retry_queue']
                if e.get('lead_id') != lead_id
            ]
            if len(self._cache['sheets_retry_queue']) < original:
                self._cache['metadata']['last_updated'] = datetime.now().isoformat()
                self._save_cache()

    def prune_retry_queue(self) -> int:
        """Drop entries that have exceeded max retry attempts."""
        self._ensure_retry_queue()
        with self._lock:
            original = len(self._cache['sheets_retry_queue'])
            self._cache['sheets_retry_queue'] = [
                e for e in self._cache['sheets_retry_queue']
                if e.get('attempts', 0) < MAX_RETRY_ATTEMPTS
            ]
            pruned = original - len(self._cache['sheets_retry_queue'])
            if pruned:
                self._cache['metadata']['last_updated'] = datetime.now().isoformat()
                self._save_cache()
                logger.warning("Pruned stale retry queue entries", pruned=pruned)
            return pruned

    def retry_queue_to_leads(self) -> List[QualifiedLead]:
        """Convert retry queue entries back to QualifiedLead objects."""
        entries = self.get_retry_queue()
        leads = []
        for e in entries:
            if e.get('attempts', 0) >= MAX_RETRY_ATTEMPTS:
                continue
            # Exponential backoff: only re-attempt if enough time passed
            # wait = 2^attempts minutes (max ~17 hours at attempt 10)
            minutes_wait = min(2 ** e.get('attempts', 0), 60)
            try:
                last_attempt = datetime.fromisoformat(e.get('last_attempt', datetime.now().isoformat()))
            except (ValueError, TypeError):
                last_attempt = datetime.now()
            if datetime.now() - last_attempt < timedelta(minutes=minutes_wait):
                continue
            try:
                lead = QualifiedLead(
                    id=e['lead_id'],
                    company_name=e['company_name'],
                    phone=e.get('phone', ''),
                    website=e.get('website', ''),
                    facebook_link=e.get('facebook_link', ''),
                    city=e.get('city', ''),
                    state=e.get('state', ''),
                    niche=e.get('niche', ''),
                    dm_eligible=e.get('dm_eligible', True),
                    contact_form_present=e.get('contact_form_present', False),
                    has_live_chat_widget=e.get('has_live_chat_widget', False),
                    messenger_button_active=e.get('messenger_button_active', False),
                    qualification_score=e.get('qualification_score', 0),
                    disqualification_reason=e.get('disqualification_reason'),
                    customized_script=e.get('customized_script', ''),
                    created_at=e.get('created_at', datetime.now().isoformat()),
                    scan_session_id=e.get('scan_session_id', ''),
                )
                leads.append(lead)
            except (KeyError, TypeError) as exc:
                logger.warning("Corrupted retry queue entry skipped", error=str(exc))
                continue
        return leads

    def increment_retry_attempt(self, lead_id: str) -> int:
        """Bump the attempt counter for a queued lead. Return new count."""
        self._ensure_retry_queue()
        with self._lock:
            for entry in self._cache['sheets_retry_queue']:
                if entry.get('lead_id') == lead_id:
                    entry['attempts'] = entry.get('attempts', 0) + 1
                    entry['last_attempt'] = datetime.now().isoformat()
                    self._cache['metadata']['last_updated'] = datetime.now().isoformat()
                    self._save_cache()
                    return entry['attempts']
        return 0

    def get_retry_queue_stats(self) -> dict:
        """Return summary of retry queue state."""
        entries = self.get_retry_queue()
        return {
            'pending': len(entries),
            'max_attempts': MAX_RETRY_ATTEMPTS,
            'over_limit': len([e for e in entries if e.get('attempts', 0) >= MAX_RETRY_ATTEMPTS]),
        }

    def export_for_sheets(self) -> List[dict]:
        """
        Export qualified leads in Google Sheets row format.

        Returns list of dicts with columns:
        [Company Name, Phone, Custom Script Text, Direct Messenger Link]
        """
        qualified = self.get_qualified_leads()
        return [
            {
                'company_name': l.get('company_name', ''),
                'phone': l.get('phone', ''),
                'custom_script': l.get('customized_script', ''),
                'messenger_link': l.get('facebook_link', ''),
            }
            for l in qualified
        ]


# Global instance
json_cache = JsonStateCache()
