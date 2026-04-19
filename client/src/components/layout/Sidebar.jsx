import { BarChart2, FileText, LayoutDashboard, Settings, Shield, Target, Video, Menu } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext.jsx';

const navItems = [
  { icon: LayoutDashboard, label: 'Overview', to: '/dashboard' },
  { icon: Video, label: 'Live Sessions', to: '/session/KYC-2024-0847' },
  { icon: FileText, label: 'Applications', to: '/report/KYC-2024-0847' },
  { icon: Target, label: 'Campaigns', to: '/campaigns' },
  { icon: BarChart2, label: 'Risk Reports', to: '/report/KYC-2024-0847' },
  { icon: Shield, label: 'Audit Logs', to: '/report/KYC-2024-0847' },
  { icon: Settings, label: 'Settings', to: '/dashboard' }
];

export function Sidebar() {
  const { sidebarOpen, setSidebarOpen } = useAppContext();
  return (
    <aside className={`fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border bg-bg-surface transition-all ${sidebarOpen ? 'w-60' : 'w-[60px]'}`}>
      <div className="flex h-16 items-center gap-3 border-b border-border px-4">
        <button className="rounded-lg p-1.5 text-text-muted hover:bg-bg-elevated" onClick={() => setSidebarOpen(!sidebarOpen)}>
          <Menu className="h-5 w-5" />
        </button>
        {sidebarOpen && <div className="font-display text-xl font-extrabold">Kredox <span className="text-accent">AI</span></div>}
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map(({ icon: Icon, label, to }) => (
          <NavLink
            key={label}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg border-l-[3px] px-3 py-3 text-sm font-bold transition ${
                isActive ? 'border-accent bg-[var(--accent-glow)] text-accent shadow-glow' : 'border-transparent text-text-muted hover:bg-bg-elevated hover:text-text-primary'
              }`
            }
          >
            <Icon className="h-5 w-5 shrink-0" />
            {sidebarOpen && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-xl bg-bg-elevated/60 p-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent font-display font-bold">RD</div>
          {sidebarOpen && (
            <div className="min-w-0">
              <div className="truncate text-sm font-bold">Ravi Desai</div>
              <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-text-muted">
                <span className="pulse-dot h-2 w-2 rounded-full bg-success" /> Senior Agent
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
