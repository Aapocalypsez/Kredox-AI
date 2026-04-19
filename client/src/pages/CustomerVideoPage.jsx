import { useEffect, useState } from 'react';
import { ChevronDown, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { useParams } from 'react-router-dom';

const steps = ['Identity', 'Income', 'Consent', 'Complete'];

function Progress({ currentStep }) {
  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const complete = index + 1 < currentStep;
          const active = index + 1 === currentStep;
          return (
            <div key={step} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <span className={`grid h-9 w-9 place-items-center rounded-full text-sm font-bold ${complete ? 'bg-emerald-500 text-white' : active ? 'bg-[#1E3A8A] text-white shadow-lg shadow-blue-900/20 pulse-dot' : 'bg-slate-200 text-slate-500'}`}>
                  {complete ? '✓' : index + 1}
                </span>
                <span className="mt-2 text-[11px] font-bold text-slate-600">{step}</span>
              </div>
              {index < steps.length - 1 && <div className={`mx-2 h-1 flex-1 rounded-full ${index + 1 < currentStep ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CameraBox() {
  return (
    <div className="customer-viewfinder relative mt-5 aspect-[4/3] overflow-hidden rounded-2xl bg-slate-950">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.04)_1px,transparent_1px)] bg-[size:28px_28px]" />
      <div className="absolute inset-0 grid place-items-center text-center text-white">
        <div>
          <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-full bg-white/10 text-3xl">📷</div>
          <p className="font-bold">Camera preview active</p>
          <p className="mt-1 text-xs text-white/55">Hold steady in good light</p>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-black/50 px-4 py-3 text-sm text-white">
        <span><span className="pulse-dot mr-2 inline-block h-2 w-2 rounded-full bg-emerald-400" />Verifying...</span>
        <span className="mono">01:02</span>
      </div>
    </div>
  );
}

function TrustFooter({ token }) {
  return (
    <footer className="mt-8 rounded-2xl bg-white p-4 text-center text-xs text-slate-500 shadow-sm">
      <p>Your data is protected under RBI Digital Lending Guidelines 2022</p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {['SSL Secured', 'RBI Regulated', 'ISO 27001', 'DPDP Compliant'].map((badge) => <span key={badge} className="rounded-full bg-slate-100 px-3 py-1">{badge}</span>)}
      </div>
      <p className="mono mt-3 text-[10px]">Session: {token || 'KYC-2024-0847'}</p>
    </footer>
  );
}

function Tips() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-5 rounded-2xl bg-white p-4 shadow-sm">
      <button className="flex w-full items-center justify-between font-bold text-slate-800" onClick={() => setOpen(!open)}>
        Tips for best results <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul className="mt-3 space-y-2 text-sm text-slate-600">
          <li>Speak clearly in a quiet room.</li>
          <li>Ensure good lighting on your face.</li>
          <li>Hold phone steady at eye level.</li>
        </ul>
      )}
    </div>
  );
}

function InstructionCard({ icon, title, description, example, phrase }) {
  return (
    <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mt-6 rounded-2xl border-l-4 border-[#1E3A8A] bg-[#EFF6FF] p-5">
      <div className="text-5xl">{icon}</div>
      <h1 className="mt-3 text-2xl font-extrabold text-[#1E3A8A]">{title}</h1>
      <p className="mt-2 text-slate-700">{description}</p>
      {example && <div className="mt-4 rounded-xl border border-dashed border-blue-300 bg-white/70 p-3 text-sm text-slate-600">{example}</div>}
      {phrase && <div className="mt-4 rounded-xl bg-[#1E3A8A] p-4 text-center font-bold leading-relaxed text-white">{phrase}</div>}
    </motion.section>
  );
}

function CompleteStep() {
  const confetti = Array.from({ length: 20 }, (_, index) => index);
  return (
    <section className="relative mt-8 overflow-hidden rounded-3xl bg-white p-6 text-center shadow-sm">
      {confetti.map((item) => (
        <span
          key={item}
          className="absolute -top-4 h-2 w-2 animate-[confetti-fall_3s_linear_infinite]"
          style={{ left: `${(item * 17) % 100}%`, animationDelay: `${item * 0.11}s`, background: ['#10B981', '#5B6EF5', '#F59E0B', '#EF4444'][item % 4] }}
        />
      ))}
      <svg className="mx-auto h-24 w-24" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="42" fill="none" stroke="#10B981" strokeWidth="6" />
        <path className="check-draw" d="M30 52 L44 66 L72 34" fill="none" stroke="#10B981" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <h1 className="mt-5 text-3xl font-extrabold text-[#1E3A8A]">Verification Complete!</h1>
      <p className="mt-3 text-slate-700">Thank you, Rahul. Your application has been successfully submitted to Kredox AI.</p>
      <p className="mt-2 text-slate-600">You'll receive your loan decision via WhatsApp within 10 minutes.</p>
      <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-left">
        <p className="font-bold text-[#1E3A8A]">Kredox AI is reviewing your application...</p>
        <div className="mt-3 h-2 rounded-full bg-blue-100"><div className="h-full w-[60%] rounded-full bg-[#1E3A8A]" /></div>
        <ul className="mt-4 space-y-2 text-sm text-slate-700">
          <li>✓ Identity verified</li>
          <li>✓ Income captured</li>
          <li>✓ Consent recorded</li>
          <li className="text-[#1E3A8A]">Risk assessment in progress...</li>
        </ul>
      </div>
      <a href="tel:18002660101" className="mt-6 inline-block font-bold text-[#1E3A8A]">Need help? Call 1800-266-0101</a>
      <p className="mt-5 text-xs text-slate-400">Poonawalla Fincorp secure verification powered by Kredox AI</p>
    </section>
  );
}

export function CustomerVideoPage() {
  const { token } = useParams();
  const [currentStep, setCurrentStep] = useState(1);

  useEffect(() => {
    if (currentStep === 4) return undefined;
    const timer = setTimeout(() => setCurrentStep((step) => Math.min(step + 1, 4)), 5500);
    return () => clearTimeout(timer);
  }, [currentStep]);

  const stepContent = {
    1: <InstructionCard icon="🪪" title="Verify your identity" description="Please look directly at the camera and hold your Aadhaar or PAN card clearly visible." example="Tip: Hold ID steady at arm's length from camera." />,
    2: <InstructionCard icon="💬" title="Tell us about your income" description="Please look at the camera and clearly state your monthly income and how long you've been employed." example={'Example: "I earn ₹45,000 per month and have been working at Infosys for 3 years."'} />,
    3: <InstructionCard icon="✍️" title="Give your consent" description="Please look at the camera and clearly say the following sentence:" phrase="I consent to this loan application and verification process with Kredox AI" />
  };

  return (
    <main className="min-h-screen bg-[#FAFBFF] px-4 py-5 font-customer text-slate-800">
      <div className="mx-auto max-w-[430px]">
        <header className="text-center">
          <div className="flex items-center justify-center gap-2 text-2xl font-extrabold text-[#1E3A8A]">
            <ShieldCheck className="h-6 w-6" /> Kredox AI
          </div>
          <p className="mt-2 text-xs font-bold text-emerald-600">Secure Session - RBI Compliant</p>
        </header>

        <Progress currentStep={currentStep} />

        {currentStep === 4 ? (
          <CompleteStep />
        ) : (
          <>
            {stepContent[currentStep]}
            <CameraBox />
            {currentStep === 2 && (
              <div className="mt-4 flex gap-2 overflow-x-auto pb-2 text-xs">
                <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-2 font-bold text-emerald-700">Face verified</span>
                <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-2 font-bold text-emerald-700">Location confirmed</span>
                <span className="shrink-0 rounded-full bg-amber-50 px-3 py-2 font-bold text-amber-700">Income listening...</span>
                <span className="shrink-0 rounded-full bg-slate-100 px-3 py-2 font-bold text-slate-500">Consent</span>
              </div>
            )}
            <button
              className="mt-5 w-full rounded-xl bg-[#1E3A8A] px-5 py-4 font-bold text-white shadow-lg shadow-blue-900/20"
              onClick={() => setCurrentStep((step) => Math.min(step + 1, 4))}
            >
              {currentStep === 1 ? 'Continue →' : currentStep === 2 ? 'Continue →' : "I've said it →"}
            </button>
            <Tips />
          </>
        )}

        <TrustFooter token={token} />
      </div>
    </main>
  );
}
