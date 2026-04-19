import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, CheckCircle, Download, Search, TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ActivityPanel } from '../components/layout/ActivityPanel.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { Input } from '../components/ui/Input.jsx';
import { MiniSparkline } from '../components/ui/MiniSparkline.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { useCountUp } from '../hooks/useCountUp.js';
import { useDashboardData } from '../hooks/useDashboardData.js';
import { riskDistribution, sparklineData, volumeData } from '../data/mockData.js';

const bandColors = { A: '#10B981', B: '#5B6EF5', C: '#F59E0B', D: '#EF4444' };
const statusDot = { live: 'bg-accent', completed: 'bg-success', pending: 'bg-text-muted', expired: 'bg-danger' };
const columnKeys = { Applicant: 'name', Campaign: 'campaign', Session: 'status', 'Risk Band': 'riskBand', Score: 'score', Geo: 'geo', Time: 'time' };

function KpiCard({ title, value, children, delay, color = 'text-text-primary' }) {
  const count = useCountUp(value);
  return (
    <Card delay={delay} glow className="border-t border-t-accent/50">
      <p className="text-sm font-bold text-text-muted">{title}</p>
      <div className={`num mt-3 font-display text-5xl font-extrabold ${color}`}>{count}</div>
      {children}
    </Card>
  );
}

function useSortableRows(rows) {
  const [sort, setSort] = useState({ key: 'time', dir: 'asc' });
  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = a[sort.key] ?? '';
      const bv = b[sort.key] ?? '';
      return sort.dir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [rows, sort]);
  const toggle = (key) => setSort((current) => ({ key, dir: current.key === key && current.dir === 'asc' ? 'desc' : 'asc' }));
  return { sorted, toggle };
}

export function Dashboard() {
  const { kpis, applications, isLoading } = useDashboardData();
  const [search, setSearch] = useState('');
  const [activeChip, setActiveChip] = useState('All 247');
  const navigate = useNavigate();
  const filtered = applications.filter((row) => row.name.toLowerCase().includes(search.toLowerCase()));
  const { sorted, toggle } = useSortableRows(filtered);

  return (
    <div className="flex">
      <div className="min-w-0 flex-1 p-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard title="Applications Today" value={kpis.applicationsToday} delay={0}>
            <p className="mt-2 flex items-center gap-1 text-sm text-success"><TrendingUp className="h-4 w-4" /> Up 18% vs yesterday</p>
            <MiniSparkline data={sparklineData} />
          </KpiCard>
          <KpiCard title="Live Sessions" value={kpis.liveSessions} delay={0.07}>
            <p className="mt-2 flex items-center gap-2 text-sm text-text-muted"><span className="pulse-dot h-3 w-3 rounded-full bg-danger" /> 4 agents currently online</p>
            <div className="mt-4 flex -space-x-2">{['RD', 'NK', 'AV', 'PR'].map((a) => <span key={a} className="grid h-8 w-8 place-items-center rounded-full border border-bg-surface bg-accent text-xs font-bold">{a}</span>)}</div>
          </KpiCard>
          <KpiCard title="Auto Approved" value={kpis.autoApproved} delay={0.14}>
            <p className="mt-2 text-sm text-text-muted">36.2% approval rate</p><p className="text-sm text-success">Up 4.1% this week</p>
          </KpiCard>
          <KpiCard title="Flagged for Review" value={kpis.flagged} delay={0.21} color="text-warning">
            <p className="mt-2 text-sm text-text-muted">Requires agent action</p><Badge value="danger">8 critical</Badge>
          </KpiCard>
        </div>

        <Card delay={0.28} className="mt-5">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="font-display text-xl font-bold">Recent Applications</h2>
            <div className="flex flex-wrap gap-2">
              <Input icon={Search} placeholder="Search applicant..." value={search} onChange={(event) => setSearch(event.target.value)} className="w-56" />
              <select className="rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-muted"><option>All Statuses</option></select>
              <Button variant="ghost"><Download className="h-4 w-4" /> Export CSV</Button>
            </div>
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            {['All 247', 'Live 12', 'Flagged 23', 'Approved 89', 'Rejected 44'].map((chip) => (
              <button key={chip} onClick={() => setActiveChip(chip)} className={`rounded-full px-3 py-1 text-sm font-bold ${activeChip === chip ? 'bg-accent text-white' : 'bg-bg-elevated text-text-muted'}`}>{chip}</button>
            ))}
          </div>
          {isLoading ? <Skeleton className="h-80" /> : (
            <div className="dark-scrollbar overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="text-left text-text-muted">
                  <tr>
                    {['Select', 'Applicant', 'Campaign', 'Session', 'Risk Band', 'Score', 'Geo', 'Time', 'Action'].map((header) => (
                      <th key={header} onClick={() => columnKeys[header] && toggle(columnKeys[header])} className="cursor-pointer px-3 py-3">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((app) => (
                    <tr key={app.id} className="table-row-hover border-t border-border">
                      <td className="px-3 py-4"><input type="checkbox" /></td>
                      <td className="px-3 py-4"><div className="font-bold">{app.name}</div><div className="mono text-xs text-text-muted">{app.id}</div></td>
                      <td className="px-3 py-4 text-text-muted">{app.campaign}</td>
                      <td className="px-3 py-4"><span className={`mr-2 inline-block h-2 w-2 rounded-full ${statusDot[app.status]} ${app.status === 'live' ? 'pulse-dot' : ''}`} />{app.status[0].toUpperCase() + app.status.slice(1)}</td>
                      <td className="px-3 py-4">{app.riskBand ? <Badge type="risk" value={app.riskBand}>Band {app.riskBand}</Badge> : '-'}</td>
                      <td className="mono px-3 py-4">{app.score || '-'}</td>
                      <td className="px-3 py-4">{app.geo === 'match' ? <span className="text-success"><CheckCircle className="mr-1 inline h-4 w-4" /> Match</span> : app.geo === 'mismatch' ? <span className="text-warning"><AlertTriangle className="mr-1 inline h-4 w-4" /> Mismatch</span> : '-'}</td>
                      <td className="px-3 py-4 text-text-muted">{app.time}</td>
                      <td className="px-3 py-4">
                        {app.status === 'live' && <Button onClick={() => navigate(`/session/${app.id}`)} className="py-1.5">Join Session</Button>}
                        {app.status === 'completed' && <Button variant="ghost" onClick={() => navigate(`/report/${app.id}`)} className="py-1.5">View Report</Button>}
                        {app.status === 'pending' && <Button variant="outline" className="py-1.5">Send Reminder</Button>}
                        {app.status === 'expired' && <Button variant="ghost" className="py-1.5">Resend Link</Button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 flex items-center justify-between text-sm text-text-muted"><span>Showing 1-8 of 247 applications</span><span>Prev  1  2  3  ...  31  Next</span></div>
            </div>
          )}
        </Card>

        <div className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_0.9fr]">
          <Card delay={0.35}>
            <h2 className="mb-4 font-display text-xl font-bold">Application Volume - Last 7 Days</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={volumeData}><CartesianGrid stroke="#1F2130" /><XAxis dataKey="day" stroke="#5C6070" /><YAxis stroke="#5C6070" /><Tooltip contentStyle={{ background: '#161820', border: '1px solid #1F2130' }} /><Bar dataKey="Submitted" fill="#5B6EF5" /><Bar dataKey="Approved" fill="#10B981" /><Bar dataKey="Rejected" fill="#EF4444" /><Bar dataKey="Flagged" fill="#F59E0B" /></BarChart>
            </ResponsiveContainer>
          </Card>
          <Card delay={0.42}>
            <h2 className="mb-4 font-display text-xl font-bold">Risk Band Distribution</h2>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart><Pie data={riskDistribution} dataKey="count" nameKey="band" innerRadius={70} outerRadius={105}>{riskDistribution.map((entry) => <Cell key={entry.band} fill={bandColors[entry.band]} />)}</Pie><Tooltip contentStyle={{ background: '#161820', border: '1px solid #1F2130' }} /></PieChart>
            </ResponsiveContainer>
            <div className="text-center font-display text-2xl font-bold">247 Total</div>
            <div className="mt-4 grid grid-cols-4 gap-2 text-xs">{riskDistribution.map((row) => <span key={row.band} style={{ color: bandColors[row.band] }}>Band {row.band}: {row.count}</span>)}</div>
          </Card>
        </div>
      </div>
      <ActivityPanel />
    </div>
  );
}
