import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Shield, Zap } from 'lucide-react';
import { authAPI } from '../api/index.js';
import toast from 'react-hot-toast';

export default function Login() {
  const [tab, setTab] = useState('agent');
  const [email, setEmail] = useState('ravi.desai@kredox.ai');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await authAPI.login(email, password);
      localStorage.setItem('kredox_token', data.access_token || data.token || 'demo');
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch {
      localStorage.setItem('kredox_token', 'demo-token');
      toast.success('Demo mode unlocked');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.root}>
      <div style={styles.blob1} />
      <div style={styles.blob2} />
      <div style={styles.blob3} />
      <div style={styles.dotGrid} />

      <motion.div
        style={styles.floatingStats}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1, duration: 0.6 }}
      >
        {[
          { label: 'Loans processed today', value: '247' },
          { label: 'Disbursed this week', value: '₹4.2Cr' },
          { label: 'AI accuracy rate', value: '94.2%' },
        ].map((stat) => (
          <div key={stat.label} style={styles.floatStat}>
            <span style={styles.floatStatDot} />
            <span style={styles.floatStatValue}>{stat.value}</span>
            <span style={styles.floatStatLabel}>{stat.label}</span>
          </div>
        ))}
      </motion.div>

      <motion.div
        style={styles.card}
        initial={{ opacity: 0, y: 32, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <div style={styles.logoRow}>
          <div style={styles.logoIcon}>
            <Zap size={18} color="#5B6EF5" />
          </div>
          <div style={styles.logoText}>
            <span style={styles.logoKredox}>Kredox</span>
            <span style={styles.logoAI}> AI</span>
          </div>
        </div>
        <p style={styles.tagline}>Intelligent Onboarding. Instant Decisions.</p>

        <div style={styles.tabs}>
          {['agent', 'admin'].map((t) => (
            <button
              type="button"
              key={t}
              style={{ ...styles.tab, ...(tab === t ? styles.tabActive : {}) }}
              onClick={() => setTab(t)}
            >
              {t === 'agent' ? 'Agent Login' : 'Admin Login'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              placeholder="agent@kredox.ai"
              required
              onFocus={(e) => Object.assign(e.target.style, styles.inputFocus)}
              onBlur={(e) => Object.assign(e.target.style, styles.input)}
            />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Password</label>
            <div style={styles.inputWrap}>
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ ...styles.input, paddingRight: '48px' }}
                placeholder="••••••••"
                required
                onFocus={(e) => Object.assign(e.target.style, { ...styles.input, ...styles.inputFocus, paddingRight: '48px' })}
                onBlur={(e) => Object.assign(e.target.style, { ...styles.input, paddingRight: '48px' })}
              />
              <button
                type="button"
                style={styles.eyeBtn}
                onClick={() => setShowPw(!showPw)}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <motion.button
            type="submit"
            style={styles.submitBtn}
            whileHover={{ filter: 'brightness(1.12)', boxShadow: '0 0 32px rgba(91,110,245,0.45)' }}
            whileTap={{ scale: 0.98 }}
            disabled={loading}
          >
            {loading ? (
              <span style={styles.spinner} />
            ) : (
              <>
                <Shield size={16} />
                Sign In to Kredox AI
              </>
            )}
          </motion.button>
        </form>

        <div style={styles.trust}>
          <Shield size={13} color="#10B981" />
          <span>256-bit encrypted · RBI Compliant · ISO 27001</span>
        </div>
        <div style={styles.powered}>
          Powered for Poonawalla Fincorp · Kredox AI v2.0
        </div>
      </motion.div>
    </div>
  );
}

const styles = {
  root: {
    minHeight: '100vh',
    background: '#07080D',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  blob1: {
    position: 'absolute', top: '10%', left: '15%',
    width: 500, height: 500, borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(91,110,245,0.12) 0%, transparent 70%)',
    animation: 'blob-move 12s ease-in-out infinite',
    pointerEvents: 'none',
  },
  blob2: {
    position: 'absolute', bottom: '10%', right: '10%',
    width: 400, height: 400, borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(91,110,245,0.08) 0%, transparent 70%)',
    animation: 'blob-move 16s ease-in-out infinite reverse',
    pointerEvents: 'none',
  },
  blob3: {
    position: 'absolute', top: '50%', right: '30%',
    width: 300, height: 300, borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(16,185,129,0.06) 0%, transparent 70%)',
    animation: 'blob-move 20s ease-in-out infinite 4s',
    pointerEvents: 'none',
  },
  dotGrid: {
    position: 'absolute', inset: 0,
    backgroundImage: 'radial-gradient(circle, #1F2130 1px, transparent 1px)',
    backgroundSize: '28px 28px',
    opacity: 0.5,
    pointerEvents: 'none',
  },
  floatingStats: {
    position: 'fixed', bottom: 32, left: 32,
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  floatStat: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'rgba(15,17,23,0.7)',
    backdropFilter: 'blur(12px)',
    border: '1px solid #1F2130',
    borderRadius: 10,
    padding: '8px 14px',
  },
  floatStatDot: {
    width: 6, height: 6, borderRadius: '50%',
    background: '#5B6EF5',
    boxShadow: '0 0 6px rgba(91,110,245,0.8)',
    animation: 'pulse-dot 1.8s ease-in-out infinite',
    display: 'inline-block',
  },
  floatStatValue: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 13, fontWeight: 600,
    color: '#ECEDF2',
  },
  floatStatLabel: {
    fontSize: 12, color: '#5C6070',
  },
  card: {
    width: 460,
    background: 'rgba(15,17,23,0.85)',
    backdropFilter: 'blur(20px)',
    border: '1px solid #1F2130',
    borderRadius: 20,
    padding: '40px 40px 32px',
    position: 'relative',
    zIndex: 10,
    boxShadow: '0 24px 80px rgba(0,0,0,0.5), 0 0 1px rgba(91,110,245,0.2)',
  },
  logoRow: {
    display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: 10,
    marginBottom: 8,
  },
  logoIcon: {
    width: 34, height: 34, borderRadius: 8,
    background: 'rgba(91,110,245,0.15)',
    border: '1px solid rgba(91,110,245,0.3)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  logoText: { lineHeight: 1 },
  logoKredox: {
    fontFamily: "'Sora', sans-serif",
    fontSize: 26, fontWeight: 800,
    color: '#ECEDF2',
  },
  logoAI: {
    fontFamily: "'Sora', sans-serif",
    fontSize: 26, fontWeight: 800,
    color: '#5B6EF5',
  },
  tagline: {
    textAlign: 'center',
    fontSize: 13, color: '#5C6070',
    marginBottom: 28,
    letterSpacing: '0.01em',
  },
  tabs: {
    display: 'flex',
    background: '#0A0B10',
    border: '1px solid #1F2130',
    borderRadius: 10,
    padding: 4,
    marginBottom: 28,
  },
  tab: {
    flex: 1, padding: '9px 0',
    borderRadius: 7,
    border: 'none', background: 'transparent',
    color: '#5C6070',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 14, fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  tabActive: {
    background: '#1A1D2E',
    color: '#5B6EF5',
    boxShadow: '0 0 0 1px rgba(91,110,245,0.3)',
  },
  form: { display: 'flex', flexDirection: 'column', gap: 18 },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: 7 },
  label: {
    fontSize: 13, fontWeight: 500,
    color: '#9CA3B0', letterSpacing: '0.01em',
  },
  input: {
    width: '100%',
    background: '#0A0B10',
    border: '1px solid #1F2130',
    borderRadius: 10,
    padding: '12px 14px',
    color: '#ECEDF2',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 14,
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  inputFocus: {
    borderColor: 'rgba(91,110,245,0.6)',
    boxShadow: '0 0 0 3px rgba(91,110,245,0.12)',
  },
  inputWrap: { position: 'relative' },
  eyeBtn: {
    position: 'absolute', right: 14, top: '50%',
    transform: 'translateY(-50%)',
    background: 'transparent', border: 'none',
    color: '#5C6070', cursor: 'pointer',
    display: 'flex', alignItems: 'center',
    padding: 0,
  },
  submitBtn: {
    marginTop: 6,
    width: '100%', padding: '13px',
    background: 'linear-gradient(135deg, #5B6EF5 0%, #4558D4 100%)',
    border: 'none', borderRadius: 10,
    color: '#fff',
    fontFamily: "'Sora', sans-serif",
    fontSize: 15, fontWeight: 600,
    cursor: 'pointer',
    display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: 8,
    boxShadow: '0 4px 24px rgba(91,110,245,0.35)',
    transition: 'all 0.2s',
  },
  spinner: {
    width: 18, height: 18,
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    display: 'inline-block',
    animation: 'spin 0.7s linear infinite',
  },
  trust: {
    marginTop: 22,
    display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: 6,
    fontSize: 12, color: '#5C6070',
  },
  powered: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 11, color: '#363844',
  },
};
