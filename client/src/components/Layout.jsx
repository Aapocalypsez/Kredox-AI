import { useState } from 'react';
import { Archive, BarChart2, Bell, FileText, LayoutDashboard, Menu, Search, Target, Video } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';

const navTop = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/session/KYC-2024-0847', label: 'Live Sessions', icon: Video, badge: '12', disabled: true },
];

const navPlatform = [
  { to: '/applications', label: 'Applications', icon: FileText },
  { to: '/campaigns', label: 'Campaigns', icon: Target },
  { to: '/reports', label: 'Risk Reports', icon: BarChart2 },
  { to: '/audit', label: 'Audit Logs', icon: Archive },
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
  return (
    <NavLink to={item.to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''} ${item.disabled ? 'disabled' : ''}`}>
      <Icon size={15} />
      <span>{item.label}</span>
      {item.badge && <span className="badge badge-blue nav-badge">{item.badge}</span>}
    </NavLink>
  );
}

export default function Layout() {
  const [open, setOpen] = useState(false);

  return (
    <div className="layout">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <Wordmark />
        <div className="separator" />
        <nav className="nav">
          {navTop.map((item) => <NavItem key={item.label} item={item} />)}
          <div className="nav-label">Platform</div>
          {navPlatform.map((item) => <NavItem key={item.label} item={item} />)}
        </nav>
        <div className="agent-info">
          <div className="separator" />
          <div className="agent-row">
            <div className="agent-avatar">RD</div>
            <div>
              <div className="agent-name">Ravi Desai</div>
              <div className="agent-role">Senior Agent</div>
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
            <input className="inp" placeholder="Search... ⌘K" />
          </div>
          <button className="btn btn-ghost bell" aria-label="Notifications">
            <Bell size={15} />
            <span className="bell-badge">5</span>
          </button>
          <NavLink to="/campaigns" className="btn btn-primary">New Campaign</NavLink>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
