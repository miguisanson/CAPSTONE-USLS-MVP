import { AlertTriangle, CheckCircle2, Info, TrendingUp } from "lucide-react";
import { Badge } from "./Badge";
import { Card, CardBody, CardHeader } from "./Card";

export type RecommendedActionItem = {
  id: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  owner?: string;
  eta?: string;
};

type Props = {
  actions: RecommendedActionItem[];
  context?: string;
};

const priorityTone = {
  high: {
    badge: "High Priority",
    tone: "danger" as const,
    icon: <AlertTriangle className="mt-0.5 h-4 w-4 text-[var(--gs-danger)]" />,
    container: "border-rose-200 bg-rose-50",
  },
  medium: {
    badge: "Medium Priority",
    tone: "warning" as const,
    icon: <TrendingUp className="mt-0.5 h-4 w-4 text-[var(--gs-warning)]" />,
    container: "border-amber-200 bg-amber-50",
  },
  low: {
    badge: "Low Priority",
    tone: "neutral" as const,
    icon: <Info className="mt-0.5 h-4 w-4 text-slate-500" />,
    container: "border-slate-200 bg-slate-50",
  },
};

export const RecommendedActions = ({ actions, context }: Props) => {
  if (actions.length === 0) {
    return (
      <Card className="border-emerald-200 bg-emerald-50">
        <CardBody className="flex items-start gap-2.5">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-[var(--gs-success)]" />
          <div>
            <p className="text-sm font-semibold text-emerald-900">Recommended Actions</p>
            <p className="text-sm text-emerald-800">No high-risk actions are currently required. Continue routine monitoring.</p>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="border-[var(--gs-primary)]/30">
      <CardHeader className="flex flex-row items-start justify-between gap-3 border-b border-[var(--gs-primary)]/12">
        <div>
          <p className="text-base font-semibold text-slate-900">Recommended Actions</p>
          <p className="mt-0.5 text-xs text-slate-500">{context ?? "Page-level advisory summary based on current operational data."}</p>
        </div>
        <Badge tone="info">{actions.length} items</Badge>
      </CardHeader>
      <CardBody className="space-y-2.5">
        {actions.map((action) => {
          const tone = priorityTone[action.priority];
          return (
            <article key={action.id} className={`rounded-xl border px-3 py-2.5 ${tone.container}`}>
              <div className="flex items-start gap-2.5">
                {tone.icon}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{action.title}</p>
                    <Badge tone={tone.tone}>{tone.badge}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-700">{action.description}</p>
                  {action.owner || action.eta ? (
                    <p className="mt-1 text-xs text-slate-600">
                      {action.owner ? `Owner: ${action.owner}` : ""} {action.owner && action.eta ? "| " : ""}
                      {action.eta ? `Target: ${action.eta}` : ""}
                    </p>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </CardBody>
    </Card>
  );
};
