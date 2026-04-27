import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Activity as ActivityIcon, AlertTriangle, CheckCircle, Search, TrendingUp } from 'lucide-react';
import { Bar, BarChart, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { activityAPI, campaignAPI, reportsAPI } from '../api/index.js';
import { useCountUp } from '../hooks/useCountUp.js';

const bandColors = { A: '#00A86B', B: '#003399', C: '#E08B00', D: '#D32F2F' };

function formatRelative(value) {
  if (!value) return '-';
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / 1440)}d`;
}

function toDashboardRows(rows = []) {
  return rows.map((row) => {
    const sessionStatus = row.session_status === 'active' ? 'live' : row.application_status || 'pending';
    const geo = row.geo_match_status === 'MATCH' ? 'match' : row.geo_match_status ? 'mismatch' : null;
    return {
      id: row.session_id || row.id,
      sessionId: row.session_id || null,
      applicationId: row.id,
      label: row.session_id ? `KYC-${String(row.session_id).slice(0, 8)}` : String(row.id).slice(0, 12),
      name: row.name || 'Unknown applicant',
      phone: row.phone || row.email || '-',
      rawPhone: row.phone || '',
      email: row.email || '',
      campaign: row.campaign || 'Direct',
      status: sessionStatus,
      band: row.risk_band,
      score: row.final_score ? Math.round(Number(row.final_score)) : null,
      geo,
      city: row.city || row.call_city || '-',
      time: formatRelative(row.created_at)
    };
  });
}

function KpiCard({ label, value, sub, icon: Icon, tone, live, badge, delay, spark, sparkData }) {
  const count = useCountUp(Number(value || 0));
  return (
    <section className="card kpi-card page-section" style={{ animationDelay: `${delay}s` }}>
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        <Icon size={15} color={tone || 'var(--t2)'} />
      </div>
      <div className="kpi-num" style={{ color: tone || 'var(--t0)' }}>
        {live && <span className="dot dot-green pulse" />}
        {count}
        {badge && <span className="badge badge-red">{badge}</span>}
      </div>
      <div className="kpi-sub" style={String(sub).startsWith('+') ? { color: 'var(--green)' } : undefined}>{sub}</div>
      {spark && (
        <div style={{ height: 28, marginTop: 8 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkData}>
              <Line dataKey="submitted" dot={false} stroke="var(--acc)" strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

function statusMeta(status) {
  if (status === 'live') return ['dot-green pulse', 'Live', 'var(--green)'];
  if (status === 'pending' || status === 'draft' || status === 'under_review') return ['dot-amber', 'Pending', 'var(--amber)'];
  if (status === 'expired' || status === 'rejected' || status === 'failed') return ['dot-red', 'Expired', 'var(--red)'];
  return ['dot-dim', 'Completed', 'var(--t1)'];
}

function activityDot(type = '') {
  if (type.includes('SESSION') || type.includes('LIVE')) return 'dot-blue';
  if (type.includes('APPROVED') || type.includes('CONSENT') || type.includes('ACCEPTED')) return 'dot-green';
  if (type.includes('FLAG') || type.includes('RISK')) return 'dot-amber';
  if (type.includes('EXPIRED') || type.includes('REJECTED')) return 'dot-red';
  return 'dot-dim';
}

export default function Dashboard() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState({ key: 'label', dir: 'asc' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const [applications, setApplications] = useState([]);
  const [activity, setActivity] = useState([]);
  const [page, setPage] = useState(0);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const pageSize = 8;

  useEffect(() => {
    const nextFilter = searchParams.get('filter');
    if (['all', 'live', 'flagged', 'approved'].includes(nextFilter)) {
      setFilter(nextFilter);
    } else if (!nextFilter) {
      setFilter('all');
    }
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        setLoading(true);
        setError('');
        const [dashboardData, applicationsData, activityData] = await Promise.all([
          reportsAPI.dashboard(),
          reportsAPI.applications(50),
          activityAPI.feed().catch(() => ({ activity: [] }))
        ]);

        if (!cancelled) {
          setDashboard(dashboardData);
          setApplications(toDashboardRows(applicationsData.applications || []));
          setActivity(activityData.activity || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error || 'Failed to load dashboard data');
          toast.error('Failed to load dashboard data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDashboard();
    const interval = setInterval(loadDashboard, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const kpis = useMemo(() => {
    const funnel = dashboard?.approval_funnel || {};
    const flagged = (dashboard?.top_red_flags || []).reduce((sum, row) => sum + Number(row.count || 0), 0);
    const liveSessions = applications.filter((app) => app.status === 'live').length;
    return {
      applicationsToday: dashboard?.total_sessions || applications.length || 0,
      liveSessions,
      autoApproved: funnel.approved || 0,
      flagged
    };
  }, [applications, dashboard]);

  const weekData = useMemo(() => {
    const rows = dashboard?.daily_volume || [];
    return rows.map((row) => ({
      day: new Date(row.date).toLocaleDateString('en-IN', { weekday: 'short' }),
      submitted: Number(row.applications || 0),
      approved: 0,
      rejected: 0
    }));
  }, [dashboard]);

  const bandDist = useMemo(() => {
    const dist = dashboard?.band_distribution || {};
    return ['A', 'B', 'C', 'D'].map((name) => ({
      name,
      value: Number(dist[name] || 0),
      color: bandColors[name]
    }));
  }, [dashboard]);

  const filtered = useMemo(() => {
    return applications
      .filter((app) => app.name.toLowerCase().includes(query.toLowerCase()))
      .filter((app) => {
        if (filter === 'live') return app.status === 'live';
        if (filter === 'flagged') return app.geo === 'mismatch' || app.band === 'C' || app.band === 'D';
        if (filter === 'approved') return app.status === 'approved' || app.status === 'completed';
        return true;
      })
      .sort((a, b) =>
        sort.dir === 'asc'
          ? String(a[sort.key] ?? '').localeCompare(String(b[sort.key] ?? ''))
          : String(b[sort.key] ?? '').localeCompare(String(a[sort.key] ?? ''))
      );
  }, [applications, filter, query, sort]);

  const toggleSort = (key) => setSort((current) => ({ key, dir: current.key === key && current.dir === 'asc' ? 'desc' : 'asc' }));
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);

  useEffect(() => {
    setPage(0);
  }, [filter, query]);

  const queueVerificationCampaign = async (app, kind) => {
    const channel = app.email ? 'email' : 'whatsapp';
    const customer = {
      name: app.name,
      phone: app.rawPhone || '',
      email: app.email || ''
    };

    if (!customer.email && !customer.phone) {
      toast.error('This applicant has no email or phone for a reminder');
      return;
    }

    const expiryMinutes = kind === 'resend' ? 120 : 60;
    const message = `Dear {name}, ${kind === 'resend' ? 'your verification link has been reissued' : 'please complete your pending Kredox AI verification'}: {link}. Valid for ${expiryMinutes >= 60 ? `${expiryMinutes / 60}h` : `${expiryMinutes}m`}.`;

    try {
      const result = await campaignAPI.create({
        lender_id: 'kredox-demo',
        name: `Kredox AI ${kind === 'resend' ? 'resend' : 'reminder'} - ${app.name}`,
        customer_list: [customer],
        channel,
        expiry_minutes: expiryMinutes,
        message_template: message
      });
      const failed = (result.dispatch_results || []).filter((item) => item.status !== 'sent');
      if (failed.length) {
        toast.error(`${kind === 'resend' ? 'Resend' : 'Reminder'} link created, but delivery failed. Open Campaigns and use Copy Link.`);
      } else {
        toast.success(`${kind === 'resend' ? 'New link sent' : 'Reminder sent'} to ${app.name}`);
      }
    } catch (err) {
      const details = err.response?.data?.details;
      const firstFieldError = details?.fieldErrors ? Object.values(details.fieldErrors).flat()[0] : null;
      toast.error(firstFieldError || err.response?.data?.error || `${kind === 'resend' ? 'Resend' : 'Reminder'} failed`);
    }
  };

  const handleAction = async (app) => {
    if (app.status === 'live') {
      if (!app.sessionId) {
        toast.error('This record has no live session ID yet');
        return;
      }
      navigate(`/session/${app.sessionId}`);
      return;
    }
    if (app.status === 'pending' || app.status === 'draft' || app.status === 'under_review') {
      await queueVerificationCampaign(app, 'reminder');
      return;
    }
    if (app.status === 'expired') {
      await queueVerificationCampaign(app, 'resend');
      return;
    }
    if (!app.sessionId) {
      toast.error('This application does not have a session report yet');
      return;
    }
    navigate(`/report/${app.sessionId}`);
  };

  if (loading) {
    return (
      <main className="page">
        <div className="kpi-row">{[0, 1, 2, 3].map((item) => <section className="card kpi-card skeleton" key={item} />)}</div>
        <section className="card page-section" style={{ height: 360, marginTop: 16 }} />
      </main>
    );
  }

  if (error) {
    return (
      <main className="page">
        <section className="card report-section">
          <h1 className="section-title">Dashboard unavailable</h1>
          <p className="muted" style={{ marginTop: 8 }}>{error}</p>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => window.location.reload()}>Retry</button>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="kpi-row">
        <KpiCard label="Applications Today" value={kpis.applicationsToday} sub="From backend reports" icon={TrendingUp} delay={0} spark sparkData={weekData} />
        <KpiCard label="Live Sessions" value={kpis.liveSessions} sub="Active video sessions" icon={ActivityIcon} delay={0.08} live />
        <KpiCard label="Auto Approved" value={kpis.autoApproved} sub="Approved in funnel" icon={CheckCircle} delay={0.16} />
        <KpiCard label="Flagged" value={kpis.flagged} sub="Risk flags today" icon={AlertTriangle} tone="var(--amber)" delay={0.24} badge={kpis.flagged ? `${kpis.flagged} total` : null} />
      </div>

      <div className="dash-grid page-section" style={{ animationDelay: '.32s' }}>
        <section className="card">
          <div className="card-header">
            <h2 className="section-title">Applications</h2>
            <div className="filter-row">
              {[
                ['all', `All ${applications.length}`],
                ['live', `Live ${kpis.liveSessions}`],
                ['flagged', `Flagged ${kpis.flagged}`],
                ['approved', `Approved ${kpis.autoApproved}`]
              ].map(([key, label]) => (
                <button
                  key={key}
                  className={`badge ${filter === key ? 'badge-blue' : 'badge-dim'}`}
                  onClick={() => {
                    setFilter(key);
                    setSearchParams(key === 'all' ? {} : { filter: key });
                  }}
                >
                  {label}
                </button>
              ))}
              <div className="search-wrap small-inp">
                <Search size={14} />
                <input className="inp" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Applicant" />
              </div>
            </div>
          </div>
          <div className="table-scroll">
            <table className="tbl">
              <colgroup>
                <col style={{ width: 80 }} /><col style={{ width: 160 }} /><col style={{ width: 110 }} /><col style={{ width: 120 }} />
                <col style={{ width: 60 }} /><col style={{ width: 70 }} /><col style={{ width: 80 }} /><col style={{ width: 60 }} /><col />
              </colgroup>
              <thead>
                <tr>{['ID', 'Applicant', 'Campaign', 'Status', 'Band', 'Score', 'Geo', 'Time', 'Action'].map((head) => <th key={head} onClick={() => toggleSort(head.toLowerCase())}>{head}</th>)}</tr>
              </thead>
              <tbody>
                {pageRows.map((app) => {
                  const [dot, label, color] = statusMeta(app.status);
                  const scoreClass = app.score > 800 ? 'score-green' : app.score >= 650 ? 'score-blue' : 'score-amber';
                  const actionLabel = app.status === 'live' ? 'Join' : app.status === 'pending' ? 'Remind' : app.status === 'expired' ? 'Resend' : 'Report';
                  return (
                    <tr key={app.id}>
                      <td className="mono dim">{app.label}</td>
                      <td><div>{app.name}</div><div className="mono dim" style={{ fontSize: 11 }}>{app.phone}</div></td>
                      <td className="mono dim">{app.campaign}</td>
                      <td><span className="status-inline" style={{ color }}><span className={`dot ${dot}`} />{label}</span></td>
                      <td>{app.band ? <span className={`band band-${app.band}`}>{app.band}</span> : <span className="dim">-</span>}</td>
                      <td className={`mono ${app.score ? scoreClass : 'dim'}`}>{app.score || '-'}</td>
                      <td>{app.geo === 'match' ? <CheckCircle size={13} color="var(--green)" /> : app.geo === 'mismatch' ? <span className="status-inline" style={{ color: 'var(--amber)', fontSize: 11 }}><AlertTriangle size={13} />Mismatch</span> : <span className="dim">-</span>}</td>
                      <td className="dim">{app.time}</td>
                      <td>
                        <button className={`btn ${app.status === 'live' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => handleAction(app)}>{actionLabel}</button>
                      </td>
                    </tr>
                  );
                })}
                {!filtered.length && (
                  <tr><td colSpan="9" className="muted">No applications returned by the backend yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <span>Showing {filtered.length ? safePage * pageSize + 1 : 0}-{Math.min((safePage + 1) * pageSize, filtered.length)} of {filtered.length}</span>
            <span>
              <button className="btn btn-ghost" disabled={safePage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>Prev</button>
              {' '}
              <button className="btn btn-ghost" disabled={safePage >= totalPages - 1} onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))}>Next</button>
            </span>
          </div>
        </section>

        <aside className="card">
          <div className="card-header">
            <h2 className="section-title">Live Activity</h2>
            <span className="dot dot-green pulse" />
          </div>
          <div className="activity-list">
            {activity.map((item, index) => (
              <div className="activity-item" key={`${item.message}-${item.timestamp}-${index}`} style={{ animationDelay: `${index * 0.05}s` }}>
                <span className={`dot ${activityDot(item.type)}`} />
                <p>{item.message}</p>
                <time>{formatRelative(item.timestamp)}</time>
              </div>
            ))}
            {!activity.length && <p className="muted" style={{ padding: 16 }}>No audit events yet.</p>}
          </div>
        </aside>
      </div>

      <div className="charts-grid page-section" style={{ animationDelay: '.4s' }}>
        <section className="card chart-card">
          <h2 className="chart-title">Application Volume</h2>
          <p className="chart-sub">Last 7 days from backend</p>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekData}>
                <XAxis dataKey="day" tick={{ fill: 'var(--t2)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid var(--b1)', color: 'var(--t0)' }} />
                <Bar dataKey="submitted" fill="#003399" />
                <Bar dataKey="approved" fill="#00A86B" />
                <Bar dataKey="rejected" fill="#D32F2F" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="legend">
            <span><i className="legend-dot" style={{ background: '#003399' }} />Submitted</span>
            <span><i className="legend-dot" style={{ background: '#00A86B' }} />Approved</span>
            <span><i className="legend-dot" style={{ background: '#D32F2F' }} />Rejected</span>
          </div>
        </section>

        <section className="card chart-card">
          <h2 className="chart-title">Risk Band Distribution</h2>
          <p className="chart-sub">Current backend risk data</p>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={bandDist} dataKey="value" innerRadius={44} outerRadius={70}>
                  {bandDist.map((row) => <Cell key={row.name} fill={row.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="band-legend">
            {bandDist.map((row) => (
              <div className="band-legend-row" key={row.name}>
                <span>{row.name}</span><span>{row.value}</span><span className="band-bar"><span style={{ width: `${Math.min(row.value, 100)}%`, background: row.color }} /></span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
