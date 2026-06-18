import { Cpu, Globe, Shield, CheckCircle2 } from 'lucide-react';

interface Props {
  isVisible: boolean;
  status: string;
  progress: number;
}

export default function ScanProgressPanel({ isVisible, status, progress }: Props) {
  if (!isVisible) return null;

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl border border-slate-700/50 p-6 shadow-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20 animate-pulse">
          <Cpu className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white">AI Agent Status</h2>
          <p className="text-sm text-slate-400">Real-time automation progress</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg px-3 py-2.5">
            <Globe className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-slate-300">Proxy Active</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg px-3 py-2.5">
            <Shield className="w-4 h-4 text-green-400" />
            <span className="text-xs text-slate-300">Stealth Mode</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg px-3 py-2.5">
            <Cpu className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-slate-300">AI Verifier</span>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/30">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-300">{status}</span>
            <span className="text-sm font-medium text-emerald-400">{progress}%</span>
          </div>
          <div className="h-2.5 bg-slate-700/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="flex items-start gap-2 text-xs text-slate-500">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
          <span className="text-slate-400">
            Browser automation running in isolated sandbox environment
          </span>
        </div>
      </div>
    </div>
  );
}
