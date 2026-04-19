import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BarChart2, CheckCircle, DollarSign, Eye, Flag, Lock, MapPin, Mic, NotebookPen, PhoneOff, Shield } from 'lucide-react';
import { riskReport } from '../data/mockData.js';

function fmt(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}`;
}

function TranscriptLine({ line }) {
  const cls = line.highlight === 'consent' ? 'tline consent' : 'tline';
  let text = line.text;
  if (line.highlight === 'income') text = text.replace('₹68,000', '<span class="hl-income">₹68,000</span>');
  if (line.highlight === 'employment') text = text.replace('TCS', '<span class="hl-employment">TCS</span>');
  return (
    <div className={cls}>
      <span className="time">{line.time}</span>
      <strong>{line.speaker}</strong>
      <span dangerouslySetInnerHTML={{__html:text}} />
      {line.highlight === 'consent' && <span className="badge badge-green">✓ CONSENT</span>}
    </div>
  );
}

function DataCard({ icon: Icon, label, badge, badgeClass, value, sub, bar, color = 'var(--green)', children, confirmed }) {
  return (
    <section className={`card data-card ${confirmed ? 'consent-card confirmed' : ''}`}>
      <div className="data-top">
        <Icon size={12} color="var(--t2)" />
        <label>{label}</label>
        <span className={`badge ${badgeClass}`}>{badge}</span>
      </div>
      <div className="data-value" style={{color}}>{value}</div>
      <div className="data-sub">{sub}</div>
      {bar != null && <div className="mini-bar"><span style={{width:`${bar}%`,background:color}} /></div>}
      {children}
    </section>
  );
}

export default function LiveSession() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [seconds, setSeconds] = useState(263);
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    const consentTimer = setTimeout(() => setConsent(true), 4000);
    return () => {
      clearInterval(timer);
      clearTimeout(consentTimer);
    };
  }, []);

  const end = () => navigate(`/report/${sessionId || riskReport.id}`);

  return (
    <main className="session-page">
      <header className="session-top">
        <button className="btn btn-ghost" onClick={() => navigate('/dashboard')}><ArrowLeft size={15} /> <span className="mono">Session #{sessionId || 'KYC-2024-0847'}</span></button>
        <div className="session-center">
          <span className="dot dot-red pulse" />
          <span className="mono" style={{color:'var(--red)',fontSize:12}}>REC</span>
          <span className="mono" style={{fontSize:16}}>{fmt(seconds)}</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span>Rahul Sharma</span><span className="dim">|</span><span className="muted">Mumbai</span>
          <button className="btn btn-ghost"><Flag size={14} />Flag</button>
          <button className="btn btn-ghost"><NotebookPen size={14} />Note</button>
          <button className="btn btn-danger" onClick={end}>End Session</button>
        </div>
      </header>

      <div className="session-body">
        <section className="session-left">
          <div className="step-progress">
            {['Identity','Income','Consent','Complete'].map((step, index) => (
              <div key={step} className={`step ${index < 2 ? 'done' : index === 2 ? 'current' : ''}`}>
                <span className="step-dot">{index < 2 ? '✓' : ''}</span>
                <span>{step}</span>
              </div>
            ))}
          </div>

          <div className="video-area">
            <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
            <div className="video-overlay-top">
              <span className="badge badge-red"><span className="dot dot-red" />REC</span>
              <span className="badge badge-blue">LIVE</span>
              <span className="badge badge-dim">HD</span>
            </div>
            <div className="video-quality">720p</div>
            <div className="video-center">
              <div>
                <Eye size={42} color="var(--acc)" />
                <div style={{marginTop:8}}>Customer feed active</div>
                <div className="dim mono">Face tracking · liveness verified</div>
              </div>
            </div>
            <div className="video-bottom">
              <span>Rahul Sharma</span>
              <span className="status-inline mono"><Lock size={13} /> {fmt(seconds)}</span>
            </div>
          </div>

          <section className="card transcript-card">
            <div className="transcript-head">
              <Mic size={13} color="var(--green)" className="pulse" />
              <strong style={{fontSize:12}}>Live Transcript</strong>
              <span className="muted" style={{fontSize:11}}>Transcribing...</span>
            </div>
            <div className="transcript-lines">
              {riskReport.transcript.map((line) => <TranscriptLine key={`${line.time}-${line.text}`} line={line} />)}
              <div className="tline interim"><span className="time">{fmt(seconds)}</span><strong>Customer</strong><span>still processing latest response_</span></div>
            </div>
          </section>
        </section>

        <aside className="right-panel">
          <DataCard icon={Eye} label="Age Estimate" badge="PASS" badgeClass="badge-green" value="28–36 yrs" sub="Declared 32 · Consistent" bar={88} />
          <DataCard icon={Shield} label="Liveness" badge="94/100" badgeClass="badge-green" value="Real person" sub="18 frames analyzed">
            <svg width="36" height="36" viewBox="0 0 42 42" style={{marginTop:8}}>
              <circle cx="21" cy="21" r="16" fill="none" stroke="var(--bg-3)" strokeWidth="4" />
              <circle cx="21" cy="21" r="16" fill="none" stroke="var(--green)" strokeWidth="4" strokeDasharray="100" strokeDashoffset="6" transform="rotate(-90 21 21)" />
            </svg>
          </DataCard>
          <DataCard icon={MapPin} label="Geo Verify" badge="MATCH" badgeClass="badge-green" value="Mumbai, MH" sub="Declared: Mumbai · 96/100" />
          <DataCard icon={BarChart2} label="CIBIL Score" badge="Good" badgeClass="badge-green" value="741" sub="Fetched 2 mins ago" bar={82} />
          <DataCard icon={DollarSign} label="Income (STT)" badge="91%" badgeClass="badge-blue" value="₹68,000/mo" sub="Salaried · TCS · 6 yrs" color="var(--t0)">
            <span className="badge badge-blue" style={{marginTop:8}}>STT</span>
          </DataCard>
          {consent ? (
            <DataCard icon={CheckCircle} label="Consent" badge="DONE" badgeClass="badge-green" value="Confirmed 04:21" sub="Audit trail created" confirmed />
          ) : (
            <section className="card data-card">
              <div className="data-top"><CheckCircle size={12} color="var(--t2)" /><label>Consent</label><span className="badge badge-dim">WAIT</span></div>
              <div className="data-value dim">Awaiting consent...</div>
            </section>
          )}
          <div className="session-actions">
            <button className="btn btn-ghost"><Flag size={14} />Flag</button>
            <button className="btn btn-ghost"><NotebookPen size={14} />Note</button>
            <button className="btn btn-danger" onClick={end}><PhoneOff size={14} />End Session</button>
          </div>
        </aside>
      </div>
    </main>
  );
}
