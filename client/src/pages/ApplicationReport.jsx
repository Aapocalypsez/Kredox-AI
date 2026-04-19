import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowLeft, CheckCircle, Download, Search, Send, UserCheck, UserRoundX, XCircle } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AuditTimeline } from '../components/report/AuditTimeline.jsx';
import { GeoMapPlaceholder } from '../components/report/GeoMapPlaceholder.jsx';
import { OfferCard } from '../components/report/OfferCard.jsx';
import { PolicyRulesTable } from '../components/report/PolicyRulesTable.jsx';
import { RiskCard } from '../components/report/RiskCard.jsx';
import { TranscriptPanel } from '../components/session/TranscriptPanel.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { ScoreRing } from '../components/ui/ScoreRing.jsx';
import { riskReport, transcript } from '../data/mockData.js';
import { useCountUp } from '../hooks/useCountUp.js';

const scoreRows = [
  ['Liveness Score', 94],
  ['Geo Trust Score', 96],
  ['Transcript Conf.', 89],
  ['AI Confidence', 84],
  ['Policy Score', 100]
];

function rupee(value) {
  return `₹${Number(value).toLocaleString('en-IN')}`;
}

function ScoreBar({ label, value }) {
  const color = value > 80 ? 'bg-success' : value >= 60 ? 'bg-warning' : 'bg-danger';
  return (
    <div>
      <div className="mb-2 flex justify-between text-sm">
        <span className="text-text-muted">{label}</span>
        <span className="mono font-bold">{value}/100</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/5">
        <motion.div initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 0.8 }} className={`h-full rounded-full ${color}`} />
      </div>
    </div>
  );
}

function QuickStat({ label, value, tone = 'text-text-primary', delay }) {
  return (
    <Card delay={delay} className="p-4">
      <div className={`mono text-2xl font-extrabold ${tone}`}>{value}</div>
      <div className="mt-1 text-xs text-text-muted">{label}</div>
    </Card>
  );
}

export function ApplicationReport() {
  const { sessionId } = useParams();
  const [query, setQuery] = useState('');
  const offerCount = useCountUp(riskReport.offerAmount);
  const filteredTranscript = useMemo(
    () => transcript.filter((line) => line.text.toLowerCase().includes(query.toLowerCase()) || line.speaker.toLowerCase().includes(query.toLowerCase())),
    [query]
  );

  return (
    <div className="min-h-screen pb-24">
      <main className="mx-auto max-w-[1400px] space-y-5 p-5">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-primary">
          <ArrowLeft className="h-4 w-4" /> Back to Applications
        </Link>

        <section className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-full border border-accent bg-accent/15 font-display text-xl font-bold text-accent">RS</div>
            <div>
              <h1 className="font-display text-3xl font-extrabold">{riskReport.name}</h1>
              <p className="text-text-muted">{riskReport.city} - {riskReport.phone}</p>
              <p className="mono mt-1 text-xs text-text-muted">#{sessionId || riskReport.id} - Completed {riskReport.completedAt}</p>
            </div>
          </div>
          <div className="flex flex-col items-start gap-3 lg:items-end">
            <div className="flex items-center gap-3">
              <div className="grid h-[72px] w-[72px] place-items-center rounded-full bg-success font-display text-4xl font-extrabold text-white shadow-[0_0_35px_rgba(16,185,129,0.28)]">A</div>
              <div>
                <p className="text-sm text-text-muted">{riskReport.persona}</p>
                <p className="mt-2 rounded-full bg-success/20 px-4 py-1 text-sm font-bold text-success">Kredox AI recommends: Auto Approve</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="danger"><XCircle className="h-4 w-4" /> Reject</Button>
              <Button variant="outline"><UserCheck className="h-4 w-4" /> Manual Review</Button>
              <Button variant="success" onClick={() => toast.success('Application Approved')}> <CheckCircle className="h-4 w-4" /> Approve & Offer</Button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-5">
          <QuickStat delay={0} label="CIBIL" value={riskReport.cibilScore} tone="text-success" />
          <QuickStat delay={0.07} label="Income" value={`₹${Math.round(riskReport.income / 1000)}K/mo`} />
          <QuickStat delay={0.14} label="Age" value={`${riskReport.age} yrs`} />
          <QuickStat delay={0.21} label="Liveness" value={`${riskReport.liveness}%`} tone="text-success" />
          <QuickStat delay={0.28} label="Geo" value="Match" tone="text-success" />
        </section>

        <section className="grid gap-5 xl:grid-cols-[38fr_32fr_30fr]">
          <div className="space-y-5">
            <RiskCard />
            <OfferCard />
            <Card className="p-4">
              <div className="text-xs text-text-muted">Animated offer counter</div>
              <div className="mt-1 font-display text-3xl font-extrabold">{rupee(offerCount)}</div>
            </Card>
          </div>

          <div className="space-y-5">
            <Card>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="font-display text-lg font-bold">Full Interview Transcript</h2>
                <Button variant="ghost" className="py-2 text-xs"><Download className="h-4 w-4" /> PDF</Button>
              </div>
              <label className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-muted">
                <Search className="h-4 w-4" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search transcript..." className="w-full bg-transparent outline-none placeholder:text-text-muted" />
              </label>
              <TranscriptPanel lines={filteredTranscript} compact />
            </Card>

            <Card>
              <h2 className="mb-5 font-display text-lg font-bold">Verification Scores</h2>
              <div className="space-y-4">{scoreRows.map(([label, value]) => <ScoreBar key={label} label={label} value={value} />)}</div>
            </Card>

            <PolicyRulesTable />
          </div>

          <div className="space-y-5">
            <Card>
              <h2 className="mb-4 font-display text-lg font-bold">Computer Vision Analysis</h2>
              <div className="viewfinder bg-grid-soft grid aspect-video place-items-center rounded-xl border border-success/40 bg-bg-elevated">
                <span className="text-sm text-text-muted">Frame #14 of 18</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <p>Age Estimate <strong className="block text-text-primary">28 - 36 years</strong></p>
                <p>Confidence <strong className="block text-success">91%</strong></p>
                <p>Emotion <strong className="block text-text-primary">Calm (88%)</strong></p>
                <p>Frames <strong className="block text-text-primary">18 analyzed</strong></p>
              </div>
            </Card>

            <Card>
              <h2 className="mb-4 font-display text-lg font-bold">Geo Verification</h2>
              <GeoMapPlaceholder />
              <div className="mt-4 space-y-2 text-sm text-text-muted">
                <p>GPS: <span className="text-text-primary">Andheri East, Mumbai - 19.11N 72.86E</span></p>
                <p>IP: <span className="text-success">Jio Fiber - Mumbai, consistent</span></p>
                <p>Declared: <span className="text-success">Mumbai, Maharashtra</span></p>
                <p>Score: <span className="mono text-success">96/100</span></p>
              </div>
            </Card>

            <Card>
              <h2 className="mb-4 font-display text-lg font-bold">Audit Timeline</h2>
              <AuditTimeline events={riskReport.auditTimeline} />
            </Card>
          </div>
        </section>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-bg-surface/95 px-5 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-sm text-text-muted">
            Reviewing: <span className="font-bold text-text-primary">Rahul Sharma - KYC-2024-0847 - Band A</span> - Kredox AI: Auto Approve Recommended
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="danger"><UserRoundX className="h-4 w-4" /> Reject</Button>
            <Button variant="outline"><UserCheck className="h-4 w-4" /> Manual Review</Button>
            <Button variant="success" onClick={() => toast.success('Approval and disbursal queued')}><Send className="h-4 w-4" /> Approve & Disburse</Button>
          </div>
        </div>
      </footer>
    </div>
  );
}
