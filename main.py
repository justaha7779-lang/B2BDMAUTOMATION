#!/usr/bin/env python3
"""
B2B Prospecting Cloud Agent

Autonomous lead discovery and qualification engine that runs 24/7.

Architecture:
- Continuous Loop Engine: Scans US metros every 6 hours
- Drip Queue Controller: Processes leads every 30-60 minutes (human rhythm)
- Zero-Loss Sync: JSON state cache + Supabase + Google Sheets
- All data persisted to leads_cache.json as permanent local database endpoint
"""

import asyncio
import json
import os
import random
import signal
import sys
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import List
from collections import deque
from threading import Thread

import structlog

from config.settings import config, TargetLocation
from config.targets import HIGH_TICKET_NICHES, NICHE_JOB_VALUES
from services.qualification import (
    QualifiedLead,
    discover_leads_for_target,
    filter_qualified_leads,
)
from services.json_cache import json_cache
from services.sync_services import supabase_service
from services.sheets_pipeline import sheets_pipeline
from utils.logger import setup_logging

# Initialize logging
setup_logging(config.log_level)
logger = structlog.get_logger()


class DripQueue:
    """
    Outbound drip queue controller.

    Maintains a queue of qualified leads and processes them
    one at a time with 30-60 minute intervals to simulate
    organic human activity rhythm.
    """

    def __init__(self):
        self.queue: deque[QualifiedLead] = deque()
        self.processed_count = 0
        self.last_process_time: datetime | None = None

    def add_leads(self, leads: List[QualifiedLead]):
        """Add qualified leads to the drip queue."""
        qualified = [l for l in leads if l.dm_eligible]
        self.queue.extend(qualified)
        logger.info(
            "Leads added to drip queue",
            added=len(qualified),
            queue_size=len(self.queue)
        )

    def get_next_lead(self) -> QualifiedLead | None:
        """Get the next lead from the queue."""
        if self.queue:
            return self.queue.popleft()
        return None

    @property
    def size(self) -> int:
        return len(self.queue)


class ContinuousEngine:
    """
    Continuous Loop Engine for autonomous lead discovery.

    Features:
    - Runs every SCAN_INTERVAL_HOURS (default: 6)
    - Cycles through top US metro areas
    - Targets high-ticket service industries
    - Immediately syncs qualified leads to JSON cache + cloud
    """

    def __init__(self):
        self.targets = config.targets.copy()
        self.target_index = 0
        self.is_running = False
        self.drip_queue = DripQueue()

        # Load previous state from JSON cache
        self._load_previous_state()

    def _load_previous_state(self):
        """Restore target index from previous session."""
        meta = json_cache.get_metadata()
        if meta.get('scan_cycles_completed', 0) > 0:
            self.target_index = meta.get('scan_cycles_completed', 0) % len(self.targets)
            logger.info(
                "Restored previous session state",
                previous_scans=meta.get('scan_cycles_completed'),
                resuming_at_index=self.target_index,
                cached_records=meta.get('total_records', 0)
            )

    async def execute_scan_cycle(self):
        """
        Execute a full scan cycle for the current target.

        Pipeline flow:
        1. Discover leads for target metro
        2. For EACH lead that passes qualification + script compilation,
           immediately POST to Google Sheets (async, non-blocking)
        3. Save all leads to JSON cache (zero-loss local endpoint)
        4. Save to Supabase (cloud backup)
        5. Add qualified leads to drip queue
        """
        target = self.targets[self.target_index]
        logger.info(
            "Starting scan cycle",
            target_city=target.city,
            target_state=target.state,
            niche=target.niche
        )

        # Phase 0: Flush any previously failed sheets posts before starting new cycle
        retry_synced = await sheets_pipeline.flush_retry_queue()
        retry_pending = json_cache.get_retry_queue_stats()["pending"]
        logger.info(
            "Retry queue flush complete",
            retry_synced=retry_synced,
            retry_pending=retry_pending,
        )

        try:
            # Phase 1: Discover leads
            leads = discover_leads_for_target(target)

            # Phase 2: Qualify and immediately stream each qualified lead
            sheets_sync_coroutines = []
            for lead in leads:
                if lead.dm_eligible:
                    sheets_sync_coroutines.append(
                        sheets_pipeline.stream_lead(lead)
                    )

            # Fire all sheets POSTs concurrently (non-blocking)
            sheets_results = await asyncio.gather(*sheets_sync_coroutines, return_exceptions=True)
            new_synced = sum(1 for r in sheets_results if r is True)
            synced_count = new_synced + retry_synced

            qualified = filter_qualified_leads(leads)
            logger.info(
                "Scan complete",
                discovered=len(leads),
                qualified=len(qualified),
                new_sheets_synced=new_synced,
                retry_sheets_synced=retry_synced,
                total_sheets_synced=synced_count,
            )

            # Phase 3: Save all leads to JSON cache (zero-loss local endpoint)
            json_cache.add_leads(leads)
            json_cache.increment_scan_cycles()

            if synced_count > 0:
                json_cache.increment_sheets_sync(synced_count)
                for lead in qualified:
                    json_cache.mark_lead_synced(lead.id)

            # Phase 4: Save to Supabase (cloud backup)
            await supabase_service.save_leads(leads)

            # Phase 5: Add qualified leads to drip queue
            self.drip_queue.add_leads(qualified)

            # Move to next target in rotation
            self.target_index = (self.target_index + 1) % len(self.targets)

            return leads

        except Exception as e:
            logger.error("Scan cycle failed", error=str(e))
            return []

    async def process_drip_queue(self):
        """
        Process one lead from the drip queue.

        This prepares leads for outreach by marking them as ready
        in both the JSON cache and Supabase. Actual outreach is manual.
        """
        lead = self.drip_queue.get_next_lead()
        if not lead:
            return None

        logger.info(
            "Processing lead from drip queue",
            company=lead.company_name,
            remaining=self.drip_queue.size
        )

        # Update status in database
        await supabase_service.update_lead_status(lead.id, 'processing')

        return lead

    def get_drip_interval_seconds(self) -> int:
        """Get a random interval between drip operations (30-60 min)."""
        min_minutes = config.drip_interval_min_minutes
        max_minutes = config.drip_interval_max_minutes
        return random.randint(min_minutes, max_minutes) * 60

    def get_scan_interval_seconds(self) -> int:
        """Get scan interval in seconds."""
        return config.scan_interval_hours * 3600


class HealthHandler(BaseHTTPRequestHandler):
    """Lightweight HTTP health check endpoint for Render/Railway."""

    def do_GET(self):
        if self.path == '/health':
            stats = json_cache.get_stats()
            payload = json.dumps({
                'status': 'healthy',
                'timestamp': datetime.now().isoformat(),
                'cache_stats': stats,
            }).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(payload)
        elif self.path == '/api/stats':
            stats = json_cache.get_stats()
            payload = json.dumps(stats, default=str).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(payload)
        elif self.path == '/api/leads/qualified':
            rows = json_cache.export_for_sheets()
            payload = json.dumps(rows, default=str).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(payload)
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass


class CloudAgent:
    """
    Main orchestrator for the B2B Prospecting Cloud Agent.

    Manages:
    - Continuous scan loop (every 6 hours)
    - Drip queue processing (every 30-60 minutes)
    - JSON state cache as permanent database endpoint
    - Health check HTTP server for cloud deployment
    - Graceful shutdown handling
    """

    def __init__(self):
        self.engine = ContinuousEngine()
        self.running = False
        self._shutdown_requested = False
        self._http_server = None

        signal.signal(signal.SIGINT, self._handle_shutdown)
        signal.signal(signal.SIGTERM, self._handle_shutdown)

    def _handle_shutdown(self, signum, frame):
        """Handle shutdown signals gracefully."""
        logger.info("Shutdown signal received - saving state before exit")
        self._shutdown_requested = True
        self.running = False

    def _start_health_server(self):
        """Start lightweight HTTP server for cloud health checks."""
        port = int(os.getenv('PORT', '8000'))
        self._http_server = HTTPServer(('0.0.0.0', port), HealthHandler)
        self._http_server.timeout = 1
        logger.info("Health check server started", port=port)

        while self.running and not self._shutdown_requested:
            self._http_server.handle_request()

    async def run_scan_loop(self):
        """Continuous scan loop - runs every 6 hours."""
        while self.running and not self._shutdown_requested:
            await self.engine.execute_scan_cycle()

            interval = self.engine.get_scan_interval_seconds()
            logger.info("Next scan in", hours=interval / 3600)

            for _ in range(int(interval)):
                if not self.running or self._shutdown_requested:
                    break
                await asyncio.sleep(1)

    async def run_drip_loop(self):
        """Drip queue loop - processes one lead every 30-60 minutes."""
        while self.running and not self._shutdown_requested:
            lead = await self.engine.process_drip_queue()

            if lead:
                logger.info(
                    "Lead ready for manual outreach",
                    company=lead.company_name,
                    messenger_link=lead.facebook_link
                )

            interval = self.engine.get_drip_interval_seconds()
            logger.info("Next drip in", minutes=interval / 60)

            for _ in range(int(interval)):
                if not self.running or self._shutdown_requested:
                    break
                await asyncio.sleep(1)

    async def start(self):
        """Start the cloud agent with all subsystems."""
        logger.info("=" * 60)
        logger.info("B2B Prospecting Cloud Agent Starting")
        logger.info("=" * 60)
        logger.info("Scan interval", hours=config.scan_interval_hours)
        logger.info("Drip interval", min_min=config.drip_interval_min_minutes, max_min=config.drip_interval_max_minutes)
        logger.info("Autonomous mode", enabled=config.autonomous_mode)
        logger.info("Targets configured", count=len(config.targets))

        cache_meta = json_cache.get_metadata()
        logger.info(
            "JSON cache state",
            cached_records=cache_meta.get('total_records', 0),
            qualified=cache_meta.get('total_qualified', 0),
            previous_scans=cache_meta.get('scan_cycles_completed', 0)
        )

        config.validate()

        self.running = True

        health_thread = Thread(target=self._start_health_server, daemon=True)
        health_thread.start()

        await asyncio.gather(
            self.run_scan_loop(),
            self.run_drip_loop(),
            return_exceptions=True
        )

        logger.info("Cloud Agent stopped - all data persisted to leads_cache.json")

    def stop(self):
        """Stop the cloud agent."""
        self.running = False


def print_banner():
    """Print startup banner."""
    print("""
╔═══════════════════════════════════════════════════════════╗
║     B2B Prospecting Cloud Agent v1.0.0                    ║
║     Autonomous Lead Discovery Engine                     ║
╠═══════════════════════════════════════════════════════════╣
║  Scan Cycle: Every 6 hours                               ║
║  Drip Queue: 30-60 minute intervals                     ║
║  State Cache: leads_cache.json (permanent endpoint)     ║
║  Zero-Loss Sync: JSON + Supabase + Google Sheets         ║
╚═══════════════════════════════════════════════════════════╝
    """)


async def main():
    """Main entry point."""
    print_banner()

    agent = CloudAgent()
    await agent.start()


if __name__ == "__main__":
    asyncio.run(main())
