import { useState } from 'react';
import { Search, MapPin, Briefcase, Loader2, Zap, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Lead } from '../types/lead';

interface Props {
  onScanComplete: (leads: Lead[]) => void;
  onScanStart: () => void;
  onScanProgress: (status: string, progress: number) => void;
  isScanning: boolean;
}

interface BusinessData {
  name: string;
  hasContactForm: boolean;
  hasLiveChat: boolean;
  hasMessengerButton: boolean;
}

export default function AutomationTargetPanel({
  onScanComplete,
  onScanStart,
  onScanProgress,
  isScanning,
}: Props) {
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [niche, setNiche] = useState('Plumbers');

  const simulateDeepScan = async () => {
    if (!city.trim() || !state.trim()) return;

    onScanStart();
    onScanProgress('Initializing browser automation module...', 5);

    // Simulate the scraping phases
    await delay(800);
    onScanProgress('Connecting to residential proxy network...', 15);

    await delay(600);
    onScanProgress(`Scanning ${city}, ${state} for ${niche.toLowerCase()}...`, 25);

    await delay(1000);
    onScanProgress('Crawling public business directories...', 40);

    await delay(800);
    onScanProgress('Extracting company data and contact information...', 55);

    await delay(600);
    onScanProgress('Discovering Facebook profile links...', 70);

    // Generate simulated leads based on location/niche
    const simulatedLeads = generateSimulatedLeads(city, state, niche);

    await delay(500);
    onScanProgress('Launching AI verification sub-agent...', 75);

    // Phase 1: Contact Form Detection
    await delay(800);
    onScanProgress('Phase 1/3: Scanning websites for contact form presence...', 80);

    // Phase 2: Live Chat Detection
    await delay(600);
    onScanProgress('Phase 2/3: Detecting live chat widgets (Intercom, Drift, booking portals)...', 85);

    // Phase 3: Messenger Button Verification
    await delay(500);
    onScanProgress('Phase 3/3: Verifying Facebook Messenger button framework...', 92);

    await delay(400);
    onScanProgress('Applying 3-criteria qualification filter...', 96);

    // Apply the 3-criteria filter
    const qualifiedLeads = simulatedLeads.filter(lead => {
      // All three criteria must be met:
      // 1. Contact form present
      // 2. No live chat widget
      // 3. Messenger button active
      return lead.contact_form_present && !lead.has_live_chat_widget && lead.messenger_button_active;
    });

    await delay(300);
    const disqualifiedCount = simulatedLeads.length - qualifiedLeads.length;
    onScanProgress(`Scan complete. ${qualifiedLeads.length} qualified, ${disqualifiedCount} filtered out.`, 100);

    // Insert into database
    const { error } = await supabase.from('leads').insert(
      qualifiedLeads.map(lead => ({
        ...lead,
        customized_script: generateCustomScript(lead.company_name),
      }))
    );

    if (error) {
      console.error('Failed to insert leads:', error);
    }

    setTimeout(() => {
      onScanComplete(qualifiedLeads);
    }, 500);
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl border border-slate-700/50 p-6 shadow-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg shadow-emerald-500/20">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white">Automation Target Panel</h2>
          <p className="text-sm text-slate-400">Configure and launch deep scan operations</p>
        </div>
      </div>

      {/* Qualification Criteria Info */}
      <div className="mb-6 bg-slate-800/50 rounded-xl p-4 border border-slate-700/30">
        <div className="text-xs font-medium text-slate-300 uppercase tracking-wider mb-3">
          3-Criteria Qualification Filter
        </div>
        <div className="space-y-2.5">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <span className="text-white font-medium">Contact Form Present</span>
              <span className="text-slate-400 block">Website must have a contact form or email submission field</span>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <span className="text-white font-medium">No Instant Live Chat</span>
              <span className="text-slate-400 block">Discard if Intercom, Drift, or booking portals detected</span>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <span className="text-white font-medium">Active Messenger Layout</span>
              <span className="text-slate-400 block">Facebook page must support direct message button</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              <MapPin className="w-4 h-4 inline mr-1.5 text-slate-400" />
              City
            </label>
            <input
              type="text"
              value={city}
              onChange={e => setCity(e.target.value)}
              placeholder="e.g., Austin"
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
              disabled={isScanning}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              State
            </label>
            <input
              type="text"
              value={state}
              onChange={e => setState(e.target.value)}
              placeholder="e.g., TX"
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
              disabled={isScanning}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            <Briefcase className="w-4 h-4 inline mr-1.5 text-slate-400" />
            Niche Sector
          </label>
          <select
            value={niche}
            onChange={e => setNiche(e.target.value)}
            className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all appearance-none cursor-pointer"
            disabled={isScanning}
          >
            {['Plumbers', 'Electricians', 'HVAC Contractors', 'Roofers', 'Landscapers', 'Painters', 'Handymen', 'Pest Control', 'Cleaning Services', 'Moving Companies', 'Garage Door Services', 'Water Damage Restoration'].map(
              n => (
                <option key={n} value={n}>
                  {n}
                </option>
              )
            )}
          </select>
        </div>

        <button
          onClick={simulateDeepScan}
          disabled={isScanning || !city.trim() || !state.trim()}
          className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:from-slate-600 disabled:to-slate-700 text-white font-semibold rounded-xl transition-all duration-300 flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/25 disabled:shadow-none disabled:cursor-not-allowed"
        >
          {isScanning ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Scanning in Progress...</span>
            </>
          ) : (
            <>
              <Search className="w-5 h-5" />
              <span>Run Deep Scan</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function generateSimulatedLeads(city: string, state: string, niche: string): Lead[] {
  const businessTemplates: BusinessData[] = [
    { name: `${city} Premier ${niche}`, hasContactForm: true, hasLiveChat: false, hasMessengerButton: true },
    { name: `Elite ${niche.replace(/s$/, '')} Solutions ${state}`, hasContactForm: true, hasLiveChat: true, hasMessengerButton: true }, // Disqualified: has live chat
    { name: `${city} Pro ${niche} LLC`, hasContactForm: true, hasLiveChat: false, hasMessengerButton: true },
    { name: `Quick Fix ${niche.replace(/s$/, '')} ${state}`, hasContactForm: false, hasLiveChat: false, hasMessengerButton: true }, // Disqualified: no contact form
    { name: `${city} Family ${niche}`, hasContactForm: true, hasLiveChat: false, hasMessengerButton: true },
    { name: `24/7 ${niche.replace(/s$/, '')} Pros`, hasContactForm: true, hasLiveChat: true, hasMessengerButton: true }, // Disqualified: has live chat (Intercom detected)
    { name: `${state} ${niche} Masters`, hasContactForm: true, hasLiveChat: false, hasMessengerButton: false }, // Disqualified: no messenger button
    { name: `${city} Emergency ${niche}`, hasContactForm: true, hasLiveChat: false, hasMessengerButton: true },
    { name: `Reliable ${niche.replace(/s$/, '')} Services`, hasContactForm: true, hasLiveChat: true, hasMessengerButton: true }, // Disqualified: has Drift chat widget
    { name: `${city} Top Tier ${niche}`, hasContactForm: false, hasLiveChat: false, hasMessengerButton: true }, // Disqualified: booking portal detected
    { name: `All-Star ${niche} ${state}`, hasContactForm: true, hasLiveChat: false, hasMessengerButton: true },
    { name: `${city} Rapid Response ${niche}`, hasContactForm: true, hasLiveChat: true, hasMessengerButton: true }, // Disqualified: has Calendly booking
  ];

  return businessTemplates.map((template, index) => {
    const phone = `(${Math.floor(Math.random() * 900) + 100}) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9009) + 1000}`;
    const cleanCity = city.toLowerCase().replace(/\s+/g, '-');
    const cleanName = template.name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
    const hasFb = template.hasMessengerButton;

    // Calculate qualification score (3 criteria)
    let score = 0;
    if (template.hasContactForm) score++;
    if (!template.hasLiveChat) score++;
    if (template.hasMessengerButton) score++;

    // Determine disqualification reason
    let disqualificationReason: string | null = null;
    if (!template.hasContactForm) {
      disqualificationReason = 'No contact form detected on website';
    } else if (template.hasLiveChat) {
      disqualificationReason = 'Live chat widget detected (Intercom/Drift/Booking portal)';
    } else if (!template.hasMessengerButton) {
      disqualificationReason = 'Facebook page does not support Messenger button';
    }

    // All three criteria must pass for DM eligibility
    const dmEligible = template.hasContactForm && !template.hasLiveChat && template.hasMessengerButton;

    return {
      id: `sim-${Date.now()}-${index}`,
      company_name: template.name,
      phone,
      website: `https://www.${cleanName}.com`,
      facebook_link: hasFb ? `https://facebook.com/${cleanName}${cleanCity}` : null,
      city,
      state,
      niche,
      dm_eligible: dmEligible,
      dm_pipeline_status: 'pending',
      customized_script: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      scan_session_id: crypto.randomUUID(),
      contact_form_present: template.hasContactForm,
      has_live_chat_widget: template.hasLiveChat,
      messenger_button_active: template.hasMessengerButton,
      qualification_score: score,
      disqualification_reason: disqualificationReason,
    } as Lead;
  });
}

function generateCustomScript(companyName: string): string {
  return `Hey, I noticed on your site that you take leads via your contact form, but if you're out on a job, it's easy to miss them before the client calls a competitor.

I actually custom-built this "Speed-to-Lead" dashboard specifically for your team at ${companyName} so you never lose another job to slow reply times: (Paste your Bolt.new app preview URL here)

I want to give you full access to it completely for free—all I ask for in return is a quick 30-second video testimonial if it helps you lock in your next client. Let me know if you're up for it!`;
}
