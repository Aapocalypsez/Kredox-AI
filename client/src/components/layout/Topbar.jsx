import { Bell, Search, Target } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { Button } from '../ui/Button.jsx';
import { useAppContext } from '../../context/AppContext.jsx';

const titles = {
  '/dashboard': ['Overview', 'Kredox AI / Command Center'],
  '/campaigns': ['Campaigns', 'Kredox AI / Campaign Links']
};

export function Topbar() {
  const location = useLocation();
  const { demoMode, setDemoMode, sidebarOpen } = useAppContext();
  const [title, breadcrumb] = titles[location.pathname] || [location.pathname.startsWith('/report') ? 'Risk Report' : 'Live Session', 'Kredox AI / Workspace'];

  return (
    <header className={`fixed right-0 top-0 z-30 h-16 border-b border-border bg-bg-base/80 backdrop-blur-xl transition-all ${sidebarOpen ? 'left-60' : 'left-[60px]'}`}>
      <div className="flex h-full items-center justify-between gap-4 px-5">
        <div>
          <h1 className="font-display text-xl font-bold">{title}</h1>
          <p className="text-xs text-text-muted">{breadcrumb}</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="hidden items-center gap-2 rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-muted md:flex">
            <Search className="h-4 w-4" />
            <input className="w-48 bg-transparent outline-none placeholder:text-text-muted" placeholder="Search applications... Ctrl+K" />
          </label>
          <button
            className={`rounded-full border px-3 py-1.5 text-xs font-bold ${demoMode ? 'border-success/40 bg-success/10 text-success' : 'border-border text-text-muted'}`}
            onClick={() => setDemoMode(!demoMode)}
          >
            Demo {demoMode ? 'ON' : 'OFF'}
          </button>
          <button className="relative rounded-lg border border-border bg-bg-surface p-2 text-text-muted">
            <Bell className="h-5 w-5" />
            <span className="absolute -right-1 -top-1 rounded-full bg-danger px-1.5 text-[10px] font-bold text-white">5</span>
          </button>
          <Button variant="outline" className="hidden md:inline-flex"><Target className="h-4 w-4" /> New Campaign</Button>
        </div>
      </div>
    </header>
  );
}
