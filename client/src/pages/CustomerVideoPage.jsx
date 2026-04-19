import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useParams } from 'react-router-dom';
import AgoraRTC, {
  AgoraRTCProvider,
  LocalUser,
  useConnectionState,
  useJoin,
  useLocalCameraTrack,
  useLocalMicrophoneTrack,
  usePublish
} from 'agora-rtc-react';
import { linkAPI, storageAPI, videoAPI } from '../api/index.js';
import { useDeepgramTranscript } from '../hooks/useDeepgramTranscript.js';
import { useFrameCapture } from '../hooks/useFrameCapture.js';
import { useGeoCapture } from '../hooks/useGeoCapture.js';

const steps = [
  ['Identity', 'Please hold your ID card up to the camera'],
  ['Income', 'Please state your monthly income and employment'],
  ['Consent', 'Please say: I consent to this loan application'],
  ['Complete', 'Thank you, your application is being processed']
];

function CustomerAgora({ tokenData, uid, localVideoRef }) {
  const { localMicrophoneTrack } = useLocalMicrophoneTrack(Boolean(tokenData));
  const { localCameraTrack } = useLocalCameraTrack(Boolean(tokenData));
  const connectionState = String(useConnectionState() || 'connecting').toLowerCase();

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
    const locateVideo = () => {
      localVideoRef.current = document.querySelector('.customer-video-stage video');
    };
    locateVideo();
    const interval = setInterval(locateVideo, 1000);
    return () => clearInterval(interval);
  }, [localCameraTrack, localVideoRef]);

  return (
    <>
      <LocalUser
        className="customer-local-video"
        audioTrack={localMicrophoneTrack}
        videoTrack={localCameraTrack}
        micOn
        cameraOn
        playAudio={false}
        playVideo
      />
      <span className={`status-pill ${connectionState}`}>{connectionState}</span>
    </>
  );
}

function AgoraShell({ children }) {
  const client = useMemo(() => AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' }), []);
  return <AgoraRTCProvider client={client}>{children}</AgoraRTCProvider>;
}

export function CustomerVideoPage() {
  const { token } = useParams();
  const localVideoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const [validation, setValidation] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [channelName, setChannelName] = useState(null);
  const [tokenData, setTokenData] = useState(null);
  const [activeStep, setActiveStep] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [invalidReason, setInvalidReason] = useState(null);

  const transcriptState = useDeepgramTranscript(sessionId);
  const { cvData } = useFrameCapture(localVideoRef, sessionId);
  const { geoStatus } = useGeoCapture(sessionId);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        setLoading(true);
        const validated = await linkAPI.validate(token);
        if (!validated.valid) {
          setInvalidReason(validated.reason || 'Link expired');
          return;
        }

        setValidation(validated);
        const started = await videoAPI.startSession(validated.customer_id, null, validated.session_token);
        const newSessionId = started.session_id || started.id || started.session?.id;
        const newChannelName = started.channel_name || String(newSessionId);
        setSessionId(newSessionId);
        setChannelName(newChannelName);
        const agoraToken = await videoAPI.getToken(newChannelName, validated.customer_id, 'publisher');
        setTokenData(agoraToken);
      } catch (error) {
        setInvalidReason(error.response?.data?.reason || error.response?.data?.error || 'Unable to validate link');
        toast.error(error.response?.data?.error || 'Failed to start secure call');
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, [token]);

  useEffect(() => {
    if (!sessionId || !transcriptState.sendAudioChunk) return undefined;
    let localStream;

    const startAudioRelay = async () => {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(localStream, { mimeType: 'audio/webm' });
        mediaRecorderRef.current = recorder;
        recorder.ondataavailable = (event) => {
          if (event.data?.size) transcriptState.sendAudioChunk(event.data);
        };
        recorder.start(1000);
      } catch {
        toast.error('Microphone audio could not be streamed for transcription');
      }
    };

    startAudioRelay();
    return () => {
      mediaRecorderRef.current?.stop();
      localStream?.getTracks().forEach((track) => track.stop());
    };
  }, [sessionId, transcriptState.sendAudioChunk]);

  useEffect(() => {
    if ((cvData?.liveness_score || 0) > 60 && activeStep < 1) setActiveStep(1);
  }, [activeStep, cvData]);

  useEffect(() => {
    if (transcriptState.entities.income && activeStep < 2) setActiveStep(2);
    if (transcriptState.entities.consent && activeStep < 3) setActiveStep(3);
  }, [activeStep, transcriptState.entities]);

  const finish = async () => {
    try {
      if (sessionId) await videoAPI.endSession(sessionId);
      setActiveStep(3);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to complete session');
    }
  };

  const uploadDemoVideo = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !sessionId) return;

    try {
      setUploading(true);
      await storageAPI.uploadRecording(sessionId, file);
      toast.success('Verification video uploaded');
      await finish();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Video upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return <main className="customer-page"><div className="call-message">Validating secure link...</div></main>;
  }

  if (invalidReason) {
    return <main className="customer-page"><div className="call-message error-text">{invalidReason}</div></main>;
  }

  return (
    <main className="customer-page">
      <section className="customer-panel">
        <p className="eyebrow">Kredox AI verification</p>
        <div className="stepper">
          {steps.map(([label], index) => (
            <span key={label} className={index <= activeStep ? 'complete' : ''}>{label}</span>
          ))}
        </div>
        <div className="customer-video-stage">
          {tokenData?.disabled ? (
            <div className="upload-demo-panel">
              <h2>Upload verification video</h2>
              <p>Live RTC is optional for this demo. Record a short video on your phone or laptop, then upload it here.</p>
              <label>
                Verification video
                <input type="file" accept="video/*" disabled={uploading} onChange={uploadDemoVideo} />
              </label>
              {uploading && <p>Uploading securely...</p>}
            </div>
          ) : tokenData ? (
            <AgoraShell>
              <CustomerAgora tokenData={tokenData} uid={validation?.customer_id} localVideoRef={localVideoRef} />
            </AgoraShell>
          ) : (
            <div className="video-placeholder">Preparing camera...</div>
          )}
        </div>
        <p className="customer-instruction">{steps[activeStep][1]}</p>
        <p className="secure-note">Location status: {geoStatus}</p>
        {activeStep === 3 ? (
          <div className="call-message">Thank you, your application is being processed.</div>
        ) : (
          <button type="button" onClick={finish}>Finish Verification</button>
        )}
      </section>
    </main>
  );
}
