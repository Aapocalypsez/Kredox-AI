import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { reportsAPI } from '../api/index.js';

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function Reports() {
  const [summary, setSummary] = useState(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const data = await reportsAPI.dailySummary(todayIsoDate());
        setSummary(data);
      } catch (error) {
        toast.error(error.response?.data?.error || 'Failed to load reports');
      } finally {
        setLoading(false);
      }
    };

    loadSummary();
    const interval = setInterval(loadSummary, 300000);
    return () => clearInterval(interval);
  }, []);

  const search = async (event) => {
    event.preventDefault();
    if (!query.trim()) return;
    try {
      setSearching(true);
      const data = await reportsAPI.searchTranscripts(query.trim());
      setResults(data.results || data.sessions || []);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Transcript search failed');
    } finally {
      setSearching(false);
    }
  };

  const rejectionReasons = summary?.top_red_flags || summary?.top_rejection_reasons || [];
  const durationByBand = summary?.avg_call_duration_by_band || [];

  return (
    <main className="page-shell">
      <section className="page-header split">
        <div>
          <p className="eyebrow">Audit and intelligence</p>
          <h1>Reports</h1>
        </div>
        <Link to="/dashboard">Dashboard</Link>
      </section>

      <form className="panel search-panel" onSubmit={search}>
        <label>
          Search transcripts
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search keyword, name, concern" />
        </label>
        <button type="submit" disabled={searching}>{searching ? 'Searching...' : 'Search'}</button>
      </form>

      {results.length > 0 && (
        <section className="panel">
          <h2>Transcript Results</h2>
          <div className="result-list">
            {results.map((result) => (
              <Link key={result.session_id || result.id} to={`/report/${result.session_id || result.id}`}>
                <strong>{result.customer_name || result.session_id}</strong>
                <span>{result.snippet || result.highlight || result.full_text}</span>
                <em>{result.risk_band || '-'}</em>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="analytics-grid">
        <article className="panel">
          <h2>Daily Summary</h2>
          {loading ? (
            <div className="skeleton-block" />
          ) : (
            <div className="kpi-grid compact">
              <div className="metric-card"><span>Total Sessions</span><strong>{summary?.total_sessions ?? 0}</strong></div>
              <div className="metric-card"><span>Approval Rate</span><strong>{summary?.approval_rate ?? 0}%</strong></div>
              <div className="metric-card"><span>Avg Risk Score</span><strong>{summary?.avg_risk_score ?? 0}</strong></div>
              <div className="metric-card"><span>Flagged</span><strong>{summary?.flagged ?? 0}</strong></div>
            </div>
          )}
        </article>

        <article className="panel">
          <h2>Top Rejection Reasons</h2>
          {rejectionReasons.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={rejectionReasons} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="reason" width={140} />
                <Tooltip />
                <Bar dataKey="count" fill="#d94841" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="empty-state">No rejection reason data returned.</p>
          )}
        </article>

        <article className="panel">
          <h2>Avg Call Duration by Band</h2>
          {durationByBand.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={durationByBand}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="band" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="avg_duration" fill="#118c6f" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="empty-state">No duration data returned.</p>
          )}
        </article>
      </section>
    </main>
  );
}
