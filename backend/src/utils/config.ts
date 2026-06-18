import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server Configuration
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Supabase Configuration
  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },

  // Google Sheets Webhook (Make/Zapier integration)
  googleSheetsWebhookUrl: process.env.GOOGLE_SHEETS_WEBHOOK_URL || '',

  // Scheduler Configuration
  scheduler: {
    // CRON pattern for main scanning loop (default: every 4 hours)
    scanInterval: process.env.SCAN_INTERVAL_CRON || '0 */4 * * *',
    // Enable/disable autonomous mode on startup
    autonomousMode: process.env.AUTONOMOUS_MODE === 'true',
  },

  // Lead Generation Targets
  targets: [
    { city: 'Atlanta', state: 'GA', niche: 'Roofing Contractors' },
    { city: 'Dallas', state: 'TX', niche: 'HVAC Specialists' },
    { city: 'Phoenix', state: 'AZ', niche: 'Solar Installers' },
    { city: 'Miami', state: 'FL', niche: 'Pool Contractors' },
    { city: 'Chicago', state: 'IL', niche: 'Plumbing Companies' },
    { city: 'Denver', state: 'CO', niche: 'Landscaping Services' },
    { city: 'Seattle', state: 'WA', niche: 'Electricians' },
    { city: 'Boston', state: 'MA', niche: 'Water Damage Restoration' },
  ],

  // Logging level
  logLevel: process.env.LOG_LEVEL || 'info',
};

export function validateConfig(): void {
  const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.warn(`Warning: Missing environment variables: ${missing.join(', ')}`);
    console.warn('Some features may be limited.');
  }
}
