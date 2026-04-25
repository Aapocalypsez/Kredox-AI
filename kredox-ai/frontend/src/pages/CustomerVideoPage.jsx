import { useEffect, useMemo, useRef, useState } from 'react';
import AgoraRTC, {
  AgoraRTCProvider,
  LocalUser,
  useConnectionState,
  useJoin,
  useLocalCameraTrack,
  useLocalMicrophoneTrack,
  usePublish
} from 'agora-rtc-react';
import { Briefcase, ChevronDown, CreditCard, Lock, Mic, ShieldCheck } from 'lucide-react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { linkAPI, videoAPI } from '../api/index.js';
import { useDeepgramTranscript } from '../hooks/useDeepgramTranscript.js';
import { useFrameCapture } from '../hooks/useFrameCapture.js';
import { useGeoCapture } from '../hooks/useGeoCapture.js';
import { useSessionRecording } from '../hooks/useSessionRecording.js';

const steps = ['Identity', 'Income', 'Consent', 'Complete'];

function Wordmark() {
  return (
    <div className="customer-wordmark">
      <span className="wordmark-k">Kredox</span>
      <span className="wordmark-ai">AI</span>
    </div>
  );
}

function Progress({ step }) {
  return (
    <div className="customer-progress">
      {steps.map((label, index) => (
        <div key={label} className={`customer-step ${index < step ? 'done' : index === step ? 'current' : ''}`}>
          <span className="step-dot">{index < step ? '✓' : ''}</span>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

function Instruction({ step }) {
  const content = [
    [CreditCard, 'Verify your identity', 'Please look directly at the camera and hold your Aadhaar or PAN card clearly visible.', 'Hold ID steady at arm length from camera.'],
    [Briefcase, 'Tell us about your income', 'Please clearly state your monthly income and how long you have been employed.', 'Example: I earn INR 45,000 per month and have worked at Infosys for 3 years.'],
    [Mic, 'Give your consent', 'Please clearly say the consent sentence shown below.', 'I consent to this loan application and verification process with Kredox AI.']
  ][step];
  const [Icon, title, body, example] = content;
  return (
    <section className="instruction">
      <Icon size={40} color="var(--acc)" />
      <h1>{title}</h1>
      <p>{body}</p>
      <div className="example">{example}</div>
    </section>
  );
}

function RtcProvider({ children }) {
  const client = useMemo(() => AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' }), []);
  return <AgoraRTCProvider client={client}>{children}</AgoraRTCProvider>;
}

function mediaProgress({ cvData, entities, transcript = [] }) {
  const consentFromTranscript = transcript.some((line) => /i consent to this loan application/i.test(line.text || ''));
  return {
    identity: Number(cvData?.liveness_score || 0) >= 60,
    income: Boolean(entities?.income?.value),
    consent: Boolean(entities?.consent?.value) || consentFromTranscript
  };
}

function CustomerAgoraStage({ tokenData, sessionId, onProgress, onMediaStream }) {
  const uid = `customer-${String(sessionId).slice(0, 8)}`;
  const shellRef = useRef(null);
  const videoRef = useRef(null);
  const joinReady = Boolean(tokenData?.appId && tokenData?.token && tokenData?.provider === 'agora');
  useJoin(
    {
      appid: tokenData?.appId || '',
      channel: tokenData?.channel_name || '',
      token: tokenData?.token || null,
      uid
    },
    joinReady
  );
  const { localMicrophoneTrack } = useLocalMicrophoneTrack(joinReady);
  const { localCameraTrack } = useLocalCameraTrack(joinReady);
  usePublish([localMicrophoneTrack, localCameraTrack], Boolean(joinReady && localMicrophoneTrack && localCameraTrack));
  const transcriptState = useDeepgramTranscript(sessionId, [localMicrophoneTrack], true);
  const { cvData } = useFrameCapture(videoRef, sessionId);
  const connectionState = useConnectionState();

  useEffect(() => {
    const tracks = [localCameraTrack, localMicrophoneTrack]
      .filter(Boolean)
      .map((track) => track.getMediaStreamTrack?.())
      .filter(Boolean);

    if (tracks.length) {
      onMediaStream?.(new MediaStream(tracks));
    }

    return () => {
      onMediaStream?.(null);
    };
  }, [localCameraTrack, localMicrophoneTrack, onMediaStream]);

  useEffect(() => {
    const updateVideoRef = () => {
      const video = shellRef.current?.querySelector('video') || null;
      videoRef.current = video;
    };
    updateVideoRef();
    const interval = window.setInterval(updateVideoRef, 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    onProgress({
      ...mediaProgress({ cvData, entities: transcriptState.entities, transcript: transcriptState.transcript }),
      connection: String(connectionState || 'connecting').toLowerCase(),
      fallback: transcriptState.isFallbackMode,
      sttStatus: transcriptState.wsStatus
    });
  }, [connectionState, cvData, onProgress, transcriptState.entities, transcriptState.isFallbackMode, transcriptState.transcript, transcriptState.wsStatus]);

  return (
    <div className="customer-video rtc-stage" ref={shellRef}>
      <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
      <LocalUser
        className="full-local-video"
        audioTrack={localMicrophoneTrack}
        videoTrack={localCameraTrack}
        micOn={Boolean(localMicrophoneTrack)}
        cameraOn={Boolean(localCameraTrack)}
        playAudio={false}
        playVideo
      />
      <div className="customer-video-bottom">
        <span><span className="dot dot-green pulse" /> Live video active</span>
        <span className="mono">{transcriptState.isFallbackMode ? 'Web Speech' : 'Agora RTC'}</span>
      </div>
    </div>
  );
}

function CustomerFallbackStage({ sessionId, onProgress, onMediaStream }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const transcriptState = useDeepgramTranscript(sessionId, [], true);
  const { cvData } = useFrameCapture(videoRef, sessionId);

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
        onMediaStream?.(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        toast.error('Camera or microphone permission is required for live onboarding');
      }
    }

    startMedia();
    return () => {
      cancelled = true;
      onMediaStream?.(null);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [onMediaStream]);

  useEffect(() => {
    onProgress({
      ...mediaProgress({ cvData, entities: transcriptState.entities, transcript: transcriptState.transcript }),
      connection: 'browser-media',
      fallback: true,
      sttStatus: transcriptState.wsStatus
    });
  }, [cvData, onProgress, transcriptState.entities, transcriptState.transcript, transcriptState.wsStatus]);

  return (
    <div className="customer-video">
      <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
      <video ref={videoRef} autoPlay muted playsInline className="camera-video" />
      <div className="customer-video-bottom">
        <span><span className="dot dot-green pulse" /> Browser live media</span>
        <span className="mono">{transcriptState.isFallbackMode ? 'Web Speech' : 'WS relay'}</span>
      </div>
    </div>
  );
}

export default function CustomerVideoPage() {
  const { token } = useParams();
  const [manualStep, setManualStep] = useState(0);
  const [tips, setTips] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [linkData, setLinkData] = useState(null);
  const [session, setSession] = useState(null);
  const [rtcToken, setRtcToken] = useState(null);
  const [completed, setCompleted] = useState(false);
  const [recordingStream, setRecordingStream] = useState(null);
  const [liveProgress, setLiveProgress] = useState({
    identity: false,
    income: false,
    consent: false,
    connection: 'preparing',
    fallback: false,
    sttStatus: 'idle'
  });
  const finishedRef = useRef(false);
  const geoCapture = useGeoCapture(session?.session_id);
  const recording = useSessionRecording(session?.session_id, recordingStream, Boolean(session?.session_id && !completed));

  useEffect(() => {
    const previous = document.body.style.background;
    document.body.style.background = '#F4F6FA';
    return () => {
      document.body.style.background = previous || '#F5F7FA';
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function validateAndStart() {
      try {
        setLoading(true);
        const validation = await linkAPI.validate(token);
        if (!validation.valid) {
          setError(validation.reason || 'This verification link is invalid or expired');
          return;
        }

        const videoSession = await videoAPI.startSession(validation.customer_id, null);
        const tokenData = await videoAPI
          .getToken(videoSession.channel_name, `customer-${validation.customer_id}`, 'publisher')
          .catch(() => ({ provider: 'browser_media', disabled: true }));

        if (!cancelled) {
          setLinkData(validation);
          setSession(videoSession);
          setRtcToken(tokenData);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error || 'Unable to start secure verification');
          toast.error('Unable to start secure verification');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    validateAndStart();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const autoStep = liveProgress.consent ? 2 : liveProgress.income ? 1 : liveProgress.identity ? 1 : 0;
  const currentStep = completed ? 3 : Math.max(manualStep, autoStep);

  const finishFlow = async () => {
    if (finishedRef.current || !session?.session_id || !linkData?.session_token) return;
    finishedRef.current = true;

    await recording.stopRecording().catch(() => {});

    try {
      await linkAPI.complete({ token, session_token: linkData.session_token });
    } catch (err) {
      toast.error(err.response?.data?.reason || 'Could not complete verification link');
    }

    try {
      await videoAPI.endSession(session.session_id);
    } catch {
      // Session may already be closed from another client.
    }

    setCompleted(true);
  };

  useEffect(() => {
    if (liveProgress.consent && !completed) {
      const timer = window.setTimeout(() => {
        finishFlow();
      }, 1200);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [completed, liveProgress.consent]);

  if (loading) {
    return (
      <main className="customer-page">
        <div className="customer-shell">
          <Wordmark />
          <section className="instruction">
            <Lock size={40} color="var(--acc)" />
            <h1>Starting secure session</h1>
            <p>Validating your Kredox AI link with the backend.</p>
          </section>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="customer-page">
        <div className="customer-shell">
          <Wordmark />
          <section className="instruction">
            <Lock size={40} color="var(--acc)" />
            <h1>Link unavailable</h1>
            <p>{error}</p>
          </section>
        </div>
      </main>
    );
  }

  if (completed) {
    return (
      <main className="customer-page">
        <div className="customer-shell">
          <Wordmark />
          <div className="secure"><Lock size={11} />Secure Session - RBI Compliant</div>
          <Progress step={3} />
          <section className="complete">
            <svg width="88" height="88" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#00A86B" strokeWidth="5" />
              <path d="M30 52 L44 66 L72 34" fill="none" stroke="#00A86B" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="100" style={{ animation: 'checkmark-draw .8s ease forwards' }} />
            </svg>
            <h1>Verification Complete</h1>
            <p>Thank you. Your secure Kredox AI verification has been submitted.</p>
            <div className="light-progress"><span /></div>
            <p className="muted">Identity verified - income captured - consent recorded - risk assessment running</p>
          </section>
          <footer className="trust-footer">SSL Secured - RBI Regulated - ISO 27001 - Session <span className="mono">{session?.session_id}</span></footer>
        </div>
      </main>
    );
  }

  return (
    <main className="customer-page">
      <div className="customer-shell">
        <Wordmark />
        <div className="secure"><Lock size={11} />Secure Session - RBI Compliant</div>
        <Progress step={currentStep} />
        <Instruction step={Math.min(currentStep, 2)} />

        {rtcToken?.provider === 'agora' ? (
          <RtcProvider>
            <CustomerAgoraStage
              tokenData={rtcToken}
              sessionId={session.session_id}
              onProgress={setLiveProgress}
              onMediaStream={setRecordingStream}
            />
          </RtcProvider>
        ) : (
          <CustomerFallbackStage sessionId={session.session_id} onProgress={setLiveProgress} onMediaStream={setRecordingStream} />
        )}

        <div className="chips">
          <span className={liveProgress.identity ? 'badge badge-green' : 'badge badge-dim'}>Identity</span>
          <span className={geoCapture.geoStatus === 'verified' ? 'badge badge-green' : 'badge badge-dim'}>Geo</span>
          <span className={liveProgress.income ? 'badge badge-green' : 'badge badge-blue'}>{liveProgress.income ? 'Income captured' : 'Income listening'}</span>
          <span className={liveProgress.consent ? 'badge badge-green' : 'badge badge-dim'}>{liveProgress.consent ? 'Consent confirmed' : 'Consent pending'}</span>
        </div>

        <div className="badge-row" style={{ marginBottom: 12 }}>
          <span className={`badge ${rtcToken?.provider === 'agora' ? 'badge-blue' : 'badge-dim'}`}>
            {rtcToken?.provider === 'agora' ? 'Agora live channel' : 'Browser live fallback'}
          </span>
          <span className={`badge ${liveProgress.fallback ? 'badge-amber' : 'badge-green'}`}>
            {liveProgress.fallback ? 'Fallback speech mode' : 'Realtime STT mode'}
          </span>
          <span className={`badge ${recording.status === 'uploaded' ? 'badge-green' : recording.status === 'recording' || recording.status === 'stopping' || recording.status === 'uploading' ? 'badge-blue' : recording.status === 'failed' ? 'badge-red' : 'badge-dim'}`}>
            {recording.status === 'uploaded'
              ? 'Recording uploaded'
              : recording.status === 'recording'
                ? 'Recording live'
                : recording.status === 'stopping'
                  ? 'Stopping recorder'
                  : recording.status === 'uploading'
                    ? 'Uploading recording'
                    : recording.status === 'stored_without_playback'
                      ? 'Recording stored'
                      : recording.status === 'unsupported'
                        ? 'Recording unsupported'
                        : 'Recording pending'}
          </span>
        </div>

        <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setManualStep((value) => Math.min(value + 1, 2))}>
          Continue
        </button>
        <section className="tips">
          <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'space-between' }} onClick={() => setTips((value) => !value)}>
            Tips for best results <ChevronDown size={14} />
          </button>
          {tips && <p style={{ marginTop: 8 }}>Speak clearly in a quiet room. Keep your phone steady at eye level. Ensure light falls evenly on your face.</p>}
        </section>
        <footer className="trust-footer">Your data is protected under RBI Digital Lending Guidelines 2022. Customer <span className="mono">{linkData?.customer_id}</span></footer>
      </div>
    </main>
  );
}
