import { motion } from 'framer-motion';
import { BarChart2, Brain, CheckCircle, FileCheck, Link, MapPin, Mic, Shield, Video, Wallet } from 'lucide-react';
import { Card } from '../ui/Card.jsx';

const icons = { Link, Video, Shield, MapPin, Mic, CheckCircle, BarChart2, Brain, Wallet, FileCheck };

export function AuditTimeline({ events = [] }) {
  return (
    <Card>
      <h2 className="mb-4 font-display text-lg font-bold">Audit Timeline</h2>
      <div className="relative space-y-4">
        <div className="absolute left-4 top-3 h-[calc(100%-24px)] w-px bg-accent/40" />
        {events.map((item, index) => {
          const Icon = icons[item.icon] || CheckCircle;
          return (
            <motion.div key={`${item.time || item.timestamp}-${item.event || item.message}`} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.07 }} className="relative flex gap-3 pl-10">
              <span className="absolute left-0 grid h-8 w-8 place-items-center rounded-full bg-accent text-white"><Icon className="h-4 w-4" /></span>
              <div><p className="text-sm font-bold">{item.event || item.message}</p><p className="mono text-xs text-text-muted">{item.time || item.timestamp}</p></div>
            </motion.div>
          );
        })}
        {!events.length && <p className="text-sm text-text-muted">No audit events returned by the backend yet.</p>}
      </div>
    </Card>
  );
}
