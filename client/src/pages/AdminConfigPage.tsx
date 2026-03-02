import { useEffect, useState } from "react";
import { adminApi, milestonesApi, usersApi } from "../api/endpoints";
import { handleApiError } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { LoadingBlock } from "../components/LoadingBlock";
import type { AlertThreshold, MilestoneDefinition, RoutingRule, UserAccount } from "../types/domain";
import { readableEnum } from "../utils/format";

type Tab = "milestones" | "thresholds" | "routing" | "users";

export const AdminConfigPage = () => {
  const [tab, setTab] = useState<Tab>("milestones");
  const [milestones, setMilestones] = useState<MilestoneDefinition[]>([]);
  const [thresholds, setThresholds] = useState<AlertThreshold[]>([]);
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [milestoneName, setMilestoneName] = useState("Proposal QA Review");
  const [milestoneStage, setMilestoneStage] = useState("PROPOSAL_DEVELOPMENT");
  const [thresholdKey, setThresholdKey] = useState("STAGE_PROPOSAL_DEFENSE");
  const [thresholdDays, setThresholdDays] = useState(20);
  const [thresholdDescription, setThresholdDescription] = useState("Defense threshold");
  const [routingTemplate, setRoutingTemplate] = useState("Re-queue student revision task");
  const [routingStage, setRoutingStage] = useState("PROPOSAL_DEFENSE");
  const [routingDecision, setRoutingDecision] = useState("REVISE");
  const [routingRole, setRoutingRole] = useState("STUDENT");
  const [userName, setUserName] = useState("New Demo User");
  const [userEmail, setUserEmail] = useState("new.user@gs.local");
  const [userPassword, setUserPassword] = useState("DemoPass123!");
  const [userRole, setUserRole] = useState("GRADUATE_SCHOOL_STAFF");

  const load = async () => {
    try {
      setLoading(true);
      const [milestonesRes, thresholdsRes, rulesRes, usersRes, rolesRes] = await Promise.all([
        milestonesApi.list({}),
        adminApi.thresholds(),
        adminApi.routingRules(),
        usersApi.list({ pageSize: 40 }),
        usersApi.roles(),
      ]);
      setMilestones(milestonesRes);
      setThresholds(thresholdsRes);
      setRules(rulesRes);
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

  const createMilestone = async () => {
    try {
      await milestonesApi.create({
        name: milestoneName,
        stage: milestoneStage as MilestoneDefinition["stage"],
        expectedDays: 14,
        criticality: 3,
        active: true,
      });
      await load();
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const createThreshold = async () => {
    try {
      await adminApi.createThreshold({
        key: thresholdKey,
        thresholdDays,
        description: thresholdDescription,
        enabled: true,
      });
      await load();
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const createRule = async () => {
    try {
      await adminApi.createRoutingRule({
        fromStage: routingStage,
        decision: routingDecision,
        nextOwnerRole: routingRole,
        taskTemplate: routingTemplate,
        active: true,
      });
      await load();
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const createUser = async () => {
    try {
      await usersApi.create({
        fullName: userName,
        email: userEmail,
        password: userPassword,
        roles: [userRole],
      });
      await load();
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  if (loading) return <LoadingBlock text="Loading admin configuration..." />;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Admin Configuration Console</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["milestones", "thresholds", "routing", "users"] as Tab[]).map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={`rounded-md px-3 py-1.5 text-sm ${
                tab === item
                  ? "bg-[var(--gs-primary)] text-white"
                  : "border border-slate-300 text-slate-700 hover:bg-slate-100"
              }`}
            >
              {readableEnum(item.toUpperCase())}
            </button>
          ))}
        </div>
      </section>

      {error ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}

      {tab === "milestones" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800">Milestone Definitions</h3>
          <div className="mt-2 grid gap-2 md:grid-cols-3">
            <input
              value={milestoneName}
              onChange={(event) => setMilestoneName(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={milestoneStage}
              onChange={(event) => setMilestoneStage(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button onClick={() => void createMilestone()} className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100">
              Create
            </button>
          </div>
          <ul className="mt-3 space-y-1 text-sm">
            {milestones.map((item) => (
              <li key={item.id} className="rounded-md bg-slate-50 px-2 py-1">
                {item.name} - {readableEnum(item.stage)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tab === "thresholds" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800">Alert Thresholds</h3>
          <div className="mt-2 grid gap-2 md:grid-cols-4">
            <input
              value={thresholdKey}
              onChange={(event) => setThresholdKey(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={thresholdDays}
              type="number"
              onChange={(event) => setThresholdDays(Number(event.target.value))}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={thresholdDescription}
              onChange={(event) => setThresholdDescription(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button onClick={() => void createThreshold()} className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100">
              Create
            </button>
          </div>
          {thresholds.length === 0 ? (
            <EmptyState message="No thresholds configured." />
          ) : (
            <ul className="mt-3 space-y-1 text-sm">
              {thresholds.map((item) => (
                <li key={item.id} className="rounded-md bg-slate-50 px-2 py-1">
                  {item.key}: {item.thresholdDays} days ({item.enabled ? "enabled" : "disabled"})
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === "routing" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800">Routing Rules</h3>
          <div className="mt-2 grid gap-2 md:grid-cols-4">
            <input
              value={routingStage}
              onChange={(event) => setRoutingStage(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={routingDecision}
              onChange={(event) => setRoutingDecision(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <select
              value={routingRole}
              onChange={(event) => setRoutingRole(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {roles.map((role) => (
                <option key={role} value={role}>
                  {readableEnum(role)}
                </option>
              ))}
            </select>
            <input
              value={routingTemplate}
              onChange={(event) => setRoutingTemplate(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={() => void createRule()}
            className="mt-2 rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100"
          >
            Create Rule
          </button>
          <ul className="mt-3 space-y-1 text-sm">
            {rules.map((item) => (
              <li key={item.id} className="rounded-md bg-slate-50 px-2 py-1">
                {readableEnum(item.fromStage)} + {item.decision ? readableEnum(item.decision) : "ANY"} {"->"}{" "}
                {readableEnum(item.nextOwnerRole)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tab === "users" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800">User Management</h3>
          <div className="mt-2 grid gap-2 md:grid-cols-4">
            <input
              value={userName}
              onChange={(event) => setUserName(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={userEmail}
              onChange={(event) => setUserEmail(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={userPassword}
              onChange={(event) => setUserPassword(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <select
              value={userRole}
              onChange={(event) => setUserRole(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {roles.map((role) => (
                <option key={role} value={role}>
                  {readableEnum(role)}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => void createUser()}
            className="mt-2 rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100"
          >
            Create User
          </button>
          <ul className="mt-3 space-y-1 text-sm">
            {users.map((user) => (
              <li key={user.id} className="rounded-md bg-slate-50 px-2 py-1">
                {user.fullName} ({user.email}) - {user.roles.map((role) => readableEnum(role)).join(", ")}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
};
