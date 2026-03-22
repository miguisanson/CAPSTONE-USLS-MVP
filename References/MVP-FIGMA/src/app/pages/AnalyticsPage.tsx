import { Link } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { mockStudents, mockTasks, mockAlerts, lifecycleStages } from "../data/mockData";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Download, FileText, Printer, TrendingUp } from "lucide-react";
import { RecommendedActions } from "../components/QuickInsights";

const COLORS = ['#006633', '#10b981', '#3b82f6', '#f59e0b', '#dc2626', '#8b5cf6', '#ec4899'];

export function AnalyticsPage() {
  const { hasAccess } = useAuth();

  if (!hasAccess(["Admin", "Graduate School Staff", "Academic Coordinator", "Research Coordinator"])) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-destructive font-medium">Access Denied</p>
            <p className="text-muted-foreground mt-2">
              You do not have permission to access analytics
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Data preparation
  const studentsByStage = lifecycleStages.map(stage => ({
    stage,
    count: mockStudents.filter(s => s.currentStage === stage).length,
  })).filter(item => item.count > 0);

  const tasksByStatus = [
    { status: "Pending", count: mockTasks.filter(t => t.status === "Pending").length },
    { status: "In Progress", count: mockTasks.filter(t => t.status === "In Progress").length },
    { status: "Overdue", count: mockTasks.filter(t => t.status === "Overdue").length },
    { status: "Completed", count: mockTasks.filter(t => t.status === "Completed").length },
  ];

  const alertsByType = [
    { type: "Prolonged Stage", count: mockAlerts.filter(a => a.alertType === "Prolonged Stage").length },
    { type: "Unresolved Handoff", count: mockAlerts.filter(a => a.alertType === "Unresolved Handoff").length },
    { type: "Delayed Scheduling", count: mockAlerts.filter(a => a.alertType === "Delayed Scheduling").length },
    { type: "Inactivity", count: mockAlerts.filter(a => a.alertType === "Inactivity").length },
  ].filter(item => item.count > 0);

  const stageTimeData = [
    { stage: "Proposal Dev.", avgDays: 65 },
    { stage: "Proposal Def.", avgDays: 45 },
    { stage: "Data Collection", avgDays: 120 },
    { stage: "Dissertation", avgDays: 90 },
    { stage: "Oral Defense", avgDays: 30 },
  ];

  // Generate Recommended Actions
  const recommendedActions = [];
  
  const prolongedDataCollection = mockStudents.filter(s => s.currentStage === "Data Collection").length;
  if (prolongedDataCollection >= 2) {
    recommendedActions.push({
      id: 'prolonged-data-collection',
      title: 'Address Prolonged Data Collection Cases',
      description: `${prolongedDataCollection} students are in Data Collection stage. Review individual timelines and schedule progress meetings with advisers to assess obstacles and timeline adjustments.`,
      priority: 'high' as const,
      category: 'Student Monitoring'
    });
  }

  const overdueTasks = mockTasks.filter(t => t.status === "Overdue").length;
  if (overdueTasks > 0) {
    recommendedActions.push({
      id: 'overdue-reviews',
      title: 'Escalate Overdue Document Reviews',
      description: `${overdueTasks} review task${overdueTasks > 1 ? 's are' : ' is'} overdue. Consider escalating to academic coordinators to prevent further delays in student progression.`,
      priority: 'high' as const,
      category: 'Task Management'
    });
  }

  const inactivityAlerts = mockAlerts.filter(a => a.alertType === "Inactivity" && a.status !== "Resolved").length;
  if (inactivityAlerts > 0) {
    recommendedActions.push({
      id: 'inactivity-alerts',
      title: 'Monitor Student Inactivity Patterns',
      description: `${inactivityAlerts} student${inactivityAlerts > 1 ? 's have' : ' has'} shown prolonged inactivity. Send automated reminder notifications and flag for adviser follow-up if no response within 3 days.`,
      priority: 'medium' as const,
      category: 'Alerts & Compliance'
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Analytics & Insights</h1>
          <p className="text-muted-foreground mt-1">
            Descriptive analytics and prescriptive decision support
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="default" size="sm" asChild className="gap-2">
            <Link to="/analytics/print">
              <Printer className="h-4 w-4" />
              Print Report
            </Link>
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Students</p>
            <p className="text-3xl font-semibold text-foreground mt-2">{mockStudents.length}</p>
            <p className="text-xs text-success mt-1">Active enrollment</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">At-Risk Students</p>
            <p className="text-3xl font-semibold text-destructive mt-2">
              {mockStudents.filter(s => s.riskFlag).length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {((mockStudents.filter(s => s.riskFlag).length / mockStudents.length) * 100).toFixed(0)}% of total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Open Alerts</p>
            <p className="text-3xl font-semibold text-warning mt-2">
              {mockAlerts.filter(a => a.status !== "Resolved").length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Require intervention</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Pending Tasks</p>
            <p className="text-3xl font-semibold text-primary mt-2">
              {mockTasks.filter(t => t.status !== "Completed").length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Across all roles</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Students by Lifecycle Stage</CardTitle>
            <CardDescription>Current distribution across research stages</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={studentsByStage}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="stage" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#006633" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Task Status Distribution</CardTitle>
            <CardDescription>Workflow queue breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={tasksByStatus}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ status, count }) => `${status}: ${count}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {tasksByStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Average Time in Stage</CardTitle>
            <CardDescription>Historical duration by lifecycle stage (days)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stageTimeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="stage" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="avgDays" stroke="#006633" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alert Type Distribution</CardTitle>
            <CardDescription>Active monitoring alerts by category</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={alertsByType} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" />
                <YAxis dataKey="type" type="category" width={120} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recommended Actions */}
      <RecommendedActions 
        actions={recommendedActions}
        context="Based on analytics data, policy rules, historical patterns, and lifecycle stage thresholds"
      />
    </div>
  );
}