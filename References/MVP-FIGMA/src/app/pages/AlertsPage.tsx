import { useState } from "react";
import { Link } from "react-router";
import { mockAlerts, AlertType } from "../data/mockData";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { AlertTriangle, Clock, TrendingUp, Calendar as CalendarIcon, Zap, Play, Eye } from "lucide-react";
import { RecommendedActions } from "../components/QuickInsights";

const alertIcons: Record<AlertType, any> = {
  "Prolonged Stage": Clock,
  "Unresolved Handoff": TrendingUp,
  "Delayed Scheduling": CalendarIcon,
  "Inactivity": Zap,
};

const alertColors: Record<AlertType, string> = {
  "Prolonged Stage": "text-warning",
  "Unresolved Handoff": "text-destructive",
  "Delayed Scheduling": "text-warning",
  "Inactivity": "text-muted-foreground",
};

export function AlertsPage() {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [interventionNote, setInterventionNote] = useState("");

  const filteredAlerts = mockAlerts.filter(alert => {
    const matchesType = typeFilter === "all" || alert.alertType === typeFilter;
    const matchesStatus = statusFilter === "all" || alert.status === statusFilter;
    return matchesType && matchesStatus;
  });

  const handleRunMonitoring = () => {
    console.log("Running monitoring cycle...");
  };

  const handleIntervention = (alertId: string) => {
    console.log("Recording intervention for alert:", alertId, "Note:", interventionNote);
    setInterventionNote("");
  };

  // Generate Recommended Actions
  const recommendedActions = [];
  
  const openAlerts = filteredAlerts.filter(a => a.status === "Open");
  if (openAlerts.length > 0) {
    recommendedActions.push({
      id: 'address-open-alerts',
      title: 'Address Open Alerts Immediately',
      description: `${openAlerts.length} alert${openAlerts.length > 1 ? 's are' : ' is'} still open and unaddressed. Review these cases and assign handlers or record initial interventions to prevent further student progression delays.`,
      priority: 'high' as const,
      category: 'Alert Resolution'
    });
  }

  const prolongedStageAlerts = filteredAlerts.filter(a => a.alertType === "Prolonged Stage" && a.status !== "Resolved");
  if (prolongedStageAlerts.length > 0) {
    recommendedActions.push({
      id: 'prolonged-stage-intervention',
      title: 'Intervene in Prolonged Stage Cases',
      description: `${prolongedStageAlerts.length} student${prolongedStageAlerts.length > 1 ? 's are' : ' is'} experiencing prolonged lifecycle stages. Schedule one-on-one meetings with advisers to identify blockers such as data access, methodology issues, or resource limitations.`,
      priority: 'high' as const,
      category: 'Student Support'
    });
  }

  const inactivityAlerts = filteredAlerts.filter(a => a.alertType === "Inactivity" && a.status !== "Resolved");
  if (inactivityAlerts.length > 0) {
    recommendedActions.push({
      id: 'address-inactivity',
      title: 'Follow Up on Inactive Students',
      description: `${inactivityAlerts.length} student${inactivityAlerts.length > 1 ? 's have' : ' has'} shown prolonged inactivity. Send personalized check-in messages to identify potential personal, financial, or academic challenges that may require institutional support.`,
      priority: 'medium' as const,
      category: 'Student Engagement'
    });
  }

  const agingAlerts = filteredAlerts.filter(a => a.age > 14 && a.status === "In Progress");
  if (agingAlerts.length > 0) {
    recommendedActions.push({
      id: 'aging-interventions',
      title: 'Escalate Aging In-Progress Alerts',
      description: `${agingAlerts.length} alert${agingAlerts.length > 1 ? 's have' : ' has'} been in progress for over 14 days without resolution. Review intervention effectiveness and consider escalating to academic coordinators or Graduate School Dean.`,
      priority: 'medium' as const,
      category: 'Escalation Management'
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Monitoring Alerts</h1>
          <p className="text-muted-foreground mt-1">
            System-generated alerts requiring intervention
          </p>
        </div>
        <Button onClick={handleRunMonitoring} className="gap-2">
          <Play className="h-4 w-4" />
          Run Monitoring Cycle
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Alerts</p>
            <p className="text-2xl font-semibold text-foreground mt-1">{mockAlerts.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Open</p>
            <p className="text-2xl font-semibold text-destructive mt-1">
              {mockAlerts.filter(a => a.status === "Open").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">In Progress</p>
            <p className="text-2xl font-semibold text-warning mt-1">
              {mockAlerts.filter(a => a.status === "In Progress").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Resolved</p>
            <p className="text-2xl font-semibold text-success mt-1">
              {mockAlerts.filter(a => a.status === "Resolved").length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Alert Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Alert Types</SelectItem>
                <SelectItem value="Prolonged Stage">Prolonged Stage</SelectItem>
                <SelectItem value="Unresolved Handoff">Unresolved Handoff</SelectItem>
                <SelectItem value="Delayed Scheduling">Delayed Scheduling</SelectItem>
                <SelectItem value="Inactivity">Inactivity</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Open">Open</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="Resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {filteredAlerts.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              No alerts found matching your criteria
            </CardContent>
          </Card>
        ) : (
          filteredAlerts.map(alert => {
            const Icon = alertIcons[alert.alertType];
            const iconColor = alertColors[alert.alertType];

            return (
              <Card key={alert.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg bg-background border border-border ${iconColor}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{alert.studentName}</CardTitle>
                        <CardDescription>{alert.program}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        alert.status === "Resolved" ? "default" :
                        alert.status === "In Progress" ? "secondary" :
                        "destructive"
                      }>
                        {alert.status}
                      </Badge>
                      <Badge variant="outline">{alert.alertType}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Triggered Date</p>
                      <p className="font-medium">{alert.triggeredDate}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Alert Age</p>
                      <p className="font-medium">{alert.age} days</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Assigned Handler</p>
                      <p className="font-medium">{alert.assignedHandler}</p>
                    </div>
                  </div>

                  {alert.interventions.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-3">Interventions ({alert.interventions.length})</h4>
                      <div className="space-y-2">
                        {alert.interventions.map(intervention => (
                          <div key={intervention.id} className="p-3 bg-accent rounded-lg">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{intervention.action}</p>
                              <Badge variant="outline" className="text-xs">{intervention.performedBy}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{intervention.notes}</p>
                            <p className="text-xs text-muted-foreground mt-1">{intervention.date}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {alert.closureEvidence && (
                    <div className="p-3 bg-success/10 border border-success/20 rounded-lg">
                      <Label className="text-sm font-medium text-success">Closure Evidence</Label>
                      <p className="text-sm text-muted-foreground mt-1">{alert.closureEvidence}</p>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/students/${alert.studentId}`}>
                        <Eye className="h-4 w-4 mr-2" />
                        View Student
                      </Link>
                    </Button>
                    {alert.status !== "Resolved" && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="default" size="sm">
                            Record Intervention
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Record Intervention</DialogTitle>
                            <DialogDescription>
                              Document intervention actions for {alert.studentName}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="p-3 bg-accent rounded-lg">
                              <p className="text-sm"><strong>Alert:</strong> {alert.alertType}</p>
                              <p className="text-sm mt-1"><strong>Student:</strong> {alert.studentName}</p>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="intervention">Intervention Notes</Label>
                              <Textarea
                                id="intervention"
                                placeholder="Describe the intervention action taken..."
                                value={interventionNote}
                                onChange={(e) => setInterventionNote(e.target.value)}
                                rows={4}
                              />
                            </div>
                            <Button 
                              className="w-full" 
                              onClick={() => handleIntervention(alert.id)}
                            >
                              Save Intervention
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                    {alert.status === "In Progress" && (
                      <Button variant="outline" size="sm">
                        Mark as Resolved
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <RecommendedActions actions={recommendedActions} />
    </div>
  );
}