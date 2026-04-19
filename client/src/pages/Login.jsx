import { useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../api/index.js';
import { useAppContext } from '../context/AppContext.jsx';

export function Login() {
  const navigate = useNavigate();
  const { setAgent } = useAppContext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      setLoading(true);
      const data = await authAPI.login(email, password);
      localStorage.setItem('kredox_token', data.access_token);
      localStorage.setItem('kredox_access_token', data.access_token);
      setAgent(data.agent || data.user || null);
      toast.success('Signed in to Kredox AI');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <p className="eyebrow">Kredox AI</p>
        <h1>Agent sign in</h1>
        <label>
          Email
          <input
            required
            type="email"
            value={email}
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          Password
          <input
            required
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
