"""
Lead qualification engine with 3-criteria filtering system.

Criteria for DM eligibility:
1. Contact form present on website
2. No live chat widget detected (Intercom, Drift, booking portals)
3. Facebook Messenger button active
"""

import random
import string
from dataclasses import dataclass
from datetime import datetime
from typing import Optional, List
from config.settings import TargetLocation, config


@dataclass
class QualifiedLead:
    """A lead that has passed the 3-criteria qualification."""

    id: str
    company_name: str
    phone: str
    website: str
    facebook_link: str
    city: str
    state: str
    niche: str
    dm_eligible: bool
    contact_form_present: bool
    has_live_chat_widget: bool
    messenger_button_active: bool
    qualification_score: int
    disqualification_reason: Optional[str]
    customized_script: str
    created_at: str
    scan_session_id: str


def generate_session_id() -> str:
    """Generate a unique session identifier."""
    timestamp = str(int(datetime.now().timestamp()))
    random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=9))
    return f"{timestamp}-{random_suffix}"


def generate_phone_number() -> str:
    """Generate a realistic US phone number."""
    area_code = random.randint(200, 999)
    exchange = random.randint(200, 999)
    subscriber = random.randint(1000, 9999)
    return f"({area_code}) {exchange}-{subscriber}"


def generate_customized_script(company_name: str) -> str:
    """
    Generate customized outreach pitch with company name injection.
    This is the text-replacement node that personalizes each message.
    """
    pitch_url = config.pitch_portal_url

    return f"""Hey, I noticed on your site that you take leads via your contact form, but if you're out on a job, it's easy to miss them before the client calls a competitor.

I actually custom-built this "Speed-to-Lead" dashboard specifically for your team at {company_name} so you never lose another job to slow reply times: {pitch_url}

I want to give you full access to it completely for free—all I ask for in return is a quick 30-second video testimonial if it helps you lock in your next client. Let me know if you're up for it!"""


def apply_qualification_criteria(
    has_contact_form: bool,
    has_live_chat: bool,
    has_messenger: bool
) -> tuple[bool, int, Optional[str]]:
    """
    Apply the 3-criteria qualification filter.

    Returns:
        tuple: (is_qualified, score, disqualification_reason)
    """
    score = 0
    if has_contact_form:
        score += 1
    if not has_live_chat:
        score += 1
    if has_messenger:
        score += 1

    # All three criteria must pass
    is_qualified = has_contact_form and not has_live_chat and has_messenger

    # Determine disqualification reason
    disqualification_reason = None
    if not is_qualified:
        if not has_contact_form:
            disqualification_reason = "No contact form detected on website"
        elif has_live_chat:
            disqualification_reason = "Live chat widget detected (Intercom/Drift/Booking portal)"
        elif not has_messenger:
            disqualification_reason = "Facebook page does not support Messenger button"

    return is_qualified, score, disqualification_reason


def discover_leads_for_target(target: TargetLocation) -> List[QualifiedLead]:
    """
    Discover and qualify leads for a target location.

    In production, this would integrate with:
    - Google Places API
    - Yelp Fusion API
    - Facebook Graph API (for Messenger button verification)

    Currently simulates discovery with realistic qualification patterns.
    """
    session_id = generate_session_id()
    leads = []

    # Simulate 3-6 businesses per scan
    num_businesses = random.randint(3, 6)

    # Business name patterns
    prefixes = ['Premier', 'Elite', 'Pro', 'Expert', 'A-1', 'Top Tier', 'All-Star',
                'Reliable', 'Trusted', 'Quality', 'Master', 'Champion']
    suffixes = ['LLC', 'Inc.', 'Services', 'Solutions', 'Group', 'Company', 'Contractors', 'Pros']

    for i in range(num_businesses):
        prefix = random.choice(prefixes)
        suffix = random.choice(suffixes)
        niche_word = target.niche.split()[0]
        company_name = f"{target.city} {prefix} {niche_word} {suffix}".strip()

        # Simulate qualification criteria with realistic distributions:
        # - ~75% have contact forms
        # - ~30% have live chat (disqualifying)
        # - ~70% have messenger buttons
        has_contact_form = random.random() > 0.25
        has_live_chat = random.random() > 0.70
        has_messenger = random.random() > 0.30

        # Apply qualification
        is_qualified, score, disqualification_reason = apply_qualification_criteria(
            has_contact_form, has_live_chat, has_messenger
        )

        # Clean company name for URLs
        clean_name = company_name.lower().replace(' ', '').replace(',', '')
        clean_name = ''.join(c for c in clean_name if c.isalnum())

        lead = QualifiedLead(
            id=f"{session_id}-{i}",
            company_name=company_name,
            phone=generate_phone_number(),
            website=f"https://www.{clean_name}.com",
            facebook_link=f"https://m.me/{clean_name}",
            city=target.city,
            state=target.state,
            niche=target.niche,
            dm_eligible=is_qualified,
            contact_form_present=has_contact_form,
            has_live_chat_widget=has_live_chat,
            messenger_button_active=has_messenger,
            qualification_score=score,
            disqualification_reason=disqualification_reason,
            customized_script=generate_customized_script(company_name),
            created_at=datetime.now().isoformat(),
            scan_session_id=session_id,
        )

        leads.append(lead)

    return leads


def filter_qualified_leads(leads: List[QualifiedLead]) -> List[QualifiedLead]:
    """Return only leads that passed all 3 criteria."""
    return [lead for lead in leads if lead.dm_eligible]
