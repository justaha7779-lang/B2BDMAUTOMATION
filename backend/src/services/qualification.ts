import { config } from '../utils/config';

export interface TargetLocation {
  city: string;
  state: string;
  niche: string;
}

export interface QualifiedLead {
  id: string;
  company_name: string;
  phone: string;
  website: string;
  facebook_link: string;
  city: string;
  state: string;
  niche: string;
  dm_eligible: boolean;
  contact_form_present: boolean;
  has_live_chat_widget: boolean;
  messenger_button_active: boolean;
  qualification_score: number;
  disqualification_reason: string | null;
  customized_script: string;
  created_at: string;
  scan_session_id: string;
}

// Predefined business name patterns for different niches
const companyPrefixes = [
  'Premier', 'Elite', 'Pro', 'Expert', 'A-1', 'Top Tier', 'All-Star',
  'Reliable', 'Trusted', 'Quality', 'Master', 'Champion', 'Premier'
];

const companySuffixes = [
  'LLC', 'Inc.', 'Services', 'Solutions', 'Group', 'Company', 'Contractors', 'Pros'
];

/**
 * Simulates lead discovery for a target location and niche.
 * In production, this would integrate with:
 * - Google Places API
 * - Yelp Fusion API
 * - Yellow Pages scraping
 * - Local directory APIs
 */
export async function discoverLeadsForTarget(target: TargetLocation): Promise<QualifiedLead[]> {
  const sessionId = generateSessionId();

  // In production, replace with actual API calls
  const businesses = generateSimulatedBusinesses(target, sessionId);

  // Apply the 3-criteria qualification filter
  const qualified = businesses.filter(business => {
    return applyQualificationCriteria(business);
  });

  return qualified;
}

function generateSimulatedBusinesses(target: TargetLocation, sessionId: string): QualifiedLead[] {
  const count = Math.floor(Math.random() * 4) + 3; // 3-6 businesses per scan
  const businesses: QualifiedLead[] = [];

  for (let i = 0; i < count; i++) {
    const prefix = companyPrefixes[Math.floor(Math.random() * companyPrefixes.length)];
    const suffix = companySuffixes[Math.floor(Math.random() * companySuffixes.length)];
    const companyName = `${target.city} ${prefix} ${target.niche.split(' ')[0]} ${suffix}`.trim();

    // Random qualification criteria assignment
    const hasContactForm = Math.random() > 0.25; // 75% have contact forms
    const hasLiveChat = Math.random() > 0.7; // 30% have live chat (disqualifying)
    const hasMessenger = Math.random() > 0.3; // 70% have messenger

    // Calculate qualification score
    let score = 0;
    if (hasContactForm) score++;
    if (!hasLiveChat) score++;
    if (hasMessenger) score++;

    // Determine disqualification reason
    let disqualificationReason: string | null = null;
    if (!hasContactForm) {
      disqualificationReason = 'No contact form detected on website';
    } else if (hasLiveChat) {
      disqualificationReason = 'Live chat widget detected (Intercom/Drift/Booking portal)';
    } else if (!hasMessenger) {
      disqualificationReason = 'Facebook page does not support Messenger button';
    }

    const dmEligible = hasContactForm && !hasLiveChat && hasMessenger;

    businesses.push({
      id: `${sessionId}-${i}`,
      company_name: companyName,
      phone: generatePhoneNumber(),
      website: `https://www.${companyName.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')}.com`,
      facebook_link: `https://facebook.com/${companyName.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')}`,
      city: target.city,
      state: target.state,
      niche: target.niche,
      dm_eligible: dmEligible,
      contact_form_present: hasContactForm,
      has_live_chat_widget: hasLiveChat,
      messenger_button_active: hasMessenger,
      qualification_score: score,
      disqualification_reason: dmEligible ? null : disqualificationReason,
      customized_script: generateCustomizedScript(companyName),
      created_at: new Date().toISOString(),
      scan_session_id: sessionId,
    });
  }

  return businesses;
}

function applyQualificationCriteria(business: QualifiedLead): boolean {
  // All three criteria must pass:
  // 1. Contact form present
  // 2. No live chat widget
  // 3. Messenger button active
  return business.contact_form_present && !business.has_live_chat_widget && business.messenger_button_active;
}

function generatePhoneNumber(): string {
  const areaCode = Math.floor(Math.random() * 900) + 100;
  const exchange = Math.floor(Math.random() * 900) + 100;
  const subscriber = Math.floor(Math.random() * 9000) + 1000;
  return `(${areaCode}) ${exchange}-${subscriber}`;
}

function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateCustomizedScript(companyName: string): string {
  return `Hey, I noticed on your site that you take leads via your contact form, but if you're out on a job, it's easy to miss them before the client calls a competitor.

I actually custom-built this "Speed-to-Lead" dashboard specifically for your team at ${companyName} so you never lose another job to slow reply times: https://clientconnectportal.netlify.app/

I want to give you full access to it completely for free—all I ask for in return is a quick 30-second video testimonial if it helps you lock in your next client. Let me know if you're up for it!`;
}

export { config };
