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
from datetime import datetime
from typing import List
from dataclasses import asdict

import structlog

from services.qualification import QualifiedLead

logger = structlog.get_logger()

CACHE_FILENAME = "leads_cache.json"


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
