"""
Configuration management for the B2B Prospecting Cloud Agent.
Loads environment variables and provides typed configuration.
"""

import os
from dataclasses import dataclass, field
from typing import List
from dotenv import load_dotenv

load_dotenv()


@dataclass
class TargetLocation:
    """Target location for lead discovery."""
    city: str
    state: str
    niche: str


@dataclass
class Config:
    """Application configuration loaded from environment variables."""

    # Supabase Configuration
    supabase_url: str = field(default_factory=lambda: os.getenv('SUPABASE_URL', ''))
    supabase_anon_key: str = field(default_factory=lambda: os.getenv('SUPABASE_ANON_KEY', ''))
    supabase_service_key: str = field(default_factory=lambda: os.getenv('SUPABASE_SERVICE_ROLE_KEY', ''))

    # Google Sheets Webhook
    google_sheets_webhook_url: str = field(
        default_factory=lambda: os.getenv('GOOGLE_SHEETS_WEBHOOK_URL', '')
    )

    # Scheduler Configuration
    scan_interval_hours: int = field(
        default_factory=lambda: int(os.getenv('SCAN_INTERVAL_HOURS', '6'))
    )
    drip_interval_min_minutes: int = field(
        default_factory=lambda: int(os.getenv('DRIP_INTERVAL_MIN_MINUTES', '30'))
    )
    drip_interval_max_minutes: int = field(
        default_factory=lambda: int(os.getenv('DRIP_INTERVAL_MAX_MINUTES', '60'))
    )

    # Pitch Portal URL
    pitch_portal_url: str = field(
        default_factory=lambda: os.getenv('PITCH_PORTAL_URL', 'https://clientconnectportal.netlify.app/')
    )

    # Agent Behavior
    autonomous_mode: bool = field(
        default_factory=lambda: os.getenv('AUTONOMOUS_MODE', 'true').lower() == 'true'
    )
    log_level: str = field(default_factory=lambda: os.getenv('LOG_LEVEL', 'INFO'))

    # Target Locations - Top US Metro Areas for High-Ticket Services
    targets: List[TargetLocation] = field(default_factory=lambda: [
        # East Coast
        TargetLocation('New York', 'NY', 'Water Damage Restoration'),
        TargetLocation('Miami', 'FL', 'Pool Contractors'),
        TargetLocation('Atlanta', 'GA', 'Roofing Contractors'),
        TargetLocation('Boston', 'MA', 'HVAC Specialists'),
        TargetLocation('Philadelphia', 'PA', 'Plumbing Companies'),

        # Midwest
        TargetLocation('Chicago', 'IL', 'Plumbing Companies'),
        TargetLocation('Detroit', 'MI', 'Roofing Contractors'),
        TargetLocation('Minneapolis', 'MN', 'HVAC Specialists'),
        TargetLocation('Cleveland', 'OH', 'Water Damage Restoration'),

        # South
        TargetLocation('Dallas', 'TX', 'HVAC Specialists'),
        TargetLocation('Houston', 'TX', 'Roofing Contractors'),
        TargetLocation('Austin', 'TX', 'Solar Installers'),
        TargetLocation('Nashville', 'TN', 'Landscaping Services'),
        TargetLocation('Charlotte', 'NC', 'Electricians'),

        # West
        TargetLocation('Los Angeles', 'CA', 'Solar Installers'),
        TargetLocation('Phoenix', 'AZ', 'Pool Contractors'),
        TargetLocation('San Francisco', 'CA', 'Electricians'),
        TargetLocation('Seattle', 'WA', 'Roofing Contractors'),
        TargetLocation('Denver', 'CO', 'HVAC Specialists'),
        TargetLocation('San Diego', 'CA', 'Solar Installers'),
    ])

    def validate(self) -> bool:
        """Validate that required configuration is present."""
        required = ['supabase_url', 'supabase_anon_key']
        missing = [k for k in required if not getattr(self, k)]

        if missing:
            print(f"Warning: Missing configuration: {', '.join(missing)}")
            print("Some features may be limited.")
            return False
        return True


# Global configuration instance
config = Config()
