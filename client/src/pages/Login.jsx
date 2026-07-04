import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { authAPI } from '../api/index.js';

function Wordmark() {
  return (
    <div className="wordmark" style={{ padding: 0 }}>
      <span className="wordmark-k">Kredox</span>
      <span className="wordmark-ai">AI</span>
    </div>
  );
}

export default function Login() {
  const allowRegistration =
    import.meta.env.VITE_ALLOW_PUBLIC_REGISTRATION !== 'false';
  const [tab, setTab] = useState('agent');
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [role, setRole] = useState('agent');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState('');
  const navigate = useNavigate();

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setLoadingLabel('Waking secure backend...');
    try {
      const data =
        mode === 'register'
          ? await authAPI.register({ name, email, password, role })
          : await authAPI.login(email, password);

      if (mode === 'login' && tab === 'admin' && data.agent?.role !== 'admin') {
        localStorage.removeItem('kredox_token');
        localStorage.removeItem('kredox_agent');
        toast.error('This account is not an admin account');
        return;
      }

      localStorage.setItem('kredox_token', data.access_token || data.token);
      localStorage.setItem('kredox_access_token', data.access_token || data.token);
      localStorage.setItem('kredox_agent', JSON.stringify(data.agent || { email, name, role }));
      toast.success(mode === 'register' ? 'Account created' : 'Signed in to Kredox AI');
      navigate(data.agent?.role === 'viewer' ? '/reports' : '/dashboard');
    } catch (error) {
      const isInvalidLogin = mode === 'login' && error.response?.status === 401;
      const backendUnreachable = !error.response || error.code === 'ERR_NETWORK' || error.response?.status === 502;
      const message = backendUnreachable
        ? 'Cannot reach the API server. Start it with npm run dev and confirm DATABASE_URL in server/.env is valid.'
        : error.code === 'ECONNABORTED'
          ? 'Backend is still waking up. Please try again in a few seconds.'
          : isInvalidLogin
            ? allowRegistration
              ? 'No matching account found. Use Register to create a new account.'
              : 'No matching account found. Ask an admin to create your account first.'
            : error.response?.data?.error || (mode === 'register' ? 'Registration failed' : 'Login failed');
      toast.error(message);
    } finally {
      setLoading(false);
      setLoadingLabel('');
    }
  };

  const setSelectedRole = (nextRole) => {
    setRole(nextRole);
    setTab(nextRole === 'admin' ? 'admin' : 'agent');
  };

  return (
    <main className="login-page">
      <section className="login-left" aria-label="Kredox AI platform overview">
        <Wordmark />
        <div className="login-copy">
          <h1>
            Loan decisions in
            <br />
            <em>minutes,</em>
            <br />
            not days.
          </h1>
          <p>AI-powered video KYC and risk scoring for Indian lenders and NBFCs.</p>
        </div>
        <div className="stat-rows">
          {[
            ['247', 'LOANS TODAY'],
            ['INR 4.2Cr', 'DISBURSED WEEK'],
            ['94.2%', 'MODEL ACCURACY'],
          ].map(([number, label]) => (
            <div className="stat-row" key={label}>
              <strong>{number}</strong>
              <span className="stat-line" aria-hidden="true" />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>
      <div className="login-divider" />
      <section className="login-right">
        <form className="card login-card" onSubmit={submit}>
          <div className="login-head">
            <h2>{mode === 'register' ? 'Create account' : 'Sign in'}</h2>
            <p>Poonawalla Fincorp - Kredox AI v2.0</p>
          </div>

          <div className="tabs login-role-tabs">
            {['agent', 'admin'].map((item) => (
              <button
                type="button"
                key={item}
                className={`tab ${tab === item ? 'active' : ''}`}
                onClick={() => setSelectedRole(item)}
              >
                {item === 'agent' ? 'Agent' : 'Admin'}
              </button>
            ))}
          </div>

          {allowRegistration ? (
            <div className="tabs auth-mode-tabs">
              <button type="button" className={`tab ${mode === 'login' ? 'active' : ''}`} onClick={() => setMode('login')}>
                Sign in
              </button>
              <button type="button" className={`tab ${mode === 'register' ? 'active' : ''}`} onClick={() => setMode('register')}>
                Register
              </button>
            </div>
          ) : (
            <div className="login-mode-chip" aria-hidden="true">Sign in</div>
          )}
          {!allowRegistration && (
            <p className="muted" style={{ margin: '-8px 0 14px', fontSize: 12 }}>
              Public registration is disabled in this environment. Ask an admin to seed or create your account.
            </p>
          )}
          {allowRegistration && mode === 'login' && (
            <p className="muted" style={{ margin: '-8px 0 14px', fontSize: 12 }}>
              New to Kredox AI? Switch to Register and create your workspace account.
            </p>
          )}

          {allowRegistration && mode === 'register' && (
            <>
              <div className="field">
                <label className="label" htmlFor="register-name">Full name</label>
                <input
                  autoComplete="name"
                  className="inp"
                  id="register-name"
                  name="name"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label className="label" htmlFor="register-role">Permission role</label>
                <select
                  className="inp"
                  id="register-role"
                  name="role"
                  value={role}
                  onChange={(event) => setSelectedRole(event.target.value)}
                >
                  <option value="admin">Admin - full platform access</option>
                  <option value="agent">Agent - campaigns, sessions, risk work</option>
                  <option value="viewer">Viewer - reports and activity only</option>
                </select>
              </div>
            </>
          )}

          <div className="field">
            <label className="label" htmlFor="login-email">Email</label>
            <input
              autoComplete="email"
              className="inp"
              id="login-email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="login-password">Password</label>
            <input
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              className="inp"
              id="login-password"
              name="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          <button className="btn btn-primary submit" disabled={loading}>
            {loading ? <span className="spinner" /> : <>{mode === 'register' ? 'Create account' : 'Sign in to Kredox AI'} <span aria-hidden>-&gt;</span></>}
          </button>
          {loadingLabel && <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>{loadingLabel}</p>}
          <div className="trust-row">
            <Lock size={11} />
            <span>256-bit encrypted</span>
            <span>-</span>
            <span>RBI Compliant</span>
            <span>-</span>
            <span>ISO 27001</span>
          </div>
        </form>
        <div className="login-kyc-badge badge badge-dim">
          <ShieldCheck size={11} /> Production KYC Console
        </div>
      </section>
    </main>
  );
}
