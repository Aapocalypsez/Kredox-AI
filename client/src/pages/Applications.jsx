import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AlertTriangle, CheckCircle, FileText, Search } from 'lucide-react';
import { reportsAPI } from '../api/index.js';

function formatRelative(value) {
  if (!value) return '-';
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / 1440)}d`;
}

function normalize(row) {
  return {
    id: row.id,
    sessionId: row.session_id,
    label: row.session_id ? `KYC-${String(row.session_id).slice(0, 8)}` : `APP-${String(row.id).slice(0, 8)}`,
    name: row.name || 'Unknown applicant',
    contact: row.phone || row.email || '-',
    campaign: row.campaign || 'Direct',
    status: row.session_status === 'active' ? 'live' : row.application_status || row.link_status || 'pending',
    band: row.risk_band,
    score: row.final_score ? Math.round(Number(row.final_score)) : null,
    geo: row.geo_match_status === 'MATCH' ? 'match' : row.geo_match_status ? 'mismatch' : null,
    time: formatRelative(row.created_at)
  };
}

function statusBadge(status) {
  if (status === 'live') return 'badge-green';
  if (status === 'completed' || status === 'approved') return 'badge-blue';
  if (status === 'expired' || status === 'rejected') return 'badge-red';
  return 'badge-amber';
}

export default function Applications() {
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const data = await reportsAPI.applications(100);
        if (!cancelled) setRows((data.applications || []).map(normalize));
      } catch (error) {
        toast.error(error.response?.data?.error || 'Failed to load applications');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const interval = window.setInterval(load, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = query.toLowerCase();
    return rows.filter((row) =>
      [row.name, row.contact, row.label, row.campaign].some((value) => String(value || '').toLowerCase().includes(needle))
    );
  }, [query, rows]);

  const openRecord = (row) => {
    if (row.status === 'live' && row.sessionId) {
      navigate(`/session/${row.sessionId}`);
      return;
    }
    if (row.sessionId) {
      navigate(`/report/${row.sessionId}`);
      return;
    }
    toast('This verification has not produced a report session yet', { id: 'application-no-report' });
  };

  const actionLabel = (row) => (row.status === 'live' ? 'Join' : 'Open');

  return (
    <main className="page">
      <section className="card report-header page-section">
        <div className="applicant-head">
          <div className="report-avatar"><FileText size={18} /></div>
          <div>
            <h1 className="report-name">Applications</h1>
            <p className="report-sub">Verification links, submitted sessions, auto-filled applications, and generated reports.</p>
            <p className="report-id">Source: /api/reports/applications</p>
          </div>
        </div>
        <Link className="btn btn-primary" to="/campaigns">New Campaign</Link>
      </section>

      <section className="card page-section" style={{ marginTop: 16 }}>
        <div className="card-header">
          <h2 className="section-title">Recent Applications</h2>
          <div className="search-wrap small-inp">
            <Search size={14} />
            <input className="inp" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search applicant" />
          </div>
        </div>
        <div className="table-scroll">
          <table className="tbl">
            <thead>
              <tr>
                {['ID', 'Applicant', 'Campaign', 'Status', 'Band', 'Score', 'Geo', 'Time', 'Action'].map((head) => <th key={head}>{head}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} onClick={() => openRecord(row)}>
                  <td className="mono dim">{row.label}</td>
                  <td><div>{row.name}</div><div className="mono dim" style={{ fontSize: 11 }}>{row.contact}</div></td>
                  <td className="mono dim">{row.campaign}</td>
                  <td><span className={`badge ${statusBadge(row.status)}`}>{row.status}</span></td>
                  <td>{row.band ? <span className={`band band-${row.band}`}>{row.band}</span> : <span className="dim">-</span>}</td>
                  <td className="mono">{row.score || '-'}</td>
                  <td>{row.geo === 'match' ? <CheckCircle size={13} color="var(--green)" /> : row.geo === 'mismatch' ? <AlertTriangle size={13} color="var(--amber)" /> : <span className="dim">-</span>}</td>
                  <td className="dim">{row.time}</td>
                  <td><button className={`btn ${row.status === 'live' ? 'btn-primary' : 'btn-ghost'}`} type="button" onClick={(event) => { event.stopPropagation(); openRecord(row); }}>{actionLabel(row)}</button></td>
                </tr>
              ))}
              {!loading && !filtered.length && <tr><td colSpan="9" className="muted">No applications returned yet. Completed verification links will appear here.</td></tr>}
              {loading && <tr><td colSpan="9" className="muted">Loading applications...</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
