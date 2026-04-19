import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { activityAPI } from '../api/index.js';
import { useDashboardData } from '../hooks/useDashboardData.js';

function ShellNav() {
  return (
    <nav className="top-nav">
      <Link to="/dashboard" className="brand-link">Kredox AI</Link>
      <div>
        <Link to="/dashboard/campaigns">Campaigns</Link>
        <Link to="/dashboard/reports">Reports</Link>
      </div>
    </nav>
  );
}

function SkeletonBlock() {
  return <div className="skeleton-block" />;
}

function normalizeActivity(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.activities || payload?.events || [];
}

export function Dashboard() {
  const { kpis, applications, campaigns, summary, isLoading } = useDashboardData();
  const [activity, setActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(true);

  useEffect(() => {
    let didToast = false;
    const loadActivity = async () => {
      try {
        const data = await activityAPI.feed();
        setActivity(normalizeActivity(data));
      } catch (error) {
        if (!didToast) {
          toast.error(error.response?.data?.error || 'Failed to load activity feed');
          didToast = true;
        }
      } finally {
        setActivityLoading(false);
      }
    };

    loadActivity();
    const interval = setInterval(loadActivity, 10000);
    return () => clearInterval(interval);
  }, []);

  const volume = summary?.daily_volume || summary?.volume || [];
  const bandDistribution = summary?.band_distribution || summary?.risk_band_distribution || [];
  const funnel = summary?.approval_funnel || summary?.funnel || [];

  return (
    <main className="page-shell">
      <ShellNav />
      <section className="page-header">
        <p className="eyebrow">Command center</p>
        <h1>Dashboard</h1>
      </section>

      <section className="kpi-grid">
        {[
          ['Applications Today', kpis?.total_applications],
          ['Live Sessions', kpis?.live_sessions],
          ['Auto Approved', kpis?.auto_approved],
          ['Flagged for Review', kpis?.flagged]
        ].map(([label, value]) => (
          <article className="metric-card" key={label}>
            <span>{label}</span>
            {isLoading ? <SkeletonBlock /> : <strong>{value ?? 0}</strong>}
          </article>
        ))}
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <h2>Applications</h2>
          {isLoading ? (
            <SkeletonBlock />
          ) : applications.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Status</th>
                    <th>Risk</th>
                    <th>Session</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((application) => (
                    <tr key={application.id || application.session_id}>
                      <td>{application.customer_name || application.name || application.customer_id}</td>
                      <td>{application.status || application.recommended_action || '-'}</td>
                      <td>{application.risk_band || '-'}</td>
                      <td>
                        {application.session_id ? (
                          <Link to={`/dashboard/report/${application.session_id}`}>Open</Link>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty-state">No applications returned by the API yet.</p>
          )}
        </article>

        <article className="panel">
          <h2>Activity Feed</h2>
          {activityLoading ? (
            <SkeletonBlock />
          ) : activity.length ? (
            <ul className="activity-list">
              {activity.map((item) => (
                <li key={item.id || `${item.event_type}-${item.timestamp}`}>
                  <strong>{item.event_type || item.action}</strong>
                  <span>{item.timestamp ? new Date(item.timestamp).toLocaleString() : item.message}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">No live activity returned by the API.</p>
          )}
        </article>
      </section>

      <section className="analytics-grid">
        <article className="panel">
          <h2>Daily Application Volume</h2>
          {volume.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={volume}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#118c6f" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="empty-state">No volume series available.</p>
          )}
        </article>

        <article className="panel">
          <h2>Risk Band Distribution</h2>
          {bandDistribution.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={bandDistribution} dataKey="count" nameKey="band" outerRadius={90} label>
                  {bandDistribution.map((entry, index) => (
                    <Cell key={entry.band || index} fill={['#118c6f', '#2f6fed', '#d99a00', '#d94841'][index % 4]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="empty-state">No band distribution available.</p>
          )}
        </article>

        <article className="panel">
          <h2>Approval Funnel</h2>
          {funnel.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={funnel} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="stage" width={100} />
                <Tooltip />
                <Bar dataKey="count" fill="#5a58c9" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="empty-state">No funnel data available.</p>
          )}
        </article>

        <article className="panel">
          <h2>Campaigns</h2>
          {isLoading ? (
            <SkeletonBlock />
          ) : campaigns.length ? (
            <ul className="compact-list">
              {campaigns.slice(0, 6).map((campaign) => (
                <li key={campaign.id}>
                  <span>{campaign.name || campaign.id}</span>
                  <strong>{campaign.channel}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">No campaigns returned by the API.</p>
          )}
        </article>
      </section>
    </main>
  );
}
