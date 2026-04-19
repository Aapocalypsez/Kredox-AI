import { motion } from 'framer-motion';
import { BarChart3, CheckCircle, Eye, MapPin, ShieldCheck, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Card } from '../ui/Card.jsx';
import { ScoreRing } from '../ui/ScoreRing.jsx';

function DataCard({ icon: Icon, title, children, delay }) {
  return (
    <Card delay={delay} className="p-4">
      <div className="mb-3 flex items-center gap-2 text-text-muted">
        <Icon className="h-4 w-4 text-accent" />
        <span className="text-xs font-bold uppercase tracking-wide">{title}</span>
      </div>
      {children}
    </Card>
  );
}

export function DataCards() {
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setConsent(true), 4000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="grid gap-4">
      <DataCard icon={Eye} title="CV Age Estimate" delay={0}>
        <div className="font-display text-3xl font-extrabold">28 - 36 yrs</div>
        <p className="mt-2 text-sm text-success">Declared: 32 years, consistent</p>
        <div className="mt-3 h-2 rounded-full bg-white/5"><div className="h-full w-[88%] rounded-full bg-success" /></div>
        <div className="mt-2 text-right text-xs text-success">88% PASS</div>
      </DataCard>

      <DataCard icon={ShieldCheck} title="Liveness" delay={0.07}>
        <div className="flex items-center gap-4">
          <ScoreRing score={94} label="Live" color="success" size={92} />
          <div>
            <p className="text-sm text-text-muted">14 frames analyzed</p>
            <p className="mt-2 rounded-full bg-success/15 px-3 py-1 text-xs font-bold text-success">REAL PERSON</p>
          </div>
        </div>
      </DataCard>

      <DataCard icon={MapPin} title="Geo Verification" delay={0.14}>
        <p className="font-bold">Andheri East, Mumbai, MH</p>
        <p className="mt-2 text-sm text-success">Declared: Mumbai, match</p>
        <p className="text-sm text-text-muted">Jio Fiber - Mumbai, consistent</p>
        <div className="mt-3 h-2 rounded-full bg-white/5"><div className="h-full w-[96%] rounded-full bg-success" /></div>
      </DataCard>

      <DataCard icon={BarChart3} title="CIBIL Score" delay={0.21}>
        <div className="mono text-4xl font-extrabold text-accent">741</div>
        <div className="relative mt-3 h-3 rounded-full bg-gradient-to-r from-danger via-warning to-success">
          <span className="absolute left-[73%] top-1/2 h-5 w-1 -translate-y-1/2 rounded bg-white" />
        </div>
        <p className="mt-2 text-sm text-text-muted">Good Credit, fetched 2 mins ago</p>
      </DataCard>

      <DataCard icon={Wallet} title="Income Detected" delay={0.28}>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="font-display text-2xl font-extrabold">
          ₹68,000 / month
        </motion.div>
        <p className="mt-2 text-sm"><span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">STT</span> <span className="text-success">91%</span></p>
        <p className="text-sm text-text-muted">Salaried - TCS (IT Sector)</p>
      </DataCard>

      <motion.div
        animate={{ backgroundColor: consent ? 'rgba(16,185,129,0.12)' : 'rgba(15,17,23,0.85)' }}
        className={`rounded-2xl border p-4 backdrop-blur-xl ${consent ? 'border-success shadow-[0_0_20px_rgba(16,185,129,0.18)]' : 'border-border'}`}
      >
        <div className="mb-3 flex items-center gap-2 text-text-muted">
          <CheckCircle className="h-4 w-4 text-success" />
          <span className="text-xs font-bold uppercase tracking-wide">Consent</span>
        </div>
        {consent ? (
          <div>
            <div className="font-display text-xl font-bold text-success">Consent Confirmed - 04:21</div>
            <p className="mt-2 text-sm text-text-muted">Auditable trail created</p>
          </div>
        ) : (
          <div className="text-text-muted">Awaiting consent phrase...</div>
        )}
      </motion.div>
    </div>
  );
}
