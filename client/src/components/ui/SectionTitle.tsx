import type { ReactNode } from "react";
import { cn } from "./cn";

type Props = {
  title: string;
  subtitle?: string;
  insight?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export const SectionTitle = ({ title, subtitle, insight, actions, className }: Props) => (
  <div className={cn("mb-3 flex flex-wrap items-start justify-between gap-2", className)}>
    <div>
      <div className="flex items-center gap-2">
        <p className="section-heading">{title}</p>
        {insight}
      </div>
      {subtitle ? <p className="section-subheading">{subtitle}</p> : null}
    </div>
    {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
  </div>
);
