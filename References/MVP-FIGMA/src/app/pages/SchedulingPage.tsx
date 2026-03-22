import { mockScheduling } from "../data/mockData";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Calendar, Users, MapPin, Clock, CheckCircle2 } from "lucide-react";
import { RecommendedActions } from "../components/QuickInsights";

export function SchedulingPage() {
  // Generate Recommended Actions
  const recommendedActions = [];
  
  const pendingSchedules = mockScheduling.filter(s => s.status === "Pending Availability");
  if (pendingSchedules.length > 0) {
    recommendedActions.push({
      id: 'collect-availability',
      title: 'Collect Panel Member Availability',
      description: `${pendingSchedules.length} defense${pendingSchedules.length > 1 ? 'es are' : ' is'} pending availability confirmation. Send automated availability requests to panel members to expedite scheduling and avoid student delays.`,
      priority: 'high' as const,
      category: 'Scheduling Coordination'
    });
  }

  const confirmedThisMonth = mockScheduling.filter(s => s.status === "Confirmed");
  if (confirmedThisMonth.length >= 3) {
    recommendedActions.push({
      id: 'venue-coordination',
      title: 'Coordinate Venue Resources',
      description: `${confirmedThisMonth.length} defenses are confirmed this month. Verify venue availability, technical equipment (projector, microphone), and administrative support for each scheduled defense.`,
      priority: 'medium' as const,
      category: 'Resource Planning'
    });
  }

  const incompleteAvailability = mockScheduling.filter(s => 
    s.participants.some(p => p.availability.length === 0) && s.status === "Pending Availability"
  );
  if (incompleteAvailability.length > 0) {
    recommendedActions.push({
      id: 'incomplete-responses',
      title: 'Follow Up on Missing Availability Responses',
      description: `${incompleteAvailability.length} defense schedule${incompleteAvailability.length > 1 ? 's have' : ' has'} panel members who have not submitted availability. Send reminder notifications to complete the scheduling process.`,
      priority: 'medium' as const,
      category: 'Scheduling Coordination'
    });
  }

  const rescheduled = mockScheduling.filter(s => s.status === "Rescheduled");
  if (rescheduled.length > 0) {
    recommendedActions.push({
      id: 'rescheduling-review',
      title: 'Review Rescheduling Patterns',
      description: `${rescheduled.length} defense${rescheduled.length > 1 ? 's have' : ' has'} been rescheduled. Analyze rescheduling reasons to identify systemic issues such as inadequate lead time or venue conflicts.`,
      priority: 'low' as const,
      category: 'Process Improvement'
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground">Defense Scheduling</h1>
        <p className="text-muted-foreground mt-1">
          Coordinate proposal and oral defense schedules
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Requests</p>
            <p className="text-2xl font-semibold text-foreground mt-1">{mockScheduling.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="text-2xl font-semibold text-warning mt-1">
              {mockScheduling.filter(s => s.status === "Pending Availability").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Confirmed</p>
            <p className="text-2xl font-semibold text-success mt-1">
              {mockScheduling.filter(s => s.status === "Confirmed").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">This Month</p>
            <p className="text-2xl font-semibold text-primary mt-1">
              {mockScheduling.filter(s => s.status === "Confirmed").length}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {mockScheduling.map(schedule => (
          <Card key={schedule.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{schedule.studentName}</CardTitle>
                  <CardDescription>{schedule.defenseType}</CardDescription>
                </div>
                <Badge variant={
                  schedule.status === "Confirmed" ? "default" :
                  schedule.status === "Rescheduled" ? "secondary" :
                  schedule.status === "Cancelled" ? "destructive" :
                  "outline"
                }>
                  {schedule.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {schedule.status === "Confirmed" && (
                <div className="grid md:grid-cols-3 gap-4 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Date</p>
                      <p className="text-sm font-medium">{schedule.confirmedDate}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Time</p>
                      <p className="text-sm font-medium">{schedule.confirmedTime}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Venue</p>
                      <p className="text-sm font-medium">{schedule.venue}</p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Participants & Availability
                </h4>
                <div className="grid md:grid-cols-2 gap-3">
                  {schedule.participants.map((participant, index) => (
                    <div key={index} className="p-3 border border-border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{participant.name}</p>
                          <p className="text-xs text-muted-foreground">{participant.role}</p>
                        </div>
                        {participant.availability.length > 0 && (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        )}
                      </div>
                      {participant.availability.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {participant.availability.map((date, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {date}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {schedule.history.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-3">Activity History</h4>
                  <div className="space-y-2">
                    {schedule.history.map((event, index) => (
                      <div key={index} className="flex gap-3 text-sm">
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <div className="h-2 w-2 rounded-full bg-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{event.action}</p>
                          <p className="text-muted-foreground text-xs">
                            {event.performedBy} • {event.date}
                          </p>
                          {event.notes && (
                            <p className="text-muted-foreground text-xs mt-1">{event.notes}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                {schedule.status === "Pending Availability" && (
                  <>
                    <Button variant="outline" size="sm">Collect Availability</Button>
                    <Button variant="default" size="sm">Confirm Schedule</Button>
                  </>
                )}
                {schedule.status === "Confirmed" && (
                  <>
                    <Button variant="outline" size="sm">Reschedule</Button>
                    <Button variant="destructive" size="sm">Cancel</Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6">
        <RecommendedActions actions={recommendedActions} />
      </div>
    </div>
  );
}