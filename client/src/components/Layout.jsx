import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Archive, BarChart2, Bell, FileText, LayoutDashboard, Menu, Search, Target, Video } from 'lucide-react';
import toast from 'react-hot-toast';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { activityAPI, authAPI, reportsAPI } from '../api/index.js';

const navPlatform = [
  { to: '/applications', label: 'Applications', icon: FileText },
  { to: '/campaigns', label: 'Campaigns', icon: Target, roles: ['admin', 'agent'] },
  { to: '/reports', label: 'Risk Reports', icon: BarChart2 },
  { to: '/admin', label: 'Admin', icon: Archive, roles: ['admin'] },
];

function Wordmark() {
  return (
    <div className="wordmark">
      <span className="wordmark-k">Kredox</span>
      <span className="wordmark-ai">AI</span>
    </div>
  );
}

function formatRelative(value) {
  if (!value) return 'now';
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / 1440)}d`;
}

function looksLikeUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function NavItem({ item, onNavigate }) {
  const Icon = item.icon;
  const location = useLocation();

  const isSearchActive = item.matchSearch && location.pathname === item.to.split('?')[0] && location.search.includes(item.matchSearch);
  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) => {
        const plainDashboardActive = item.to === '/dashboard' && location.search.includes('filter=live') ? false : isActive;
        return `nav-item ${isSearchActive || (plainDashboardActive && !item.matchSearch) ? 'active' : ''}`;
      }}
    >
      <Icon size={15} />
      <span>{item.label}</span>
      {item.badge != null && Number(item.badge) > 0 && <span className="badge badge-blue nav-badge">{item.badge}</span>}
    </NavLink>
  );
}

function currentAgent() {
  try {
    return JSON.parse(localStorage.getItem('kredox_agent') || 'null');
  } catch {
    return null;
  }
}

function notificationAction(item, navigate) {
  const type = String(item.type || '').toUpperCase();
  const entityId = item.entity_id;
  const isSession = ['video_session', 'session', 'loan_application', 'loan_offer'].includes(item.entity_type);

  if (type.includes('SESSION_STARTED') && isSession && entityId) {
    return { path: `/session/${entityId}`, label: 'Open live session' };
  }
  if (isSession && entityId) {
    return { path: `/report/${entityId}`, label: 'Open report' };
  }
  if (type.includes('CAMPAIGN')) {
    return { path: '/campaigns', label: 'Open campaigns' };
  }
  if (type.includes('FLAG') || type.includes('RISK')) {
    return { path: '/reports', label: 'Open risk reports' };
  }
  return { path: '/dashboard', label: 'Open dashboard' };
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [liveCount, setLiveCount] = useState(0);
  const [activity, setActivity] = useState([]);
  const [applications, setApplications] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();
  const notifRef = useRef(null);
  const searchRef = useRef(null);
  const agent = currentAgent();

  const initials = useMemo(() => {
    if (!agent?.name) return 'RD';
    return agent.name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }, [agent]);

  const navTop = useMemo(() => [
    { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { to: '/dashboard?filter=live', label: 'Live Sessions', icon: Video, badge: liveCount, matchSearch: 'filter=live' },
  ], [liveCount]);

  const visibleNavPlatform = navPlatform.filter((item) => {
    if (!item.roles) return true;
    return item.roles.includes(agent?.role || 'agent');
  });

  const loadWorkspaceMeta = useCallback(async () => {
    try {
      const [applicationsData, activityData] = await Promise.all([
        reportsAPI.applications(50),
        activityAPI.feed().catch(() => ({ activity: [] }))
      ]);
      const rows = applicationsData.applications || [];
      setApplications(rows);
      setLiveCount(rows.filter((row) => row.session_status === 'active').length);
      setActivity((activityData.activity || []).slice(0, 5));
    } catch {
      // Workspace shell should stay usable even if polling fails.
    }
  }, []);

  useEffect(() => {
    loadWorkspaceMeta();
    const interval = window.setInterval(loadWorkspaceMeta, 30000);
    return () => window.clearInterval(interval);
  }, [loadWorkspaceMeta]);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!notifRef.current || notifRef.current.contains(event.target)) return;
      setNotificationsOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const resolveSearchTarget = (value) => {
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (looksLikeUuid(trimmed)) return trimmed;

    const kycMatch = trimmed.match(/^kyc-([0-9a-f]+)/i);
    if (kycMatch) {
      const prefix = kycMatch[1].toLowerCase();
      const match = applications.find((row) => String(row.session_id || '').toLowerCase().startsWith(prefix));
      if (match?.session_id) return match.session_id;
    }

    const needle = trimmed.toLowerCase();
    const byName = applications.find((row) =>
      [row.name, row.phone, row.email, row.id, row.session_id]
        .some((field) => String(field || '').toLowerCase().includes(needle))
    );
    if (byName?.session_id) return byName.session_id;
    if (byName?.id && looksLikeUuid(byName.id)) return byName.id;

    return trimmed;
  };

  const runSearch = async (event) => {
    if (event?.key && event.key !== 'Enter') return;
    event?.preventDefault?.();

    const value = search.trim();
    if (!value) {
      toast.error('Type an applicant name, KYC ID, or session ID first');
      return;
    }

    const target = resolveSearchTarget(value);
    if (!target) {
      toast.error('No matching application found');
      return;
    }

    if (!looksLikeUuid(target)) {
      toast.error('No session report found for that search');
      return;
    }

    navigate(`/report/${encodeURIComponent(target)}`);
    setSearch('');
    toast.success('Opening application report');
  };

  const signOut = async () => {
    try {
      await authAPI.logout().catch(() => {});
    } finally {
      localStorage.removeItem('kredox_token');
      localStorage.removeItem('kredox_access_token');
      localStorage.removeItem('kredox_agent');
      navigate('/login');
      toast.success('Signed out');
    }
  };

  const handleNotificationClick = (item) => {
    const action = notificationAction(item, navigate);
    setNotificationsOpen(false);
    navigate(action.path);
    toast.success(action.label);
  };

  const fallbackNotifications = useMemo(() => {
    if (activity.length) return activity;
    const items = [];
    if (liveCount > 0) {
      items.push({
        type: 'LIVE_SESSION',
        message: `${liveCount} active video session${liveCount === 1 ? '' : 's'} need monitoring`,
        timestamp: new Date().toISOString(),
        entity_id: null
      });
    }
    items.push({
      type: 'WORKSPACE_READY',
      message: agent?.role === 'admin' ? 'Admin tools are available in the sidebar' : 'Browse applications and risk reports from the workspace',
      timestamp: new Date().toISOString(),
      entity_id: null
    });
    return items;
  }, [activity, agent?.role, liveCount]);

  const closeSidebar = () => setOpen(false);

  return (
    <div className="layout">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <Wordmark />
        <div className="separator" />
        <nav className="nav">
          {navTop.map((item) => <NavItem key={item.label} item={item} onNavigate={closeSidebar} />)}
          <div className="nav-label">Platform</div>
          {visibleNavPlatform.map((item) => <NavItem key={item.label} item={item} onNavigate={closeSidebar} />)}
        </nav>
        <div className="agent-info">
          <div className="separator" />
          <div className="agent-row">
            <div className="agent-avatar">{initials}</div>
            <div>
              <div className="agent-name">{agent?.name || 'Ravi Desai'}</div>
              <div className="agent-role">{agent?.role === 'admin' ? 'Platform Admin' : agent?.role === 'viewer' ? 'Read-only Viewer' : 'Senior Agent'}</div>
            </div>
            <span className="dot dot-green pulse" />
          </div>
          <button className="btn btn-ghost" type="button" style={{ width: '100%', marginTop: 10 }} onClick={signOut}>
            Sign out
          </button>
        </div>
      </aside>
      <header className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-ghost hamb" type="button" onClick={() => setOpen((value) => !value)} aria-label="Toggle navigation">
            <Menu size={15} />
          </button>
          <div className="top-title">Kredox AI Workspace</div>
        </div>
        <div className="top-actions">
          <form className="search-wrap" onSubmit={runSearch}>
            <Search size={14} />
            <input
              ref={searchRef}
              className="inp"
              placeholder="Search applicant, KYC ID, session..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={runSearch}
            />
          </form>
          <div className="notif-wrap" ref={notifRef}>
            <button
              className="btn btn-ghost bell"
              type="button"
              aria-label="Notifications"
              aria-expanded={notificationsOpen}
              onClick={() => setNotificationsOpen((value) => !value)}
            >
              <Bell size={15} />
              {fallbackNotifications.length > 0 && <span className="bell-badge">{fallbackNotifications.length}</span>}
            </button>
            {notificationsOpen && (
              <div className="notif-panel card">
                <div className="notif-head">
                  <strong>Notifications</strong>
                  <span className="badge badge-blue">{fallbackNotifications.length} recent</span>
                </div>
                <div className="notif-list">
                  {fallbackNotifications.map((item, index) => (
                    <button
                      type="button"
                      key={`${item.type}-${item.timestamp}-${index}`}
                      className="notif-item"
                      onClick={() => handleNotificationClick(item)}
                    >
                      <div>
                        <strong>{String(item.type || 'Update').replaceAll('_', ' ')}</strong>
                        <p>{item.message}</p>
                      </div>
                      <span className="mono">{formatRelative(item.timestamp)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          {agent?.role !== 'viewer' && (
            <NavLink to="/campaigns" className="btn btn-primary">New Campaign</NavLink>
          )}
        </div>
      </header>
      <Outlet />
    </div>
  );
}
