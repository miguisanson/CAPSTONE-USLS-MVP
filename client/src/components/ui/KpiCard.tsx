import type { ReactNode } from "react";
import { Card, CardBody } from "./Card";

type Tone = "default" | "primary" | "danger" | "warning" | "success";

const toneClass: Record<Tone, string> = {
  default: "border-slate-200",
  primary: "border-[var(--gs-primary)]/30 bg-[var(--gs-primary-soft)]/35",
  danger: "border-rose-200 bg-rose-50",
  warning: "border-amber-200 bg-amber-50",
  success: "border-emerald-200 bg-emerald-50",
};

type Props = {
  label: string;
  value: string | number;
  helper?: string;
  icon?: ReactNode;
  tone?: Tone;
  actions?: ReactNode;
};

export const KpiCard = ({ label, value, helper, icon, tone = "default", actions }: Props) => (
  <Card className={toneClass[tone]}>
    <CardBody className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</p>
            {actions}
          </div>
          <p className="mt-2 text-3xl font-semibold leading-none text-slate-900">{value}</p>
          {helper ? <p className="mt-1.5 text-xs text-slate-500">{helper}</p> : null}
        </div>
        {icon ? <div className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600">{icon}</div> : null}
      </div>
    </CardBody>
  </Card>
);
