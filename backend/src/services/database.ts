import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import { QualifiedLead } from './qualification';

class DatabaseService {
  private client: SupabaseClient | null = null;

  constructor() {
    if (config.supabase.url && config.supabase.anonKey) {
      this.client = createClient(config.supabase.url, config.supabase.anonKey);
    } else {
      logger.warn('Supabase credentials not configured. Database operations will be skipped.');
    }
  }

  async saveLeads(leads: QualifiedLead[]): Promise<boolean> {
    if (!this.client) {
      logger.warn('Database not configured. Skipping lead storage.');
      return false;
    }

    if (leads.length === 0) {
      logger.info('No leads to save to database');
      return true;
    }

    try {
      const records = leads.map(lead => ({
        id: lead.id,
        company_name: lead.company_name,
        phone: lead.phone,
        website: lead.website,
        facebook_link: lead.facebook_link,
        city: lead.city,
        state: lead.state,
        niche: lead.niche,
        dm_eligible: lead.dm_eligible,
        contact_form_present: lead.contact_form_present,
        has_live_chat_widget: lead.has_live_chat_widget,
        messenger_button_active: lead.messenger_button_active,
        qualification_score: lead.qualification_score,
        disqualification_reason: lead.disqualification_reason,
        customized_script: lead.customized_script,
        scan_session_id: lead.scan_session_id,
        dm_pipeline_status: 'pending',
        created_at: lead.created_at,
        updated_at: lead.created_at,
      }));

      const { error } = await this.client
        .from('leads')
        .insert(records);

      if (error) {
        logger.error('Failed to save leads to database:', error);
        return false;
      }

      logger.info(`Saved ${leads.length} leads to database`);
      return true;

    } catch (err) {
      logger.error('Database error:', err);
      return false;
    }
  }

  async updateLeadStatus(id: string, status: string): Promise<boolean> {
    if (!this.client) return false;

    try {
      const { error } = await this.client
        .from('leads')
        .update({ dm_pipeline_status: status, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        logger.error(`Failed to update lead ${id}:`, error);
        return false;
      }

      return true;
    } catch (err) {
      logger.error('Database update error:', err);
      return false;
    }
  }

  async getRecentLeads(limit: number = 100): Promise<QualifiedLead[]> {
    if (!this.client) return [];

    try {
      const { data, error } = await this.client
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Failed to fetch leads:', error);
        return [];
      }

      return data || [];
    } catch (err) {
      logger.error('Database fetch error:', err);
      return [];
    }
  }

  async getStats(): Promise<{
    totalLeads: number;
    qualifiedLeads: number;
    todayLeads: number;
  }> {
    if (!this.client) {
      return { totalLeads: 0, qualifiedLeads: 0, todayLeads: 0 };
    }

    try {
      const today = new Date().toISOString().split('T')[0];

      const { count: totalLeads } = await this.client
        .from('leads')
        .select('*', { count: 'exact', head: true });

      const { count: qualifiedLeads } = await this.client
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('dm_eligible', true);

      const { count: todayLeads } = await this.client
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today);

      return {
        totalLeads: totalLeads || 0,
        qualifiedLeads: qualifiedLeads || 0,
        todayLeads: todayLeads || 0,
      };
    } catch (err) {
      logger.error('Database stats error:', err);
      return { totalLeads: 0, qualifiedLeads: 0, todayLeads: 0 };
    }
  }
}

export const databaseService = new DatabaseService();

export async function saveLeadsToDatabase(leads: QualifiedLead[]): Promise<boolean> {
  return databaseService.saveLeads(leads);
}

export async function updateLeadStatus(id: string, status: string): Promise<boolean> {
  return databaseService.updateLeadStatus(id, status);
}
