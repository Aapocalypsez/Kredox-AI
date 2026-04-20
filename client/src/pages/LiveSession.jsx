import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, BarChart2, CheckCircle, DollarSign, Eye, Flag, Lock, MapPin, Mic, NotebookPen, PhoneOff, Shield } from 'lucide-react';
import { applicationAPI, llmAPI, riskAPI, videoAPI } from '../api/index.js';
import { useDeepgramTranscript } from '../hooks/useDeepgramTranscript.js';

function fmt(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function TranscriptLine({ line }) {
  const isConsent = /consent/i.test(line.text || '');
  const isIncome = /income|salary|earn|rs|inr|₹|\d{4,}/i.test(line.text || '');
  const cls = isConsent ? 'tline consent' : 'tline';
  return (
    <div className={cls}>
      <span className="time">{line.received_at ? new Date(line.received_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
      <strong>{line.speaker || 'Customer'}</strong>
      <span className={isIncome ? 'hl-income' : ''}>{line.text}</span>
      {isConsent && <span className="badge badge-green">CONSENT</span>}
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
      <div className="data-value" style={{ color }}>{value}</div>
      <div className="data-sub">{sub}</div>
      {bar != null && <div className="mini-bar"><span style={{ width: `${Math.min(bar, 100)}%`, background: color }} /></div>}
      {children}
    </section>
  );
}

export default function LiveSession() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [seconds, setSeconds] = useState(0);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState('');
  const { transcript, entities, isConnected, wsStatus, isFallbackMode } = useDeepgramTranscript(id);

  useEffect(() => {
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadSession() {
      try {
        setLoading(true);
        const data = await videoAPI.getSession(id);
        if (!cancelled) setSession(data.session);
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error || 'Failed to load video session');
          toast.error('Failed to load video session');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadSession();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const consentConfirmed = useMemo(() => Boolean(entities.consent || transcript.some((line) => /i consent to this loan application/i.test(line.text || ''))), [entities, transcript]);
  const flagSession = () => toast.success(`Session ${id} added to flagged review`);
  const addNote = () => toast.success('Demo note saved for this session');

  const end = async () => {
    try {
      setEnding(true);
      await videoAPI.endSession(id);
      await llmAPI.analyze(id).catch(() => null);
      await riskAPI.finalScore(id, session?.customer_id).catch(() => null);
      await applicationAPI.compile(id).catch(() => null);
      navigate(`/report/${id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to end session');
    } finally {
      setEnding(false);
    }
  };

  const customerLabel = session?.customer_id || 'Customer';
  const callCity = session?.call_city || 'Location pending';

  if (loading) {
    return <main className="session-page"><section className="card report-section skeleton" style={{ margin: 24, height: 300 }} /></main>;
  }

  if (error) {
    return (
      <main className="session-page">
        <section className="card report-section" style={{ margin: 24 }}>
          <h1 className="section-title">Session unavailable</h1>
          <p className="muted" style={{ marginTop: 8 }}>{error}</p>
          <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={() => navigate('/dashboard')}>Back to dashboard</button>
        </section>
      </main>
    );
  }

  return (
    <main className="session-page">
      <header className="session-top">
        <button className="btn btn-ghost" onClick={() => navigate('/dashboard')}><ArrowLeft size={15} /> <span className="mono">Session #{id}</span></button>
        <div className="session-center">
          <span className="dot dot-red pulse" />
          <span className="mono" style={{ color: 'var(--red)', fontSize: 12 }}>REC</span>
          <span className="mono" style={{ fontSize: 16 }}>{fmt(seconds)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{customerLabel}</span><span className="dim">|</span><span className="muted">{callCity}</span>
          <button className="btn btn-ghost" onClick={flagSession}><Flag size={14} />Flag</button>
          <button className="btn btn-ghost" onClick={addNote}><NotebookPen size={14} />Note</button>
          <button className="btn btn-danger" onClick={end} disabled={ending}>{ending ? 'Ending...' : 'End Session'}</button>
        </div>
      </header>

      <div className="session-body">
        <section className="session-left">
          <div className="step-progress">
            {['Identity', 'Income', 'Consent', 'Complete'].map((step, index) => (
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
              <span className="badge badge-blue">{isConnected ? 'LIVE' : wsStatus}</span>
              <span className="badge badge-dim">{isFallbackMode ? 'WEB SPEECH' : 'DEEPGRAM'}</span>
            </div>
            <div className="video-quality">720p</div>
            <div className="video-center">
              <div>
                <Eye size={42} color="var(--acc)" />
                <div style={{ marginTop: 8 }}>Customer feed placeholder</div>
                <div className="dim mono">Upload/live stream can attach here</div>
              </div>
            </div>
            <div className="video-bottom">
              <span>{customerLabel}</span>
              <span className="status-inline mono"><Lock size={13} /> {fmt(seconds)}</span>
            </div>
          </div>

          <section className="card transcript-card">
            <div className="transcript-head">
              <Mic size={13} color="var(--green)" className="pulse" />
              <strong style={{ fontSize: 12 }}>Live Transcript</strong>
              <span className="muted" style={{ fontSize: 11 }}>{isConnected ? 'Transcribing...' : wsStatus}</span>
            </div>
            <div className="transcript-lines">
              {transcript.map((line) => <TranscriptLine key={line.id} line={line} />)}
              {!transcript.length && <div className="tline interim"><span className="time">--:--</span><strong>System</strong><span>Waiting for transcript events from backend...</span></div>}
            </div>
          </section>
        </section>

        <aside className="right-panel">
          <DataCard icon={Eye} label="Age Estimate" badge="LIVE" badgeClass="badge-dim" value="Pending" sub="CV endpoint updates after frames are analyzed" bar={0} />
          <DataCard icon={Shield} label="Liveness" badge="WAIT" badgeClass="badge-dim" value="Pending" sub="Frame capture not started in this view">
            <svg width="36" height="36" viewBox="0 0 42 42" style={{ marginTop: 8 }}>
              <circle cx="21" cy="21" r="16" fill="none" stroke="var(--bg-3)" strokeWidth="4" />
            </svg>
          </DataCard>
          <DataCard icon={MapPin} label="Geo Verify" badge={session?.geo_match ? 'MATCH' : 'PENDING'} badgeClass={session?.geo_match ? 'badge-green' : 'badge-dim'} value={session?.call_city || 'Pending'} sub={session?.call_state || 'Waiting for geo verification'} />
          <DataCard icon={BarChart2} label="CIBIL Score" badge="API" badgeClass="badge-dim" value="Pending" sub="Bureau result loads in report" bar={0} />
          <DataCard icon={DollarSign} label="Income (STT)" badge={entities.income ? 'STT' : 'WAIT'} badgeClass={entities.income ? 'badge-blue' : 'badge-dim'} value={entities.income?.value || 'Pending'} sub="Extracted from transcript" color="var(--t0)" />
          {consentConfirmed ? (
            <DataCard icon={CheckCircle} label="Consent" badge="DONE" badgeClass="badge-green" value="Confirmed" sub="Audit trail created" confirmed />
          ) : (
            <section className="card data-card">
              <div className="data-top"><CheckCircle size={12} color="var(--t2)" /><label>Consent</label><span className="badge badge-dim">WAIT</span></div>
              <div className="data-value dim">Awaiting consent...</div>
            </section>
          )}
          <div className="session-actions">
            <button className="btn btn-ghost" onClick={flagSession}><Flag size={14} />Flag</button>
            <button className="btn btn-ghost" onClick={addNote}><NotebookPen size={14} />Note</button>
            <button className="btn btn-danger" onClick={end} disabled={ending}><PhoneOff size={14} />{ending ? 'Ending...' : 'End Session'}</button>
          </div>
        </aside>
      </div>
    </main>
  );
}
