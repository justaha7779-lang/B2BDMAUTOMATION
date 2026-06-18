"""
Database sync service for Supabase integration.
Provides zero-loss cloud storage for all discovered leads.
"""

from datetime import datetime
import structlog
from typing import List, Optional
from supabase import create_client, Client

from config.settings import config
from services.qualification import QualifiedLead

logger = structlog.get_logger()


class SupabaseService:
    """Handles all database operations with Supabase."""

    def __init__(self):
        self.client: Optional[Client] = None
        self._initialize_client()

    def _initialize_client(self):
        """Initialize Supabase client with configuration."""
        if not config.supabase_url or not config.supabase_anon_key:
            logger.warning("Supabase credentials not configured. Database operations will be skipped.")
            return

        try:
            self.client = create_client(
                config.supabase_url,
                config.supabase_anon_key
            )
            logger.info("Supabase client initialized successfully")
        except Exception as e:
            logger.error("Failed to initialize Supabase client", error=str(e))

    async def save_lead(self, lead: QualifiedLead) -> bool:
        """
        Save a single lead to the database.
        Returns True if successful.
        """
        if not self.client:
            logger.debug("Database not configured. Skipping lead storage.")
            return False

        record = {
            'id': lead.id,
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
            'scan_session_id': lead.scan_session_id,
            'dm_pipeline_status': 'pending',
            'created_at': lead.created_at,
            'updated_at': lead.created_at,
        }

        try:
            self.client.table('leads').insert(record).execute()
            logger.info("Lead saved to database", company=lead.company_name)
            return True
        except Exception as e:
            logger.error("Failed to save lead to database", error=str(e), company=lead.company_name)
            return False

    async def save_leads(self, leads: List[QualifiedLead]) -> int:
        """
        Save multiple leads to the database.
        Returns count of successfully saved leads.
        """
        success_count = 0
        for lead in leads:
            if await self.save_lead(lead):
                success_count += 1
        return success_count

    async def update_lead_status(self, lead_id: str, status: str) -> bool:
        """Update the DM pipeline status of a lead."""
        if not self.client:
            return False

        try:
            self.client.table('leads').update({
                'dm_pipeline_status': status,
                'updated_at': datetime.now().isoformat()
            }).eq('id', lead_id).execute()
            return True
        except Exception as e:
            logger.error("Failed to update lead status", error=str(e), lead_id=lead_id)
            return False

    async def get_pending_leads(self, limit: int = 100) -> List[dict]:
        """Get leads pending for outreach."""
        if not self.client:
            return []

        try:
            result = self.client.table('leads')\
                .select('*')\
                .eq('dm_eligible', True)\
                .eq('dm_pipeline_status', 'pending')\
                .order('created_at', desc=True)\
                .limit(limit)\
                .execute()
            return result.data or []
        except Exception as e:
            logger.error("Failed to fetch pending leads", error=str(e))
            return []

    async def get_stats(self) -> dict:
        """Get database statistics."""
        if not self.client:
            return {'total': 0, 'qualified': 0, 'today': 0}

        try:
            total_result = self.client.table('leads').select('id', count='exact').execute()
            total = total_result.count if hasattr(total_result, 'count') else len(total_result.data or [])

            qualified_result = self.client.table('leads').select('id', count='exact').eq('dm_eligible', True).execute()
            qualified = qualified_result.count if hasattr(qualified_result, 'count') else len(qualified_result.data or [])

            today = datetime.now().strftime('%Y-%m-%d')
            today_result = self.client.table('leads').select('id', count='exact').gte('created_at', today).execute()
            today_count = today_result.count if hasattr(today_result, 'count') else len(today_result.data or [])

            return {'total': total, 'qualified': qualified, 'today': today_count}
        except Exception as e:
            logger.error("Failed to get stats", error=str(e))
            return {'total': 0, 'qualified': 0, 'today': 0}


# Global instance
supabase_service = SupabaseService()
