import { useRef, useState } from 'react';
import ReactPlayer from 'react-player';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Funnel,
  FunnelChart,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import {
  fetchAuditLogs,
  fetchDashboardAnalytics,
  fetchRecordingPlayback,
  searchTranscripts
} from '../api.js';

const bandColors = {
  A: '#15803d',
  B: '#2563eb',
  C: '#b45309',
  D: '#b91c1c',
  unclear: '#6b7280'
};

function formatDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function prettyJson(value) {
  if (!value) return '{}';
  return JSON.stringify(value, null, 2);
}

function downloadCsv(filename, rows) {
  const headers = ['timestamp', 'event_type', 'actor_type', 'actor_id', 'entity_type', 'entity_id', 'action'];
  const csv = [
    headers.join(','),
    ...rows.map((row) => headers.map((key) => `"${String(row[key] ?? '').replaceAll('"', '""')}"`).join(','))
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function AuditTrailViewer({ entityId }) {
  const [filters, setFilters] = useState({ event_type: '', actor_id: '', date_from: '', date_to: '' });
  const [openLog, setOpenLog] = useState(null);
  const auditQuery = useQuery({
    queryKey: ['audit-logs', entityId, filters],
    queryFn: () => fetchAuditLogs({
      entity_id: entityId,
      ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value))
    }),
    refetchInterval: 30000
  });
  const logs = auditQuery.data || [];

  return (
    <main className="admin-shell">
      <section className="admin-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Audit Trail</p>
            <h1>Application event timeline</h1>
          </div>
          <button type="button" onClick={() => downloadCsv('audit-trail.csv', logs)}>Export CSV</button>
        </div>
        <div className="audit-filters">
          <input placeholder="Event type" value={filters.event_type} onChange={(event) => setFilters({ ...filters, event_type: event.target.value })} />
          <input placeholder="Actor ID" value={filters.actor_id} onChange={(event) => setFilters({ ...filters, actor_id: event.target.value })} />
          <input type="date" value={filters.date_from} onChange={(event) => setFilters({ ...filters, date_from: event.target.value })} />
          <input type="date" value={filters.date_to} onChange={(event) => setFilters({ ...filters, date_to: event.target.value })} />
        </div>
        <div className="audit-timeline">
          {logs.map((log) => (
            <article key={log.id} className="audit-event">
              <span className="audit-icon">●</span>
              <div>
                <h3>{log.event_type}</h3>
                <p>{log.actor_type} {log.actor_id || 'system'} · {formatDate(log.timestamp)}</p>
              </div>
              <button type="button" className="ghost" onClick={() => setOpenLog(openLog?.id === log.id ? null : log)}>View Details</button>
              {openLog?.id === log.id && (
                <div className="audit-diff">
                  <div>
                    <strong>Before</strong>
                    <pre>{prettyJson(log.old_value)}</pre>
                  </div>
                  <div>
                    <strong>After</strong>
                    <pre>{prettyJson(log.new_value)}</pre>
                  </div>
                </div>
              )}
            </article>
          ))}
          {auditQuery.isLoading && <p>Loading timeline...</p>}
          {!auditQuery.isLoading && !logs.length && <p>No audit events found.</p>}
        </div>
      </section>
    </main>
  );
}

export function VideoPlaybackPage({ sessionId }) {
  const playerRef = useRef(null);
  const [playedSeconds, setPlayedSeconds] = useState(0);
  const playbackQuery = useQuery({
    queryKey: ['recording-playback', sessionId],
    queryFn: () => fetchRecordingPlayback(sessionId),
    enabled: Boolean(sessionId)
  });
  const playback = playbackQuery.data;
  const lines = playback?.transcripts || [];
  const activeId = [...lines].reverse().find((line) => Number(line.offset_seconds) <= playedSeconds)?.id;

  return (
    <main className="admin-shell playback-shell">
      <section className="admin-panel playback-grid">
        <div>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Recording</p>
              <h1>Video playback</h1>
            </div>
            {playback?.playback_url && <a className="button-link" href={playback.playback_url}>Download</a>}
          </div>
          <div className="video-player-box">
            {playback?.playback_url ? (
              <ReactPlayer
                ref={playerRef}
                url={playback.playback_url}
                controls
                width="100%"
                height="100%"
                onProgress={({ playedSeconds: seconds }) => setPlayedSeconds(seconds)}
              />
            ) : (
              <div className="empty-video">Recording is not uploaded yet.</div>
            )}
          </div>
        </div>
        <aside className="synced-transcript">
          <h2>Transcript</h2>
          {lines.map((line) => (
            <button
              type="button"
              key={line.id}
              className={line.id === activeId ? 'transcript-line active' : 'transcript-line'}
              onClick={() => playerRef.current?.seekTo(Number(line.offset_seconds), 'seconds')}
            >
              <span>{Math.floor(Number(line.offset_seconds) / 60)}:{String(Math.floor(Number(line.offset_seconds) % 60)).padStart(2, '0')}</span>
              <strong>{line.speaker || 'Speaker'}:</strong>
              {line.text}
            </button>
          ))}
          {!lines.length && <p>No transcript lines saved yet.</p>}
        </aside>
      </section>
    </main>
  );
}

export function GlobalSearchPage() {
  const [query, setQuery] = useState('');
  const [riskBand, setRiskBand] = useState('');
  const searchQuery = useQuery({
    queryKey: ['transcript-search', query, riskBand],
    queryFn: () => searchTranscripts({ q: query, risk_band: riskBand }),
    enabled: query.length > 1 || Boolean(riskBand)
  });
  const results = searchQuery.data?.results || [];

  return (
    <main className="admin-shell">
      <section className="admin-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Global Search</p>
            <h1>Search every interview transcript</h1>
          </div>
        </div>
        <div className="search-row">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search income, consent, employment..." />
          <select value={riskBand} onChange={(event) => setRiskBand(event.target.value)}>
            <option value="">All bands</option>
            <option value="A">Band A</option>
            <option value="B">Band B</option>
            <option value="C">Band C</option>
            <option value="D">Band D</option>
          </select>
        </div>
        <div className="search-results">
          {results.map((result) => (
            <a href={`/application/session/${result.session_id}`} key={result.session_id} className="search-result-card">
              <div>
                <strong>{result.customer_name}</strong>
                <span>{formatDate(result.timestamp)}</span>
              </div>
              <span className={`risk-badge ${result.risk_band}`}>{result.risk_band}</span>
              <p dangerouslySetInnerHTML={{ __html: result.snippet }} />
            </a>
          ))}
          {searchQuery.isLoading && <p>Searching transcripts...</p>}
          {!searchQuery.isLoading && !results.length && <p>Run a search to find interview moments.</p>}
        </div>
      </section>
    </main>
  );
}

export function DashboardAnalytics() {
  const analyticsQuery = useQuery({
    queryKey: ['dashboard-analytics'],
    queryFn: fetchDashboardAnalytics,
    refetchInterval: 300000
  });
  const data = analyticsQuery.data;
  const bandData = data ? Object.entries(data.band_distribution).map(([band, count]) => ({ band, count })) : [];
  const funnelData = data ? [
    { name: 'Sent', value: data.approval_funnel.sent || 0 },
    { name: 'Opened', value: data.approval_funnel.opened || 0 },
    { name: 'Completed', value: data.approval_funnel.completed || 0 },
    { name: 'Approved', value: data.approval_funnel.approved || 0 }
  ] : [];

  const rejectionData = data?.top_red_flags?.map((item) => ({ reason: item.flag, count: item.count })) || [];
  const durationData = data?.avg_call_duration_by_band?.map((item) => ({
    band: item.risk_band,
    minutes: Number((Number(item.avg_seconds || 0) / 60).toFixed(1))
  })) || [];

  return (
    <section className="workspace-panel analytics-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Dashboard Analytics</p>
          <h2>Live application health</h2>
        </div>
        <span className="polling-badge">Refreshes every 5 min</span>
      </div>
      {!data && <p>Loading analytics...</p>}
      {data && (
        <div className="analytics-grid">
          <ChartCard title="Daily application volume">
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={data.daily_volume}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { weekday: 'short' })} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="applications" fill="#00a870" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Risk band distribution">
            <ResponsiveContainer width="100%" height={230}>
              <PieChart>
                <Pie data={bandData} dataKey="count" nameKey="band" innerRadius={55} outerRadius={90} label>
                  {bandData.map((entry) => <Cell key={entry.band} fill={bandColors[entry.band]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Approval funnel">
            <ResponsiveContainer width="100%" height={230}>
              <FunnelChart>
                <Tooltip />
                <Funnel dataKey="value" data={funnelData} fill="#2563eb">
                  <LabelList dataKey="name" position="right" />
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Top rejection reasons">
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={rejectionData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis dataKey="reason" type="category" width={120} />
                <Tooltip />
                <Bar dataKey="count" fill="#b45309" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Avg call duration by band">
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={durationData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="band" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="minutes" fill="#0f766e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}
    </section>
  );
}

function ChartCard({ title, children }) {
  return (
    <article className="chart-card">
      <h3>{title}</h3>
      {children}
    </article>
  );
}
