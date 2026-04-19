import { motion } from 'framer-motion';

export function Card({ children, className = '', glow = false, delay = 0, as = 'section' }) {
  const Component = motion[as] || motion.section;
  return (
    <Component
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className={`glass-card rounded-2xl p-5 shadow-card ${glow ? 'accent-glow' : ''} ${className}`}
    >
      {children}
    </Component>
  );
}
