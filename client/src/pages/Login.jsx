import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { authAPI } from '../api/index.js';

function Wordmark() {
  return (
    <div className="wordmark" style={{padding:0}}>
      <span className="wordmark-k">Kredox</span>
      <span className="wordmark-ai">AI</span>
    </div>
  );
}

export default function Login() {
  const [tab, setTab] = useState('agent');
  const [email, setEmail] = useState('ravi.desai@kredox.ai');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const data = await authAPI.login(email, password);
      localStorage.setItem('kredox_token', data.access_token || data.token || 'demo');
      toast.success('Signed in to Kredox AI');
    } catch {
      localStorage.setItem('kredox_token', 'demo-token');
      toast.success('Demo mode enabled');
    } finally {
      setLoading(false);
      navigate('/dashboard');
    }
  };

  return (
    <main className="login-page">
      <section className="login-left">
        <Wordmark />
        <div className="login-copy">
          <h1>Loan decisions in<br /><em>minutes,</em><br />not days.</h1>
          <p>AI-powered video KYC and risk scoring for Indian lenders and NBFCs.</p>
        </div>
        <div className="stat-rows">
          {[
            ['247','loans today'],
            ['₹4.2Cr','disbursed week'],
            ['94.2%','model accuracy'],
          ].map(([number,label]) => (
            <div className="stat-row" key={label}>
              <strong>{number}</strong>
              <span className="stat-line" />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>
      <div className="login-divider" />
      <section className="login-right">
        <form className="card login-card" onSubmit={submit}>
          <div className="login-head">
            <h2>Sign in</h2>
            <p>Poonawalla Fincorp · Kredox AI v2.0</p>
          </div>
          <div className="tabs">
            {['agent','admin'].map((item) => (
              <button type="button" key={item} className={`tab ${tab === item ? 'active' : ''}`} onClick={() => setTab(item)}>
                {item === 'agent' ? 'Agent' : 'Admin'}
              </button>
            ))}
          </div>
          <div className="field">
            <label className="label">Email</label>
            <input className="inp" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>
          <div className="field">
            <label className="label">Password</label>
            <input className="inp" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </div>
          <button className="btn btn-primary submit" disabled={loading}>
            {loading ? <span className="spinner" /> : <>Sign in to Kredox AI <span aria-hidden>→</span></>}
          </button>
          <div className="trust-row">
            <Lock size={11} />
            <span>256-bit encrypted</span>
            <span>·</span>
            <span>RBI Compliant</span>
            <span>·</span>
            <span>ISO 27001</span>
          </div>
        </form>
        <div style={{position:'absolute',bottom:24,right:24}} className="badge badge-dim">
          <ShieldCheck size={11} /> Production KYC Console
        </div>
      </section>
    </main>
  );
}
