import toast from 'react-hot-toast';
import { useParams } from 'react-router-dom';
import { CheckCircle, Send, XCircle } from 'lucide-react';
import AppShell from '../components/AppShell.jsx';
import { riskReport, transcript } from '../data/mockData.js';

function money(value) {
  return `₹${Number(value).toLocaleString('en-IN')}`;
}

export default function ApplicationReport() {
  const { sessionId } = useParams();
  const scores = [
    ['Liveness Score', 94],
    ['Geo Trust Score', 96],
    ['Transcript Conf.', 89],
    ['AI Confidence', riskReport.confidenceScore],
    ['Policy Score', 100],
  ];

  return (
    <AppShell title="Risk Report" subtitle={`${riskReport.name} · ${sessionId || riskReport.id} · Auto approve recommended`}>
      <div className="grid kpi-grid">
        <section className="card"><p className="muted">CIBIL</p><div className="kpi-value">{riskReport.cibilScore}</div></section>
        <section className="card"><p className="muted">Income</p><div className="kpi-value">₹68K</div></section>
        <section className="card"><p className="muted">Liveness</p><div className="kpi-value">{riskReport.liveness}%</div></section>
        <section className="card"><p className="muted">Risk Band</p><div className="kpi-value" style={{ color: 'var(--success)' }}>{riskReport.riskBand}</div></section>
      </div>

      <div className="grid three-col" style={{ marginTop: 18 }}>
        <section className="card glow">
          <h2>Kredox AI Risk Assessment</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 18 }}>
            <div className="score-ring" style={{ '--score': `${riskReport.confidenceScore}%` }}><strong>{riskReport.confidenceScore}%</strong></div>
            <div>
              <span className="badge a">Band A</span>
              <h3 style={{ marginTop: 10 }}>{riskReport.persona}</h3>
            </div>
          </div>
          <p className="muted" style={{ lineHeight: 1.65, marginTop: 18 }}>{riskReport.summary}</p>
          <h3 style={{ marginTop: 20 }}>Red Flags</h3>
          {riskReport.redFlags.map((flag) => <p key={flag} className="badge warn" style={{ marginTop: 10 }}>{flag}</p>)}
          <h3 style={{ marginTop: 20 }}>Positive Signals</h3>
          <div className="grid" style={{ marginTop: 10 }}>
            {riskReport.positiveSignals.map((signal) => <span key={signal} className="badge success"><CheckCircle size={13} /> {signal}</span>)}
          </div>
        </section>

        <section className="card">
          <h2>Loan Offer Generated</h2>
          <div className="kpi-value">{money(riskReport.offerAmount)}</div>
          <p className="trend">{riskReport.interestRate}% per annum · {riskReport.tenure} months</p>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginTop: 18 }}>
            {[
              ['12 mo', '₹74,820'],
              ['24 mo', '₹39,440'],
              ['36 mo', `₹${riskReport.emi.toLocaleString('en-IN')}`],
            ].map(([tenure, emi]) => <div key={tenure} className="card" style={{ background: 'var(--bg-base)', padding: 14 }}><strong>{tenure}</strong><p className="mono">{emi}</p></div>)}
          </div>
          <p className="muted" style={{ marginTop: 18 }}>Processing fee: {money(riskReport.processingFee)} · Total payable: {money(riskReport.totalPayable)}</p>
          <p className="muted" style={{ lineHeight: 1.6, marginTop: 14 }}>Based on stable employment at TCS, strong credit quality, and verified consent, Kredox AI recommends the premium Band A offer.</p>
          <button className="btn" style={{ width: '100%', marginTop: 18 }} onClick={() => toast.success('Offer sent to customer')}><Send size={16} /> Send Offer via WhatsApp</button>
        </section>

        <section className="card">
          <h2>Verification Scores</h2>
          <div className="grid" style={{ marginTop: 18 }}>
            {scores.map(([label, value]) => (
              <div key={label}>
                <p className="muted">{label} <span className="mono" style={{ float: 'right', color: 'var(--text-primary)' }}>{value}/100</span></p>
                <div className="progress" style={{ '--value': `${value}%`, marginTop: 8 }}><span /></div>
              </div>
            ))}
          </div>
          <h3 style={{ marginTop: 20 }}>Audit Timeline</h3>
          <div className="grid" style={{ marginTop: 12 }}>
            {riskReport.auditTimeline.slice(0, 6).map((event) => <p key={event.time} className="muted"><span className="mono">{event.time}</span> · {event.event}</p>)}
          </div>
        </section>
      </div>

      <section className="card" style={{ marginTop: 18 }}>
        <h2>Full Interview Transcript</h2>
        <div className="transcript" style={{ marginTop: 14, maxHeight: 320 }}>
          {transcript.map((line) => <p key={`${line.time}-${line.text}`}><span className="mono muted">{line.time}</span> <strong>{line.speaker}:</strong> {line.text}</p>)}
        </div>
      </section>

      <footer className="card" style={{ position: 'sticky', bottom: 18, marginTop: 18, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <strong>Reviewing Rahul Sharma · Band A · Kredox AI: Auto Approve</strong>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn danger"><XCircle size={16} /> Reject</button>
          <button className="btn ghost">Manual Review</button>
          <button className="btn success" onClick={() => toast.success('Application approved and disbursal queued')}>Approve & Disburse</button>
        </div>
      </footer>
    </AppShell>
  );
}
