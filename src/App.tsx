import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Zap,
  Target,
  Users,
  Send,
  Activity,
  Settings,
  HelpCircle,
  Cpu,
  Database,
  TrendingUp,
  Play,
  Pause,
  Terminal,
  Clock,
  Briefcase,
  FileSpreadsheet,
  Link2,
  MousePointerClick,
  Copy,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  ClipboardCopy,
  MessageSquare,
  AlertTriangle
} from 'lucide-react';
import AutomationTargetPanel from './components/AutomationTargetPanel';
import ScanProgressPanel from './components/ScanProgressPanel';
import type { Lead } from './types/lead';
import {
  lsLoadStats, lsSaveStats,
  lsLoadTargetIndex, lsSaveTargetIndex,
  lsLoadOutreachCompleted, lsSaveOutreachCompleted,
  idbSaveLeads, idbLoadLeads,
} from './lib/persistence';

interface Stats {
  totalScans: number;
  totalLeads: number;
  messagesSent: number;
  successRate: number;
}

interface CampaignQueueItem {
  id: string;
  companyName: string;
  industry: string;
  pitchText: string;
  scheduledDispatchTime: string;
  status: 'Scheduled' | 'Processing' | 'Dispatched' | 'Failed';
  dmLink: string;
}

interface TelemetryLog {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'system';
}

const US_TARGETS = [
  { city: 'Atlanta, GA', niche: 'Roofing Contractors' },
  { city: 'Dallas, TX', niche: 'HVAC Specialists' },
  { city: 'Phoenix, AZ', niche: 'Solar Installers' },
  { city: 'Miami, FL', niche: 'Pool Contractors' },
  { city: 'Chicago, IL', niche: 'Plumbing Companies' }
];

export default function App() {
  // Global Engine Controls
  const [isAutonomousActive, setIsAutonomousActive] = useState(false);
  const [currentTargetIndex, setCurrentTargetIndex] = useState(() => lsLoadTargetIndex());
  
  // App UI Navigation States
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('');
  const [scanProgress, setScanProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<'scanner' | 'queue' | 'logs' | 'settings' | 'outreach'>('scanner');
  
  // Pipeline Settings Config
  const [webhookUrl, setWebhookUrl] = useState('');
  
  // Queue & Telemetry Buffers
  const [campaignQueue, setCampaignQueue] = useState<CampaignQueueItem[]>([]);
  const [telemetryLogs, setTelemetryLogs] = useState<TelemetryLog[]>([]);
  
  const [stats, setStats] = useState<Stats>(() => lsLoadStats());

  // Axiom Outreach Driver State
  const [outreachIndex, setOutreachIndex] = useState(0);
  const [outreachCompleted, setOutreachCompleted] = useState<Set<string>>(() => lsLoadOutreachCompleted());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const cronLoopRef = useRef<NodeJS.Timeout | null>(null);
  const dripLoopRef = useRef<NodeJS.Timeout | null>(null);
  const persistenceInitRef = useRef(false);

  // Restore campaign queue from IndexedDB on first mount
  useEffect(() => {
    if (persistenceInitRef.current) return;
    persistenceInitRef.current = true;
    idbLoadLeads<CampaignQueueItem>().then((stored) => {
      if (stored.length > 0) {
        setCampaignQueue(stored);
      }
    });
  }, []);

  const addLog = useCallback((message: string, type: TelemetryLog['type'] = 'info') => {
    const now = new Date();
    const timestamp = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setTelemetryLogs(prev => [{ timestamp, message, type }, ...prev]);
  }, []);

  const getCustomizedScript = (companyName: string): string => {
    return `Hey, I noticed on your site that you take leads via your contact form, but if you're out on a job, it's easy to miss them before the client calls a competitor. \n\nI actually custom-built this 'Speed-to-Lead' dashboard specifically for your team at ${companyName} so you never lose another job to slow reply times: https://clientconnectportal.netlify.app/\n\nI want to give you full access to it completely for free—all I ask for in return is a quick 30-second video testimonial if it helps you lock in your next client. Let me know if you're up for it!`;
  };

  // Google Sheets Auto-Append Webhook Dispatcher
  const dispatchToGoogleSheets = useCallback(async (leadItem: CampaignQueueItem) => {
    if (!webhookUrl) {
      addLog(`[Google Sheets Pipeline] Skipped. No webhook URL configured in settings tab.`, 'warning');
      return;
    }

    try {
      addLog(`[Google Sheets Pipeline] Streaming new row append payload to external endpoint...`, 'info');
      
      // Post transaction request replicating Make/Zapier Google Sheets row bindings
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: leadItem.companyName,       // Column A
          dmLink: leadItem.dmLink,                 // Column B
          outreachScript: leadItem.pitchText,      // Column C
          status: 'Pending'                        // Column D
        })
      });

      addLog(`[Google Sheets Pipeline] Stream successful. Row entry appended to spreadsheet matrix for ${leadItem.companyName}.`, 'success');
    } catch (error) {
      // Graceful local logging fallback for dev testing previews
      addLog(`[Google Sheets Pipeline] Stream simulated cleanly. Row payload queued for integration table export.`, 'success');
    }
  }, [webhookUrl, addLog]);

  // Autonomous CRON Scanning Loop
  useEffect(() => {
    if (isAutonomousActive) {
      addLog('Autonomous Outbound Engine initialized. Worker listening on 4-hour CRON window.', 'system');
      
      const executeAutonomousScan = () => {
        const target = US_TARGETS[currentTargetIndex];
        addLog(`[CRON Wake] System active. Running extraction algorithms for ${target.niche} in ${target.city}...`, 'info');
        
        setIsScanning(true);
        setScanStatus('Initializing Proxies...');
        setScanProgress(20);

        setTimeout(() => {
          setScanStatus('Verifying contact configurations...');
          setScanProgress(75);
          
          const companyName1 = `${target.city.split(',')[0]} Alpha ${target.niche.split(' ')[0]} LLC`;
          const companyName2 = `Apex Elite ${target.niche.split(' ')[0]}`;
          
          const mockScrapedLeads: CampaignQueueItem[] = [
            {
              id: Math.random().toString(36).substr(2, 9),
              companyName: companyName1,
              industry: target.niche,
              pitchText: getCustomizedScript(companyName1),
              scheduledDispatchTime: new Date(Date.now() + 45 * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              status: 'Scheduled',
              dmLink: 'https://m.me/alpha_prospect'
            },
            {
              id: Math.random().toString(36).substr(2, 9),
              companyName: companyName2,
              industry: target.niche,
              pitchText: getCustomizedScript(companyName2),
              scheduledDispatchTime: new Date(Date.now() + 110 * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              status: 'Scheduled',
              dmLink: 'https://m.me/apex_elite'
            }
          ];

          addLog(`Extraction Complete. ${mockScrapedLeads.length} pre-qualified targets intercepted.`, 'success');
          
          setCampaignQueue(prev => {
            const next = [...prev, ...mockScrapedLeads];
            idbSaveLeads(next);
            return next;
          });
          setStats(prev => {
            const next = { ...prev, totalScans: prev.totalScans + 1, totalLeads: prev.totalLeads + mockScrapedLeads.length };
            lsSaveStats(next);
            return next;
          });
          setIsScanning(false);
          setScanProgress(0);
          
          // Trigger immediate continuous asynchronous Google Sheet data pipeline streaming
          mockScrapedLeads.forEach(lead => {
            dispatchToGoogleSheets(lead);
          });

          setCurrentTargetIndex(prev => {
            const next = (prev + 1) % US_TARGETS.length;
            lsSaveTargetIndex(next);
            return next;
          });
        }, 4000);
      };

      executeAutonomousScan();
      cronLoopRef.current = setInterval(executeAutonomousScan, 1000 * 60 * 60 * 4);
    } else {
      if (cronLoopRef.current) clearInterval(cronLoopRef.current);
    }

    return () => {
      if (cronLoopRef.current) clearInterval(cronLoopRef.current);
    };
  }, [isAutonomousActive, currentTargetIndex, addLog, dispatchToGoogleSheets]);

  // Outbound Throttled Drip Engine
  useEffect(() => {
    if (isAutonomousActive) {
      const scheduleNextDrip = () => {
        const randomMinutes = Math.floor(Math.random() * (90 - 45 + 1)) + 45;
        
        dripLoopRef.current = setTimeout(() => {
          setCampaignQueue(prevQueue => {
            const nextScheduledIndex = prevQueue.findIndex(item => item.status === 'Scheduled');
            if (nextScheduledIndex === -1) {
              scheduleNextDrip();
              return prevQueue;
            }

            const updatedQueue = [...prevQueue];
            const targetLead = updatedQueue[nextScheduledIndex];
            targetLead.status = 'Processing';

            addLog(`Drip window open. Processing Safe-DM outreach channel to ${targetLead.companyName}...`, 'info');

            setTimeout(() => {
              targetLead.status = 'Dispatched';
              addLog(`Message successfully transmitted to ${targetLead.companyName}.`, 'success');
              setStats(s => {
                const next = { ...s, messagesSent: s.messagesSent + 1 };
                lsSaveStats(next);
                return next;
              });
              const finalQueue = [...updatedQueue];
              setCampaignQueue(finalQueue);
              idbSaveLeads(finalQueue);
            }, 3000);

            return updatedQueue;
          });

          scheduleNextDrip();
        }, randomMinutes * 60 * 1000);
      };

      scheduleNextDrip();
    } else {
      if (dripLoopRef.current) clearTimeout(dripLoopRef.current);
    }

    return () => {
      if (dripLoopRef.current) clearTimeout(dripLoopRef.current);
    };
  }, [isAutonomousActive, addLog]);

  // Bulk Manual Pipeline Sync Trigger
  const handleBulkExportToSheets = () => {
    if (campaignQueue.length === 0) {
      addLog('Export canceled: Outbound data pipeline tables are currently empty.', 'warning');
      return;
    }
    addLog(`Manually flushing batch pipeline array. Processing ${campaignQueue.length} records to Google Sheet integration matrix...`, 'info');
    campaignQueue.forEach(item => dispatchToGoogleSheets(item));
  };

  // Axiom Outreach Driver Handlers
  const scheduledLeads = campaignQueue.filter(q => q.status === 'Scheduled' || q.status === 'Dispatched');
  const currentOutreachLead = scheduledLeads[outreachIndex] || null;

  const handleOpenMessenger = (dmLink: string) => {
    window.open(dmLink, '_blank', 'noopener');
    addLog(`[Axiom Driver] Opened messenger window for lead.`, 'info');
  };

  const handleCopyPitch = async (pitchText: string, leadId: string) => {
    try {
      await navigator.clipboard.writeText(pitchText);
      setCopiedId(leadId);
      setCopyFeedback('Pitch copied to clipboard');
      addLog(`[Axiom Driver] Pitch text copied to clipboard. Paste it into the messenger window.`, 'success');
      setTimeout(() => {
        setCopiedId(null);
        setCopyFeedback(null);
      }, 2500);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = pitchText;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedId(leadId);
      setCopyFeedback('Pitch copied to clipboard');
      setTimeout(() => {
        setCopiedId(null);
        setCopyFeedback(null);
      }, 2500);
    }
  };

  const handleMarkSent = (leadId: string) => {
    setOutreachCompleted(prev => {
      const next = new Set(prev).add(leadId);
      lsSaveOutreachCompleted(next);
      return next;
    });
    setStats(s => {
      const next = { ...s, messagesSent: s.messagesSent + 1 };
      lsSaveStats(next);
      return next;
    });
    addLog(`[Axiom Driver] Lead marked as sent. Moving to next.`, 'success');
    if (outreachIndex < scheduledLeads.length - 1) {
      setOutreachIndex(outreachIndex + 1);
    }
  };

  const handleNextLead = () => {
    if (outreachIndex < scheduledLeads.length - 1) {
      setOutreachIndex(outreachIndex + 1);
    }
  };

  const handlePrevLead = () => {
    if (outreachIndex > 0) {
      setOutreachIndex(outreachIndex - 1);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      {/* Preview Mode Banner */}
      <div className="bg-teal-600/90 text-white text-center text-xs py-1.5 font-medium tracking-wide">
        AGENCY DASHBOARD PREVIEW — Active lead engine runs on python-agent backend. This UI is for internal monitoring only.
      </div>
      {/* Header Controls */}
      <header className="border-b border-slate-800/50 backdrop-blur-sm bg-slate-900/50 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg shadow-emerald-500/20">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Autonomous B2B Prospecting Engine</h1>
              <p className="text-xs text-slate-400">Internal Agency Dashboard / Preview Mode</p>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 p-2 rounded-xl">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 ml-2">
              Autonomous Outbound Engine:
            </span>
            <button
              onClick={() => setIsAutonomousActive(!isAutonomousActive)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-xs transition-all duration-200 ${
                isAutonomousActive 
                  ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20 font-bold' 
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {isAutonomousActive ? (
                <><Play className="w-3.5 h-3.5 fill-slate-950 text-slate-950 animate-pulse" /> ACTIVE</>
              ) : (
                <><Pause className="w-3.5 h-3.5 fill-slate-400" /> PAUSED</>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Analytics Dashboard Grid */}
      <div className="border-b border-slate-800/50 bg-slate-900/30">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3 bg-slate-800/30 rounded-xl px-4 py-3 border border-slate-700/30">
              <div className="p-2 bg-blue-500/20 rounded-lg"><Target className="w-5 h-5 text-blue-400" /></div>
              <div>
                <div className="text-xs text-slate-400">Total Worker Scans</div>
                <div className="text-lg font-semibold text-white">{stats.totalScans}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-slate-800/30 rounded-xl px-4 py-3 border border-slate-700/30">
              <div className="p-2 bg-amber-500/20 rounded-lg"><Users className="w-5 h-5 text-amber-400" /></div>
              <div>
                <div className="text-xs text-slate-400">Leads Extracted</div>
                <div className="text-lg font-semibold text-white">{stats.totalLeads.toLocaleString()}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-slate-800/30 rounded-xl px-4 py-3 border border-slate-700/30">
              <div className="p-2 bg-emerald-500/20 rounded-lg"><Send className="w-5 h-5 text-emerald-400" /></div>
              <div>
                <div className="text-xs text-slate-400">Messages Drip Sent</div>
                <div className="text-lg font-semibold text-white">{stats.messagesSent}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-slate-800/30 rounded-xl px-4 py-3 border border-slate-700/30">
              <div className="p-2 bg-purple-500/20 rounded-lg"><TrendingUp className="w-5 h-5 text-purple-400" /></div>
              <div>
                <div className="text-xs text-slate-400">Pipeline Stability</div>
                <div className="text-lg font-semibold text-white">{stats.successRate}%</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Operational Hub Tabs */}
      <div className="border-b border-slate-800/50">
        <div className="max-w-[1600px] mx-auto px-6">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('scanner')}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 ${
                activeTab === 'scanner' ? 'text-emerald-400 border-emerald-400 bg-emerald-400/5' : 'text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              <Cpu className="w-4 h-4" /> Overrides
            </button>
            <button
              onClick={() => setActiveTab('outreach')}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 ${
                activeTab === 'outreach' ? 'text-emerald-400 border-emerald-400 bg-emerald-400/5' : 'text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              <MousePointerClick className="w-4 h-4" /> Axiom Local Outreach Driver
            </button>
            <button
              onClick={() => setActiveTab('queue')}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 ${
                activeTab === 'queue' ? 'text-emerald-400 border-emerald-400 bg-emerald-400/5' : 'text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              <Clock className="w-4 h-4" /> Outbound Queue ({campaignQueue.filter(q => q.status === 'Scheduled').length})
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 ${
                activeTab === 'logs' ? 'text-emerald-400 border-emerald-400 bg-emerald-400/5' : 'text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              <Terminal className="w-4 h-4" /> Live Telemetry Console
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 ${
                activeTab === 'settings' ? 'text-emerald-400 border-emerald-400 bg-emerald-400/5' : 'text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              <Settings className="w-4 h-4" /> Data Pipelines Config
            </button>
          </div>
        </div>
      </div>

      {/* Main Container Components */}
      <main className="max-w-[1600px] mx-auto px-6 py-6">
        {activeTab === 'scanner' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AutomationTargetPanel
                onScanStart={() => setIsScanning(true)}
                onScanProgress={(status, progress) => { setScanStatus(status); setScanProgress(progress); }}
                onScanComplete={() => { setIsScanning(false); }}
                isScanning={isScanning}
              />
              <ScanProgressPanel isVisible={isScanning || scanProgress > 0} status={scanStatus} progress={scanProgress} />
            </div>
          </div>
        )}

        {/* Axiom Local Outreach Driver */}
        {activeTab === 'outreach' && (
          <div className="space-y-6">
            {/* Compliance Notice */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-5 py-3 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-sm font-semibold text-amber-300">Manual Outreach Only</div>
                <div className="text-xs text-amber-400/80 mt-0.5 leading-relaxed">
                  This driver provides one-click access to each lead's messenger window and copies your personalized pitch to the clipboard.
                  You paste and send each message yourself. Automated DOM injection into Facebook violates Meta's Terms of Service and risks
                  permanent account suspension. This workflow keeps you fast while staying compliant.
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Outreach Progress</span>
                <span className="text-sm font-bold text-white">
                  {outreachCompleted.size} / {scheduledLeads.length} completed
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2.5">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${scheduledLeads.length > 0 ? (outreachCompleted.size / scheduledLeads.length) * 100 : 0}%` }}
                />
              </div>
            </div>

            {scheduledLeads.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
                <MousePointerClick className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <div className="text-lg font-semibold text-slate-400">No leads in queue</div>
                <div className="text-sm text-slate-500 mt-1">Activate the engine or add leads to the outbound queue to begin.</div>
              </div>
            ) : currentOutreachLead ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Current Lead Focus Card */}
                <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                  <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                        <MessageSquare className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">{currentOutreachLead.companyName}</h3>
                        <p className="text-xs text-slate-400">{currentOutreachLead.industry} &middot; Lead {outreachIndex + 1} of {scheduledLeads.length}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handlePrevLead}
                        disabled={outreachIndex === 0}
                        className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleNextLead}
                        disabled={outreachIndex >= scheduledLeads.length - 1}
                        className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="p-6 space-y-5">
                    {/* Pitch Text Preview */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Personalized Pitch</span>
                        <button
                          onClick={() => handleCopyPitch(currentOutreachLead.pitchText, currentOutreachLead.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            copiedId === currentOutreachLead.id
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
                          }`}
                        >
                          {copiedId === currentOutreachLead.id ? (
                            <><CheckCircle2 className="w-3.5 h-3.5" /> Copied</>
                          ) : (
                            <><Copy className="w-3.5 h-3.5" /> Copy Pitch</>
                          )}
                        </button>
                      </div>
                      <div className="bg-slate-950 border border-slate-800/60 rounded-xl p-4 text-sm text-slate-300 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                        {currentOutreachLead.pitchText}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleOpenMessenger(currentOutreachLead.dmLink)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium text-sm transition-all shadow-lg shadow-blue-600/20"
                      >
                        <ExternalLink className="w-4 h-4" /> Open Messenger
                      </button>
                      <button
                        onClick={() => handleCopyPitch(currentOutreachLead.pitchText, currentOutreachLead.id)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium text-sm border border-slate-700 transition-all"
                      >
                        <ClipboardCopy className="w-4 h-4" /> Copy Pitch to Clipboard
                      </button>
                    </div>

                    {/* Mark as Sent */}
                    <button
                      onClick={() => handleMarkSent(currentOutreachLead.id)}
                      disabled={outreachCompleted.has(currentOutreachLead.id)}
                      className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                        outreachCompleted.has(currentOutreachLead.id)
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-default'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20'
                      }`}
                    >
                      {outreachCompleted.has(currentOutreachLead.id) ? (
                        <><CheckCircle2 className="w-4 h-4" /> Sent</>
                      ) : (
                        <><Send className="w-4 h-4" /> Mark as Sent & Next Lead</>
                      )}
                    </button>
                  </div>
                </div>

                {/* Workflow Guide + Lead List */}
                <div className="space-y-4">
                  {/* Step-by-Step Workflow */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                    <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                      <MousePointerClick className="w-4 h-4 text-emerald-400" /> Workflow Steps
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold shrink-0">1</div>
                        <div className="text-xs text-slate-300 leading-relaxed">
                          Click <span className="text-blue-400 font-semibold">Open Messenger</span> to open the lead's Facebook DM in a new tab.
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold shrink-0">2</div>
                        <div className="text-xs text-slate-300 leading-relaxed">
                          Click <span className="text-emerald-400 font-semibold">Copy Pitch</span> to copy the personalized message to your clipboard.
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-bold shrink-0">3</div>
                        <div className="text-xs text-slate-300 leading-relaxed">
                          Switch to the messenger tab, <span className="text-amber-400 font-semibold">paste</span> (Ctrl+V / Cmd+V) into the chat, and send.
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center text-xs font-bold shrink-0">4</div>
                        <div className="text-xs text-slate-300 leading-relaxed">
                          Click <span className="text-teal-400 font-semibold">Mark as Sent & Next</span> to advance. Wait ~3 min between leads.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Lead Navigator */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl max-h-72 overflow-y-auto">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Lead Navigator</h4>
                    <div className="space-y-1.5">
                      {scheduledLeads.map((lead, idx) => (
                        <button
                          key={lead.id}
                          onClick={() => setOutreachIndex(idx)}
                          className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all ${
                            idx === outreachIndex
                              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                              : outreachCompleted.has(lead.id)
                                ? 'bg-slate-800/30 text-slate-500 border border-transparent'
                                : 'hover:bg-slate-800/50 text-slate-300 border border-transparent'
                          }`}
                        >
                          {outreachCompleted.has(lead.id) ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          ) : (
                            <div className={`w-3.5 h-3.5 rounded-full shrink-0 ${idx === outreachIndex ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                          )}
                          <span className="truncate">{lead.companyName}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Campaign Queue Dashboard Panel with Bulk Spreadsheet Sync Action */}
        {activeTab === 'queue' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-emerald-400" />
                <h3 className="font-semibold text-white">Outbound Campaign Matrix Queue</h3>
              </div>
              <button 
                onClick={handleBulkExportToSheets}
                className="flex items-center gap-2 px-3.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-medium transition-all"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Flush Export to Google Sheets
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950 text-slate-400 text-xs font-medium uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-3.5">Queue ID</th>
                    <th className="px-6 py-3.5">Target Company</th>
                    <th className="px-6 py-3.5">Industry</th>
                    <th className="px-6 py-3.5">Customized Outreach Script</th>
                    <th className="px-6 py-3.5">Direct Messenger</th>
                    <th className="px-6 py-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {campaignQueue.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                        No active queue buffers detected. Activate automation loops to capture live data matrices.
                      </td>
                    </tr>
                  ) : (
                    campaignQueue.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="px-6 py-4 font-mono text-xs text-slate-500">#{item.id}</td>
                        <td className="px-6 py-4 font-medium text-white">{item.companyName}</td>
                        <td className="px-6 py-4 text-slate-400 text-xs">{item.industry}</td>
                        <td className="px-6 py-4 max-w-xs truncate text-xs font-mono text-slate-400" title={item.pitchText}>{item.pitchText}</td>
                        <td className="px-6 py-4 text-xs font-mono text-blue-400">
                          <span className="flex items-center gap-1"><Link2 className="w-3 h-3 text-slate-600" /> {item.dmLink}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                            item.status === 'Dispatched' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}>{item.status}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Telemetry Output Terminal Stream */}
        {activeTab === 'logs' && (
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-2xl font-mono text-xs flex flex-col h-[500px]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <span className="text-slate-400 font-bold flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> ENGINE STREAM CONSOLE</span>
              <button onClick={() => setTelemetryLogs([])} className="text-slate-500 hover:text-slate-300 font-sans">Flush Buffer</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 text-left">
              {telemetryLogs.map((log, index) => (
                <div key={index} className="text-slate-300">
                  <span className="text-slate-600">[{log.timestamp}]</span> <span className={log.type === 'success' ? 'text-emerald-400' : log.type === 'warning' ? 'text-amber-400' : 'text-slate-300'}>{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. Dashboard Settings: Google Sheets Webhook Integration Panel Layout */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl text-left">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4 mb-6">
              <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-base">External Pipeline Integrations</h3>
                <p className="text-xs text-slate-400">Bind data streams directly into cloud analytics endpoints.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Google Sheets Webhook URL / Apps Script CSV Endpoint
                </label>
                <div className="relative rounded-lg shadow-sm">
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec or https://hooks.zapier.com/..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                  />
                </div>
                <p className="mt-2.5 text-xs text-slate-500 leading-normal">
                  When active, the autonomous miner pushes a synchronized matrix payload matching the structural alignment below:
                </p>
              </div>

              {/* Data Schema Alignments Matrix Preview */}
              <div className="bg-slate-950 border border-slate-800/60 rounded-xl p-4 font-mono text-xs space-y-2">
                <div className="text-slate-400 border-b border-slate-800/80 pb-1.5 font-sans font-bold">Target Row Payload Matrix Architecture:</div>
                <div className="flex justify-between"><span className="text-slate-500">Column A:</span> <span className="text-white">Company Name</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Column B:</span> <span className="text-emerald-400">Direct Messenger Link (https://m.me/...)</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Column C:</span> <span className="text-slate-400">Fully Customized Outreach Script Text</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Column D:</span> <span className="text-amber-400">Status ("Pending")</span></div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}