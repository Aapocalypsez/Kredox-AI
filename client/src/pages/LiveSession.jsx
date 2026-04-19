import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowLeft, Flag, Mic, NotebookPen, PhoneOff, SkipForward } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { DataCards } from '../components/session/DataCards.jsx';
import { TranscriptPanel } from '../components/session/TranscriptPanel.jsx';
import { VideoPanel } from '../components/session/VideoPanel.jsx';
import { Button } from '../components/ui/Button.jsx';
import { transcript } from '../data/mockData.js';

function formatTimer(seconds) {
  const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secs = String(seconds % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

function StepProgress() {
  const steps = useMemo(() => ['Identity', 'Income', 'Consent', 'Complete'], []);
  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const complete = index < 2;
          const active = index === 2;
          return (
            <div key={step} className="flex flex-1 items-center">
              <div className="flex items-center gap-2">
                <span className={`grid h-8 w-8 place-items-center rounded-full text-sm font-bold ${complete ? 'bg-success text-white' : active ? 'bg-accent text-white shadow-glow pulse-dot' : 'bg-bg-elevated text-text-muted'}`}>
                  {complete ? '✓' : index + 1}
                </span>
                <span className={`hidden text-sm font-bold md:inline ${complete ? 'text-success' : active ? 'text-accent' : 'text-text-muted'}`}>{step}</span>
              </div>
              {index < steps.length - 1 && <div className={`mx-3 h-px flex-1 ${complete ? 'bg-success' : 'bg-border'}`} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function LiveSession() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [seconds, setSeconds] = useState(263);

  useEffect(() => {
    const interval = setInterval(() => setSeconds((current) => current + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const endSession = () => {
    toast.success('Post-call risk pipeline completed');
    navigate(`/report/${sessionId || 'KYC-2024-0847'}`);
  };

  return (
    <main className="fixed inset-0 z-50 overflow-y-auto bg-[#080A0E] text-text-primary">
      <header className="sticky top-0 z-20 border-b border-border bg-[#080A0E]/90 backdrop-blur-xl">
        <div className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <button className="flex items-center gap-2 text-sm text-text-muted hover:text-text-primary" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="mono text-sm text-text-muted">Session #{sessionId || 'KYC-2024-0847'}</div>
          <div className="flex items-center gap-4">
            <span className="rounded-full bg-danger/15 px-3 py-1 text-sm font-bold text-danger"><span className="pulse-dot mr-2 inline-block h-2 w-2 rounded-full bg-danger" />REC</span>
            <span className="mono text-2xl font-bold">{formatTimer(seconds)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-bold">Rahul Sharma - Mumbai</span>
            <Button variant="ghost" className="py-2"><Flag className="h-4 w-4" /> Flag</Button>
            <Button variant="ghost" className="py-2"><NotebookPen className="h-4 w-4" /> Note</Button>
            <Button variant="danger" className="py-2" onClick={endSession}><PhoneOff className="h-4 w-4" /> End Session</Button>
          </div>
        </div>
      </header>

      <div className="grid gap-5 p-5 pb-28 xl:grid-cols-[65fr_35fr]">
        <section className="space-y-4">
          <StepProgress />
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <VideoPanel />
          </motion.div>
          <TranscriptPanel lines={transcript} />
        </section>

        <aside className="dark-scrollbar max-h-[calc(100vh-120px)] space-y-4 overflow-y-auto pr-1">
          <DataCards />
          <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-border bg-[#080A0E]/95 py-4 backdrop-blur">
            <Button variant="outline"><Flag className="h-4 w-4" /> Flag Response</Button>
            <Button variant="ghost"><NotebookPen className="h-4 w-4" /> Add Note</Button>
            <Button variant="outline"><SkipForward className="h-4 w-4" /> Next Step</Button>
            <div className="h-8 w-px bg-border" />
            <Button variant="danger" onClick={endSession}><PhoneOff className="h-4 w-4" /> End Session</Button>
          </div>
        </aside>
      </div>

      <div className="pointer-events-none fixed bottom-4 left-5 hidden rounded-full border border-border bg-bg-surface/80 px-4 py-2 text-xs text-text-muted backdrop-blur md:flex">
        <Mic className="mr-2 h-4 w-4 text-success" /> Deepgram stream active with browser fallback armed
      </div>
    </main>
  );
}
