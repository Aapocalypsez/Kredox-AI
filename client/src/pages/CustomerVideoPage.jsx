import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useParams } from 'react-router-dom';

const stepCopy = [
  ['Identity', 'Verify your identity', 'Please look directly at the camera and hold your Aadhaar or PAN card clearly visible.'],
  ['Income', 'Tell us about your income', 'Please clearly state your monthly income and how long you have been employed.'],
  ['Consent', 'Give your consent', 'Please say: I consent to this loan application and verification process with Kredox AI.'],
  ['Complete', 'Verification Complete', 'Thank you, Rahul. Your application has been successfully submitted to Kredox AI.'],
];

export default function CustomerVideoPage() {
  const { token } = useParams();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step >= 3) return undefined;
    const timer = setTimeout(() => setStep((current) => current + 1), 5200);
    return () => clearTimeout(timer);
  }, [step]);

  return (
    <main className="customer-root">
      <section className="customer-card">
        <div style={{ textAlign: 'center' }}>
          <ShieldCheck color="#1E3A8A" />
          <h1 style={{ fontFamily: 'var(--font-display)', color: '#1E3A8A', marginTop: 8 }}>Kredox AI</h1>
          <p style={{ color: '#047857', marginTop: 6 }}>Secure Session · RBI Compliant</p>
        </div>

        <div className="stepper">
          {stepCopy.map(([label], index) => <span key={label} className={index < step ? 'done' : index === step ? 'active' : ''}>{label}</span>)}
        </div>

        {step < 3 ? (
          <>
            <div style={{ padding: 16, borderRadius: 16, background: '#EFF6FF', borderLeft: '4px solid #1E3A8A' }}>
              <h2 style={{ color: '#1E3A8A' }}>{stepCopy[step][1]}</h2>
              <p style={{ marginTop: 8, lineHeight: 1.55 }}>{stepCopy[step][2]}</p>
            </div>
            <div className="customer-camera">
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 38 }}>📷</div>
                <strong>Camera preview active</strong>
                <p style={{ opacity: 0.65, marginTop: 6 }}><span className="pulse-dot" style={{ background: '#10B981' }} /> Verifying... 01:02</p>
              </div>
            </div>
            <button className="btn" onClick={() => setStep((current) => Math.min(current + 1, 3))}>
              {step === 2 ? "I've said it →" : 'Continue →'}
            </button>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '22px 0' }}>
            <svg width="96" height="96" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#10B981" strokeWidth="6" />
              <path d="M30 52 L44 66 L72 34" fill="none" stroke="#10B981" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: 100, animation: 'checkmark-draw 0.8s ease forwards' }} />
            </svg>
            <h2 style={{ color: '#1E3A8A', marginTop: 16 }}>Verification Complete!</h2>
            <p style={{ lineHeight: 1.6, marginTop: 10 }}>{stepCopy[3][2]}</p>
            <div style={{ marginTop: 18, padding: 16, borderRadius: 16, background: '#EFF6FF' }}>
              <strong>Kredox AI is reviewing your application...</strong>
              <div className="progress" style={{ '--value': '60%', marginTop: 12 }}><span /></div>
              <p style={{ marginTop: 12 }}>Identity verified · Income captured · Consent recorded</p>
            </div>
          </div>
        )}

        <p style={{ textAlign: 'center', marginTop: 18, color: '#64748B', fontSize: 12 }}>
          Session: <span className="mono">{token || 'KYC-2024-0847'}</span><br />
          Your data is protected under RBI Digital Lending Guidelines 2022.
        </p>
      </section>
    </main>
  );
}
