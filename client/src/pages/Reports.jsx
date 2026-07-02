import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, BarChart2, Search, ShieldCheck } from 'lucide-react';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Link } from 'react-router-dom';
import { reportsAPI } from '../api/index.js';

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

const bandColors = { A: '#00A86B', B: '#003399', C: '#E08B00', D: '#D32F2F', unclear: '#7A8AAD' };

export function Reports() {
  const [summary, setSummary] = useState(null);
  const [recentApplications, setRecentApplications] = useState([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const agent = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('kredox_agent') || 'null');
    } catch {
      return null;
    }
  }, []);
  const canSearchTranscripts = agent?.role === 'admin';

  useEffect(() => {
    const loadSummary = async () => {
      try {
        setLoading(true);
        const [summaryData, applicationsData] = await Promise.all([
          reportsAPI.dailySummary(todayIsoDate()),
          reportsAPI.applications(20).catch(() => ({ applications: [] }))
        ]);
        setSummary(summaryData);
        setRecentApplications(
          (applicationsData.applications || []).filter((row) => row.session_id)
        );
      } catch (error) {
        toast.error(error.response?.data?.error || 'Failed to load reports');
      } finally {
        setLoading(false);
      }
    };

    loadSummary();
    const interval = window.setInterval(loadSummary, 300000);
    return () => window.clearInterval(interval);
  }, []);

  const search = async (event) => {
    event.preventDefault();
    if (!canSearchTranscripts) {
      toast.error('Transcript search is available for admin accounts only');
      return;
    }
    if (!query.trim()) return;
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

  const rejectionReasons = summary?.top_red_flags || summary?.top_rejection_reasons || [];
  const durationByBand = summary?.avg_call_duration_by_band || [];
  const bandDistribution = useMemo(() => {
    const dist = summary?.band_distribution || {};
    return Object.entries(dist).map(([name, value]) => ({
      name,
      value: Number(value || 0),
      color: bandColors[name] || bandColors.unclear
    }));
  }, [summary]);

  return (
    <main className="page">
      <section className="card report-header page-section">
        <div>
          <div className="applicant-head">
            <div className="report-avatar"><BarChart2 size={18} /></div>
            <div>
              <h1 className="report-name">Risk Reports</h1>
              <p className="report-sub">Daily operational summary, rejection patterns, transcript intelligence, and backend risk distribution.</p>
              <p className="report-id">Source: /api/reports/daily-summary</p>
            </div>
          </div>
          <div className="quick-stats">
            <div className="quick-chip"><strong>{summary?.total_sessions ?? 0}</strong><span>Sessions</span></div>
            <div className="quick-chip"><strong>{summary?.approval_rate ?? 0}%</strong><span>Approval</span></div>
            <div className="quick-chip"><strong>{summary?.avg_risk_score ?? 0}</strong><span>Risk Score</span></div>
            <div className="quick-chip"><strong>{rejectionReasons.length}</strong><span>Top Flags</span></div>
          </div>
        </div>
        <div>
          <div className="recommend"><ShieldCheck size={12} />{canSearchTranscripts ? 'Admin transcript search enabled' : 'Agent view enabled'}</div>
          <div className="report-actions">
            <Link className="btn btn-ghost" to="/dashboard">Back to dashboard</Link>
          </div>
        </div>
      </section>

      <div className="report-grid">
        <section className="card report-section page-section">
          <h2 className="section-title">Daily Summary</h2>
          {loading ? (
            <div className="reports-summary-grid">
              {[0, 1, 2, 3].map((index) => <div key={index} className="skeleton reports-mini-card" />)}
            </div>
          ) : (
            <div className="reports-summary-grid">
              <div className="reports-mini-card">
                <span>Total sessions</span>
                <strong className="mono">{summary?.total_sessions ?? 0}</strong>
              </div>
              <div className="reports-mini-card">
                <span>Approval rate</span>
                <strong className="mono">{summary?.approval_rate ?? 0}%</strong>
              </div>
              <div className="reports-mini-card">
                <span>Avg risk score</span>
                <strong className="mono">{summary?.avg_risk_score ?? 0}</strong>
              </div>
              <div className="reports-mini-card">
                <span>Approved today</span>
                <strong className="mono">{summary?.approval_funnel?.approved ?? 0}</strong>
              </div>
            </div>
          )}

          <div className="micro-label">Top rejection reasons</div>
          <div className="report-chart-box">
            {rejectionReasons.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rejectionReasons} layout="vertical" margin={{ left: 20, right: 10 }}>
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: 'var(--t2)', fontSize: 10 }} />
                  <YAxis type="category" dataKey="flag" width={150} axisLine={false} tickLine={false} tick={{ fill: 'var(--t1)', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid var(--b1)', color: 'var(--t0)' }} />
                  <Bar dataKey="count" fill="#E08B00" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="muted">No rejection reason data returned yet.</p>
            )}
          </div>
        </section>

        <section className="card report-section page-section" style={{ animationDelay: '.08s' }}>
          <h2 className="section-title">Transcript Search</h2>
          <form onSubmit={search} className="reports-search-form">
            <div className="search-wrap reports-search-input">
              <Search size={14} />
              <input
                className="inp"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={canSearchTranscripts ? 'Search transcripts by keyword, applicant, concern...' : 'Admin access required for transcript search'}
                disabled={!canSearchTranscripts}
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={searching || !canSearchTranscripts}>
              {searching ? 'Searching...' : 'Search'}
            </button>
          </form>
          {!canSearchTranscripts && (
            <p className="muted" style={{ marginTop: 10 }}>
              Switch to an admin account to search transcript snippets and audit evidence.
            </p>
          )}
          <div className="reports-results">
            {results.map((result) => (
              <Link key={result.session_id || result.id} to={`/report/${result.session_id || result.id}`} className="reports-result-card">
                <div>
                  <strong>{result.customer_name || result.session_id || result.id}</strong>
                  <p>{result.snippet || result.highlight || result.full_text}</p>
                </div>
                <span className={`badge ${result.risk_band ? 'badge-blue' : 'badge-dim'}`}>{result.risk_band || 'Report'}</span>
              </Link>
            ))}
            {!results.length && <p className="muted">Transcript matches will appear here.</p>}
          </div>
        </section>

        <section className="card report-section page-section" style={{ animationDelay: '.16s' }}>
          <h2 className="section-title">Risk Band Distribution</h2>
          <div className="report-chart-box compact">
            {bandDistribution.some((item) => item.value > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={bandDistribution} dataKey="value" innerRadius={44} outerRadius={76}>
                    {bandDistribution.map((item) => <Cell key={item.name} fill={item.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid var(--b1)', color: 'var(--t0)' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="muted">No band distribution returned yet.</p>
            )}
          </div>
          <div className="band-legend">
            {bandDistribution.map((item) => (
              <div className="band-legend-row" key={item.name}>
                <span>{item.name}</span>
                <span>{item.value}</span>
                <span className="band-bar"><span style={{ width: `${Math.min(item.value, 100)}%`, background: item.color }} /></span>
              </div>
            ))}
          </div>
          <div className="micro-label">Average call duration by band</div>
          <div className="reports-duration-list">
            {durationByBand.length ? (
              durationByBand.map((item) => (
                <div key={item.risk_band} className="score-row">
                  <label>{item.risk_band}</label>
                  <div className="score-track">
                    <span style={{ width: `${Math.min(Math.round(Number(item.avg_seconds || 0) / 6), 100)}%`, background: bandColors[item.risk_band] || 'var(--acc)' }} />
                  </div>
                  <strong className="mono">{Math.round(Number(item.avg_seconds || 0))}s</strong>
                </div>
              ))
            ) : (
              <p className="muted">No duration data returned yet.</p>
            )}
          </div>
        </section>
      </div>

      <section className="card report-section page-section" style={{ marginTop: 16, animationDelay: '.24s' }}>
        <div className="reports-footer-head">
          <h2 className="section-title">Recent session reports</h2>
          <Link className="btn btn-ghost" to="/applications">View all applications</Link>
        </div>
        <div className="reports-results" style={{ marginTop: 12 }}>
          {recentApplications.map((row) => (
            <Link key={row.session_id} to={`/report/${row.session_id}`} className="reports-result-card">
              <div>
                <strong>{row.name || 'Applicant'}</strong>
                <p className="mono dim" style={{ fontSize: 11 }}>
                  {row.session_id ? `KYC-${String(row.session_id).slice(0, 8)}` : row.id} · {row.campaign || 'Direct'}
                </p>
              </div>
              <span className={`badge ${row.risk_band ? `band band-${row.risk_band}` : 'badge-dim'}`}>
                {row.risk_band || row.application_status || 'Open'}
              </span>
            </Link>
          ))}
          {!loading && !recentApplications.length && (
            <p className="muted">Complete a verification session to generate risk reports. Launch a campaign or open a live session first.</p>
          )}
        </div>
      </section>
    </main>
  );
}
