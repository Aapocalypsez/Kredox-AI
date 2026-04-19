import { motion } from 'framer-motion';
import { Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button.jsx';
import { Input } from '../components/ui/Input.jsx';
import { useAppContext } from '../context/AppContext.jsx';

export function Login() {
  const [activeTab, setActiveTab] = useState('agent');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setAgent } = useAppContext();

  const submit = (event) => {
    event.preventDefault();
    setLoading(true);
    setTimeout(() => {
      localStorage.setItem('kredox_token', 'demo-agent-token');
      setAgent({ name: activeTab === 'agent' ? 'Ravi Desai' : 'Admin Console', role: activeTab === 'agent' ? 'Senior Agent' : 'Platform Admin' });
      navigate('/dashboard');
    }, 1500);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg-base text-text-primary">
      <div className="absolute -left-24 top-16 h-80 w-80 rounded-full bg-[#3730A3]/[0.08] blur-3xl" style={{ animation: 'mesh-one 10s ease-in-out infinite' }} />
      <div className="absolute right-10 top-1/4 h-96 w-96 rounded-full bg-[#3730A3]/[0.08] blur-3xl" style={{ animation: 'mesh-two 12s ease-in-out infinite' }} />
      <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-[#3730A3]/[0.08] blur-3xl" style={{ animation: 'mesh-one 14s ease-in-out infinite' }} />
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='32' height='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M32 0H0v32' fill='none' stroke='white'/%3E%3C/svg%3E\")" }} />

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 grid min-h-screen place-items-center px-4">
        <form onSubmit={submit} className="glass-card w-full max-w-[480px] rounded-3xl p-8 shadow-card">
          <div className="text-center">
            <h1 className="font-display text-4xl font-extrabold">Kredox <span className="text-accent">AI</span></h1>
            <p className="mt-2 text-text-muted">Intelligent Onboarding. Instant Decisions.</p>
          </div>

          <div className="mt-8 flex border-b border-border">
            {['agent', 'admin'].map((tab) => (
              <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`relative flex-1 pb-3 text-sm font-bold capitalize ${activeTab === tab ? 'text-accent' : 'text-text-muted'}`}>
                {tab === 'agent' ? 'Agent Login' : 'Admin Login'}
                {activeTab === tab && <motion.span layoutId="login-tab" className="absolute bottom-0 left-0 h-0.5 w-full bg-accent" />}
              </button>
            ))}
          </div>

          <div className="mt-6 space-y-4">
            <Input icon={Mail} type="email" defaultValue="ravi.desai@kredox.ai" aria-label="Email" />
            <div className="relative">
              <Input icon={Lock} type={showPassword ? 'text' : 'password'} defaultValue="kredox-secure" aria-label="Password" />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button className="group mt-6 w-full py-3" disabled={loading}>
            <span className="absolute inset-y-0 -left-full w-1/2 skew-x-12 bg-white/20 transition group-hover:left-[120%]" />
            {loading ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : 'Sign In to Kredox AI'}
          </Button>

          <p className="mt-5 flex items-center justify-center gap-2 text-center text-xs text-text-muted">
            <ShieldCheck className="h-4 w-4 text-success" /> 256-bit encrypted - RBI Compliant - ISO 27001
          </p>
          <p className="mt-6 text-center text-xs text-text-muted">Powered for Poonawalla Fincorp - Kredox AI v2.0</p>
        </form>
      </motion.div>

      <div className="glass-card absolute bottom-6 left-6 hidden rounded-2xl p-4 text-sm lg:block">
        {['247 loans processed today', '₹4.2Cr disbursed this week', '94.2% accuracy rate'].map((line) => (
          <p key={line} className="mb-2 flex items-center gap-2 last:mb-0"><span className="h-2 w-2 rounded-full bg-accent" /> {line}</p>
        ))}
      </div>
    </main>
  );
}
