import { AlertTriangle, CheckCircle } from 'lucide-react';
import { Card } from '../ui/Card.jsx';
import { ScoreRing } from '../ui/ScoreRing.jsx';

export function RiskCard({ analysis }) {
  const redFlags = analysis?.red_flags || [];
  const positiveSignals = analysis?.key_positive_signals || [];
  return (
    <Card className="border-t-2 border-t-accent">
      <div className="mb-4 rounded-full bg-accent/15 px-3 py-1 text-sm font-bold text-accent">
        Profile: {analysis?.persona || 'Analysis pending'}
      </div>
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center">
        <ScoreRing score={analysis?.confidence_score || 0} label="AI Confidence" color="accent" size={120} />
        <p className="leading-relaxed text-text-muted">{analysis?.summary || 'No AI risk analysis has been returned by the backend yet.'}</p>
      </div>
      <div className="mt-5">
        <h3 className="mb-2 flex items-center gap-2 font-display font-bold text-warning"><AlertTriangle className="h-4 w-4" /> Red Flags</h3>
        {redFlags.length ? redFlags.map((flag) => <span key={flag} className="mb-2 inline-flex rounded-full bg-warning/15 px-3 py-1 text-sm text-warning">Warning: {flag}</span>) : <p className="text-sm text-text-muted">No red flags returned.</p>}
      </div>
      <div className="mt-5">
        <h3 className="mb-2 flex items-center gap-2 font-display font-bold text-success"><CheckCircle className="h-4 w-4" /> Positive Signals</h3>
        <div className="flex flex-wrap gap-2">
          {positiveSignals.length ? positiveSignals.map((signal) => <span key={signal} className="rounded-full bg-success/10 px-3 py-1 text-sm text-success">Passed: {signal}</span>) : <span className="text-sm text-text-muted">No positive signals returned.</span>}
        </div>
      </div>
    </Card>
  );
}
