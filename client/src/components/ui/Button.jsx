const variants = {
  filled: 'bg-accent text-white hover:shadow-glow',
  outline: 'border border-accent/60 text-accent hover:bg-[var(--accent-glow)]',
  ghost: 'text-text-muted hover:bg-bg-elevated hover:text-text-primary',
  danger: 'bg-danger text-white hover:shadow-[0_0_20px_rgba(239,68,68,0.18)]',
  success: 'bg-success text-white hover:shadow-[0_0_20px_rgba(16,185,129,0.2)]'
};

export function Button({ variant = 'filled', className = '', children, ...props }) {
  return (
    <button
      className={`relative overflow-hidden rounded-lg px-4 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    >
      <span className="relative z-10 inline-flex items-center justify-center gap-2">{children}</span>
    </button>
  );
}
