import { useParams, Link } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { mockStudents, mockTasks, mockAlerts, mockDocuments, LifecycleStage, lifecycleStages } from "../data/mockData";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Label } from "../components/ui/label";
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Clock,
  User,
  Mail,
  Calendar,
  BookOpen,
  Users,
  FileText,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import { Progress } from "../components/ui/progress";

export function StudentProfilePage() {
  const { id } = useParams();
  const { user, hasAccess } = useAuth();
  
  const student = mockStudents.find(s => s.id === id);
  const studentTasks = mockTasks.filter(t => t.studentId === id);
  const studentAlerts = mockAlerts.filter(a => a.studentId === id);
  const studentDocuments = mockDocuments.filter(d => d.studentId === id);

  if (!student) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/students">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Students
            </Link>
          </Button>
        </div>
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">Student not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canUpdateStage = hasAccess(["Admin", "Graduate School Staff", "Academic Coordinator", "Research Coordinator", "Adviser"]);
  
  const completedMilestones = student.milestones.filter(m => m.status === "Completed").length;
  const totalMilestones = student.milestones.length;
  const progressPercentage = totalMilestones > 0 ? (completedMilestones / totalMilestones) * 100 : 0;

  const currentStageIndex = lifecycleStages.indexOf(student.currentStage);

  return (
    <div className="space-y-6">
      {/* Navigation */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/students">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Students
          </Link>
        </Button>
      </div>

      {/* Student Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="h-16 w-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-semibold">
                {student.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-semibold text-foreground">{student.name}</h1>
                  {student.riskFlag && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertCircle className="h-3 w-3" />
                      At-Risk
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground mt-1">{student.studentId}</p>
                <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <BookOpen className="h-4 w-4" />
                    <span>{student.program}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    <span>{student.email}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>Enrolled: {student.enrollmentDate}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <Badge variant="outline" className="text-sm justify-center py-2">
                Current Stage: {student.currentStage}
              </Badge>
              <p className="text-xs text-muted-foreground text-center">
                Last updated: {student.lastUpdated}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stage Progress Tracker */}
      <Card>
        <CardHeader>
          <CardTitle>Lifecycle Stage Progress</CardTitle>
          <CardDescription>Track student progress through graduate program stages</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between overflow-x-auto pb-2">
              {lifecycleStages.filter(s => s !== "LOA").map((stage, index) => {
                const isCompleted = index < currentStageIndex;
                const isCurrent = index === currentStageIndex;
                
                return (
                  <div key={stage} className="flex items-center flex-shrink-0">
                    <div className="flex flex-col items-center">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center border-2 ${
                        isCompleted ? "bg-primary border-primary text-primary-foreground" :
                        isCurrent ? "bg-primary border-primary text-primary-foreground" :
                        "bg-background border-border text-muted-foreground"
                      }`}>
                        {isCompleted ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : (
                          <span className="text-xs font-medium">{index + 1}</span>
                        )}
                      </div>
                      <p className={`text-xs mt-2 max-w-[80px] text-center ${
                        isCurrent ? "font-medium text-foreground" : "text-muted-foreground"
                      }`}>
                        {stage}
                      </p>
                    </div>
                    {index < lifecycleStages.filter(s => s !== "LOA").length - 1 && (
                      <div className={`h-0.5 w-12 mx-2 ${
                        isCompleted ? "bg-primary" : "bg-border"
                      }`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="tasks">Tasks ({studentTasks.length})</TabsTrigger>
          <TabsTrigger value="documents">Documents ({studentDocuments.length})</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Academic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Academic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Program</Label>
                  <p className="text-sm font-medium">{student.program}</p>
                </div>
                <Separator />
                <div>
                  <Label className="text-xs text-muted-foreground">Adviser</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium">{student.adviser}</p>
                  </div>
                </div>
                <Separator />
                <div>
                  <Label className="text-xs text-muted-foreground">Panel Members</Label>
                  {student.panelMembers.length > 0 ? (
                    <div className="space-y-1 mt-1">
                      {student.panelMembers.map((member, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm">{member}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1">Not assigned yet</p>
                  )}
                </div>
                <Separator />
                <div>
                  <Label className="text-xs text-muted-foreground">Enrollment Date</Label>
                  <p className="text-sm font-medium">{student.enrollmentDate}</p>
                </div>
              </CardContent>
            </Card>

            {/* Stage Management */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Stage Management</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {canUpdateStage ? (
                  <>
                    <div>
                      <Label htmlFor="stage">Update Current Stage</Label>
                      <Select defaultValue={student.currentStage}>
                        <SelectTrigger id="stage" className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {lifecycleStages.map(stage => (
                            <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button className="w-full" variant="outline">
                      Update Stage
                    </Button>
                    <Separator />
                  </>
                ) : null}
                <div>
                  <Label className="text-xs text-muted-foreground">Current Stage</Label>
                  <Badge variant="outline" className="mt-1 w-full justify-center py-1.5">
                    {student.currentStage}
                  </Badge>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Progress</Label>
                  <div className="mt-2 space-y-1">
                    <Progress value={progressPercentage} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      {completedMilestones} of {totalMilestones} milestones completed
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span className="text-sm">Open Tasks</span>
                  </div>
                  <span className="text-sm font-semibold">{studentTasks.filter(t => t.status !== "Completed").length}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    <span className="text-sm">Active Alerts</span>
                  </div>
                  <span className="text-sm font-semibold">{studentAlerts.filter(a => a.status !== "Resolved").length}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="text-sm">Documents</span>
                  </div>
                  <span className="text-sm font-semibold">{studentDocuments.length}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Last Activity</span>
                  </div>
                  <span className="text-sm font-semibold">{student.lastUpdated}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Open Tasks */}
          {studentTasks.filter(t => t.status !== "Completed").length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Open Tasks</CardTitle>
                <CardDescription>Tasks requiring attention</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {studentTasks.filter(t => t.status !== "Completed").map(task => (
                    <div key={task.id} className="flex items-start gap-3 p-3 border border-border rounded-lg">
                      <CheckCircle2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{task.taskType}</p>
                          <Badge variant={task.status === "Overdue" ? "destructive" : "outline"} className="text-xs">
                            {task.status}
                          </Badge>
                          {task.priority === "High" && (
                            <Badge variant="destructive" className="text-xs">High Priority</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>Assigned to: {task.assignedTo}</span>
                          <span>Due: {task.dueDate}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Milestones Tab */}
        <TabsContent value="milestones" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Milestone Checklist</CardTitle>
              <CardDescription>Track completion of key academic milestones</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {student.milestones.map(milestone => (
                  <div key={milestone.id} className="flex items-start gap-3 p-3 border border-border rounded-lg">
                    <div className="mt-0.5">
                      {milestone.status === "Completed" ? (
                        <CheckCircle2 className="h-5 w-5 text-success" />
                      ) : milestone.status === "In Progress" ? (
                        <Clock className="h-5 w-5 text-warning" />
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 border-border" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{milestone.name}</p>
                        <Badge variant="outline" className="text-xs">{milestone.stage}</Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>Status: {milestone.status}</span>
                        {milestone.completedDate && <span>Completed: {milestone.completedDate}</span>}
                        {milestone.dueDate && <span>Due: {milestone.dueDate}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <CardTitle>All Tasks</CardTitle>
              <CardDescription>Complete task history for this student</CardDescription>
            </CardHeader>
            <CardContent>
              {studentTasks.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No tasks found</p>
              ) : (
                <div className="space-y-3">
                  {studentTasks.map(task => (
                    <div key={task.id} className="flex items-start gap-3 p-3 border border-border rounded-lg">
                      <CheckCircle2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{task.taskType}</p>
                          <Badge variant={task.status === "Overdue" ? "destructive" : task.status === "Completed" ? "default" : "outline"}>
                            {task.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>Assigned: {task.assignedTo}</span>
                          <span>Due: {task.dueDate}</span>
                          <span>Priority: {task.priority}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
              <CardDescription>Submitted documents and revision history</CardDescription>
            </CardHeader>
            <CardContent>
              {studentDocuments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No documents found</p>
              ) : (
                <div className="space-y-3">
                  {studentDocuments.map(doc => (
                    <div key={doc.id} className="flex items-start gap-3 p-3 border border-border rounded-lg">
                      <FileText className="h-5 w-5 text-primary mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{doc.checklistItem}</p>
                          <Badge variant={doc.status === "Approved" ? "default" : doc.status === "Revision Requested" ? "destructive" : "outline"}>
                            {doc.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{doc.fileName} (v{doc.version})</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>Uploaded by: {doc.uploadedBy}</span>
                          <span>Date: {doc.uploadedDate}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle>Activity Timeline</CardTitle>
              <CardDescription>Recent activities and updates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {student.timeline.map((event, index) => (
                  <div key={event.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                      </div>
                      {index < student.timeline.length - 1 && (
                        <div className="w-0.5 flex-1 bg-border mt-1" />
                      )}
                    </div>
                    <div className="flex-1 pb-6">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{event.action}</p>
                        <Badge variant="outline" className="text-xs">{event.actor}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">{event.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
