import { motion } from 'framer-motion';
import { Mic } from 'lucide-react';

function highlight(text) {
  const parts = text.split(/(₹[\d,]+|TCS|Infosys|I consent to this loan application and verification process with Kredox AI)/g);
  return parts.map((part, index) => {
    if (/^₹/.test(part)) return <span key={index} className="rounded bg-success/15 px-1 text-success">{part}</span>;
    if (['TCS', 'Infosys'].includes(part)) return <span key={index} className="rounded bg-accent/15 px-1 text-accent">{part}</span>;
    if (part.startsWith('I consent')) {
      return (
        <span key={index} className="rounded bg-accent/20 px-1 text-accent">
          {part} <span className="ml-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] text-success">CONSENT CAPTURED</span>
        </span>
      );
    }
    return part;
  });
}

export function TranscriptPanel({ lines, compact = false }) {
  return (
    <section className={`glass-card rounded-2xl p-4 ${compact ? '' : 'h-[200px]'}`}>
      <div className="mb-3 flex items-center gap-2">
        <Mic className="h-4 w-4 text-accent" />
        <h3 className="font-display font-bold">Live Transcript</h3>
        <span className="pulse-dot h-2 w-2 rounded-full bg-success" />
        <span className="text-xs text-success">Transcribing...</span>
      </div>
      <div className={`dark-scrollbar space-y-3 overflow-y-auto pr-2 ${compact ? 'max-h-[350px]' : 'h-[135px]'}`}>
        {lines.map((line, index) => (
          <motion.p
            key={`${line.time}-${index}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            className="text-sm leading-relaxed"
          >
            <span className="mr-2 text-text-muted">{line.speaker}:</span>
            <span className="mono mr-2 text-xs text-text-muted">{line.time}</span>
            <span>{highlight(line.text)}</span>
          </motion.p>
        ))}
        <p className="text-sm italic text-text-muted">still processing latest response...</p>
      </div>
    </section>
  );
}
