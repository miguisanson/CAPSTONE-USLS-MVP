import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Settings, Clock, Route, AlertTriangle, Users, Plus, Edit, Trash2 } from "lucide-react";

export function AdminConfigPage() {
  const { user, hasAccess } = useAuth();

  if (!hasAccess(["Admin"])) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-destructive font-medium">Access Denied</p>
            <p className="text-muted-foreground mt-2">
              Only Administrators can access configuration settings
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground">Admin Configuration</h1>
        <p className="text-muted-foreground mt-1">
          System settings, thresholds, and user management
        </p>
      </div>

      <Tabs defaultValue="thresholds" className="space-y-6">
        <TabsList>
          <TabsTrigger value="thresholds">Alert Thresholds</TabsTrigger>
          <TabsTrigger value="routing">Routing Rules</TabsTrigger>
          <TabsTrigger value="milestones">Milestone Definitions</TabsTrigger>
          <TabsTrigger value="users">User Management</TabsTrigger>
        </TabsList>

        {/* Alert Thresholds */}
        <TabsContent value="thresholds">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <CardTitle>Alert Thresholds</CardTitle>
              </div>
              <CardDescription>Configure monitoring alert triggers and escalation rules</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="task-escalation">Task Escalation Days</Label>
                    <Input id="task-escalation" type="number" defaultValue="7" />
                    <p className="text-xs text-muted-foreground">
                      Days before overdue tasks are escalated
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="unresolved-handoff">Unresolved Handoff Days</Label>
                    <Input id="unresolved-handoff" type="number" defaultValue="5" />
                    <p className="text-xs text-muted-foreground">
                      Days to trigger unresolved handoff alert
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="delayed-scheduling">Delayed Scheduling Days</Label>
                    <Input id="delayed-scheduling" type="number" defaultValue="10" />
                    <p className="text-xs text-muted-foreground">
                      Days to trigger delayed scheduling alert
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="inactivity">Inactivity Days</Label>
                    <Input id="inactivity" type="number" defaultValue="14" />
                    <p className="text-xs text-muted-foreground">
                      Days of no activity before alert
                    </p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium mb-4">Stage Duration Thresholds (Days)</h4>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="proposal-dev">Proposal Development</Label>
                      <Input id="proposal-dev" type="number" defaultValue="50" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="data-collection">Data Collection</Label>
                      <Input id="data-collection" type="number" defaultValue="75" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dissertation">Dissertation Writing</Label>
                      <Input id="dissertation" type="number" defaultValue="45" />
                    </div>
                  </div>
                </div>

                <Button className="w-full md:w-auto">Save Threshold Configuration</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Routing Rules */}
        <TabsContent value="routing">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Route className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle>Decision Routing Rules</CardTitle>
                    <CardDescription>Define next owner based on stage and decision</CardDescription>
                  </div>
                </div>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Rule
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Stage</TableHead>
                    <TableHead>Decision</TableHead>
                    <TableHead>Next Owner</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>
                      <Badge variant="outline">Proposal Development</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">Revise</Badge>
                    </TableCell>
                    <TableCell>Student</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <Badge variant="outline">Proposal Defense</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive">Return</Badge>
                    </TableCell>
                    <TableCell>Adviser</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <Badge variant="outline">Dissertation Writing</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">Revise</Badge>
                    </TableCell>
                    <TableCell>Student</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Milestone Definitions */}
        <TabsContent value="milestones">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle>Milestone Definitions</CardTitle>
                    <CardDescription>Manage lifecycle stage milestones</CardDescription>
                  </div>
                </div>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Milestone
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border border-border rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium">Admission Documents Complete</p>
                      <p className="text-sm text-muted-foreground mt-1">Stage: Admission</p>
                      <p className="text-sm text-muted-foreground">Required for all students</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="p-4 border border-border rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium">Proposal Draft Submitted</p>
                      <p className="text-sm text-muted-foreground mt-1">Stage: Proposal Development</p>
                      <p className="text-sm text-muted-foreground">Required for thesis/dissertation students</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="p-4 border border-border rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium">Data Collection Ethics Clearance</p>
                      <p className="text-sm text-muted-foreground mt-1">Stage: Data Collection</p>
                      <p className="text-sm text-muted-foreground">Required before data gathering begins</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* User Management */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle>User Management</CardTitle>
                    <CardDescription>Manage system users and role assignments</CardDescription>
                  </div>
                </div>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add User
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Dr. Maria Santos</TableCell>
                    <TableCell>maria.santos@usls.edu.ph</TableCell>
                    <TableCell>
                      <Badge variant="default">Graduate School Staff</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-success">Active</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Dr. Patricia Cruz</TableCell>
                    <TableCell>patricia.cruz@usls.edu.ph</TableCell>
                    <TableCell>
                      <Badge variant="default">Adviser</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-success">Active</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Dr. Robert Tan</TableCell>
                    <TableCell>robert.tan@usls.edu.ph</TableCell>
                    <TableCell>
                      <Badge variant="default">Panel Member</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-success">Active</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
