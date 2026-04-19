export function Input({ icon: Icon, className = '', ...props }) {
  return (
    <label className="relative block">
      {Icon && <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />}
      <input
        className={`w-full rounded-lg border border-border bg-bg-elevated/80 px-3 py-2.5 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/20 ${Icon ? 'pl-10' : ''} ${className}`}
        {...props}
      />
    </label>
  );
}
