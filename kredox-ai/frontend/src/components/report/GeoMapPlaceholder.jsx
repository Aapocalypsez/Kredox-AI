import { Card } from '../ui/Card.jsx';

export function GeoMapPlaceholder() {
  return (
    <Card>
      <h2 className="mb-4 font-display text-lg font-bold">Geo Verification</h2>
      <div className="relative h-[220px] overflow-hidden rounded-xl border border-border bg-[#101827]">
        <div className="absolute inset-0 bg-grid-soft opacity-60" />
        <div className="absolute left-12 top-16 rounded-full bg-danger px-3 py-1 text-xs font-bold">📍 Calling From: Andheri East, Mumbai</div>
        <div className="absolute right-8 top-24 h-24 w-24 rounded-full border border-success bg-success/10" />
        <div className="absolute bottom-4 left-4 rounded-full bg-success px-3 py-1 text-xs font-bold text-white">✅ City Match Confirmed</div>
      </div>
      <div className="mt-4 space-y-2 text-sm text-text-muted">
        <p>GPS: <span className="text-text-primary">Andheri East, Mumbai — 19.11°N 72.86°E</span></p>
        <p>IP: <span className="text-success">Jio Fiber — Mumbai ✅ Consistent</span></p>
        <p>Declared: <span className="text-success">Mumbai, Maharashtra ✅</span></p>
        <p>Score: <span className="mono text-success">96/100</span></p>
      </div>
    </Card>
  );
}
