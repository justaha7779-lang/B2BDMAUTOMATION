import fetch from 'node-fetch';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import { QualifiedLead } from './qualification';

class SheetsService {
  private webhookUrl: string;

  constructor() {
    this.webhookUrl = config.googleSheetsWebhookUrl;
  }

  async appendLead(lead: QualifiedLead): Promise<boolean> {
    if (!this.webhookUrl) {
      logger.debug('Google Sheets webhook not configured. Skipping export.');
      return false;
    }

    try {
      const payload = {
        companyName: lead.company_name,
        dmLink: lead.facebook_link,
        outreachScript: lead.customized_script,
        city: lead.city,
        state: lead.state,
        niche: lead.niche,
        qualificationScore: lead.qualification_score,
        status: 'Pending',
        timestamp: lead.created_at,
      };

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        logger.error(`Google Sheets webhook failed: ${response.status}`);
        return false;
      }

      logger.info(`Exported lead to Google Sheets: ${lead.company_name}`);
      return true;

    } catch (err) {
      logger.error('Google Sheets export error:', err);
      return false;
    }
  }

  async appendMultiple(leads: QualifiedLead[]): Promise<number> {
    let successCount = 0;

    for (const lead of leads) {
      const success = await this.appendLead(lead);
      if (success) successCount++;

      // Small delay between requests to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return successCount;
  }
}

export const sheetsService = new SheetsService();

export async function appendToGoogleSheets(lead: QualifiedLead): Promise<boolean> {
  return sheetsService.appendLead(lead);
}
