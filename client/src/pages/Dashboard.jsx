import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, CheckCircle, Download, Radio, TrendingUp } from 'lucide-react';
import AppShell from '../components/AppShell.jsx';
import { applications, kpis, riskDistribution, volumeData } from '../data/mockData.js';

const bandColors = { A: '#10B981', B: '#5B6EF5', C: '#F59E0B', D: '#EF4444' };

function Kpi({ label, value, note, tone = 'var(--text-primary)' }) {
  return (
    <section className="card glow">
      <p className="muted">{label}</p>
      <div className="kpi-value" style={{ color: tone }}>{value}</div>
      <p className="trend">{note}</p>
    </section>
  );
}

export default function Dashboard() {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState({ key: 'time', dir: 'asc' });
  const navigate = useNavigate();
  const rows = useMemo(() => {
    return applications
      .filter((app) => app.name.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => {
        const av = a[sort.key] ?? '';
        const bv = b[sort.key] ?? '';
        return sort.dir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      });
  }, [query, sort]);
  const toggleSort = (key) => setSort((current) => ({ key, dir: current.key === key && current.dir === 'asc' ? 'desc' : 'asc' }));

  return (
    <AppShell
      title="Command Center"
      subtitle="Agentic loan onboarding, live verification, risk intelligence"
      actions={<button className="btn ghost"><Download size={16} /> Export CSV</button>}
    >
      <div className="grid kpi-grid">
        <Kpi label="Applications Today" value={kpis.applicationsToday} note="18% vs yesterday" />
        <Kpi label="Live Sessions" value={kpis.liveSessions} note="4 agents currently online" tone="var(--accent)" />
        <Kpi label="Auto Approved" value={kpis.autoApproved} note="36.2% approval rate" tone="var(--success)" />
        <Kpi label="Flagged for Review" value={kpis.flagged} note="8 critical require action" tone="var(--warning)" />
      </div>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="topbar" style={{ minHeight: 'auto', marginBottom: 16 }}>
          <div>
            <h2>Recent Applications</h2>
            <p className="muted">Live queue across campaign, KYC, risk, and offer stages.</p>
          </div>
          <input className="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter by applicant..." />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {['Applicant', 'Campaign', 'Session', 'Risk Band', 'Score', 'Geo', 'Time', 'Action'].map((header) => (
                  <th key={header} onClick={() => toggleSort(header === 'Applicant' ? 'name' : header.toLowerCase().replace(' ', ''))}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((app) => (
                <tr key={app.id}>
                  <td><strong>{app.name}</strong><br /><span className="mono muted">{app.id}</span></td>
                  <td>{app.campaign}</td>
                  <td><span className={`badge ${app.status}`}><span className="pulse-dot" style={{ background: app.status === 'live' ? 'var(--accent)' : 'currentColor' }} />{app.status}</span></td>
                  <td>{app.riskBand ? <span className={`badge ${app.riskBand.toLowerCase()}`}>Band {app.riskBand}</span> : '-'}</td>
                  <td className="mono">{app.score || '-'}</td>
                  <td>{app.geo === 'match' ? <span className="badge match"><CheckCircle size={13} /> Match</span> : app.geo === 'mismatch' ? <span className="badge mismatch"><AlertTriangle size={13} /> Mismatch</span> : '-'}</td>
                  <td className="muted">{app.time}</td>
                  <td>
                    {app.status === 'live' && <button className="btn" onClick={() => navigate(`/session/${app.id}`)}><Radio size={15} /> Join</button>}
                    {app.status === 'completed' && <button className="btn ghost" onClick={() => navigate(`/report/${app.id}`)}>View Report</button>}
                    {app.status === 'pending' && <button className="btn ghost">Reminder</button>}
                    {app.status === 'expired' && <button className="btn ghost">Resend</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid two-col" style={{ marginTop: 18 }}>
        <section className="card">
          <h2>Application Volume - Last 7 Days</h2>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeData}>
                <CartesianGrid stroke="#1F2130" />
                <XAxis dataKey="day" stroke="#5C6070" />
                <YAxis stroke="#5C6070" />
                <Tooltip contentStyle={{ background: '#161820', border: '1px solid #1F2130', color: '#ECEDF2' }} />
                <Bar dataKey="Submitted" fill="#5B6EF5" />
                <Bar dataKey="Approved" fill="#10B981" />
                <Bar dataKey="Rejected" fill="#EF4444" />
                <Bar dataKey="Flagged" fill="#F59E0B" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="card">
          <h2>Risk Band Distribution</h2>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={riskDistribution} dataKey="count" innerRadius={72} outerRadius={105}>
                  {riskDistribution.map((row) => <Cell key={row.band} fill={bandColors[row.band]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#161820', border: '1px solid #1F2130', color: '#ECEDF2' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <p className="muted">247 total applications analyzed today.</p>
          <p className="trend"><TrendingUp size={15} /> Band A approvals up 4.1% this week</p>
        </section>
      </div>
    </AppShell>
  );
}
