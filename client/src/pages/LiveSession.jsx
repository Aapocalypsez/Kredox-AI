import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import AgoraRTC, {
  AgoraRTCProvider,
  LocalUser,
  RemoteUser,
  useConnectionState,
  useJoin,
  useLocalCameraTrack,
  useLocalMicrophoneTrack,
  usePublish,
  useRemoteUsers
} from 'agora-rtc-react';
import { ArrowLeft, BarChart2, CheckCircle, DollarSign, Eye, Flag, Lock, MapPin, Mic, NotebookPen, PhoneOff, Shield } from 'lucide-react';
import { applicationAPI, bureauAPI, llmAPI, offerAPI, riskAPI, videoAPI } from '../api/index.js';
import AutoFillApplication from '../components/AutoFillApplication.jsx';
import { useDeepgramTranscript } from '../hooks/useDeepgramTranscript.js';
import { useFrameCapture } from '../hooks/useFrameCapture.js';
import { useGeoCapture } from '../hooks/useGeoCapture.js';

function fmt(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function looksLikeSessionId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function RtcProvider({ children }) {
  const client = useMemo(() => AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' }), []);
  return <AgoraRTCProvider client={client}>{children}</AgoraRTCProvider>;
}

function TranscriptLine({ line }) {
  const isConsent = /consent/i.test(line.text || '');
  const isIncome = /income|salary|earn|rs|inr|₹|\d{4,}/i.test(line.text || '');
  const isEmployment = /tcs|infosys|employee|employment|salaried|business|self employed/i.test(line.text || '');
  const cls = isConsent ? 'tline consent' : 'tline';

  return (
    <div className={cls}>
      <span className="time">{line.received_at ? new Date(line.received_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
      <strong>{line.speaker || 'Customer'}</strong>
      <span className={isIncome ? 'hl-income' : isEmployment ? 'hl-employment' : ''}>{line.text}</span>
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

function liveField(path, label, group, value, source, confidence = 0, needsReview = false, displayValue = null) {
  return {
    path,
    label,
    group,
    value,
    displayValue,
    source: value === null || value === undefined || value === '' ? 'empty' : source,
    confidence: value === null || value === undefined || value === '' ? 0 : confidence,
    needs_review: needsReview || value === null || value === undefined || value === ''
  };
}

function AgentAgoraStage({ session, tokenData, onStageState, onDurationTick }) {
  const remoteVideoRef = useRef(null);
  const frameVideoRef = useRef(null);
  const joinReady = Boolean(tokenData?.appId && tokenData?.token && tokenData?.provider === 'agora');
  useJoin(
    {
      appid: tokenData?.appId || '',
      channel: session.channel_name,
      token: tokenData?.token || null,
      uid: `agent-${String(session.id).slice(0, 8)}`
    },
    joinReady
  );
  const { localMicrophoneTrack } = useLocalMicrophoneTrack(joinReady);
  const { localCameraTrack } = useLocalCameraTrack(joinReady);
  usePublish([localMicrophoneTrack, localCameraTrack], Boolean(joinReady && localMicrophoneTrack && localCameraTrack));
  const remoteUsers = useRemoteUsers();
  const connectionState = useConnectionState();
  const transcriptState = useDeepgramTranscript(session.id, [localMicrophoneTrack, remoteUsers[0]?.audioTrack].filter(Boolean), true);
  const { cvData, frameCount } = useFrameCapture(frameVideoRef, session.id);

  useEffect(() => {
    const timer = window.setInterval(() => onDurationTick(), 1000);
    return () => window.clearInterval(timer);
  }, [onDurationTick]);

  useEffect(() => {
    const syncVideoRef = () => {
      const remoteVideo = remoteVideoRef.current?.querySelector('video') || null;
      frameVideoRef.current = remoteVideo;
    };
    syncVideoRef();
    const interval = window.setInterval(syncVideoRef, 1000);
    return () => window.clearInterval(interval);
  }, [remoteUsers]);

  useEffect(() => {
    onStageState({
      transcript: transcriptState.transcript,
      entities: transcriptState.entities,
      cvData,
      frameCount,
      wsStatus: transcriptState.wsStatus,
      fallback: transcriptState.isFallbackMode,
      connection: String(connectionState || 'connecting').toLowerCase(),
      remoteConnected: Boolean(remoteUsers[0]),
      localMicrophoneTrack,
      localCameraTrack
    });
  }, [connectionState, cvData, frameCount, localCameraTrack, localMicrophoneTrack, onStageState, remoteUsers, transcriptState.entities, transcriptState.isFallbackMode, transcriptState.transcript, transcriptState.wsStatus]);

  return (
    <div className="video-area">
      <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
      <div className="video-overlay-top">
        <span className="badge badge-red"><span className="dot dot-red" />REC</span>
        <span className="badge badge-blue">LIVE</span>
        <span className="badge badge-dim">{transcriptState.isFallbackMode ? 'WEB SPEECH' : 'DEEPGRAM'}</span>
      </div>
      <div className="video-quality">720p</div>
      <div className="video-center" ref={remoteVideoRef}>
        {remoteUsers[0] ? (
          <RemoteUser user={remoteUsers[0]} playAudio playVideo />
        ) : (
          <div>
            <Eye size={42} color="var(--acc)" />
            <div style={{ marginTop: 8 }}>Waiting for customer live feed...</div>
            <div className="dim mono">Customer joins the secure RTC channel from /verify</div>
          </div>
        )}
      </div>
      <div className="pip-shell">
        <LocalUser
          className="pip-video live-pip"
          audioTrack={localMicrophoneTrack}
          videoTrack={localCameraTrack}
          micOn={Boolean(localMicrophoneTrack)}
          cameraOn={Boolean(localCameraTrack)}
          playAudio={false}
          playVideo
        />
      </div>
      <div className="video-bottom">
        <span>{session.customer_id}</span>
        <span className="status-inline mono"><Lock size={13} /> encrypted</span>
      </div>
    </div>
  );
}

function AgentFallbackStage({ session, onStageState, onDurationTick }) {
  const fallbackVideoRef = useRef(null);
  const streamRef = useRef(null);
  const transcriptState = useDeepgramTranscript(session.id, [], true);
  const { cvData, frameCount } = useFrameCapture(fallbackVideoRef, session.id);

  useEffect(() => {
    const timer = window.setInterval(() => onDurationTick(), 1000);
    return () => window.clearInterval(timer);
  }, [onDurationTick]);

  useEffect(() => {
    let cancelled = false;
    async function startMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (fallbackVideoRef.current) {
          fallbackVideoRef.current.srcObject = stream;
        }
      } catch {
        toast.error('Camera permission is required for fallback live monitoring');
      }
    }

    startMedia();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    onStageState({
      transcript: transcriptState.transcript,
      entities: transcriptState.entities,
      cvData,
      frameCount,
      wsStatus: transcriptState.wsStatus,
      fallback: true,
      connection: 'browser-media',
      remoteConnected: false
    });
  }, [cvData, frameCount, onStageState, transcriptState.entities, transcriptState.transcript, transcriptState.wsStatus]);

  return (
    <div className="video-area">
      <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
      <div className="video-overlay-top">
        <span className="badge badge-red"><span className="dot dot-red" />REC</span>
        <span className="badge badge-amber">DEMO</span>
        <span className="badge badge-dim">BROWSER MEDIA</span>
      </div>
      <div className="video-quality">local</div>
      <video ref={fallbackVideoRef} autoPlay muted playsInline className="camera-video" />
      <div className="video-bottom">
        <span>{session.customer_id}</span>
        <span className="status-inline mono"><Lock size={13} /> local capture</span>
      </div>
    </div>
  );
}

export default function LiveSession() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [seconds, setSeconds] = useState(0);
  const [session, setSession] = useState(null);
  const [rtcToken, setRtcToken] = useState(null);
  const [bureau, setBureau] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState('');
  const [stageState, setStageState] = useState({
    transcript: [],
    entities: {},
    cvData: null,
    frameCount: 0,
    wsStatus: 'idle',
    fallback: false,
    connection: 'preparing',
    remoteConnected: false
  });
  const geoCapture = useGeoCapture(id);

  useEffect(() => {
    let cancelled = false;
    async function loadSession() {
      if (!looksLikeSessionId(id)) {
        setError('Open a live session from the dashboard once a real backend session is active.');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const data = await videoAPI.getSession(id);
        const tokenData = await videoAPI
          .getToken(data.session.channel_name, `agent-${id}`, 'publisher')
          .catch(() => ({ provider: 'browser_media', disabled: true }));
        const bureauData = data.session.customer_id
          ? await bureauAPI.get(data.session.customer_id).catch(() => null)
          : null;
        if (!cancelled) {
          setSession(data.session);
          setRtcToken(tokenData);
          setBureau(bureauData);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err.response?.data?.error || 'Failed to load video session';
          setError(message);
          toast.error(message);
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

  const consentConfirmed = useMemo(
    () =>
      Boolean(stageState.entities.consent?.value) ||
      stageState.transcript.some((line) => /i consent to this loan application/i.test(line.text || '')),
    [stageState.entities.consent, stageState.transcript]
  );
  const incomeValue = stageState.entities.income?.value || 'Pending';
  const employmentValue = stageState.entities.employment?.display_value || stageState.entities.employment?.value || 'Awaiting transcript';
  const callCity = geoCapture.geoResult?.gps_city || session?.call_city || 'Location pending';
  const livenessScore = Number(stageState.cvData?.liveness_score || 0);
  const ageRange = stageState.cvData?.age_range ? `${stageState.cvData.age_range.low}-${stageState.cvData.age_range.high} yrs` : 'Pending';
  const cvBadge = stageState.cvData?.provider === 'azure_face' ? 'AZURE FACE' : stageState.cvData?.demo_mode ? 'DEMO CV' : 'LIVE CV';
  const liveAutoFillRows = useMemo(() => [
    liveField('personal.full_name', 'Full Name', 'Identity', session?.customer_name, 'declared', 0.95),
    liveField('personal.phone', 'Phone', 'Identity', session?.customer_phone, 'declared', 0.95),
    liveField('personal.email', 'Email', 'Identity', session?.customer_email, 'declared', 0.95),
    liveField('personal.age', 'Declared Age', 'Identity', session?.declared_age, 'declared', 0.9),
    liveField('financial.monthly_income', 'Monthly Income', 'Income', stageState.entities.income?.value || session?.declared_monthly_income, stageState.entities.income ? 'live_stt' : 'declared', stageState.entities.income ? 0.91 : 0.8, false, stageState.entities.income?.display_value),
    liveField('financial.employment_type', 'Employment Type', 'Income', stageState.entities.employment?.display_value || stageState.entities.employment?.value || session?.employment_type, stageState.entities.employment ? 'live_stt' : 'declared', stageState.entities.employment ? 0.86 : 0.75),
    liveField('financial.employer_name', 'Employer', 'Income', stageState.entities.employer_name?.display_value || stageState.entities.employer_name?.value, 'live_stt', 0.82),
    liveField('financial.years_employed', 'Years Employed', 'Income', stageState.entities.years_employed?.display_value || stageState.entities.years_employed?.value, 'live_stt', 0.82),
    liveField('financial.bureau_score', 'CIBIL Score', 'Risk', bureau?.bureau_score || session?.bureau_score, 'bureau', 0.95),
    liveField('loan.amount_requested', 'Loan Amount', 'Loan', session?.loan_amount_requested, 'declared', 0.85),
    liveField('loan.purpose', 'Loan Purpose', 'Loan', stageState.entities.loan_purpose?.display_value || stageState.entities.loan_purpose?.value || session?.loan_purpose, stageState.entities.loan_purpose ? 'live_stt' : 'declared', stageState.entities.loan_purpose ? 0.84 : 0.75),
    liveField('verification.liveness_score', 'Liveness Score', 'Verification', livenessScore || null, 'live_cv', livenessScore ? 0.86 : 0),
    liveField('verification.consent_confirmed', 'Verbal Consent', 'Verification', consentConfirmed, consentConfirmed ? 'live_stt' : 'empty', consentConfirmed ? 0.94 : 0, !consentConfirmed),
    liveField('verification.geo_verified', 'Geo Verified', 'Verification', geoCapture.geoResult?.match_status === 'MATCH', geoCapture.geoResult ? 'live_geo' : 'empty', geoCapture.geoResult ? 0.9 : 0, !geoCapture.geoResult),
    liveField('verification.cv_age_estimate', 'CV Age Estimate', 'Verification', ageRange !== 'Pending' ? ageRange : null, 'live_cv', ageRange !== 'Pending' ? 0.78 : 0)
  ], [ageRange, bureau?.bureau_score, consentConfirmed, geoCapture.geoResult, livenessScore, session, stageState.entities]);
  const flagSession = async () => {
    try {
      await videoAPI.flagSession(id, 'Agent flagged during live monitoring');
      toast.success(`Session ${id} added to flagged review`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to flag session');
    }
  };
  const addNote = async () => {
    const note = window.prompt('Add session note', 'Customer asked for follow-up after verification');
    if (!note) return;
    try {
      await videoAPI.addNote(id, note);
      toast.success('Session note saved');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save note');
    }
  };

  const end = async () => {
    try {
      setEnding(true);
      await videoAPI.endSession(id);
      await llmAPI.analyze(id).catch(() => null);
      await riskAPI.finalScore(id, session?.customer_id).catch(() => null);
      const application = await applicationAPI.compile(id).catch(() => null);
      if (application?.id || application?.application_id) {
        await offerAPI.generate(id, application.id || application.application_id).catch(() => null);
      }
      navigate(`/report/${id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to end session');
    } finally {
      setEnding(false);
    }
  };

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
          <span>{session?.customer_id}</span><span className="dim">|</span><span className="muted">{callCity}</span>
          <button className="btn btn-ghost" onClick={flagSession}><Flag size={14} />Flag</button>
          <button className="btn btn-ghost" onClick={addNote}><NotebookPen size={14} />Note</button>
          <button className="btn btn-danger" onClick={end} disabled={ending}>{ending ? 'Ending...' : 'End Session'}</button>
        </div>
      </header>

      <div className="session-body">
        <section className="session-left">
          <div className="step-progress">
            {['Identity', 'Income', 'Consent', 'Complete'].map((step, index) => {
              const currentIndex = consentConfirmed ? 2 : stageState.entities.income ? 1 : livenessScore >= 60 ? 0 : 0;
              return (
                <div key={step} className={`step ${index < currentIndex ? 'done' : index === currentIndex ? 'current' : ''}`}>
                  <span className="step-dot">{index < currentIndex ? '✓' : ''}</span>
                  <span>{step}</span>
                </div>
              );
            })}
          </div>

          {rtcToken?.provider === 'agora' ? (
            <RtcProvider>
              <AgentAgoraStage session={session} tokenData={rtcToken} onStageState={setStageState} onDurationTick={() => setSeconds((value) => value + 1)} />
            </RtcProvider>
          ) : (
            <AgentFallbackStage session={session} onStageState={setStageState} onDurationTick={() => setSeconds((value) => value + 1)} />
          )}

          <section className="card transcript-card">
            <div className="transcript-head">
              <Mic size={13} color="var(--green)" className="pulse" />
              <strong style={{ fontSize: 12 }}>Live Transcript</strong>
              <span className="muted" style={{ fontSize: 11 }}>{stageState.connection}</span>
            </div>
            <div className="transcript-lines">
              {stageState.transcript.map((line) => <TranscriptLine key={line.id} line={line} />)}
              {!stageState.transcript.length && <div className="tline interim"><span className="time">--:--</span><strong>System</strong><span>Waiting for transcript events from the live session...</span></div>}
            </div>
          </section>

          <AutoFillApplication title="Live Auto-Filled Application" rows={liveAutoFillRows} />
        </section>

        <aside className="right-panel">
          <DataCard
            icon={Eye}
            label="Age Estimate"
            badge={cvBadge}
            badgeClass={stageState.cvData?.demo_mode ? 'badge-amber' : 'badge-green'}
            value={ageRange}
            sub={`Declared ${bureau?.declared_age || session?.declared_age || '-'} | ${livenessScore >= 60 ? 'Consistent' : 'Waiting for frame confidence'} | ${stageState.cvData?.provider_status || 'demo_mode'}`}
            bar={stageState.cvData ? 88 : 0}
          />
          <DataCard
            icon={Shield}
            label="Liveness"
            badge={livenessScore ? `${livenessScore}/100` : 'WAIT'}
            badgeClass={livenessScore >= 60 ? 'badge-green' : 'badge-dim'}
            value={livenessScore ? 'Real person' : 'Pending'}
            sub={`${stageState.frameCount} frames analyzed`}
            bar={livenessScore}
          />
          <DataCard
            icon={MapPin}
            label="Geo Verify"
            badge={geoCapture.geoResult?.match_status || 'PENDING'}
            badgeClass={geoCapture.geoResult?.match_status === 'MATCH' ? 'badge-green' : geoCapture.geoResult ? 'badge-amber' : 'badge-dim'}
            value={geoCapture.geoResult?.gps_city || callCity}
            sub={geoCapture.geoResult ? `Declared: ${geoCapture.geoResult.declared_city || '-'} | ${geoCapture.geoResult.geo_score}/100` : 'Waiting for geo verification'}
            bar={geoCapture.geoResult?.geo_score || 0}
          />
          <DataCard
            icon={BarChart2}
            label="CIBIL Score"
            badge={bureau?.bureau_score >= 700 ? 'Good' : bureau?.bureau_score ? 'Review' : 'WAIT'}
            badgeClass={bureau?.bureau_score ? 'badge-blue' : 'badge-dim'}
            value={bureau?.bureau_score || 'Pending'}
            sub={bureau ? `${bureau.existing_loans || 0} existing loans` : 'Bureau result loads from customer profile'}
            bar={bureau?.bureau_score ? Math.round((Number(bureau.bureau_score) / 900) * 100) : 0}
            color={bureau?.bureau_score >= 700 ? 'var(--green)' : 'var(--t0)'}
          />
          <DataCard
            icon={DollarSign}
            label="Income (STT)"
            badge={stageState.entities.income ? 'STT' : 'WAIT'}
            badgeClass={stageState.entities.income ? 'badge-blue' : 'badge-dim'}
            value={incomeValue}
            sub={`${employmentValue} | ${stageState.fallback ? 'fallback speech mode' : 'realtime speech mode'}`}
            color="var(--t0)"
          />
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
