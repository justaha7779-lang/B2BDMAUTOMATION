export type DMPipelineStatus = 'pending' | 'browser_active' | 'message_typed' | 'sent_successfully';

export interface LeadQualification {
  contact_form_present: boolean;
  has_live_chat_widget: boolean;
  messenger_button_active: boolean;
}

export interface Lead {
  id: string;
  company_name: string;
  phone: string | null;
  website: string | null;
  facebook_link: string | null;
  city: string;
  state: string;
  niche: string;
  dm_eligible: boolean;
  dm_pipeline_status: DMPipelineStatus;
  customized_script: string | null;
  created_at: string;
  updated_at: string;
  scan_session_id: string;
  // New qualification fields
  contact_form_present: boolean;
  has_live_chat_widget: boolean;
  messenger_button_active: boolean;
  qualification_score: number;
  disqualification_reason: string | null;
}

export interface ScanSession {
  id: string;
  city: string;
  state: string;
  niche: string;
  status: 'idle' | 'scraping' | 'verifying' | 'complete';
  leads_found: number;
  leads_qualified: number;
  progress: number;
}

export const MESSAGE_TEMPLATE = `Hey, I noticed on your site that you take leads via your contact form, but if you're out on a job, it's easy to miss them before the client calls a competitor.

I actually custom-built this "Speed-to-Lead" dashboard specifically for your team at (Put Business Name Here) so you never lose another job to slow reply times: (Paste your Bolt.new app preview URL here)

I want to give you full access to it completely for free—all I ask for in return is a quick 30-second video testimonial if it helps you lock in your next client. Let me know if you're up for it!`;

export const NICHES = [
  'Plumbers',
  'Electricians',
  'HVAC Contractors',
  'Roofers',
  'Landscapers',
  'Painters',
  'Handymen',
  'Pest Control',
  'Cleaning Services',
  'Moving Companies',
  'Garage Door Services',
  'Water Damage Restoration',
];
