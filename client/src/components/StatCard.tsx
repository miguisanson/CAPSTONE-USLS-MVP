type Props = {
  label: string;
  value: string | number;
  hint?: string;
  emphasis?: "primary" | "danger" | "neutral";
};

export const StatCard = ({ label, value, hint, emphasis = "neutral" }: Props) => {
  const tone =
    emphasis === "primary"
      ? "border-[var(--gs-primary)]/30 bg-[var(--gs-primary-soft)] text-[var(--gs-primary)]"
      : emphasis === "danger"
        ? "border-rose-300 bg-rose-50 text-[var(--gs-danger)]"
        : "border-slate-200 bg-white text-slate-700";

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${tone}`}>
      <p className="text-xs uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      {hint ? <p className="mt-1 text-xs opacity-80">{hint}</p> : null}
    </div>
  );
};
