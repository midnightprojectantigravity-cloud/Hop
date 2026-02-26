type JuiceTraceOverlayEntry = {
  id: string;
  sequenceId: string;
  signature: string;
};

interface JuiceTraceOverlayProps {
  entries: JuiceTraceOverlayEntry[];
}

export const JuiceTraceOverlay: React.FC<JuiceTraceOverlayProps> = ({ entries }) => (
  <div className="absolute left-2 bottom-2 z-30 max-w-[min(24rem,calc(100%-1rem))] pointer-events-none rounded-xl border border-cyan-200/20 bg-black/55 backdrop-blur-sm px-2 py-1.5 text-[10px] leading-tight text-cyan-100/90">
    <div className="mb-1 font-black tracking-wider text-cyan-200/90">JUICE TRACE</div>
    <div className="space-y-0.5">
      {entries.length === 0 && (
        <div className="text-cyan-100/55">No signature events yet.</div>
      )}
      {entries.map((entry) => (
        <div key={entry.id} className="truncate">
          <span className="text-cyan-200/70">{entry.sequenceId}</span>
          <span className="text-white/55"> :: </span>
          <span className="text-white/85">{entry.signature}</span>
        </div>
      ))}
    </div>
  </div>
);
