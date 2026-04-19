import { AnimatePresence, motion } from 'framer-motion';
import { BarChart2, Bell, CheckCircle, ChevronRight, FileText, MapPin, Shield, Target, Video } from 'lucide-react';
import { useEffect, useState } from 'react';
import { activityFeed } from '../../data/mockData.js';
import { useAppContext } from '../../context/AppContext.jsx';

const icons = { Video, Shield, MapPin, CheckCircle, Target, FileText, Bell, BarChart2 };
const colors = { live: 'bg-accent', success: 'bg-success', warning: 'bg-warning', info: 'bg-accent' };

export function ActivityPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const [items, setItems] = useState(activityFeed);
  const { demoMode } = useAppContext();

  useEffect(() => {
    if (!demoMode) return undefined;
    let index = 0;
    const interval = setInterval(() => {
      const next = activityFeed[index % activityFeed.length];
      setItems((current) => [{ ...next, time: 'Just now' }, ...current.slice(0, 9)]);
      index += 1;
    }, 4000);
    return () => clearInterval(interval);
  }, [demoMode]);

  return (
    <aside className={`hidden border-l border-border bg-bg-surface/70 backdrop-blur-xl transition-all xl:block ${collapsed ? 'w-14' : 'w-[300px]'}`}>
      <div className="flex h-16 items-center justify-between border-b border-border px-4">
        {!collapsed && (
          <h2 className="flex items-center gap-2 font-display font-bold">
            Live Activity <span className="pulse-dot h-2 w-2 rounded-full bg-success" />
          </h2>
        )}
        <button className="rounded-lg p-2 text-text-muted hover:bg-bg-elevated" onClick={() => setCollapsed(!collapsed)}>
          <ChevronRight className={`h-4 w-4 transition ${collapsed ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {!collapsed && (
        <div className="dark-scrollbar h-[calc(100vh-4rem)] overflow-y-auto p-4">
          <AnimatePresence initial={false}>
            {items.map((item, index) => {
              const Icon = icons[item.icon] || Bell;
              return (
                <motion.div
                  key={`${item.message}-${index}`}
                  initial={{ opacity: 0, y: -12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mb-4 flex gap-3 rounded-xl border border-border bg-bg-surface p-3"
                >
                  <span className={`mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full ${colors[item.type] || 'bg-accent'}`}>
                    <Icon className="h-4 w-4 text-white" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold leading-snug">{item.message}</p>
                    <p className="mt-1 text-xs text-text-muted">{item.time}</p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </aside>
  );
}
