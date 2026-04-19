import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Circle, GoogleMap, Marker, useLoadScript } from '@react-google-maps/api';
import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis } from 'recharts';
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
import {
  completeLink,
  calculateFinalRiskScore,
  compileApplication,
  createVideoToken,
  endVideoSession,
  generateLoanOffer,
  acceptLoanOffer,
  fetchPublicLoanOffer,
  presentLoanOffer,
  fetchGeoReport,
  fetchLlmAnalysis,
  fetchVideoSession,
  patchApplicationField,
  startVideoSession,
  validateToken
} from '../api.js';
import { useDeepgramTranscript } from './useDeepgramTranscript.js';
import { useFrameCapture } from './useFrameCapture.js';
import { useGeoCapture } from './useGeoCapture.js';

const customerSteps = [
  { label: 'Identity', instruction: 'Please hold your ID card up to the camera' },
  { label: 'Income', instruction: 'Please state your monthly income and employment' },
  { label: 'Consent', instruction: 'Please say: I consent to this loan application' },
  { label: 'Complete', instruction: 'Thank you, your application is being processed' }
];

const insightSeed = [
  { key: 'age', label: 'CV Age Estimate', value: '31-36 years' },
  { key: 'geo', label: 'Geo Location', value: 'Mumbai, MH' },
  { key: 'consent', label: 'Consent Detected', value: 'Listening for phrase' },
  { key: 'bureau', label: 'Bureau Score', value: '742' },
  { key: 'employment', label: 'Employment Type', value: 'Awaiting speech' },
  { key: 'income', label: 'Income Declared', value: 'Awaiting transcript' }
];

function formatDuration(seconds) {
  const minutes = String(Math.floor(seconds / 60)).padStart(2, '0');
  const remainder = String(seconds % 60).padStart(2, '0');
  return `${minutes}:${remainder}`;
}

function normalizeConnectionState(state) {
  if (state === 'CONNECTED') return 'connected';
  if (state === 'CONNECTING') return 'connecting';
  if (state === 'RECONNECTING') return 'reconnecting';
  if (state === 'DISCONNECTED') return 'failed';
  return String(state || 'connecting').toLowerCase();
}

function AgoraClientProvider({ children }) {
  const client = useMemo(() => AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' }), []);
  return <AgoraRTCProvider client={client}>{children}</AgoraRTCProvider>;
}

function ConnectionBadge() {
  const connectionState = useConnectionState();
  const state = normalizeConnectionState(connectionState);
  return <span className={`connection-badge ${state}`}>{state}</span>;
}

function VideoRoom({
  channelName,
  uid,
  role,
  sessionId,
  layout,
  onEnded,
  activeCustomerStep,
  onNextCustomerStep
}) {
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [duration, setDuration] = useState(0);
  const remoteVideoTileRef = useRef(null);
  const [remoteVideoElement, setRemoteVideoElement] = useState(null);
  const tokenQuery = useQuery({
    queryKey: ['agora-token', channelName, uid, role],
    queryFn: () => createVideoToken({ channel_name: channelName, uid, role }),
    enabled: Boolean(channelName)
  });

  const joinArgs = {
    appid: tokenQuery.data?.appId || '',
    channel: channelName || '',
    token: tokenQuery.data?.token || null,
    uid
  };
  const joinState = useJoin(joinArgs, Boolean(tokenQuery.data));
  const { localMicrophoneTrack } = useLocalMicrophoneTrack(Boolean(tokenQuery.data));
  const { localCameraTrack } = useLocalCameraTrack(Boolean(tokenQuery.data));
  usePublish(
    [localMicrophoneTrack, localCameraTrack],
    Boolean(tokenQuery.data && localMicrophoneTrack && localCameraTrack)
  );
  const remoteUsers = useRemoteUsers();
  const transcriptAudioTracks = useMemo(
    () => [localMicrophoneTrack, remoteUsers[0]?.audioTrack].filter(Boolean),
    [localMicrophoneTrack, remoteUsers]
  );
  const transcriptState = useDeepgramTranscript(sessionId, transcriptAudioTracks, layout === 'agent');
  const cvState = useFrameCapture(remoteVideoElement, sessionId, layout === 'agent' && Boolean(remoteUsers[0]));
  const endMutation = useMutation({
    mutationFn: () => endVideoSession(sessionId),
    onSuccess: () => {
      toast.success('Call ended');
      onEnded?.();
    },
    onError: (error) => toast.error(error.response?.data?.error || 'Could not end call')
  });

  useEffect(() => {
    const timer = window.setInterval(() => setDuration((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    localMicrophoneTrack?.setEnabled(micOn);
  }, [localMicrophoneTrack, micOn]);

  useEffect(() => {
    localCameraTrack?.setEnabled(cameraOn);
  }, [localCameraTrack, cameraOn]);

  useEffect(() => {
    if (layout !== 'agent') return undefined;

    const findVideoElement = () => {
      const video = remoteVideoTileRef.current?.querySelector('video') || null;
      setRemoteVideoElement(video);
    };

    findVideoElement();
    const interval = window.setInterval(findVideoElement, 1000);
    return () => window.clearInterval(interval);
  }, [layout, remoteUsers]);

  if (layout === 'customer') {
    return (
      <div className="customer-call">
        <div className="customer-video">
          <LocalUser
            className="full-local-video"
            audioTrack={localMicrophoneTrack}
            videoTrack={localCameraTrack}
            micOn={micOn}
            cameraOn={cameraOn}
            playAudio={false}
            playVideo
          />
          <div className="video-status-strip">
            <ConnectionBadge />
            <span>{formatDuration(duration)}</span>
          </div>
        </div>
        <p className="customer-instruction">{customerSteps[activeCustomerStep].instruction}</p>
        <div className="bottom-call-bar">
          <button type="button" className="ghost" onClick={() => setMicOn((value) => !value)}>
            {micOn ? 'Mute' : 'Unmute'}
          </button>
          <button type="button" className="ghost" onClick={() => setCameraOn((value) => !value)}>
            {cameraOn ? 'Camera Off' : 'Camera On'}
          </button>
          {activeCustomerStep < customerSteps.length - 1 ? (
            <button type="button" onClick={onNextCustomerStep}>
              Continue
            </button>
          ) : (
            <button type="button" className="danger" disabled={endMutation.isPending} onClick={() => endMutation.mutate()}>
              Finish
            </button>
          )}
        </div>
        {(tokenQuery.isError || joinState.error) && (
          <p className="call-error">Unable to connect to the secure video session.</p>
        )}
      </div>
    );
  }

  return (
    <div className="agent-call-grid">
      <section className="agent-left">
        <div className="agent-video-stage">
          <div className="remote-video-tile" ref={remoteVideoTileRef}>
            {remoteUsers[0] ? (
              <RemoteUser user={remoteUsers[0]} playAudio playVideo />
            ) : (
              <div className="video-placeholder">Waiting for customer video...</div>
            )}
          </div>
          <EmotionPulse emotion={cvState.latestAnalysis?.dominant_emotion} />
          <LocalUser
            className="pip-video"
            audioTrack={localMicrophoneTrack}
            videoTrack={localCameraTrack}
            micOn={micOn}
            cameraOn={cameraOn}
            playAudio={false}
            playVideo
          />
          <div className="recording-indicator">
            <span />
            REC
          </div>
          <div className="session-timer">{formatDuration(duration)}</div>
          <div className="agent-connection">
            <ConnectionBadge />
          </div>
        </div>
        <TranscriptPanel transcriptState={transcriptState} />
      </section>

      <aside className="agent-right">
        <CVAnalysisCard cvState={cvState} />
        <GeoVerificationCard sessionId={sessionId} />
        <LiveDataPanel entities={transcriptState.entities} />
        <label className="notes-field">
          Session notes
          <textarea placeholder="Add observations for underwriting review" />
        </label>
      </aside>

      <div className="bottom-call-bar agent-bottom-bar">
        <button type="button" className="danger" disabled={endMutation.isPending} onClick={() => endMutation.mutate()}>
          End Call
        </button>
        <button type="button" className="ghost" onClick={() => setMicOn((value) => !value)}>
          {micOn ? 'Mute' : 'Unmute'}
        </button>
        <button type="button" className="ghost" onClick={() => setCameraOn((value) => !value)}>
          {cameraOn ? 'Camera Off' : 'Camera On'}
        </button>
        <button type="button" className="ghost">
          Add to Flagged
        </button>
      </div>
    </div>
  );
}

function GeoVerificationCard({ sessionId }) {
  const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: mapsApiKey
  });
  const geoQuery = useQuery({
    queryKey: ['geo-report', sessionId],
    queryFn: () => fetchGeoReport(sessionId),
    enabled: Boolean(sessionId),
    refetchInterval: 30000,
    retry: false
  });

  const report = geoQuery.data;
  const coordinates = report?.coordinates;
  const mapCenter = coordinates?.lat && coordinates?.lng
    ? { lat: coordinates.lat, lng: coordinates.lng }
    : { lat: 19.076, lng: 72.8777 };
  const isMismatch = report?.match_status === 'MISMATCH';

  return (
    <section className="geo-card">
      <div className="section-heading compact-heading">
        <div>
          <p className="eyebrow">Geo Verification</p>
          <h2>Location trust</h2>
        </div>
        <span className={isMismatch ? 'geo-status mismatch' : 'geo-status'}>
          {report?.match_status || 'Waiting'}
        </span>
      </div>

      <div className="geo-map-frame">
        {isMismatch && <div className="geo-map-warning">⚠️ Location mismatch detected</div>}
        {isLoaded && mapsApiKey ? (
          <GoogleMap
            mapContainerClassName="geo-map"
            center={mapCenter}
            zoom={coordinates?.lat ? 11 : 5}
            options={{
              disableDefaultUI: true,
              clickableIcons: false
            }}
          >
            {coordinates?.lat && coordinates?.lng && <Marker position={mapCenter} />}
            {coordinates?.lat && coordinates?.lng && (
              <Circle
                center={mapCenter}
                radius={22000}
                options={{
                  fillColor: '#00a870',
                  fillOpacity: 0.16,
                  strokeColor: '#00a870',
                  strokeOpacity: 0.8,
                  strokeWeight: 1
                }}
              />
            )}
          </GoogleMap>
        ) : (
          <div className="map-placeholder">Map waiting for Google Maps key</div>
        )}
      </div>

      <div className="geo-lines">
        <p>📍 Calling from: {report?.gps_city || report?.ip_city || 'Waiting'}, {report?.gps_state || report?.ip_region || ''}</p>
        <p>📋 Declared: {report?.declared_city || 'Unknown'}, {report?.declared_state || ''}</p>
        {report?.flags?.map((flag) => (
          <p className="geo-flag" key={flag}>⚠️ {flag.replaceAll('_', ' ').toLowerCase()}</p>
        ))}
      </div>

      <div className="geo-score">
        <div>
          <span>Geo Trust Score</span>
          <strong>{report?.geo_score ?? 0}/100</strong>
        </div>
        <div className={isMismatch ? 'geo-score-bar mismatch' : 'geo-score-bar'}>
          <span style={{ width: `${report?.geo_score ?? 0}%` }} />
        </div>
      </div>
    </section>
  );
}

function CVAnalysisCard({ cvState }) {
  const { latestAnalysis, summary, isAnalyzing, error } = cvState;
  const ageRange = latestAnalysis?.age_range || summary.most_common_age_estimate;
  const score = latestAnalysis?.liveness_score ?? summary.average_liveness_score ?? 0;
  const status = latestAnalysis?.liveness_status || (score >= 70 ? 'PASS' : 'FAIL');
  const declaredAge = latestAnalysis?.declared_age;
  const ageFlag = Boolean(latestAnalysis?.age_flag);

  return (
    <section className="cv-analysis-card">
      <div className="section-heading compact-heading">
        <div>
          <p className="eyebrow">Computer Vision</p>
          <h2>Face analysis</h2>
        </div>
        <span className={isAnalyzing ? 'cv-scan-badge active' : 'cv-scan-badge'}>{isAnalyzing ? 'Scanning' : 'Ready'}</span>
      </div>

      <div className="cv-age-row">
        <span>Age Estimate</span>
        <strong>{ageRange ? `${ageRange.low} – ${ageRange.high} yrs` : 'Waiting for face'}</strong>
      </div>

      <div className="liveness-block">
        <div className="liveness-labels">
          <span>Liveness</span>
          <strong className={status === 'PASS' ? 'pass' : 'fail'}>{status} · {score}</strong>
        </div>
        <div className={status === 'PASS' ? 'liveness-meter pass' : 'liveness-meter fail'}>
          <span style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
        </div>
      </div>

      <p className="frame-count">{summary.total_frames_analyzed} frames analyzed</p>

      {ageFlag && (
        <div className="age-warning">
          ⚠️ Age mismatch — declared {declaredAge || 'unknown'}, CV estimate {ageRange?.low}–{ageRange?.high}
        </div>
      )}

      {error && <p className="cv-error">CV analysis is waiting for a readable demo video frame.</p>}
    </section>
  );
}

function EmotionPulse({ emotion }) {
  const current = emotion || { label: 'Calm', icon: '😐', tone: 'calm' };

  return (
    <div className={`emotion-pulse ${current.tone}`}>
      <span>{current.icon}</span>
      {current.label}
    </div>
  );
}

function highlightTranscript(text) {
  const pattern = /(i consent to this loan application|(?:₹|rs\.?|inr)?\s*\d{2,3}(?:,\d{3})+|\b\d{4,7}\b|fraud|fake|default|overdue|bounce)/gi;
  const parts = text.split(pattern).filter(Boolean);

  return parts.map((part, index) => {
    const normalized = part.toLowerCase();
    let className = '';
    let prefix = '';

    if (/i consent to this loan application/i.test(part)) {
      className = 'entity-highlight consent';
      prefix = '✓ ';
    } else if (/(?:₹|rs\.?|inr)?\s*\d{2,3}(?:,\d{3})+|\b\d{4,7}\b/i.test(part)) {
      className = 'entity-highlight income';
    } else if (['fraud', 'fake', 'default', 'overdue', 'bounce'].some((word) => normalized.includes(word))) {
      className = 'entity-highlight risk';
    }

    return className ? (
      <mark className={className} key={`${part}-${index}`}>
        {prefix}
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    );
  });
}

function TranscriptPanel({ transcriptState }) {
  const { transcripts, connectionStatus } = transcriptState;

  return (
    <section className="transcript-panel">
      <div className="section-heading compact-heading">
        <div>
          <p className="eyebrow">Transcript</p>
          <h2>Real-time customer speech</h2>
        </div>
        <span className={`transcript-status ${connectionStatus}`}>
          {connectionStatus === 'transcribing' ? '🟢 Transcribing' : '🔴 Disconnected'}
        </span>
      </div>
      <div className="transcript-feed">
        {!transcripts.length && (
          <p className="interim-line">Waiting for Deepgram transcript events...</p>
        )}
        {transcripts.map((line) => (
          <p className={line.is_final ? 'final-line' : 'interim-line'} key={line.id}>
            <strong>{line.speaker}:</strong> {highlightTranscript(line.transcript)}
          </p>
        ))}
      </div>
    </section>
  );
}

function LiveDataPanel({ entities }) {
  const cardValues = {
    ...entities,
    age: { display_value: '31-36 years' },
    geo: { display_value: 'Mumbai, MH' },
    bureau: { display_value: '742' }
  };

  return (
    <section className="live-data-panel">
      <div className="section-heading compact-heading">
        <div>
          <p className="eyebrow">Live Data</p>
          <h2>Verification signals</h2>
        </div>
      </div>
      <div className="insight-grid">
        {insightSeed.map((item) => {
          const entity = cardValues[item.key];
          const loaded = Boolean(entity);
          const isConsent = item.key === 'consent' && entities.consent;
          const isEmployment = item.key === 'employment' && entities.employment;
          return (
            <article className={loaded ? 'insight-card entity-ready' : 'insight-card'} key={item.key}>
              <span>{item.label}</span>
              {loaded ? (
                <strong className={isConsent ? 'consent-value' : ''}>
                  {isConsent ? '✓ ' : ''}
                  {entity.display_value || item.value}
                </strong>
              ) : (
                <div className="skeleton-line" />
              )}
              {isEmployment && <em className="employment-badge">{entity.value}</em>}
              <button type="button" className="text-button">
                Flag this response
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function AgentSessionPage({ sessionId }) {
  const sessionQuery = useQuery({
    queryKey: ['video-session', sessionId],
    queryFn: () => fetchVideoSession(sessionId),
    enabled: Boolean(sessionId)
  });
  const [ended, setEnded] = useState(false);

  if (sessionQuery.isLoading) {
    return <CallShell message="Loading secure session..." />;
  }

  if (sessionQuery.isError) {
    return <CallShell message="Video session could not be loaded." />;
  }

  if (ended || sessionQuery.data?.status === 'completed') {
    return <RiskReportPage sessionId={sessionId} />;
  }

  return (
    <main className="video-shell agent-shell">
      <AgoraClientProvider>
        <VideoRoom
          channelName={sessionQuery.data.channel_name}
          uid={101}
          role="publisher"
          sessionId={sessionId}
          layout="agent"
          onEnded={() => setEnded(true)}
        />
      </AgoraClientProvider>
    </main>
  );
}

function riskTone(riskBand) {
  return {
    A: { label: 'A', tone: 'green' },
    B: { label: 'B', tone: 'blue' },
    C: { label: 'C', tone: 'amber' },
    D: { label: 'D', tone: 'red' }
  }[riskBand] || { label: '-', tone: 'amber' };
}

function actionLabel(action) {
  if (action === 'auto_approve') return 'Auto Approve';
  if (action === 'reject') return 'Reject';
  return 'Manual Review';
}

function RiskReportPage({ sessionId }) {
  const [analysis, setAnalysis] = useState(null);
  const [streamedSummary, setStreamedSummary] = useState('');
  const [progressSteps, setProgressSteps] = useState([
    { label: 'Transcript compiled', status: 'pending' },
    { label: 'CV data merged', status: 'pending' },
    { label: 'Risk model running', status: 'pending' }
  ]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const baseUrl = import.meta.env.VITE_API_BASE_URL || '';

    async function parseSse(response) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (!cancelled) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const event of events) {
          const dataLine = event.split('\n').find((line) => line.startsWith('data: '));
          if (!dataLine) continue;
          const payload = JSON.parse(dataLine.slice(6));

          if (payload.type === 'progress') {
            setProgressSteps((current) =>
              current.map((step) =>
                step.label === payload.step ? { ...step, status: payload.status } : step
              )
            );
          }

          if (payload.type === 'summary_delta') {
            setStreamedSummary((current) => current + payload.delta);
          }

          if (payload.type === 'analysis_complete') {
            setAnalysis(payload.analysis);
            setProgressSteps((current) => current.map((step) => ({ ...step, status: 'complete' })));
          }
        }
      }
    }

    async function runAnalysis() {
      try {
        const response = await fetch(`${baseUrl}/api/llm/analyze?stream=true`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId })
        });

        if (!response.ok || !response.body) {
          throw new Error('Streaming analysis failed');
        }

        await parseSse(response);
      } catch (streamError) {
        if (cancelled) return;
        try {
          const stored = await fetchLlmAnalysis(sessionId);
          setAnalysis(stored);
          setStreamedSummary(stored.summary || '');
          setProgressSteps((current) => current.map((step) => ({ ...step, status: 'complete' })));
        } catch {
          setError(streamError);
        }
      }
    }

    runAnalysis();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return (
    <main className="video-shell risk-report-shell">
      <section className="risk-report-layout">
        <div className="llm-loading-card">
          <p className="eyebrow">Post-call intelligence</p>
          <h1>🧠 AI is analyzing the interview<span className="loading-dots">...</span></h1>
          <div className="llm-progress">
            {progressSteps.map((step) => (
              <span key={step.label} className={step.status}>
                {step.status === 'complete' ? '✅' : step.status === 'running' ? '⏳' : '○'} {step.label}
              </span>
            ))}
          </div>
          {error && <p className="cv-error">Risk analysis needs OpenAI credentials and completed session data.</p>}
        </div>

        {analysis ? (
          <RiskReportCard analysis={{ ...analysis, summary: streamedSummary || analysis.summary }} />
        ) : (
          <RiskReportSkeleton summary={streamedSummary} />
        )}
        <RiskScoreBreakdown sessionId={sessionId} enabled={Boolean(analysis)} />
      </section>
    </main>
  );
}

function RiskReportSkeleton({ summary }) {
  return (
    <section className="risk-report-card">
      <div className="risk-skeleton-grid">
        <div className="skeleton-line" />
        <div className="skeleton-line" />
        <div className="skeleton-line" />
      </div>
      {summary && (
        <article className="summary-card">
          <h3>Summary</h3>
          <p>{summary}</p>
        </article>
      )}
    </section>
  );
}

function RiskReportCard({ analysis }) {
  const tone = riskTone(analysis.risk_band);
  const confidence = Math.min(100, Math.max(0, Number(analysis.confidence_score || 0)));

  return (
    <section className="risk-report-card">
      <div className="risk-report-header">
        <div className={`risk-band-badge ${tone.tone}`}>{tone.label}</div>
        <div>
          <p className="eyebrow">Risk Band</p>
          <h2>{analysis.persona || 'Applicant Profile'}</h2>
        </div>
        <div className="confidence-ring" style={{ '--confidence': `${confidence}%` }}>
          <span>{confidence}%</span>
        </div>
      </div>

      <div className="risk-report-grid">
        <article>
          <h3>Red Flags</h3>
          <div className="badge-list">
            {(analysis.red_flags || []).length ? (
              analysis.red_flags.map((flag) => (
                <span className="red-flag-badge" key={flag}>⚠️ {flag}</span>
              ))
            ) : (
              <span className="green-signal">No major red flags found</span>
            )}
          </div>
        </article>

        <article>
          <h3>Positive Signals</h3>
          <ul className="positive-list">
            {(analysis.key_positive_signals || []).map((signal) => (
              <li key={signal}>✓ {signal}</li>
            ))}
          </ul>
        </article>
      </div>

      <article className="summary-card">
        <h3>Summary</h3>
        <p>{analysis.summary}</p>
      </article>

      <div className="risk-actions">
        <button type="button" className={`recommendation-button ${tone.tone}`}>
          {actionLabel(analysis.recommended_action)}
        </button>
        <div>
          <span>Suggested range</span>
          <strong>
            ₹{Number(analysis.suggested_loan_range?.min || 0).toLocaleString('en-IN')} – ₹
            {Number(analysis.suggested_loan_range?.max || 0).toLocaleString('en-IN')}
          </strong>
        </div>
        <div>
          <span>Rate band</span>
          <strong>{analysis.interest_rate_band || 'Manual pricing'}</strong>
        </div>
      </div>
    </section>
  );
}

function RiskScoreBreakdown({ sessionId, enabled }) {
  const [expanded, setExpanded] = useState(false);
  const scoreQuery = useQuery({
    queryKey: ['risk-final-score', sessionId],
    queryFn: () => calculateFinalRiskScore({ session_id: sessionId }),
    enabled,
    retry: false
  });

  if (!enabled) return null;

  if (scoreQuery.isLoading) {
    return (
      <section className="risk-score-card">
        <div className="skeleton-line" />
        <div className="skeleton-line" />
      </section>
    );
  }

  if (scoreQuery.isError) {
    return (
      <section className="risk-score-card">
        <p className="cv-error">Final risk score is waiting for the Python ML service at /ml/predict.</p>
      </section>
    );
  }

  const score = scoreQuery.data;
  const policyRules = score.policy_result?.rules || [];
  const shapData = Object.entries(score.ml_result?.feature_contributions || {}).map(([name, value]) => ({
    name,
    value: Number(value)
  }));

  return (
    <section className="risk-score-card">
      <div className="score-breakdown-header">
        <AnimatedScoreGauge score={Math.round(score.final_score)} riskBand={score.risk_band} />
        <div className="score-sub-bars">
          <ScoreSubBar label="ML Model" value={Math.round(score.ml_risk_score)} />
          <ScoreSubBar label="Policy Engine" value={Math.round(score.policy_score)} />
          <ScoreSubBar label="AI Analysis" value={Math.round(score.llm_confidence_score)} />
        </div>
      </div>

      <div className="shap-chart">
        <h3>Feature Contributions</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={shapData} layout="vertical" margin={{ left: 20, right: 20 }}>
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={150} />
            <Bar dataKey="value" radius={[0, 6, 6, 0]}>
              {shapData.map((entry) => (
                <Cell key={entry.name} fill={entry.value >= 0 ? '#00a870' : '#c93434'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <button type="button" className="policy-toggle" onClick={() => setExpanded((value) => !value)}>
        {expanded ? 'Hide Policy Rules' : 'Show Policy Rules'}
      </button>

      {expanded && <PolicyRulesTable rules={policyRules} />}
    </section>
  );
}

function AnimatedScoreGauge({ score, riskBand }) {
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    let frame = 0;
    const totalFrames = 34;
    const timer = window.setInterval(() => {
      frame += 1;
      setDisplayScore(Math.round((score * frame) / totalFrames));
      if (frame >= totalFrames) {
        window.clearInterval(timer);
      }
    }, 22);

    return () => window.clearInterval(timer);
  }, [score]);

  return (
    <div
      className={`score-gauge band-${String(riskBand || 'c').toLowerCase()}`}
      style={{ '--score': `${Math.max(0, Math.min(100, displayScore))}%` }}
    >
      <span>{displayScore}</span>
      <small>Final Score</small>
    </div>
  );
}

function ScoreSubBar({ label, value }) {
  return (
    <div className="score-sub-bar">
      <div>
        <span>{label}</span>
        <strong>{value}{label === 'Policy Engine' ? '%' : ''}</strong>
      </div>
      <div className="score-sub-track">
        <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function PolicyRulesTable({ rules }) {
  return (
    <div className="policy-table-wrap">
      <table className="policy-table">
        <thead>
          <tr>
            <th>Rule</th>
            <th>Required</th>
            <th>Actual</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((rule) => (
            <tr key={rule.rule}>
              <td>{rule.rule}</td>
              <td>{Array.isArray(rule.required) ? rule.required.join(', ') : String(rule.required)}</td>
              <td>{rule.actual === null || rule.actual === undefined ? '-' : String(rule.actual)}</td>
              <td>
                <span className={`policy-status ${rule.status.toLowerCase()}`}>
                  {rule.status === 'PASS' ? '✅' : rule.status === 'FAIL' ? '❌' : '⚠️'} {rule.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CustomerVideoPage({ token }) {
  const [step, setStep] = useState(0);
  const [session, setSession] = useState(null);
  const [completed, setCompleted] = useState(false);
  const geoCapture = useGeoCapture(session?.session_id, Boolean(session));
  const validateQuery = useQuery({
    queryKey: ['validate-link', token],
    queryFn: () => validateToken(token),
    retry: false
  });

  const startMutation = useMutation({
    mutationFn: startVideoSession,
    onSuccess: (data) => {
      setSession(data);
      toast.success('Secure video session started');
    },
    onError: (error) => toast.error(error.response?.data?.error || 'Could not start video session')
  });

  const completionMutation = useMutation({
    mutationFn: completeLink,
    onError: (error) => toast.error(error.response?.data?.reason || 'Could not complete verification')
  });
  const endSessionMutation = useMutation({
    mutationFn: endVideoSession,
    onError: () => toast.error('Video session ended locally, but server close failed')
  });
  const startSession = startMutation.mutate;

  useEffect(() => {
    if (validateQuery.data?.valid && !session && !startMutation.isPending) {
      startSession({
        customer_id: validateQuery.data.customer_id,
        agent_id: 'kredox-agent'
      });
    }
  }, [validateQuery.data, session, startMutation.isPending, startSession]);

  function finishCustomerCall() {
    if (!validateQuery.data?.session_token) return;
    completionMutation.mutate({ token, session_token: validateQuery.data.session_token });
    if (session?.session_id && !endSessionMutation.isPending) {
      endSessionMutation.mutate(session.session_id);
    }
    setCompleted(true);
  }

  if (completed || step === customerSteps.length - 1) {
    return <CallShell message={customerSteps[3].instruction} />;
  }

  return (
    <main className="video-shell customer-shell">
      <section className="customer-panel">
        <p className="eyebrow">Kredox AI</p>
        <h1>Secure video verification</h1>
        <div className="customer-stepper">
          {customerSteps.map((item, index) => (
            <span key={item.label} className={index <= step ? 'active' : ''}>
              {item.label}
            </span>
          ))}
        </div>
        {(validateQuery.isLoading || startMutation.isPending) && <p>Preparing your secure video session...</p>}
        {session && (
          <p className={`geo-customer-status ${geoCapture.status}`}>
            📍 Verifying your location securely...
          </p>
        )}
        {validateQuery.isError && <p>This secure link is expired, already used, or invalid.</p>}
        {session && (
          <AgoraClientProvider>
            <VideoRoom
              channelName={session.channel_name}
              uid={202}
              role="publisher"
              sessionId={session.session_id}
              layout="customer"
              activeCustomerStep={step}
              onNextCustomerStep={() => {
                if (step === customerSteps.length - 2) {
                  finishCustomerCall();
                  setStep((value) => value + 1);
                  return;
                }
                setStep((value) => value + 1);
              }}
              onEnded={() => {
                finishCustomerCall();
                setCompleted(true);
              }}
            />
          </AgoraClientProvider>
        )}
      </section>
    </main>
  );
}

function CallShell({ message }) {
  return (
    <main className="video-shell customer-shell">
      <section className="call-message">
        <p className="eyebrow">Kredox AI</p>
        <h1>{message}</h1>
      </section>
    </main>
  );
}

export function GeoReportPage({ sessionId }) {
  const geoQuery = useQuery({
    queryKey: ['geo-report-detail', sessionId],
    queryFn: () => fetchGeoReport(sessionId),
    enabled: Boolean(sessionId),
    retry: false
  });

  if (geoQuery.isLoading) {
    return <CallShell message="Loading geo verification report..." />;
  }

  if (geoQuery.isError) {
    return <CallShell message="Geo report is not available yet." />;
  }

  const report = geoQuery.data;

  return (
    <main className="video-shell risk-report-shell">
      <section className="geo-detail-report">
        <p className="eyebrow">Application Detail</p>
        <h1>Geo Verification Report</h1>
        <div className="geo-detail-grid">
          <GeoVerificationCard sessionId={sessionId} />
          <article className="geo-timeline-card">
            <h2>Timeline</h2>
            {(report.timeline || []).map((item) => (
              <p key={item}>{item}</p>
            ))}
            <div className="geo-score">
              <div>
                <span>Final Geo Trust Score</span>
                <strong>{report.geo_score}/100</strong>
              </div>
              <div className={report.match_status === 'MISMATCH' ? 'geo-score-bar mismatch' : 'geo-score-bar'}>
                <span style={{ width: `${report.geo_score}%` }} />
              </div>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}

const sectionLabels = {
  personal: 'Personal',
  financial: 'Financial',
  loan: 'Loan',
  verification: 'Verification',
  risk: 'Risk'
};

const sourceLabels = {
  stt_extracted: 'From STT',
  declared: 'From Declaration',
  bureau: 'From Bureau',
  cv: 'From CV',
  geo: 'From Geo',
  llm: 'From LLM',
  risk_engine: 'From Risk Engine',
  manual: 'Manually Entered',
  empty: 'Missing'
};

const editReasons = ['Typo correction', 'Customer clarified', 'Source conflict', 'Other'];

function confidenceTone(field) {
  if (field.needs_review || field.confidence < 0.6) return 'low';
  if (field.confidence <= 0.85) return 'medium';
  return 'high';
}

function displayFieldValue(value) {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value === null || value === undefined || value === '') return '';
  return String(value);
}

function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

function useTypewriter(text, speed = 18) {
  const [output, setOutput] = useState('');

  useEffect(() => {
    setOutput('');
    if (!text) return undefined;

    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setOutput(text.slice(0, index));
      if (index >= text.length) {
        window.clearInterval(timer);
      }
    }, speed);

    return () => window.clearInterval(timer);
  }, [text, speed]);

  return output;
}

function useAnimatedNumber(value) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let frame = 0;
    const totalFrames = 36;
    const timer = window.setInterval(() => {
      frame += 1;
      setDisplayValue(Math.round((Number(value || 0) * frame) / totalFrames));
      if (frame >= totalFrames) window.clearInterval(timer);
    }, 20);
    return () => window.clearInterval(timer);
  }, [value]);

  return displayValue;
}

export function ApplicationFormView({ sessionId }) {
  const queryClient = useQueryClient();
  const applicationQuery = useQuery({
    queryKey: ['compiled-application', sessionId],
    queryFn: () => compileApplication(sessionId),
    enabled: Boolean(sessionId),
    retry: false
  });
  const editMutation = useMutation({
    mutationFn: ({ applicationId, payload }) => patchApplicationField(applicationId, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(['compiled-application', sessionId], updated);
      toast.success('Field updated');
    },
    onError: () => toast.error('Could not update field')
  });

  if (applicationQuery.isLoading) {
    return <CallShell message="Compiling application..." />;
  }

  if (applicationQuery.isError) {
    return <CallShell message="Application data is not ready yet." />;
  }

  const application = applicationQuery.data;
  const reviewFields = application.fields_needing_review || [];

  return (
    <main className="video-shell application-shell">
      <section className="application-form-view">
        <div className="application-header">
          <div>
            <p className="eyebrow">Application Auto-fill</p>
            <h1>Loan Application Review</h1>
          </div>
          <button type="button" disabled={reviewFields.length > 0}>
            Confirm & Submit Application
          </button>
        </div>

        {reviewFields.length > 0 && (
          <div className="needs-review-banner">
            ⚠️ {reviewFields.length} fields need review before submission.
            <div>{reviewFields.join(', ')}</div>
          </div>
        )}

        <FieldConflictResolver
          applicationId={application.id}
          application={application.application_json}
          onEdit={(payload) => editMutation.mutate({ applicationId: application.id, payload })}
        />

        {Object.entries(application.application_json).map(([sectionKey, section]) => (
          <section className="application-section" key={sectionKey}>
            <h2>{sectionLabels[sectionKey] || sectionKey}</h2>
            <div className="application-fields-grid">
              {Object.entries(section).map(([fieldKey, field]) => (
                <ApplicationField
                  key={`${sectionKey}.${fieldKey}`}
                  path={`${sectionKey}.${fieldKey}`}
                  label={fieldKey.replaceAll('_', ' ')}
                  field={field}
                  disabled={editMutation.isPending}
                  onEdit={(payload) => editMutation.mutate({ applicationId: application.id, payload })}
                />
              ))}
            </div>
          </section>
        ))}
      </section>
    </main>
  );
}

export function OfferPage({ applicationId, sessionId }) {
  const offerQuery = useQuery({
    queryKey: ['loan-offer', applicationId, sessionId],
    queryFn: () => generateLoanOffer({ application_id: applicationId, session_id: sessionId }),
    enabled: Boolean(applicationId && sessionId),
    retry: false
  });

  if (offerQuery.isLoading) {
    return <CallShell message="Generating loan offer..." />;
  }

  if (offerQuery.isError) {
    return <CallShell message="Offer could not be generated for this application." />;
  }

  return (
    <main className="video-shell offer-shell">
      <OfferCard offerData={offerQuery.data} />
    </main>
  );
}

function OfferCard({ offerData }) {
  const { offer, emi_options: emiOptions, explanation, customer_offer_url: customerOfferUrl } = offerData;
  const [selectedOption, setSelectedOption] = useState(emiOptions[0]);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const animatedAmount = useAnimatedNumber(offer.amount);
  const typedExplanation = useTypewriter(explanation);
  const presentMutation = useMutation({
    mutationFn: () => presentLoanOffer(offer.id, 'sms'),
    onSuccess: (result) => {
      if (result.delivery?.status === 'sent') {
        toast.success('Offer summary sent to customer');
      } else {
        toast.success('Offer link is ready');
      }
    },
    onError: () => toast.error('Could not present offer')
  });
  const approveMutation = useMutation({
    mutationFn: () => acceptLoanOffer(offer.id),
    onSuccess: () => toast.success('Offer approved for disbursal'),
    onError: () => toast.error('Could not approve offer')
  });

  return (
    <section className="offer-card">
      <div className="offer-header">
        <div>
          <p className="eyebrow">Loan Offer</p>
          <h1>🎉 Offer Generated — Band {offer.band}</h1>
        </div>
        <strong className="offer-amount">{formatCurrency(animatedAmount)}</strong>
      </div>
      {customerOfferUrl && <p className="offer-public-link">{customerOfferUrl}</p>}

      <div className="offer-meta-grid">
        <div>
          <span>Rate</span>
          <strong>{offer.interest_rate}% per annum</strong>
        </div>
        <div>
          <span>Processing Fee</span>
          <strong>{formatCurrency(offer.processing_fee)}</strong>
        </div>
      </div>

      <div className="emi-options">
        {emiOptions.map((option) => (
          <button
            type="button"
            key={option.tenure_months}
            className={selectedOption.tenure_months === option.tenure_months ? 'emi-option selected' : 'emi-option'}
            onClick={() => setSelectedOption(option)}
          >
            <span>{option.tenure_months}mo</span>
            <strong>{formatCurrency(option.emi)}</strong>
            <em>Total interest {formatCurrency(option.total_interest)}</em>
            <em>Total payable {formatCurrency(option.total_payable)}</em>
          </button>
        ))}
      </div>

      <article className="offer-explanation">
        <h2>AI Explanation</h2>
        <p>{typedExplanation}</p>
      </article>

      <div className="offer-actions">
        <button type="button" disabled={presentMutation.isPending} onClick={() => presentMutation.mutate()}>
          {presentMutation.isPending ? 'Sending...' : 'Present to Customer'}
        </button>
        <button type="button" className="ghost" disabled={approveMutation.isPending} onClick={() => approveMutation.mutate()}>
          {approveMutation.isPending ? 'Approving...' : 'Approve & Disburse'}
        </button>
        <button type="button" className="ghost" onClick={() => setOverrideOpen(true)}>Override Offer</button>
      </div>

      {overrideOpen && (
        <div className="override-modal">
          <div>
            <h2>Override Offer</h2>
            <p>Manual adjustment will require audit approval in the next workflow.</p>
            <button type="button" onClick={() => setOverrideOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </section>
  );
}

export function CustomerOfferPage({ token }) {
  const [accepted, setAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const offerQuery = useQuery({
    queryKey: ['public-loan-offer', token],
    queryFn: () => fetchPublicLoanOffer(token),
    enabled: Boolean(token),
    retry: false
  });
  const publicOffer = offerQuery.data?.offer;
  const customer = offerQuery.data?.customer;
  const typedExplanation = useTypewriter(publicOffer?.explanation_text || '');
  const acceptMutation = useMutation({
    mutationFn: () => acceptLoanOffer(publicOffer.id),
    onSuccess: () => {
      setAccepted(true);
      toast.success('Offer accepted');
    },
    onError: () => toast.error('Could not accept offer')
  });

  useEffect(() => {
    if (publicOffer?.status === 'accepted') {
      setAccepted(true);
    }
  }, [publicOffer?.status]);

  if (offerQuery.isLoading) {
    return <CallShell message="Loading your offer..." />;
  }

  if (offerQuery.isError || !publicOffer) {
    return <CallShell message="This offer link is invalid or no longer available." />;
  }

  return (
    <main className="customer-offer-shell">
      <div className="confetti-layer" aria-hidden="true">
        {Array.from({ length: 18 }).map((_, index) => <span key={index} />)}
      </div>
      <section className="customer-offer-card">
        <p className="eyebrow">Kredox AI</p>
        <h1>Congratulations, {customer?.name || 'Customer'}! Your loan is approved.</h1>
        <div className="customer-offer-amount">{formatCurrency(publicOffer.amount)}</div>
        <div className="customer-offer-grid">
          <div><span>Rate</span><strong>{publicOffer.interest_rate}%</strong></div>
          <div><span>Monthly EMI</span><strong>{formatCurrency(publicOffer.emi)}</strong></div>
        </div>
        <p>{typedExplanation}</p>
        <label className="terms-check">
          <input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} />
          I agree to the loan terms and processing fee.
        </label>
        <button
          type="button"
          disabled={!termsAccepted || acceptMutation.isPending || accepted}
          onClick={() => acceptMutation.mutate()}
        >
          {accepted ? 'Accepted' : 'Accept Offer'}
        </button>
      </section>
    </main>
  );
}

function ApplicationField({ path, label, field, onEdit, disabled }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(displayFieldValue(field.value));
  const [reason, setReason] = useState(editReasons[0]);
  const tone = confidenceTone(field);

  useEffect(() => {
    setValue(displayFieldValue(field.value));
  }, [field.value]);

  function submitEdit() {
    onEdit({
      agent_id: 'agent-dashboard',
      field_path: path,
      new_value: value,
      reason
    });
    setEditing(false);
  }

  return (
    <div className={`application-field ${tone}`}>
      <div className="field-topline">
        <label>{label}</label>
        <span className={`source-badge ${field.source}`}>{sourceLabels[field.source] || field.source}</span>
      </div>
      {editing ? (
        <div className="inline-edit">
          <input value={value} onChange={(event) => setValue(event.target.value)} />
          <select value={reason} onChange={(event) => setReason(event.target.value)}>
            {editReasons.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <button type="button" disabled={disabled} onClick={submitEdit}>Save</button>
        </div>
      ) : (
        <button type="button" className="field-value-button" onClick={() => setEditing(true)}>
          {displayFieldValue(field.value) || 'Add value'}
        </button>
      )}
      <div className="field-confidence">
        <span>{Math.round((field.confidence || 0) * 100)}% confidence</span>
        {field.needs_review && <strong>⚠️ Review</strong>}
      </div>
    </div>
  );
}

function FieldConflictResolver({ application, applicationId, onEdit }) {
  const conflicts = [];

  for (const [sectionKey, section] of Object.entries(application)) {
    for (const [fieldKey, field] of Object.entries(section)) {
      if (field.conflicts?.length) {
        conflicts.push({
          path: `${sectionKey}.${fieldKey}`,
          label: fieldKey.replaceAll('_', ' '),
          field
        });
      }
    }
  }

  if (!conflicts.length) return null;

  return (
    <section className="conflict-resolver">
      <h2>Field Conflict Resolver</h2>
      {conflicts.map((item) => (
        <div className="conflict-card" key={item.path}>
          <h3>{item.label}</h3>
          <div className="conflict-split">
            <button
              type="button"
              onClick={() =>
                onEdit({
                  applicationId,
                  agent_id: 'agent-dashboard',
                  field_path: item.path,
                  new_value: displayFieldValue(item.field.value),
                  reason: 'Source conflict'
                })
              }
            >
              <span>Customer Said</span>
              <strong>{displayFieldValue(item.field.value)}</strong>
              <em>{sourceLabels[item.field.source]} · {Math.round(item.field.confidence * 100)}%</em>
            </button>
            {item.field.conflicts.map((conflict) => (
              <button
                type="button"
                key={`${item.path}-${conflict.source}`}
                onClick={() =>
                  onEdit({
                    applicationId,
                    agent_id: 'agent-dashboard',
                    field_path: item.path,
                    new_value: displayFieldValue(conflict.value),
                    reason: 'Source conflict'
                  })
                }
              >
                <span>{conflict.source}</span>
                <strong>{displayFieldValue(conflict.value)}</strong>
                <em>{Math.round((conflict.confidence || 0.9) * 100)}%</em>
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
