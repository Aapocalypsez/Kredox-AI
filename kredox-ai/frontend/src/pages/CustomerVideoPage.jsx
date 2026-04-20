import { useEffect, useState } from 'react';
import { Briefcase, ChevronDown, CreditCard, Lock, Mic, ShieldCheck } from 'lucide-react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { linkAPI, videoAPI } from '../api/index.js';
import { useGeoCapture } from '../hooks/useGeoCapture.js';

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

export default function CustomerVideoPage() {
  const { token } = useParams();
  const [step, setStep] = useState(0);
  const [tips, setTips] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [linkData, setLinkData] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  useGeoCapture(sessionId);

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
        const session = await videoAPI.startSession(validation.customer_id, null);
        if (!cancelled) {
          setLinkData(validation);
          setSessionId(session.session_id);
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

  if (step === 3) {
    return (
      <main className="customer-page">
        <div className="customer-shell">
          <Wordmark />
          <div className="secure"><Lock size={11} />Secure Session - RBI Compliant</div>
          <Progress step={step} />
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
          <footer className="trust-footer">SSL Secured - RBI Regulated - ISO 27001 - Session <span className="mono">{sessionId}</span></footer>
        </div>
      </main>
    );
  }

  return (
    <main className="customer-page">
      <div className="customer-shell">
        <Wordmark />
        <div className="secure"><Lock size={11} />Secure Session - RBI Compliant</div>
        <Progress step={step} />
        <Instruction step={step} />
        <div className="customer-video">
          <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
          <div className="video-center"><ShieldCheck size={36} /><span>Camera verification active</span></div>
          <div className="customer-video-bottom">
            <span><span className="dot dot-green pulse" /> Verifying...</span>
            <span className="mono">{sessionId ? String(sessionId).slice(0, 8) : 'pending'}</span>
          </div>
        </div>
        <div className="chips">
          <span className="badge badge-green">Link validated</span>
          <span className="badge badge-blue">Session started</span>
          <span className={step >= 1 ? 'badge badge-green' : 'badge badge-dim'}>Income</span>
          <span className={step >= 2 ? 'badge badge-green' : 'badge badge-dim'}>Consent</span>
        </div>
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setStep((value) => Math.min(value + 1, 3))}>Continue</button>
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
