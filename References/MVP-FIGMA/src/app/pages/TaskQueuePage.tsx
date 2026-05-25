import { useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { mockTasks, TaskStatus } from "../data/mockData";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Textarea } from "../components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { CheckCircle2, Clock, AlertCircle, Search, Filter, Eye, CheckCheck, RotateCcw, X } from "lucide-react";
import { RecommendedActions } from "../components/QuickInsights";

export function TaskQueuePage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [decisionNotes, setDecisionNotes] = useState("");

  const myTasks = mockTasks.filter(task => task.assignedTo === user?.name);
  const teamTasks = mockTasks.filter(task => task.assignedRole === user?.role || task.assignedTo !== user?.name);

  const filterTasks = (tasks: typeof mockTasks) => {
    return tasks.filter(task => {
      const matchesSearch = 
        task.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.taskType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || task.status === statusFilter;
      const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  };

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case "Completed":
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "Overdue":
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case "In Progress":
        return <Clock className="h-4 w-4 text-warning" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    const variants = {
      "High": "destructive",
      "Medium": "default",
      "Low": "secondary",
    } as const;
    return variants[priority as keyof typeof variants] || "secondary";
  };

  const handleDecision = (taskId: string, decision: "Approve" | "Revise" | "Return") => {
    console.log("Decision:", decision, "for task:", taskId, "Notes:", decisionNotes);
    // In a real app, this would call an API
    setSelectedTask(null);
    setDecisionNotes("");
  };

  // Generate Recommended Actions
  const recommendedActions = [];
  
  const overdueTasks = myTasks.filter(t => t.status === "Overdue");
  if (overdueTasks.length > 0) {
    recommendedActions.push({
      id: 'address-overdue',
      title: 'Prioritize Overdue Task Reviews',
      description: `${overdueTasks.length} task${overdueTasks.length > 1 ? 's are' : ' is'} overdue. These delays may block student progression. Review and complete high-priority overdue tasks first, or escalate if additional input is needed.`,
      priority: 'high' as const,
      category: 'Task Management'
    });
  }

  const highPriorityPending = myTasks.filter(t => t.priority === "High" && t.status !== "Completed");
  if (highPriorityPending.length > 0) {
    recommendedActions.push({
      id: 'high-priority-tasks',
      title: 'Process High-Priority Tasks',
      description: `${highPriorityPending.length} high-priority task${highPriorityPending.length > 1 ? 's require' : ' requires'} attention. These tasks are critical for student milestone progression. Allocate time today to review and process these items.`,
      priority: 'high' as const,
      category: 'Task Management'
    });
  }

  const oldTasks = myTasks.filter(t => t.age > 10 && t.status !== "Completed");
  if (oldTasks.length >= 2) {
    recommendedActions.push({
      id: 'aging-tasks',
      title: 'Review Aging Tasks',
      description: `${oldTasks.length} tasks have been pending for over 10 days. Long task durations can create bottlenecks in the student lifecycle. Review these tasks to identify blockers or reassignment needs.`,
      priority: 'medium' as const,
      category: 'Workflow Optimization'
    });
  }

  const proposalReviews = myTasks.filter(t => t.taskType.includes("Proposal") && t.status !== "Completed");
  if (proposalReviews.length >= 2) {
    recommendedActions.push({
      id: 'proposal-reviews',
      title: 'Coordinate Proposal Review Schedule',
      description: `${proposalReviews.length} proposal reviews are pending. Consider batch-reviewing similar proposals or coordinating with panel members to accelerate the review process.`,
      priority: 'medium' as const,
      category: 'Academic Review'
    });
  }

  const TaskTable = ({ tasks }: { tasks: typeof mockTasks }) => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student</TableHead>
            <TableHead>Task</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Age</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filterTasks(tasks).length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                No tasks found
              </TableCell>
            </TableRow>
          ) : (
            filterTasks(tasks).map(task => (
              <TableRow key={task.id} className="hover:bg-accent/50">
                <TableCell>
                  <div>
                    <p className="font-medium text-foreground">{task.studentName}</p>
                    <p className="text-xs text-muted-foreground">{task.program}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="text-sm font-medium">{task.taskType}</p>
                    <p className="text-xs text-muted-foreground">{task.description}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">{task.stage}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(task.status)}
                    <span className="text-sm">{task.status}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={getPriorityBadge(task.priority)} className="text-xs">
                    {task.priority}
                  </Badge>
                </TableCell>
                <TableCell>
                  <p className="text-sm">{task.dueDate}</p>
                </TableCell>
                <TableCell>
                  <p className="text-sm">{task.age} days</p>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/students/${task.studentId}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                    {task.status !== "Completed" && task.assignedTo === user?.name && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" onClick={() => setSelectedTask(task.id)}>
                            Decide
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Task Decision</DialogTitle>
                            <DialogDescription>
                              Make a decision on this task for {task.studentName}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label>Task</Label>
                              <p className="text-sm text-muted-foreground">{task.taskType}: {task.description}</p>
                            </div>
                            {task.recommendedAction && (
                              <div className="p-3 bg-accent rounded-lg">
                                <Label className="text-xs">Recommended Action</Label>
                                <p className="text-sm text-muted-foreground mt-1">{task.recommendedAction}</p>
                              </div>
                            )}
                            <div className="space-y-2">
                              <Label htmlFor="notes">Decision Notes</Label>
                              <Textarea
                                id="notes"
                                placeholder="Enter your feedback or comments..."
                                value={decisionNotes}
                                onChange={(e) => setDecisionNotes(e.target.value)}
                                rows={4}
                              />
                            </div>
                          </div>
                          <DialogFooter className="flex-col sm:flex-row gap-2">
                            <Button
                              variant="default"
                              onClick={() => handleDecision(task.id, "Approve")}
                              className="bg-success hover:bg-success/90"
                            >
                              <CheckCheck className="h-4 w-4 mr-2" />
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => handleDecision(task.id, "Revise")}
                            >
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Request Revision
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={() => handleDecision(task.id, "Return")}
                            >
                              <X className="h-4 w-4 mr-2" />
                              Return
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-semibold text-foreground">Task Queue</h1>
        <p className="text-muted-foreground mt-1">
          Manage workflow tasks and make decisions
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="Overdue">Overdue</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">My Tasks</p>
            <p className="text-2xl font-semibold text-foreground mt-1">{myTasks.filter(t => t.status !== "Completed").length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Overdue</p>
            <p className="text-2xl font-semibold text-destructive mt-1">
              {myTasks.filter(t => t.status === "Overdue").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">High Priority</p>
            <p className="text-2xl font-semibold text-warning mt-1">
              {myTasks.filter(t => t.priority === "High" && t.status !== "Completed").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Completed</p>
            <p className="text-2xl font-semibold text-success mt-1">
              {myTasks.filter(t => t.status === "Completed").length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Task Tabs */}
      <Tabs defaultValue="my-tasks" className="space-y-4">
        <TabsList>
          <TabsTrigger value="my-tasks">My Tasks ({myTasks.length})</TabsTrigger>
          <TabsTrigger value="team-queue">Team Queue ({teamTasks.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="my-tasks">
          <Card>
            <CardHeader>
              <CardTitle>My Tasks</CardTitle>
              <CardDescription>Tasks assigned directly to you</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <TaskTable tasks={myTasks} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team-queue">
          <Card>
            <CardHeader>
              <CardTitle>Team Queue</CardTitle>
              <CardDescription>All tasks for your role</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <TaskTable tasks={teamTasks} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Recommended Actions */}
      <RecommendedActions actions={recommendedActions} />
    </div>
  );
}