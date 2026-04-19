import { motion } from 'framer-motion';

const colors = {
  A: 'var(--success)',
  B: 'var(--accent)',
  C: 'var(--warning)',
  D: 'var(--danger)',
  success: 'var(--success)',
  accent: 'var(--accent)',
  warning: 'var(--warning)',
  danger: 'var(--danger)'
};

export function ScoreRing({ score = 0, label = '', color = 'accent', size = 116, stroke = 10 }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(score, 100) / 100) * circumference;
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors[color] || color}
          strokeLinecap="round"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="font-display text-2xl font-extrabold num">{score}%</div>
        {label && <div className="text-[10px] uppercase text-text-muted">{label}</div>}
      </div>
    </div>
  );
}
