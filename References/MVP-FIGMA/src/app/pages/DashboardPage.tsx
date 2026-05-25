import { Link } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { mockStudents, mockTasks, mockAlerts, mockScheduling, lifecycleStages } from "../data/mockData";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Users,
  CheckSquare,
  AlertTriangle,
  Clock,
  TrendingUp,
  Calendar,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { QuickInsightPopover, QuickInsightDrawer, RecommendedActions } from "../components/QuickInsights";

const COLORS = ['#006633', '#10b981', '#3b82f6', '#f59e0b', '#dc2626', '#8b5cf6', '#ec4899'];

export function DashboardPage() {
  const { user } = useAuth();

  // Calculate KPIs
  const totalStudents = mockStudents.length;
  const myTasks = mockTasks.filter(t => t.assignedTo === user?.name).length;
  const overdueTasks = mockTasks.filter(t => t.status === "Overdue").length;
  const openAlerts = mockAlerts.filter(a => a.status !== "Resolved").length;
  const atRiskStudents = mockStudents.filter(s => s.riskFlag).length;

  // Students by stage
  const studentsByStage = lifecycleStages.map(stage => ({
    name: stage,
    count: mockStudents.filter(s => s.currentStage === stage).length,
  })).filter(item => item.count > 0);

  // Program distribution
  const studentsByProgram = [
    { name: "MS CS", count: mockStudents.filter(s => s.program === "MS Computer Science").length },
    { name: "MA ED", count: mockStudents.filter(s => s.program === "MA Education").length },
    { name: "MBA", count: mockStudents.filter(s => s.program === "MBA").length },
    { name: "PhD ENG", count: mockStudents.filter(s => s.program === "PhD Engineering").length },
  ].filter(item => item.count > 0);

  // Priority tasks
  const priorityTasks = mockTasks
    .filter(t => t.status !== "Completed")
    .sort((a, b) => {
      const priorityOrder = { "High": 0, "Medium": 1, "Low": 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    })
    .slice(0, 5);

  // Upcoming defenses
  const upcomingDefenses = mockScheduling.filter(s => s.status === "Confirmed");

  // Generate Recommended Actions (Page-Level)
  const recommendedActions = [];
  
  if (overdueTasks > 0) {
    recommendedActions.push({
      id: 'overdue-tasks',
      title: 'Address Overdue Tasks',
      description: `${overdueTasks} task${overdueTasks > 1 ? 's are' : ' is'} overdue and may be blocking student progress. Review task queue and complete or reassign high-priority items.`,
      priority: 'high' as const,
      category: 'Task Management'
    });
  }

  if (atRiskStudents > 2) {
    recommendedActions.push({
      id: 'at-risk-students',
      title: 'Review At-Risk Student Cases',
      description: `${atRiskStudents} students are flagged as at-risk. Conduct individual case reviews to identify common blockers such as prolonged stage duration, milestone delays, or adviser availability issues.`,
      priority: 'high' as const,
      category: 'Student Monitoring'
    });
  }

  if (openAlerts > 3) {
    recommendedActions.push({
      id: 'open-alerts',
      title: 'Resolve Open Monitoring Alerts',
      description: `${openAlerts} active alerts require attention. Review alerts by severity level and address critical policy violations or milestone delays first.`,
      priority: 'medium' as const,
      category: 'Alerts & Compliance'
    });
  }

  // Check for upcoming defenses within 7 days
  const upcomingDefensesWithinWeek = upcomingDefenses.filter(d => {
    const defenseDate = new Date(d.confirmedDate);
    const today = new Date();
    const daysUntil = Math.floor((defenseDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntil >= 0 && daysUntil <= 7;
  });

  if (upcomingDefensesWithinWeek.length > 0) {
    recommendedActions.push({
      id: 'upcoming-defenses',
      title: 'Prepare for Upcoming Defenses',
      description: `${upcomingDefensesWithinWeek.length} defense${upcomingDefensesWithinWeek.length > 1 ? 's are' : ' is'} scheduled within the next 7 days. Confirm panel member availability, room setup, and ensure all required defense documents are submitted.`,
      priority: 'medium' as const,
      category: 'Scheduling'
    });
  }

  if (myTasks > 10) {
    recommendedActions.push({
      id: 'high-task-volume',
      title: 'Optimize Task Workload Distribution',
      description: 'Your assigned task count is high. Consider delegating low-priority tasks to available team members or requesting additional support from coordinators.',
      priority: 'low' as const,
      category: 'Workload Management'
    });
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome back, {user?.name}. Here's an overview of graduate student activities.
        </p>
      </div>

      {/* KPI Cards with Quick Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-sm text-muted-foreground">Students Monitored</p>
                  <QuickInsightPopover
                    title="Total Active Students"
                    description="Total number of active graduate students across all programs currently tracked in the system. This includes students from admission through completion stages, excluding graduated or withdrawn students."
                    recommendation="Monitor the distribution across lifecycle stages to identify potential bottlenecks in the graduate student journey."
                  />
                </div>
                <p className="text-3xl font-semibold text-foreground">{totalStudents}</p>
                <p className="text-xs text-muted-foreground mt-1">Across all programs</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-sm text-muted-foreground">My Open Tasks</p>
                  <QuickInsightPopover
                    title="Your Assigned Tasks"
                    description="Number of pending tasks currently assigned to you that require action. These include document reviews, stage approvals, defense evaluations, and student case follow-ups."
                    recommendation={myTasks > 5 ? "You have a high task volume. Prioritize overdue and high-priority items first to prevent student delays." : "Your task load is manageable. Focus on addressing any overdue items."}
                    variant={myTasks > 5 ? "warning" : "default"}
                  />
                </div>
                <p className="text-3xl font-semibold text-foreground">{myTasks}</p>
                <p className="text-xs text-muted-foreground mt-1">Assigned to you</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <CheckSquare className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-sm text-muted-foreground">Overdue Tasks</p>
                  <QuickInsightPopover
                    title="Overdue Tasks Alert"
                    description="Tasks that have passed their due date and require immediate attention. These may impact student progress timelines, milestone completion, and compliance with academic deadlines."
                    recommendation={overdueTasks > 0 ? "Review and address overdue tasks immediately. Consider escalating to team leads if blockers exist." : "No overdue tasks. Continue monitoring upcoming due dates to maintain this status."}
                    variant="warning"
                  />
                </div>
                <p className="text-3xl font-semibold text-destructive">{overdueTasks}</p>
                <p className="text-xs text-muted-foreground mt-1">Require attention</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-destructive/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-sm text-muted-foreground">Open Alerts</p>
                  <QuickInsightPopover
                    title="Active System Alerts"
                    description="Active system alerts triggered by milestone delays, prolonged inactivity, policy violations, or stage duration thresholds. These require staff intervention or acknowledgment."
                    recommendation={openAlerts > 3 ? "High alert volume detected. Review alerts by severity and address critical cases first." : "Alert count is within normal range. Review and resolve alerts systematically."}
                    variant={openAlerts > 3 ? "warning" : "default"}
                  />
                </div>
                <p className="text-3xl font-semibold text-warning">{openAlerts}</p>
                <p className="text-xs text-muted-foreground mt-1">Need intervention</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-warning/10 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid with Quick Insights */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Students by Lifecycle Stage */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Students by Lifecycle Stage</CardTitle>
                <CardDescription>Distribution across research milestones</CardDescription>
              </div>
              <QuickInsightDrawer
                title="Understanding Lifecycle Stage Distribution"
                description="This chart shows how graduate students are distributed across the 9 lifecycle stages from Admission to Completed."
                sections={[
                  {
                    title: "What This Chart Measures",
                    content: "Each bar represents the number of students currently in a specific research lifecycle stage. Stages include Admission, Coursework, Proposal Development, Proposal Defense, Data Collection, Dissertation Writing, Oral Defense Preparation, Oral Defense, and Completed."
                  },
                  {
                    title: "What to Look For",
                    content: "Watch for unusual concentrations in any single stage, particularly Data Collection or Dissertation Writing stages. Large numbers staying in one stage may indicate systematic bottlenecks, resource constraints, or common blockers."
                  },
                  {
                    title: "Why It Matters",
                    content: "Stage distribution helps identify where students face delays and where additional adviser support, resources, or intervention may be needed. It informs resource allocation and targeted support planning."
                  }
                ]}
                recommendation="If you notice a stage with significantly more students than others, review individual cases for common blockers and consider targeted support interventions or process improvements."
              />
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={studentsByStage}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#006633" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Program Distribution */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Students by Program</CardTitle>
                <CardDescription>Active graduate programs</CardDescription>
              </div>
              <QuickInsightPopover
                title="Program Distribution"
                description="Shows the distribution of active graduate students across different academic programs. This helps with resource planning, faculty allocation, and program-specific support planning."
                recommendation="Monitor program enrollment trends to ensure adequate faculty advisers, administrative support, and resources for each program."
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={studentsByProgram}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, count }) => `${name}: ${count}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {studentsByProgram.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Priority Tasks & At-Risk Students with Quick Insights */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Priority Tasks */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle>Priority Tasks</CardTitle>
                <QuickInsightPopover
                  title="Understanding Priority Tasks"
                  description="Tasks are prioritized based on urgency, impact on student progress, and compliance requirements. High-priority tasks often have tight deadlines or directly impact critical milestone completion."
                  recommendation="Address overdue and high-priority tasks first. Tasks marked as 'Overdue' may be blocking student advancement to the next stage."
                  variant="warning"
                />
              </div>
              <CardDescription>High-priority items requiring action</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/tasks">
                View All <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {priorityTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No priority tasks</p>
              ) : (
                priorityTasks.map(task => (
                  <div key={task.id} className="flex items-start gap-3 p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{task.studentName}</p>
                        <Badge 
                          variant={task.priority === "High" ? "destructive" : task.priority === "Medium" ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {task.priority}
                        </Badge>
                        {task.status === "Overdue" && (
                          <Badge variant="destructive" className="text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            Overdue
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">Due: {task.dueDate}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* At-Risk Students */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle>At-Risk Students</CardTitle>
                <QuickInsightDrawer
                  title="Understanding At-Risk Students"
                  description="Students flagged as at-risk require proactive intervention and support to prevent dropout or excessive delays."
                  sections={[
                    {
                      title: "Why Students Are Flagged",
                      content: "A student is marked at-risk when they exceed stage duration thresholds, have prolonged inactivity (no milestone updates for extended periods), face repeated document revisions, or encounter persistent milestone delays."
                    },
                    {
                      title: "What These Flags Mean",
                      content: "At-risk flags are early warning indicators. They don't mean a student will fail or drop out, but they signal the need for closer monitoring and potential support interventions before issues escalate."
                    },
                    {
                      title: "How to Respond",
                      content: "Review each student's profile to understand specific blockers. Common interventions include progress review meetings, adviser consultations, resource referrals, timeline adjustments, or deadline extensions where appropriate."
                    }
                  ]}
                  recommendation="Click on any at-risk student to view their detailed profile, active alerts, and recommended interventions specific to their case."
                />
              </div>
              <CardDescription>Students requiring intervention</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/students">
                View All <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {atRiskStudents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No at-risk students</p>
              ) : (
                mockStudents.filter(s => s.riskFlag).map(student => (
                  <Link
                    key={student.id}
                    to={`/students/${student.id}`}
                    className="flex items-start gap-3 p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors block"
                  >
                    <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{student.name}</p>
                      <p className="text-sm text-muted-foreground">{student.program}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">{student.currentStage}</Badge>
                        <p className="text-xs text-muted-foreground">Last updated: {student.lastUpdated}</p>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Defense Schedules with Quick Insights */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle>Upcoming Defense Schedules</CardTitle>
              <QuickInsightPopover
                title="Defense Schedule Overview"
                description="Confirmed defense dates for proposal defenses and oral examinations. These are critical milestone events that require panel member coordination, room booking, and complete documentation preparation."
                recommendation="Review upcoming defense schedules weekly. Confirm panel member availability and room logistics at least 2 weeks in advance to avoid last-minute conflicts."
              />
            </div>
            <CardDescription>Confirmed defense dates</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/scheduling">
              View All <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {upcomingDefenses.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No upcoming defenses</p>
            ) : (
              upcomingDefenses.map(defense => (
                <div key={defense.id} className="flex items-start gap-3 p-3 border border-border rounded-lg">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{defense.studentName}</p>
                    <p className="text-sm text-muted-foreground">{defense.defenseType}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Date:</span> {defense.confirmedDate}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Time:</span> {defense.confirmedTime}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Venue:</span> {defense.venue}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recommended Actions - Page-Level Summary */}
      {user && ["Admin", "Graduate School Staff", "Academic Coordinator", "Research Coordinator"].includes(user.role) && (
        <RecommendedActions
          actions={recommendedActions}
          context="Based on current task queues, student monitoring data, alert thresholds, and scheduling deadlines"
        />
      )}
    </div>
  );
}