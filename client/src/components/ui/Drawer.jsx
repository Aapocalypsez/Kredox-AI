import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from './Button.jsx';

export function Drawer({ open, title, children, onClose }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.aside className="glass-card dark-scrollbar absolute right-0 top-0 h-full w-full max-w-sm overflow-y-auto rounded-l-2xl p-5" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">{title}</h2>
              <Button variant="ghost" className="px-2" onClick={onClose}><X className="h-4 w-4" /></Button>
            </div>
            {children}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
