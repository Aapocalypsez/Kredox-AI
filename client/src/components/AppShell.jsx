import { BarChart3, FileText, LayoutDashboard, LogOut, Shield, Target, Video, Zap } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';

const nav = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/session/KYC-2024-0847', label: 'Live Session', icon: Video },
  { to: '/report/KYC-2024-0847', label: 'Applications', icon: FileText },
  { to: '/campaigns', label: 'Campaigns', icon: Target },
  { to: '/report/KYC-2024-0847', label: 'Risk Reports', icon: BarChart3 },
  { to: '/report/KYC-2024-0847', label: 'Audit Logs', icon: Shield },
];

export default function AppShell({ title, subtitle, actions, children }) {
  const navigate = useNavigate();

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Zap size={18} /></div>
          <div><span>Kredox</span><span> AI</span></div>
        </div>
        <nav className="nav-list">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink key={label} to={to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          className="nav-item"
          onClick={() => {
            localStorage.removeItem('kredox_token');
            navigate('/login');
          }}
        >
          <LogOut size={18} />
          <span>Logout</span>
        </button>
        <div className="agent-card">
          <div className="avatar">RD</div>
          <div>
            <strong>Ravi Desai</strong>
            <p className="muted"><span className="pulse-dot" style={{ background: 'var(--success)', marginRight: 6 }} />Senior Agent</p>
          </div>
        </div>
      </aside>
      <main className="page">
        <header className="topbar">
          <div>
            <div className="page-title">{title}</div>
            <p className="muted">{subtitle}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <input className="search" placeholder="Search applications..." />
            {actions}
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
