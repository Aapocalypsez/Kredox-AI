import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity as ActivityIcon, AlertTriangle, CheckCircle, Search, TrendingUp } from 'lucide-react';
import { Bar, BarChart, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { activity, applications, bandDist, kpis, weekData } from '../data/mockData.js';
import { useCountUp } from '../hooks/useCountUp.js';

function KpiCard({ label, value, sub, icon: Icon, tone, live, badge, delay, spark }) {
  const count = useCountUp(value);
  const sparkData = weekData.map((row) => ({ value: row.submitted }));
  return (
    <section className="card kpi-card page-section" style={{animationDelay:`${delay}s`}}>
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        <Icon size={15} color={tone || 'var(--t2)'} />
      </div>
      <div className="kpi-num" style={{color:tone || 'var(--t0)'}}>
        {live && <span className="dot dot-green pulse" />}
        {count}
        {badge && <span className="badge badge-red">{badge}</span>}
      </div>
      <div className="kpi-sub" style={sub?.startsWith('↑') ? {color:'var(--green)'} : undefined}>{sub}</div>
      {spark && (
        <div style={{height:28,marginTop:8}}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkData}>
              <Line dataKey="value" dot={false} stroke="var(--acc)" strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

function statusMeta(status) {
  if (status === 'live') return ['dot-green pulse', 'Live', 'var(--green)'];
  if (status === 'pending') return ['dot-amber', 'Pending', 'var(--amber)'];
  if (status === 'expired') return ['dot-red', 'Expired', 'var(--red)'];
  return ['dot-dim', 'Completed', 'var(--t1)'];
}

function activityDot(type) {
  if (type === 'live') return 'dot-blue';
  if (type === 'approved' || type === 'consent') return 'dot-green';
  if (type === 'flag') return 'dot-amber';
  if (type === 'expired') return 'dot-red';
  return 'dot-dim';
}

export default function Dashboard() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All 247');
  const [sort, setSort] = useState({key:'id',dir:'asc'});
  const navigate = useNavigate();
  const filtered = useMemo(() => {
    return applications
      .filter((app) => app.name.toLowerCase().includes(query.toLowerCase()))
      .sort((a,b) => sort.dir === 'asc' ? String(a[sort.key] ?? '').localeCompare(String(b[sort.key] ?? '')) : String(b[sort.key] ?? '').localeCompare(String(a[sort.key] ?? '')));
  }, [query, sort]);
  const toggleSort = (key) => setSort((current) => ({key,dir:current.key === key && current.dir === 'asc' ? 'desc' : 'asc'}));

  return (
    <main className="page">
      <div className="kpi-row">
        <KpiCard label="Applications Today" value={kpis.applicationsToday} sub="↑ 18% vs yesterday" icon={TrendingUp} delay={0} spark />
        <KpiCard label="Live Sessions" value={kpis.liveSessions} sub="4 agents currently online" icon={ActivityIcon} delay={0.08} live />
        <KpiCard label="Auto Approved" value={kpis.autoApproved} sub="36.2% approval rate" icon={CheckCircle} delay={0.16} />
        <KpiCard label="Flagged" value={kpis.flagged} sub="Requires review" icon={AlertTriangle} tone="var(--amber)" delay={0.24} badge="8 critical" />
      </div>

      <div className="dash-grid page-section" style={{animationDelay:'.32s'}}>
        <section className="card">
          <div className="card-header">
            <h2 className="section-title">Applications</h2>
            <div className="filter-row">
              {['All 247','Live 12','Flagged 23','Approved 89'].map((chip) => (
                <button key={chip} className={`badge ${filter === chip ? 'badge-blue' : 'badge-dim'}`} onClick={() => setFilter(chip)}>{chip}</button>
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
                <col style={{width:80}} /><col style={{width:160}} /><col style={{width:110}} /><col style={{width:120}} />
                <col style={{width:60}} /><col style={{width:70}} /><col style={{width:80}} /><col style={{width:60}} /><col />
              </colgroup>
              <thead>
                <tr>{['ID','Applicant','Campaign','Status','Band','Score','Geo','Time','Action'].map((head) => <th key={head} onClick={() => toggleSort(head.toLowerCase())}>{head}</th>)}</tr>
              </thead>
              <tbody>
                {filtered.map((app) => {
                  const [dot, label, color] = statusMeta(app.status);
                  const scoreClass = app.score > 800 ? 'score-green' : app.score >= 650 ? 'score-blue' : 'score-amber';
                  return (
                    <tr key={app.id}>
                      <td className="mono dim">{app.id}</td>
                      <td><div>{app.name}</div><div className="mono dim" style={{fontSize:11}}>{app.phone}</div></td>
                      <td className="mono dim">{app.campaign}</td>
                      <td><span className="status-inline" style={{color}}><span className={`dot ${dot}`} />{label}</span></td>
                      <td>{app.band ? <span className={`band band-${app.band}`}>{app.band}</span> : <span className="dim">—</span>}</td>
                      <td className={`mono ${app.score ? scoreClass : 'dim'}`}>{app.score || '—'}</td>
                      <td>{app.geo === 'match' ? <CheckCircle size={13} color="var(--green)" /> : app.geo === 'mismatch' ? <span className="status-inline" style={{color:'var(--amber)',fontSize:11}}><AlertTriangle size={13} />Mismatch</span> : <span className="dim">—</span>}</td>
                      <td className="dim">{app.time}</td>
                      <td>
                        {app.status === 'live' && <button className="btn btn-primary" onClick={() => navigate(`/session/${app.id}`)}>Join →</button>}
                        {app.status === 'completed' && <button className="btn btn-ghost" onClick={() => navigate(`/report/${app.id}`)}>Report</button>}
                        {app.status === 'pending' && <button className="btn btn-ghost">Remind</button>}
                        {app.status === 'expired' && <button className="btn btn-ghost">Resend</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <span>Showing 1–8 of 247</span>
            <span><button className="btn btn-ghost">Prev</button> <button className="btn btn-ghost">Next</button></span>
          </div>
        </section>

        <aside className="card">
          <div className="card-header">
            <h2 className="section-title">Live Activity</h2>
            <span className="dot dot-green pulse" />
          </div>
          <div className="activity-list">
            {activity.map((item, index) => (
              <div className="activity-item" key={`${item.msg}-${item.time}`} style={{animationDelay:`${index * .05}s`}}>
                <span className={`dot ${activityDot(item.type)}`} />
                <p>{item.msg}</p>
                <time>{item.time}</time>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <div className="charts-grid page-section" style={{animationDelay:'.4s'}}>
        <section className="card chart-card">
          <h2 className="chart-title">Application Volume</h2>
          <p className="chart-sub">Last 7 days</p>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekData}>
                <XAxis dataKey="day" tick={{fill:'var(--t2)',fontSize:10}} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{background:'var(--bg-2)',border:'1px solid var(--b1)',color:'var(--t0)'}} />
                <Bar dataKey="submitted" fill="#4D90E8" />
                <Bar dataKey="approved" fill="#22C97A" />
                <Bar dataKey="rejected" fill="#F04E55" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="legend">
            <span><i className="legend-dot" style={{background:'#4D90E8'}} />Submitted</span>
            <span><i className="legend-dot" style={{background:'#22C97A'}} />Approved</span>
            <span><i className="legend-dot" style={{background:'#F04E55'}} />Rejected</span>
          </div>
        </section>

        <section className="card chart-card">
          <h2 className="chart-title">Risk Band Distribution</h2>
          <p className="chart-sub">Current application pool</p>
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
                <span>{row.name}</span><span>{row.value}</span><span className="band-bar"><span style={{width:`${row.value}%`,background:row.color}} /></span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
