import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Search, ShieldCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { auditAPI, reportsAPI, storageAPI } from '../api/index.js';

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function Admin() {
  const [logs, setLogs] = useState([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [sessionId, setSessionId] = useState('');
  const [recording, setRecording] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const navigate = useNavigate();
  const agent = (() => {
    try {
      return JSON.parse(localStorage.getItem('kredox_agent') || 'null');
    } catch {
      return null;
    }
  })();
  const isAdmin = agent?.role === 'admin';

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    async function loadLogs() {
      try {
        setLoading(true);
        const data = await auditAPI.logs({ limit: 50 });
        if (!cancelled) setLogs(data.logs || []);
      } catch (error) {
        toast.error(error.response?.data?.error || 'Admin audit logs failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadLogs();
    const interval = setInterval(loadLogs, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isAdmin]);

  const searchTranscripts = async (event) => {
    event.preventDefault();
    if (!isAdmin) {
      toast.error('Admin access is required for transcript search');
      return;
    }
    if (!query.trim()) {
      toast.error('Enter a transcript search term');
      return;
    }
    try {
      setSearching(true);
      const data = await reportsAPI.searchTranscripts(query.trim());
      setResults(data.results || data.sessions || []);
      toast.success('Transcript search complete');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Transcript search failed');
    } finally {
      setSearching(false);
    }
  };

  const openResult = (result) => {
    const sessionId = result.session_id || result.id;
    if (!sessionId) {
      toast.error('This result has no session ID');
      return;
    }
    navigate(`/report/${sessionId}`);
  };

  const fetchRecording = async (event) => {
    event.preventDefault();
    if (!isAdmin) {
      toast.error('Admin access is required for recording lookup');
      return;
    }
    if (!sessionId.trim()) {
      toast.error('Enter a session ID');
      return;
    }
    try {
      const data = await storageAPI.getRecording(sessionId.trim());
      setRecording(data);
      toast.success('Recording lookup complete');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Recording lookup failed');
    }
  };

  if (!isAdmin) {
    return (
      <main className="page">
        <section className="card report-header page-section">
          <div>
            <div className="applicant-head">
              <div className="report-avatar"><ShieldCheck size={18} /></div>
              <div>
                <h1 className="report-name">Admin Console</h1>
                <p className="report-sub">This area is reserved for admin accounts because it exposes audit logs, transcript search, and recording access.</p>
                <p className="report-id">Current role: {agent?.role || 'unknown'}</p>
              </div>
            </div>
          </div>
          <div className="report-actions">
            <Link className="btn btn-primary" to="/dashboard">Back to dashboard</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="card report-header page-section">
        <div>
          <div className="applicant-head">
            <div className="report-avatar"><ShieldCheck size={18} /></div>
            <div>
              <h1 className="report-name">Admin Console</h1>
              <p className="report-sub">Full access to audit logs, transcript search, recordings, and platform oversight.</p>
              <p className="report-id">Role required: admin</p>
            </div>
          </div>
        </div>
        <div className="recommend"><ShieldCheck size={12} />Admin permissions active</div>
      </section>

      <div className="report-grid">
        <section className="card report-section page-section">
          <h2 className="section-title">Audit Trail</h2>
          <p className="muted" style={{ marginTop: 6 }}>Latest API and system events.</p>
          <div className="table-scroll" style={{ marginTop: 12 }}>
            <table className="tbl">
              <thead>
                <tr><th>Event</th><th>Actor</th><th>Entity</th><th>Time</th></tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{log.event_type}</td>
                    <td className="mono dim">{log.actor_type || 'system'}:{log.actor_id || '-'}</td>
                    <td className="mono dim">{log.entity_type || '-'}:{log.entity_id || '-'}</td>
                    <td className="mono dim">{formatDate(log.timestamp)}</td>
                  </tr>
                ))}
                {loading && <tr><td colSpan="4" className="muted">Loading audit logs...</td></tr>}
                {!loading && !logs.length && <tr><td colSpan="4" className="muted">No audit logs returned yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card report-section page-section" style={{ animationDelay: '.08s' }}>
          <h2 className="section-title">Transcript Search</h2>
          <form className="reports-search-form" onSubmit={searchTranscripts}>
            <div className="search-wrap reports-search-input">
              <Search size={14} />
              <input className="inp" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search income, consent, fraud..." />
            </div>
            <button className="btn btn-primary" type="submit" disabled={searching}>
              {searching ? 'Searching...' : 'Search'}
            </button>
          </form>
          <div className="reports-results" style={{ marginTop: 12 }}>
            {results.map((result) => (
              <button
                type="button"
                key={result.session_id || result.id}
                className="reports-result-card"
                onClick={() => openResult(result)}
              >
                <div>
                  <strong>{result.customer_name || result.session_id || result.id}</strong>
                  <p>{result.snippet || result.highlight || result.full_text}</p>
                </div>
                <span className={`badge ${result.risk_band ? 'badge-blue' : 'badge-dim'}`}>{result.risk_band || 'Open'}</span>
              </button>
            ))}
            {!results.length && <p className="muted">Run a search to inspect transcripts.</p>}
          </div>
        </section>

        <section className="card report-section page-section" style={{ animationDelay: '.16s' }}>
          <h2 className="section-title">Recording Access</h2>
          <form onSubmit={fetchRecording} style={{ marginTop: 12 }}>
            <label className="label" htmlFor="admin-session-id">Session ID</label>
            <input id="admin-session-id" className="inp" value={sessionId} onChange={(event) => setSessionId(event.target.value)} placeholder="KYC/session UUID" />
            <button className="btn btn-primary" style={{ width: '100%', marginTop: 12 }} type="submit">Get recording link</button>
          </form>
          {recording?.playback_url ? (
            <a className="btn btn-ghost" style={{ width: '100%', marginTop: 12 }} href={recording.playback_url} target="_blank" rel="noreferrer">Open recording</a>
          ) : (
            <p className="muted" style={{ marginTop: 12 }}>Recording link appears here when available.</p>
          )}
        </section>
      </div>
    </main>
  );
}
