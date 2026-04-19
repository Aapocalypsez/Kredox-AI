import { AlertTriangle, CheckCircle } from 'lucide-react';
import { riskReport } from '../../data/mockData.js';
import { Card } from '../ui/Card.jsx';
import { ScoreRing } from '../ui/ScoreRing.jsx';

export function RiskCard() {
  return (
    <Card className="border-t-2 border-t-accent">
      <div className="mb-4 rounded-full bg-accent/15 px-3 py-1 text-sm font-bold text-accent">
        Stable profile: {riskReport.persona}
      </div>
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center">
        <ScoreRing score={riskReport.confidenceScore} label="AI Confidence" color="accent" size={120} />
        <p className="leading-relaxed text-text-muted">{riskReport.summary}</p>
      </div>
      <div className="mt-5">
        <h3 className="mb-2 flex items-center gap-2 font-display font-bold text-warning"><AlertTriangle className="h-4 w-4" /> Red Flags</h3>
        {riskReport.redFlags.map((flag) => <span key={flag} className="mb-2 inline-flex rounded-full bg-warning/15 px-3 py-1 text-sm text-warning">Warning: {flag}</span>)}
      </div>
      <div className="mt-5">
        <h3 className="mb-2 flex items-center gap-2 font-display font-bold text-success"><CheckCircle className="h-4 w-4" /> Positive Signals</h3>
        <div className="flex flex-wrap gap-2">
          {riskReport.positiveSignals.map((signal) => <span key={signal} className="rounded-full bg-success/10 px-3 py-1 text-sm text-success">Passed: {signal}</span>)}
        </div>
      </div>
    </Card>
  );
}
