export function InvestmentProgress({ percent }: { percent: number }) {
  const width = Math.max(0, Math.min(100, percent));
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
      role="progressbar"
      aria-valuenow={width}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-full rounded-full bg-[#0d5c63]" style={{ width: `${width}%` }} />
    </div>
  );
}
