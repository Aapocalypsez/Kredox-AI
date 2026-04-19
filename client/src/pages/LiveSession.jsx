import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
  applicationAPI,
  bureauAPI,
  llmAPI,
  offerAPI,
  riskAPI,
  videoAPI
} from '../api/index.js';
import { useAppContext } from '../context/AppContext.jsx';
import { useDeepgramTranscript } from '../hooks/useDeepgramTranscript.js';
import { useFrameCapture } from '../hooks/useFrameCapture.js';
import { useGeoCapture } from '../hooks/useGeoCapture.js';

function formatDuration(totalSeconds) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function AgoraShell({ children }) {
  const client = useMemo(() => AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' }), []);
  return <AgoraRTCProvider client={client}>{children}</AgoraRTCProvider>;
}

function ConnectionStatePill() {
  const state = useConnectionState();
  const normalized = String(state || 'connecting').toLowerCase();
  return <span className={`status-pill ${normalized}`}>{normalized}</span>;
}

function VideoRoom({ tokenData, uid, remoteVideoRef }) {
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const { localMicrophoneTrack } = useLocalMicrophoneTrack(Boolean(tokenData));
  const { localCameraTrack } = useLocalCameraTrack(Boolean(tokenData));
  const remoteUsers = useRemoteUsers();

  useJoin(
    {
      appid: tokenData?.appId || '',
      channel: tokenData?.channel_name || '',
      token: tokenData?.token || null,
      uid
    },
    Boolean(tokenData)
  );
  usePublish([localMicrophoneTrack, localCameraTrack], Boolean(localMicrophoneTrack && localCameraTrack));

  useEffect(() => {
    localMicrophoneTrack?.setEnabled(micOn);
  }, [localMicrophoneTrack, micOn]);

  useEffect(() => {
    localCameraTrack?.setEnabled(cameraOn);
  }, [localCameraTrack, cameraOn]);

  useEffect(() => {
    const findRemoteVideo = () => {
      remoteVideoRef.current = document.querySelector('.remote-video-tile video');
    };
    findRemoteVideo();
    const interval = setInterval(findRemoteVideo, 1000);
    return () => clearInterval(interval);
  }, [remoteUsers, remoteVideoRef]);

  return (
    <>
      <div className="remote-video-tile">
        {remoteUsers[0] ? (
          <RemoteUser user={remoteUsers[0]} playAudio playVideo />
        ) : (
          <div className="video-placeholder">Waiting for customer video...</div>
        )}
      </div>
      <LocalUser
        className="pip-video"
        audioTrack={localMicrophoneTrack}
        videoTrack={localCameraTrack}
        micOn={micOn}
        cameraOn={cameraOn}
        playAudio={false}
        playVideo
      />
      <div className="call-toggles">
        <button type="button" className="secondary" onClick={() => setMicOn((value) => !value)}>
          {micOn ? 'Mute' : 'Unmute'}
        </button>
        <button type="button" className="secondary" onClick={() => setCameraOn((value) => !value)}>
          {cameraOn ? 'Camera Off' : 'Camera On'}
        </button>
      </div>
    </>
  );
}

function TranscriptPanel({ transcript, isConnected }) {
  return (
    <section className="panel transcript-panel">
      <div className="panel-title-row">
        <h2>Transcript</h2>
        <span className={isConnected ? 'live-dot on' : 'live-dot off'}>
          {isConnected ? 'Transcribing' : 'Disconnected'}
        </span>
      </div>
      {transcript.length ? (
        <div className="transcript-scroll">
          {transcript.map((line) => (
            <p key={line.id} className={line.is_final ? 'final-line' : 'interim-line'}>
              <strong>{line.speaker || 'Customer'}:</strong> {line.text}
            </p>
          ))}
        </div>
      ) : (
        <p className="empty-state">Transcript will appear as Deepgram returns speech chunks.</p>
      )}
    </section>
  );
}

function DataCard({ label, value, loading }) {
  return (
    <article className="mini-card">
      <span>{label}</span>
      {loading ? <div className="skeleton-line" /> : <strong>{value || 'Awaiting signal'}</strong>}
      <button type="button" className="text-button">Flag this response</button>
    </article>
  );
}

export function LiveSession() {
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { agent, setCurrentSession, updateEntity } = useAppContext();
  const remoteVideoRef = useRef(null);
  const [session, setSession] = useState(null);
  const [tokenData, setTokenData] = useState(null);
  const [bureauScore, setBureauScore] = useState(null);
  const [duration, setDuration] = useState(0);
  const [ending, setEnding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');

  const transcriptState = useDeepgramTranscript(sessionId);
  const { cvData, frameCount } = useFrameCapture(remoteVideoRef, sessionId);
  const { geoResult, geoStatus } = useGeoCapture(sessionId);

  useEffect(() => {
    Object.entries(transcriptState.entities).forEach(([field, data]) => updateEntity(field, data.value));
  }, [transcriptState.entities, updateEntity]);

  useEffect(() => {
    const timer = setInterval(() => setDuration((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadSession = async () => {
      try {
        setLoading(true);
        const [token, sessionData] = await Promise.all([
          videoAPI.getToken(sessionId, agent?.id || `agent-${Date.now()}`, 'publisher'),
          videoAPI.getSession(sessionId).catch(() => null)
        ]);
        const normalizedSession = sessionData?.session || sessionData;
        setTokenData(token);
        setSession(normalizedSession);
        setCurrentSession(normalizedSession);

        const customerId = normalizedSession?.customer_id || searchParams.get('customer_id');
        if (customerId) {
          const bureau = await bureauAPI.get(customerId);
          setBureauScore(bureau.score ?? bureau.bureau_score ?? bureau.customer?.bureau_score);
        }
      } catch (error) {
        toast.error(error.response?.data?.error || 'Failed to initialize live session');
      } finally {
        setLoading(false);
      }
    };

    loadSession();
  }, [agent?.id, searchParams, sessionId, setCurrentSession]);

  const handleEndSession = async () => {
    try {
      setEnding(true);
      await videoAPI.endSession(sessionId);
      await llmAPI.analyze(sessionId);
      await riskAPI.finalScore(sessionId, session?.customer_id);
      const application = await applicationAPI.compile(sessionId);
      const applicationId = application.id || application.application?.id || application.loan_application?.id;
      if (applicationId) await offerAPI.generate(sessionId, applicationId);
      toast.success('Post-call analysis is ready');
      navigate(`/dashboard/report/${sessionId}`);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to complete post-call pipeline');
    } finally {
      setEnding(false);
    }
  };

  const income = transcriptState.entities.income?.value;
  const employment = transcriptState.entities.employment?.value;
  const consent = transcriptState.entities.consent?.value ? 'Confirmed' : null;
  const ageEstimate = cvData?.age_range
    ? `${cvData.age_range.low ?? cvData.age_range.Low}-${cvData.age_range.high ?? cvData.age_range.High} yrs`
    : null;
  const geoLabel = geoResult?.gps_city ? `${geoResult.gps_city}, ${geoResult.gps_state || ''}` : geoStatus;

  return (
    <main className="page-shell">
      <section className="session-header">
        <div>
          <p className="eyebrow">Live underwriting</p>
          <h1>Session {sessionId}</h1>
        </div>
        <div className="session-actions">
          <span className="rec-indicator"><span /> REC</span>
          <strong>{formatDuration(duration)}</strong>
          <button type="button" className="danger" disabled={ending} onClick={handleEndSession}>
            {ending ? 'Ending...' : 'End Call'}
          </button>
        </div>
      </section>

      <section className="session-layout">
        <div className="session-left">
          <div className="video-stage">
            {loading ? (
              <div className="video-placeholder">Connecting to Agora...</div>
            ) : (
              <AgoraShell>
                <ConnectionStatePill />
                <VideoRoom tokenData={tokenData} uid={agent?.id || tokenData?.uid || sessionId} remoteVideoRef={remoteVideoRef} />
              </AgoraShell>
            )}
          </div>
          <TranscriptPanel transcript={transcriptState.transcript} isConnected={transcriptState.isConnected} />
        </div>

        <aside className="session-right">
          <div className="live-card-grid">
            <DataCard label="CV Age Estimate" value={ageEstimate} loading={!cvData} />
            <DataCard label="Geo Location" value={geoLabel} loading={geoStatus === 'requesting' || geoStatus === 'verifying'} />
            <DataCard label="Consent Detected" value={consent} loading={!consent} />
            <DataCard label="Bureau Score" value={bureauScore} loading={bureauScore === null} />
            <DataCard label="Employment Type" value={employment} loading={!employment} />
            <DataCard label="Income Declared" value={income} loading={!income} />
          </div>

          <article className="panel">
            <h2>Computer Vision</h2>
            <p>Liveness: <strong>{cvData?.liveness_status || 'Awaiting frames'}</strong></p>
            <div className="meter"><span style={{ width: `${cvData?.liveness_score || 0}%` }} /></div>
            <p>{frameCount} frames analyzed</p>
          </article>

          <article className="panel">
            <h2>Session Notes</h2>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Add notes for the risk analyst" />
          </article>
        </aside>
      </section>
    </main>
  );
}
