import { useState } from 'react';
import {
  Building2,
  Phone,
  Globe,
  Facebook,
  MessageSquare,
  Copy,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Send,
  AlertCircle,
  FileText,
  MessageCircle,
} from 'lucide-react';
import type { Lead, DMPipelineStatus } from '../types/lead';

interface Props {
  leads: Lead[];
}

const statusConfig: Record<DMPipelineStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: 'Pending', color: 'text-slate-300', bgColor: 'bg-slate-600/50' },
  browser_active: { label: 'Browser Active', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  message_typed: { label: 'Message Typed', color: 'text-amber-400', bgColor: 'bg-amber-500/20' },
  sent_successfully: { label: 'Sent Successfully', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
};

export default function LeadsQueueTable({ leads: initialLeads }: Props) {
  const [leads, setLeads] = useState(initialLeads);
  const [expandedLead, setExpandedLead] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);

  const handleCopyScript = (lead: Lead) => {
    if (lead.customized_script) {
      navigator.clipboard.writeText(lead.customized_script);
      setCopiedId(lead.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleDispatch = async (leadId: string) => {
    setDispatchingId(leadId);

    // Simulate browser automation workflow
    await updateLeadStatus(leadId, 'browser_active');
    await delay(2000);
    await updateLeadStatus(leadId, 'message_typed');
    await delay(1500);
    await updateLeadStatus(leadId, 'sent_successfully');

    setDispatchingId(null);
  };

  const updateLeadStatus = async (leadId: string, status: DMPipelineStatus) => {
    setLeads(prev =>
      prev.map(lead => (lead.id === leadId ? { ...lead, dm_pipeline_status: status } : lead))
    );
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const qualifiedLeads = leads.filter(l => l.dm_eligible);

  if (leads.length === 0) {
    return (
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl border border-slate-700/50 p-8 text-center">
        <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
        <p className="text-slate-400">No qualified leads in the queue yet.</p>
        <p className="text-sm text-slate-500 mt-2">Run a deep scan to discover pre-qualified prospects.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Qualification Summary */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl border border-slate-700/50 p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-white mb-4">Qualification Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 bg-slate-800/50 rounded-xl px-4 py-3 border border-slate-700/30">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <FileText className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <div className="text-xs text-slate-400">Contact Forms</div>
              <div className="text-lg font-semibold text-white">
                {leads.filter(l => l.contact_form_present).length}/{leads.length}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-slate-800/50 rounded-xl px-4 py-3 border border-slate-700/30">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <MessageCircle className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <div className="text-xs text-slate-400">No Live Chat</div>
              <div className="text-lg font-semibold text-white">
                {leads.filter(l => !l.has_live_chat_widget).length}/{leads.length}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-slate-800/50 rounded-xl px-4 py-3 border border-slate-700/30">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <MessageSquare className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="text-xs text-slate-400">Messenger Ready</div>
              <div className="text-lg font-semibold text-white">
                {leads.filter(l => l.messenger_button_active).length}/{leads.length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl border border-slate-700/50 shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg shadow-amber-500/20">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Pre-Qualified Leads Queue</h2>
                <p className="text-sm text-slate-400">
                  {qualifiedLeads.length} leads passed all 3 qualification criteria
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="px-3 py-1.5 bg-emerald-500/20 rounded-lg text-emerald-400 border border-emerald-500/30">
                {leads.filter(l => l.dm_pipeline_status === 'sent_successfully').length} Sent
              </span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-800/30">
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Company
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Qualification Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  DM Pipeline Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {leads.map(lead => {
                const status = statusConfig[lead.dm_pipeline_status];
                const isExpanded = expandedLead === lead.id;
                const isDispatching = dispatchingId === lead.id;

                return (
                  <>
                    <tr
                      key={lead.id}
                      className={`hover:bg-slate-800/20 transition-colors cursor-pointer ${
                        !lead.dm_eligible ? 'opacity-60' : ''
                      }`}
                      onClick={() => setExpandedLead(isExpanded ? null : lead.id)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            lead.dm_eligible
                              ? 'bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30'
                              : 'bg-gradient-to-br from-slate-700 to-slate-600 border border-slate-600/50'
                          }`}>
                            <Building2 className={`w-5 h-5 ${lead.dm_eligible ? 'text-emerald-400' : 'text-slate-400'}`} />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-white">{lead.company_name}</div>
                            <div className="text-xs text-slate-400">
                              {lead.city}, {lead.state}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm text-slate-300">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            {lead.phone}
                          </div>
                          {lead.website && (
                            <a
                              href={lead.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
                              onClick={e => e.stopPropagation()}
                            >
                              <Globe className="w-3.5 h-3.5" />
                              Website
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          {lead.facebook_link && (
                            <a
                              href={lead.facebook_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
                              onClick={e => e.stopPropagation()}
                            >
                              <Facebook className="w-3.5 h-3.5" />
                              Facebook
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-2">
                          {/* Qualification Score Display */}
                          <div className="flex items-center gap-2">
                            <div className="flex gap-1">
                              {/* Criteria 1: Contact Form */}
                              <div
                                className={`px-1.5 py-0.5 rounded text-xs ${
                                  lead.contact_form_present
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : 'bg-red-500/20 text-red-400'
                                }`}
                                title="Contact Form"
                              >
                                <FileText className="w-3 h-3" />
                              </div>
                              {/* Criteria 2: No Live Chat */}
                              <div
                                className={`px-1.5 py-0.5 rounded text-xs ${
                                  !lead.has_live_chat_widget
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : 'bg-red-500/20 text-red-400'
                                }`}
                                title="No Live Chat"
                              >
                                <MessageCircle className="w-3 h-3" />
                              </div>
                              {/* Criteria 3: Messenger Button */}
                              <div
                                className={`px-1.5 py-0.5 rounded text-xs ${
                                  lead.messenger_button_active
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : 'bg-red-500/20 text-red-400'
                                }`}
                                title="Messenger Button"
                              >
                                <MessageSquare className="w-3 h-3" />
                              </div>
                            </div>
                            <span className={`text-xs font-medium ${
                              lead.qualification_score === 3 ? 'text-emerald-400' : 'text-slate-400'
                            }`}>
                              {lead.qualification_score}/3
                            </span>
                          </div>

                          {/* Disqualification Reason */}
                          {lead.disqualification_reason && (
                            <div className="flex items-center gap-1.5 text-xs text-amber-400">
                              <AlertCircle className="w-3 h-3" />
                              <span className="truncate max-w-[200px]">{lead.disqualification_reason}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium ${status.bgColor} ${status.color}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              handleCopyScript(lead);
                            }}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                            title="Copy Script"
                          >
                            {copiedId === lead.id ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                          {lead.dm_eligible && lead.dm_pipeline_status !== 'sent_successfully' && (
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                handleDispatch(lead.id);
                              }}
                              disabled={isDispatching}
                              className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:from-slate-600 disabled:to-slate-700 text-white text-sm font-medium rounded-lg transition-all"
                            >
                              {isDispatching ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>Dispatching...</span>
                                </>
                              ) : (
                                <>
                                  <Send className="w-3.5 h-3.5" />
                                  <span>Execute Safe Dispatch</span>
                                </>
                              )}
                            </button>
                          )}
                          {!lead.dm_eligible && (
                            <span className="text-xs text-slate-500 italic px-2 py-1">
                              Not qualified
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${lead.id}-expanded`} className="bg-slate-800/30">
                        <td colSpan={5} className="px-6 py-4">
                          <div className="space-y-4">
                            {/* Qualification Details */}
                            <div className="grid grid-cols-3 gap-4">
                              <div className="flex items-center gap-2">
                                {lead.contact_form_present ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-red-400" />
                                )}
                                <span className="text-sm text-slate-300">
                                  Contact Form: <span className={lead.contact_form_present ? 'text-emerald-400' : 'text-red-400'}>
                                    {lead.contact_form_present ? 'Detected' : 'Not Found'}
                                  </span>
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {!lead.has_live_chat_widget ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-red-400" />
                                )}
                                <span className="text-sm text-slate-300">
                                  Live Chat: <span className={!lead.has_live_chat_widget ? 'text-emerald-400' : 'text-red-400'}>
                                    {lead.has_live_chat_widget ? 'Detected (Disqualified)' : 'None Found'}
                                  </span>
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {lead.messenger_button_active ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-red-400" />
                                )}
                                <span className="text-sm text-slate-300">
                                  Messenger: <span className={lead.messenger_button_active ? 'text-emerald-400' : 'text-red-400'}>
                                    {lead.messenger_button_active ? 'Button Active' : 'Not Available'}
                                  </span>
                                </span>
                              </div>
                            </div>

                            {/* Customized Message Script */}
                            {lead.customized_script && (
                              <div className="space-y-2">
                                <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                                  Customized Message Script
                                </div>
                                <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/30">
                                  <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono">
                                    {lead.customized_script}
                                  </pre>
                                </div>
                              </div>
                            )}

                            <div className="flex items-center gap-4 text-xs text-slate-500">
                              <span>Niche: {lead.niche}</span>
                              <span>Session: {lead.scan_session_id?.slice(0, 8)}...</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
