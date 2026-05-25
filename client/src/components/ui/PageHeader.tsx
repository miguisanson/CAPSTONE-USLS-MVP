import type { ReactNode } from "react";
import { QuickInsights } from "./QuickInsights";

type HelpContent = {
  title: string;
  summary: string;
  points?: string[];
  recommendation?: string;
};

type Props = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  help?: HelpContent;
};

export const PageHeader = ({ title, subtitle, actions, help }: Props) => (
  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
    <div>
      <div className="flex min-w-0 items-center gap-2">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {help ? (
          <QuickInsights
            title={help.title}
            summary={help.summary}
            points={help.points}
            recommendation={help.recommendation}
            className="mt-0.5"
          />
        ) : null}
      </div>
      {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
    </div>
    {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
  </div>
);
