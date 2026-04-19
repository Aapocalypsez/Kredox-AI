import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Flag, Mic, PhoneOff, ShieldCheck } from 'lucide-react';
import { transcript } from '../data/mockData.js';

function formatTime(total) {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function highlight(text) {
  return text
    .replace(/₹68,000/g, '<span class="highlight-income">₹68,000</span>')
    .replace('I consent to this loan application and verification process with Kredox AI', '<span class="highlight-consent">I consent to this loan application and verification process with Kredox AI</span>');
}

export default function LiveSession() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [seconds, setSeconds] = useState(263);

  useEffect(() => {
    const interval = setInterval(() => setSeconds((current) => current + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="session-shell">
      <header className="session-top">
        <button className="btn ghost" onClick={() => navigate('/dashboard')}><ArrowLeft size={16} /> Back</button>
        <div>
          <p className="mono muted">Session #{sessionId}</p>
          <h1 className="page-title">Rahul Sharma - Mumbai</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span className="badge d"><span className="pulse-dot" style={{ background: 'var(--danger)' }} /> REC</span>
          <span className="mono" style={{ fontSize: 26, fontWeight: 800 }}>{formatTime(seconds)}</span>
          <button className="btn danger" onClick={() => navigate(`/report/${sessionId}`)}><PhoneOff size={16} /> End Session</button>
        </div>
      </header>

      <div className="session-layout">
        <section className="grid">
          <div className="card">
            <div className="stepper">
              <span className="done">Identity</span>
              <span className="done">Income</span>
              <span className="active">Consent</span>
              <span>Complete</span>
            </div>
          </div>
          <div className="video-stage">
            <div style={{ textAlign: 'center', zIndex: 2 }}>
              <ShieldCheck size={64} color="var(--accent)" />
              <h2 style={{ fontFamily: 'var(--font-display)', marginTop: 12 }}>Customer video feed</h2>
              <p className="muted">Face tracking active · Encrypted HD stream</p>
            </div>
            <div className="pip">You</div>
          </div>
          <section className="card">
            <h2><Mic size={18} /> Live Transcript <span className="badge success">Transcribing</span></h2>
            <div className="transcript" style={{ marginTop: 16 }}>
              {transcript.map((line) => (
                <p key={`${line.time}-${line.speaker}`}>
                  <span className="mono muted">{line.time}</span> <strong>{line.speaker}:</strong>{' '}
                  <span dangerouslySetInnerHTML={{ __html: highlight(line.text) }} />
                </p>
              ))}
            </div>
          </section>
        </section>

        <aside className="grid">
          {[
            ['CV Age Estimate', '28 - 36 yrs', 'Declared 32 · consistent'],
            ['Liveness', '94/100', '14 frames analyzed'],
            ['Geo Verification', 'Mumbai Match', 'Jio Fiber · consistent'],
            ['CIBIL Score', '741', 'Good Credit'],
            ['Income Detected', '₹68,000 / month', 'Salaried · TCS'],
            ['Consent', 'Confirmed at 04:21', 'Auditable trail created'],
          ].map((card, index) => (
            <section key={card[0]} className="card" style={{ animationDelay: `${index * 0.06}s` }}>
              <p className="muted">{card[0]}</p>
              <h2 style={{ marginTop: 8 }}>{card[1]}</h2>
              <p className="trend">{card[2]}</p>
              <button className="btn ghost" style={{ marginTop: 12 }}><Flag size={15} /> Flag this response</button>
            </section>
          ))}
        </aside>
      </div>
    </main>
  );
}
