import { useEffect, useRef, useState } from 'react';
import { Archive, BarChart2, Bell, FileText, LayoutDashboard, Menu, Search, Target, Video } from 'lucide-react';
import toast from 'react-hot-toast';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

const navTop = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/dashboard', label: 'Live Sessions', icon: Video, badge: '12', disabled: true },
];

const navPlatform = [
  { to: '/applications', label: 'Applications', icon: FileText },
  { to: '/campaigns', label: 'Campaigns', icon: Target },
  { to: '/reports', label: 'Risk Reports', icon: BarChart2 },
  { to: '/admin', label: 'Admin', icon: Archive },
];

function Wordmark() {
  return (
    <div className="wordmark">
      <span className="wordmark-k">Kredox</span>
      <span className="wordmark-ai">AI</span>
    </div>
  );
}

function NavItem({ item }) {
  const Icon = item.icon;

  if (item.disabled) {
    return (
      <button
        type="button"
        className="nav-item disabled"
        onClick={() => toast('Open a live session from the dashboard when one is active')}
      >
        <Icon size={15} />
        <span>{item.label}</span>
        {item.badge && <span className="badge badge-blue nav-badge">{item.badge}</span>}
      </button>
    );
  }

  return (
    <NavLink to={item.to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
      <Icon size={15} />
      <span>{item.label}</span>
      {item.badge && <span className="badge badge-blue nav-badge">{item.badge}</span>}
    </NavLink>
  );
}

const notificationItems = [
  { title: 'Campaign approvals ready', detail: '5 new offers are waiting for final review.', time: 'now' },
  { title: 'Transcript search restricted', detail: 'Agent accounts can browse reports but not admin transcript search.', time: '2m' },
  { title: 'No active live sessions', detail: 'Start a customer call to enable the live session console.', time: '5m' }
];

function currentAgent() {
  try {
    return JSON.parse(localStorage.getItem('kredox_agent') || 'null');
  } catch {
    return null;
  }
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const navigate = useNavigate();
  const notifRef = useRef(null);
  const agent = currentAgent();
  const visibleNavPlatform = navPlatform.filter((item) => item.to !== '/admin' || agent?.role === 'admin');

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!notifRef.current || notifRef.current.contains(event.target)) return;
      setNotificationsOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  const runSearch = (event) => {
    if (event.key !== 'Enter') return;
    const value = search.trim();
    if (!value) {
      toast.error('Type an application or session ID first');
      return;
    }
    navigate(`/report/${encodeURIComponent(value)}`);
    toast.success(`Opening report for ${value}`);
  };

  return (
    <div className="layout">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <Wordmark />
        <div className="separator" />
        <nav className="nav">
          {navTop.map((item) => <NavItem key={item.label} item={item} />)}
          <div className="nav-label">Platform</div>
          {visibleNavPlatform.map((item) => <NavItem key={item.label} item={item} />)}
        </nav>
        <div className="agent-info">
          <div className="separator" />
          <div className="agent-row">
            <div className="agent-avatar">RD</div>
            <div>
              <div className="agent-name">{agent?.name || 'Ravi Desai'}</div>
              <div className="agent-role">{agent?.role === 'admin' ? 'Platform Admin' : agent?.role === 'viewer' ? 'Read-only Viewer' : 'Senior Agent'}</div>
            </div>
            <span className="dot dot-green pulse" />
          </div>
        </div>
      </aside>
      <header className="topbar">
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <button className="btn btn-ghost hamb" onClick={() => setOpen((value) => !value)} aria-label="Toggle navigation">
            <Menu size={15} />
          </button>
          <div className="top-title">Kredox AI Workspace</div>
        </div>
        <div className="top-actions">
          <div className="search-wrap">
            <Search size={14} />
            <input
              className="inp"
              placeholder="Search... Ctrl+K"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={runSearch}
            />
          </div>
          <div className="notif-wrap" ref={notifRef}>
            <button
              className="btn btn-ghost bell"
              aria-label="Notifications"
              aria-expanded={notificationsOpen}
              onClick={() => setNotificationsOpen((value) => !value)}
            >
              <Bell size={15} />
              <span className="bell-badge">3</span>
            </button>
            {notificationsOpen && (
              <div className="notif-panel card">
                <div className="notif-head">
                  <strong>Notifications</strong>
                  <span className="badge badge-blue">3 open</span>
                </div>
                <div className="notif-list">
                  {notificationItems.map((item) => (
                    <button
                      type="button"
                      key={item.title}
                      className="notif-item"
                      onClick={() => {
                        setNotificationsOpen(false);
                        toast.success(item.detail);
                      }}
                    >
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.detail}</p>
                      </div>
                      <span className="mono">{item.time}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <NavLink to="/campaigns" className="btn btn-primary">New Campaign</NavLink>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
