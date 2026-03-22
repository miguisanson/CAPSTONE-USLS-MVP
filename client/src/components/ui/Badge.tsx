import type { HTMLAttributes } from "react";
import { cn } from "./cn";

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const toneClass: Record<Tone, string> = {
  neutral: "border-slate-300 bg-white text-slate-600",
  info: "border-blue-200 bg-blue-50 text-blue-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
};

type Props = HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone;
};

export const Badge = ({ className, tone = "neutral", ...props }: Props) => (
  <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold", toneClass[tone], className)} {...props} />
);
