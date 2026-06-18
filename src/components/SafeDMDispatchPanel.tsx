import { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Send,
  MousePointer,
  Keyboard,
  Clock,
  Shield,
  Monitor,
  CheckCircle2,
  Globe,
  Zap,
} from 'lucide-react';

interface SimulationStep {
  id: string;
  label: string;
  icon: React.ReactNode;
  duration: number;
  action: string;
}

const simulationSteps: SimulationStep[] = [
  { id: '1', label: 'Initialize', icon: <Play className="w-4 h-4" />, duration: 800, action: 'Launching headless browser instance...' },
  { id: '2', label: 'Connect Proxy', icon: <Globe className="w-4 h-4" />, duration: 600, action: 'Routing through residential proxy network...' },
  { id: '3', label: 'Navigate', icon: <Monitor className="w-4 h-4" />, duration: 1200, action: 'Opening Facebook Messenger window...' },
  { id: '4', label: 'Anti-Bot Delay', icon: <Clock className="w-4 h-4" />, duration: 3000, action: 'Randomized 3s pause to bypass bot filters...' },
  { id: '5', label: 'Type Message', icon: <Keyboard className="w-4 h-4" />, duration: 2500, action: 'Simulating human keystroke patterns...' },
  { id: '6', label: 'Verify', icon: <Shield className="w-4 h-4" />, duration: 500, action: 'Verifying message content integrity...' },
  { id: '7', label: 'Send', icon: <Send className="w-4 h-4" />, duration: 400, action: 'Executing safe message dispatch...' },
  { id: '8', label: 'Complete', icon: <CheckCircle2 className="w-4 h-4" />, duration: 300, action: 'Message sent successfully!' },
];

interface Props {
  isRunning: boolean;
  companyName: string;
  script: string;
  onComplete: () => void;
}

export default function SafeDMDispatchPanel({ isRunning, companyName, script, onComplete }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [typedText, setTypedText] = useState('');
  const [typingProgress, setTypingProgress] = useState(0);
  const [browserVisual, setBrowserVisual] = useState({
    url: '',
    pageTitle: '',
    messageBox: true,
    showTyping: false,
    messageSent: false,
  });
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const stepRef = useRef(0);

  useEffect(() => {
    if (isRunning && !isPaused) {
      runSimulation();
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, isPaused]);

  const runSimulation = async () => {
    stepRef.current = 0;
    setTypedText('');
    setTypingProgress(0);
    setBrowserVisual({
      url: `https://facebook.com/messages/t/${companyName.toLowerCase().replace(/\s+/g, '')}`,
      pageTitle: `Messenger - ${companyName}`,
      messageBox: true,
      showTyping: false,
      messageSent: false,
    });

    for (let i = 0; i < simulationSteps.length; i++) {
      if (!isRunning) break;
      setCurrentStep(i);

      const step = simulationSteps[i];

      // Simulate typing animation for step 5
      if (step.id === '5') {
        setBrowserVisual(prev => ({ ...prev, showTyping: true }));
        const chars = script.split('');
        for (let j = 0; j < chars.length; j++) {
          await delay(15);
          setTypedText(prev => prev + chars[j]);
          setTypingProgress(((j + 1) / chars.length) * 100);
        }
      } else if (step.id === '8') {
        setBrowserVisual(prev => ({ ...prev, showTyping: false, messageSent: true }));
      } else {
        await delay(step.duration);
      }
    }

    setCurrentStep(simulationSteps.length);
    onComplete();
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl border border-slate-700/50 p-6 shadow-2xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-lg shadow-purple-500/20">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Safe-DM Dispatch Agent</h2>
            <p className="text-sm text-slate-400">Browser automation with human emulation</p>
          </div>
        </div>
        <button
          onClick={() => setIsPaused(!isPaused)}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
        >
          {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Browser Simulation Window */}
        <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700/50">
          <div className="flex items-center gap-2 px-4 py-3 bg-slate-900/50 border-b border-slate-700/50">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/70" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
              <div className="w-3 h-3 rounded-full bg-green-500/70" />
            </div>
            <div className="flex-1 mx-4">
              <div className="bg-slate-800 rounded-md px-3 py-1.5 text-xs text-slate-400 truncate">
                {browserVisual.url || 'about:blank'}
              </div>
            </div>
          </div>
          <div className="p-4 min-h-[200px]">
            <div className="text-center mb-4">
              <div className="text-sm font-medium text-white mb-1">{browserVisual.pageTitle}</div>
            </div>
            {browserVisual.messageBox && (
              <div className="space-y-3">
                <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
                  <div className="text-xs text-slate-500 mb-2">Message Input</div>
                  <div className="min-h-[80px] text-sm text-slate-300 whitespace-pre-wrap">
                    {typedText}
                    {browserVisual.showTyping && (
                      <span className="inline-block w-2 h-4 bg-emerald-400 ml-0.5 animate-pulse" />
                    )}
                  </div>
                </div>
                {browserVisual.messageSent && (
                  <div className="flex items-center gap-2 text-emerald-400 text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    Message delivered successfully!
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Steps Progress */}
        <div className="space-y-2">
          {simulationSteps.map((step, index) => {
            const isActive = currentStep === index;
            const isCompleted = currentStep > index;
            const isUpcoming = currentStep < index;

            return (
              <div
                key={step.id}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive
                    ? 'bg-emerald-500/20 border border-emerald-500/30'
                    : isCompleted
                      ? 'bg-slate-800/30 border border-slate-700/20'
                      : 'bg-slate-800/20 border border-transparent'
                }`}
              >
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                    isActive
                      ? 'bg-emerald-500 text-white'
                      : isCompleted
                        ? 'bg-slate-700 text-emerald-400'
                        : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : step.icon}
                </div>
                <div className="flex-1">
                  <div
                    className={`text-sm font-medium ${
                      isActive ? 'text-emerald-400' : isCompleted ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    {step.label}
                  </div>
                  <div
                    className={`text-xs ${
                      isActive ? 'text-emerald-300/70' : 'text-slate-500'
                    }`}
                  >
                    {step.action}
                  </div>
                </div>
                {step.id === '5' && isActive && (
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Typing Progress</div>
                    <div className="text-sm text-emerald-400">{Math.round(typingProgress)}%</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Anti-Detection Banner */}
      <div className="mt-6 flex items-center gap-3 bg-slate-800/50 rounded-xl px-4 py-3 border border-slate-700/30">
        <Shield className="w-5 h-5 text-emerald-400" />
        <div className="flex-1">
          <div className="text-sm font-medium text-white">Anti-Detection Layer Active</div>
          <div className="text-xs text-slate-400">
            Residential proxy rotation + randomized human emulation patterns enabled
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <MousePointer className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-slate-400">Mouse Trail</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Keyboard className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400">Keystroke Timing</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-slate-400">Random Delays</span>
          </div>
        </div>
      </div>
    </div>
  );
}
