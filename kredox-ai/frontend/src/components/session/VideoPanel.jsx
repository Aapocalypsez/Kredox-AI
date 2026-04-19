import { Lock, Video } from 'lucide-react';

export function VideoPanel() {
  return (
    <div className="viewfinder bg-grid-soft relative min-h-[520px] overflow-hidden rounded-2xl border border-border bg-[#111318]">
      <div className="absolute left-4 top-4 flex gap-2">
        <span className="rounded-full bg-danger/20 px-3 py-1 text-xs font-bold text-danger">
          <span className="pulse-dot mr-1 inline-block h-2 w-2 rounded-full bg-danger" /> LIVE
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-black/40 px-3 py-1 text-xs text-text-primary">
          <Lock className="h-3 w-3" /> Encrypted
        </span>
      </div>
      <div className="absolute right-4 top-4 text-xs text-text-muted">HD 720p</div>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <Video className="mx-auto mb-3 h-16 w-16 text-accent/50" />
          <p className="font-display text-xl font-bold">Rahul Sharma</p>
          <p className="text-sm text-text-muted">Face tracking active, liveness verified</p>
        </div>
      </div>
      <div className="absolute bottom-4 left-4 rounded-full bg-black/50 px-4 py-2 text-sm font-bold">Rahul Sharma</div>
      <div className="absolute bottom-4 right-4 h-[75px] w-[100px] rounded-xl border border-accent bg-bg-elevated p-2 shadow-glow">
        <div className="grid h-full place-items-center rounded-lg bg-bg-base text-xs text-text-muted">You</div>
      </div>
    </div>
  );
}
