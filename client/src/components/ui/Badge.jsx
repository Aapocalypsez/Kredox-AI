const riskColors = {
  A: 'bg-success/15 text-success border-success/30',
  B: 'bg-accent/15 text-accent border-accent/30',
  C: 'bg-warning/15 text-warning border-warning/30',
  D: 'bg-danger/15 text-danger border-danger/30'
};

const statusColors = {
  live: 'bg-accent/15 text-accent border-accent/30',
  completed: 'bg-success/15 text-success border-success/30',
  pending: 'bg-white/5 text-text-muted border-border',
  expired: 'bg-danger/15 text-danger border-danger/30',
  active: 'bg-success/15 text-success border-success/30',
  warning: 'bg-warning/15 text-warning border-warning/30',
  danger: 'bg-danger/15 text-danger border-danger/30'
};

export function Badge({ children, type = 'status', value, className = '' }) {
  const color = type === 'risk' ? riskColors[value] : statusColors[value] || statusColors.pending;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold ${color} ${className}`}>
      {children}
    </span>
  );
}
