import { useEffect, useMemo, useState } from "react";
import { adminApi, milestonesApi, usersApi } from "../api/endpoints";
import { handleApiError } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { LoadingBlock } from "../components/LoadingBlock";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardBody } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { QuickInsights } from "../components/ui/QuickInsights";
import { RecommendedActions, type RecommendedActionItem } from "../components/ui/RecommendedActions";
import { SectionTitle } from "../components/ui/SectionTitle";
import type { AlertThreshold, MilestoneDefinition, RoutingRule, UserAccount } from "../types/domain";
import { readableEnum } from "../utils/format";

type Tab = "milestones" | "thresholds" | "routing" | "users";

const STAGE_OPTIONS = [
  "ADMISSION",
  "COURSEWORK",
  "PROPOSAL_DEVELOPMENT",
  "PROPOSAL_DEFENSE",
  "DATA_COLLECTION",
  "DISSERTATION_WRITING",
  "ORAL_DEFENSE",
  "LOA",
  "COMPLETED",
] as const;

const DECISION_OPTIONS = ["APPROVE", "REVISE", "RETURN"] as const;

export const AdminConfigPage = () => {
  const [tab, setTab] = useState<Tab>("milestones");
  const [milestones, setMilestones] = useState<MilestoneDefinition[]>([]);
  const [thresholds, setThresholds] = useState<AlertThreshold[]>([]);
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [milestoneDraft, setMilestoneDraft] = useState({
    name: "Proposal QA Review",
    stage: "PROPOSAL_DEVELOPMENT",
    expectedDays: 14,
    criticality: 3,
  });
  const [thresholdDraft, setThresholdDraft] = useState({
    key: "STAGE_PROPOSAL_DEFENSE",
    stage: "",
    thresholdDays: 20,
    description: "Proposal defense threshold",
  });
  const [routingDraft, setRoutingDraft] = useState({
    fromStage: "PROPOSAL_DEFENSE",
    decision: "REVISE",
    nextOwnerRole: "STUDENT",
    taskTemplate: "Request revisions from student",
  });
  const [userDraft, setUserDraft] = useState({
    fullName: "New User",
    email: "new.user@gs.local",
    password: "DemoPass123!",
    role: "GRADUATE_SCHOOL_STAFF",
  });

  const load = async () => {
    try {
      setLoading(true);
      const [milestonesRes, thresholdsRes, routingRes, usersRes, rolesRes] = await Promise.all([
        milestonesApi.list({}),
        adminApi.thresholds(),
        adminApi.routingRules(),
        usersApi.list({ pageSize: 100 }),
        usersApi.roles(),
      ]);
      setMilestones(milestonesRes);
      setThresholds(thresholdsRes);
      setRules(routingRes);
      setUsers(usersRes.items);
      setRoles(rolesRes);
      setError(null);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const recommendedActions = useMemo<RecommendedActionItem[]>(() => {
    const actions: RecommendedActionItem[] = [];
    const disabledThresholds = thresholds.filter((item) => !item.enabled);
    if (disabledThresholds.length > 0) {
      actions.push({
        id: "disabled-thresholds",
        title: "Review disabled monitoring thresholds",
        description: `${disabledThresholds.length} threshold(s) are currently disabled. Validate whether this is intentional and policy-approved.`,
        priority: "high",
      });
    }
    const inactiveRules = rules.filter((rule) => !rule.active);
    if (inactiveRules.length > 0) {
      actions.push({
        id: "inactive-rules",
        title: "Audit inactive routing rules",
        description: `${inactiveRules.length} routing rule(s) are inactive. Ensure stage-decision paths remain complete.`,
        priority: "medium",
      });
    }
    const inactiveUsers = users.filter((item) => !item.isActive);
    if (inactiveUsers.length > 0) {
      actions.push({
        id: "inactive-users",
        title: "Review inactive user accounts",
        description: `${inactiveUsers.length} user account(s) are inactive. Confirm account lifecycle and role transitions.`,
        priority: "medium",
      });
    }
    return actions;
  }, [rules, thresholds, users]);

  const createMilestone = async () => {
    try {
      await milestonesApi.create({
        ...milestoneDraft,
        stage: milestoneDraft.stage as MilestoneDefinition["stage"],
        active: true,
      });
      await load();
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const toggleMilestoneActive = async (item: MilestoneDefinition) => {
    try {
      await milestonesApi.update(item.id, { active: !item.active });
      await load();
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const createThreshold = async () => {
    try {
      await adminApi.createThreshold({
        key: thresholdDraft.key,
        stage: thresholdDraft.stage || null,
        thresholdDays: thresholdDraft.thresholdDays,
        description: thresholdDraft.description,
        enabled: true,
      });
      await load();
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const toggleThreshold = async (item: AlertThreshold) => {
    try {
      await adminApi.updateThreshold(item.id, { enabled: !item.enabled });
      await load();
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const createRule = async () => {
    try {
      await adminApi.createRoutingRule({
        fromStage: routingDraft.fromStage,
        decision: routingDraft.decision,
        nextOwnerRole: routingDraft.nextOwnerRole,
        taskTemplate: routingDraft.taskTemplate,
        active: true,
      });
      await load();
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const toggleRule = async (item: RoutingRule) => {
    try {
      await adminApi.updateRoutingRule(item.id, { active: !item.active });
      await load();
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const createUser = async () => {
    try {
      await usersApi.create({
        fullName: userDraft.fullName,
        email: userDraft.email,
        password: userDraft.password,
        roles: [userDraft.role],
      });
      await load();
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const toggleUser = async (item: UserAccount) => {
    try {
      await usersApi.update(item.id, { isActive: !item.isActive });
      await load();
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  if (loading) return <LoadingBlock text="Loading admin configuration..." />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Admin Configuration"
        subtitle="Milestones, thresholds, routing rules, and user administration for platform operations."
        help={{
          title: "Platform Configuration",
          summary: "This area controls milestone definitions, monitoring thresholds, routing rules, and user accounts.",
          recommendation: "Configuration changes affect workflow behavior, so keep them aligned with approved Graduate School process rules.",
        }}
      />

      <Card>
        <CardBody className="p-4 md:p-5">
          <div className="flex flex-wrap gap-2">
            {(["milestones", "thresholds", "routing", "users"] as Tab[]).map((item) => (
              <Button key={item} size="sm" variant={tab === item ? "primary" : "outline"} onClick={() => setTab(item)}>
                {readableEnum(item.toUpperCase())}
              </Button>
            ))}
          </div>
        </CardBody>
      </Card>

      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      {tab === "milestones" ? (
        <Card>
          <CardBody className="p-4 md:p-5">
            <SectionTitle
              title="Milestone Definitions"
              subtitle="Stage-linked milestone configuration"
              insight={
                <QuickInsights
                  title="Milestone Definitions"
                  summary="Milestones define expected progression checkpoints per lifecycle stage."
                  recommendation="Keep expected days and criticality aligned with graduate policy."
                />
              }
            />
            <div className="mb-2 grid gap-2 md:grid-cols-5">
              <input
                value={milestoneDraft.name}
                onChange={(event) => setMilestoneDraft((prev) => ({ ...prev, name: event.target.value }))}
                className="h-10 rounded-md border border-slate-300 px-3 text-sm md:col-span-2"
                placeholder="Milestone name"
              />
              <select
                value={milestoneDraft.stage}
                onChange={(event) => setMilestoneDraft((prev) => ({ ...prev, stage: event.target.value }))}
                className="h-10 rounded-md border border-slate-300 px-3 text-sm"
              >
                {STAGE_OPTIONS.map((stage) => (
                  <option key={stage} value={stage}>
                    {readableEnum(stage)}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={milestoneDraft.expectedDays}
                onChange={(event) => setMilestoneDraft((prev) => ({ ...prev, expectedDays: Number(event.target.value) }))}
                className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                placeholder="Expected days"
              />
              <Button size="sm" onClick={() => void createMilestone()}>
                Create
              </Button>
            </div>
            {milestones.length === 0 ? (
              <EmptyState message="No milestone definitions available." />
            ) : (
              <div className="space-y-1.5">
                {milestones.map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-600">
                        {readableEnum(item.stage)} | {item.expectedDays} days | Criticality {item.criticality}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={item.active ? "success" : "warning"}>{item.active ? "Active" : "Inactive"}</Badge>
                      <Button size="sm" variant="outline" onClick={() => void toggleMilestoneActive(item)}>
                        {item.active ? "Disable" : "Enable"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      ) : null}

      {tab === "thresholds" ? (
        <Card>
          <CardBody className="p-4 md:p-5">
            <SectionTitle
              title="Monitoring Thresholds"
              subtitle="Alert trigger and stage-time threshold settings"
              insight={
                <QuickInsights
                  title="Alert Thresholds"
                  summary="Thresholds govern monitoring triggers such as inactivity, handoffs, and stage duration."
                  recommendation="Review threshold changes with incident history before deployment."
                />
              }
            />
            <div className="mb-2 grid gap-2 md:grid-cols-5">
              <input
                value={thresholdDraft.key}
                onChange={(event) => setThresholdDraft((prev) => ({ ...prev, key: event.target.value }))}
                className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                placeholder="Key"
              />
              <select
                value={thresholdDraft.stage}
                onChange={(event) => setThresholdDraft((prev) => ({ ...prev, stage: event.target.value }))}
                className="h-10 rounded-md border border-slate-300 px-3 text-sm"
              >
                <option value="">No stage</option>
                {STAGE_OPTIONS.map((stage) => (
                  <option key={stage} value={stage}>
                    {readableEnum(stage)}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={thresholdDraft.thresholdDays}
                onChange={(event) => setThresholdDraft((prev) => ({ ...prev, thresholdDays: Number(event.target.value) }))}
                className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                placeholder="Days"
              />
              <input
                value={thresholdDraft.description}
                onChange={(event) => setThresholdDraft((prev) => ({ ...prev, description: event.target.value }))}
                className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                placeholder="Description"
              />
              <Button size="sm" onClick={() => void createThreshold()}>
                Create
              </Button>
            </div>
            {thresholds.length === 0 ? (
              <EmptyState message="No thresholds configured." />
            ) : (
              <div className="space-y-1.5">
                {thresholds.map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.key}</p>
                      <p className="text-xs text-slate-600">
                        {item.stage ? readableEnum(item.stage) : "Global"} | {item.thresholdDays} days | {item.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={item.enabled ? "success" : "warning"}>{item.enabled ? "Enabled" : "Disabled"}</Badge>
                      <Button size="sm" variant="outline" onClick={() => void toggleThreshold(item)}>
                        {item.enabled ? "Disable" : "Enable"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      ) : null}

      {tab === "routing" ? (
        <Card>
          <CardBody className="p-4 md:p-5">
            <SectionTitle
              title="Routing Rules"
              subtitle="Decision-driven next-owner transitions"
              insight={
                <QuickInsights
                  title="Routing Rules"
                  summary="Routing rules determine task ownership after decision outcomes by stage."
                  recommendation="Ensure every revise/return path has an active next-owner route."
                />
              }
            />
            <div className="mb-2 grid gap-2 md:grid-cols-5">
              <select
                value={routingDraft.fromStage}
                onChange={(event) => setRoutingDraft((prev) => ({ ...prev, fromStage: event.target.value }))}
                className="h-10 rounded-md border border-slate-300 px-3 text-sm"
              >
                {STAGE_OPTIONS.map((stage) => (
                  <option key={stage} value={stage}>
                    {readableEnum(stage)}
                  </option>
                ))}
              </select>
              <select
                value={routingDraft.decision}
                onChange={(event) => setRoutingDraft((prev) => ({ ...prev, decision: event.target.value }))}
                className="h-10 rounded-md border border-slate-300 px-3 text-sm"
              >
                {DECISION_OPTIONS.map((decision) => (
                  <option key={decision} value={decision}>
                    {readableEnum(decision)}
                  </option>
                ))}
              </select>
              <select
                value={routingDraft.nextOwnerRole}
                onChange={(event) => setRoutingDraft((prev) => ({ ...prev, nextOwnerRole: event.target.value }))}
                className="h-10 rounded-md border border-slate-300 px-3 text-sm"
              >
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {readableEnum(role)}
                  </option>
                ))}
              </select>
              <input
                value={routingDraft.taskTemplate}
                onChange={(event) => setRoutingDraft((prev) => ({ ...prev, taskTemplate: event.target.value }))}
                className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                placeholder="Task template"
              />
              <Button size="sm" onClick={() => void createRule()}>
                Create
              </Button>
            </div>
            {rules.length === 0 ? (
              <EmptyState message="No routing rules configured." />
            ) : (
              <div className="space-y-1.5">
                {rules.map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {readableEnum(item.fromStage)} + {item.decision ? readableEnum(item.decision) : "ANY"} {"->"}{" "}
                        {readableEnum(item.nextOwnerRole)}
                      </p>
                      <p className="text-xs text-slate-600">{item.taskTemplate}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={item.active ? "success" : "warning"}>{item.active ? "Active" : "Inactive"}</Badge>
                      <Button size="sm" variant="outline" onClick={() => void toggleRule(item)}>
                        {item.active ? "Disable" : "Enable"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      ) : null}

      {tab === "users" ? (
        <Card>
          <CardBody className="p-4 md:p-5">
            <SectionTitle
              title="User Management"
              subtitle="Role assignments and account activity state"
              insight={
                <QuickInsights
                  title="User Management"
                  summary="User accounts and role access are managed here for RBAC enforcement."
                  recommendation="Review inactive accounts and role assignments regularly."
                />
              }
            />
            <div className="mb-2 grid gap-2 md:grid-cols-5">
              <input
                value={userDraft.fullName}
                onChange={(event) => setUserDraft((prev) => ({ ...prev, fullName: event.target.value }))}
                className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                placeholder="Full name"
              />
              <input
                value={userDraft.email}
                onChange={(event) => setUserDraft((prev) => ({ ...prev, email: event.target.value }))}
                className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                placeholder="Email"
              />
              <input
                value={userDraft.password}
                onChange={(event) => setUserDraft((prev) => ({ ...prev, password: event.target.value }))}
                className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                placeholder="Password"
              />
              <select
                value={userDraft.role}
                onChange={(event) => setUserDraft((prev) => ({ ...prev, role: event.target.value }))}
                className="h-10 rounded-md border border-slate-300 px-3 text-sm"
              >
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {readableEnum(role)}
                  </option>
                ))}
              </select>
              <Button size="sm" onClick={() => void createUser()}>
                Create
              </Button>
            </div>
            {users.length === 0 ? (
              <EmptyState message="No user accounts available." />
            ) : (
              <div className="space-y-1.5">
                {users.map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.fullName}</p>
                      <p className="text-xs text-slate-600">
                        {item.email} | {item.roles.map((role) => readableEnum(role)).join(", ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={item.isActive ? "success" : "warning"}>{item.isActive ? "Active" : "Inactive"}</Badge>
                      <Button size="sm" variant="outline" onClick={() => void toggleUser(item)}>
                        {item.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      ) : null}

      <RecommendedActions
        actions={recommendedActions}
        context="Page-level recommendations based on configuration readiness, disabled controls, and account governance status."
      />
    </div>
  );
};
