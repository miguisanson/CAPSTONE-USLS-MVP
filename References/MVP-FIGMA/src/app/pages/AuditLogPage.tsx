import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { mockAuditLog } from "../data/mockData";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Search, Filter } from "lucide-react";

export function AuditLogPage() {
  const { hasAccess } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  if (!hasAccess(["Admin", "Graduate School Staff", "Academic Coordinator", "Research Coordinator"])) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-destructive font-medium">Access Denied</p>
            <p className="text-muted-foreground mt-2">
              You do not have permission to access audit logs
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const filteredLogs = mockAuditLog.filter(log => {
    const matchesSearch = 
      log.actor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.entity.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesAction = actionFilter === "all" || log.action === actionFilter;
    const matchesRole = roleFilter === "all" || log.role === roleFilter;

    return matchesSearch && matchesAction && matchesRole;
  });

  const getActionBadgeVariant = (action: string) => {
    switch (action) {
      case "Login":
      case "View":
        return "secondary";
      case "Create":
      case "Upload":
        return "default";
      case "Update":
      case "Decision":
        return "outline";
      case "Delete":
      case "Access Denied":
        return "destructive";
      case "Config Change":
        return "default";
      case "Alert Triggered":
        return "destructive";
      default:
        return "outline";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground">Audit Log</h1>
        <p className="text-muted-foreground mt-1">
          Comprehensive activity tracking and compliance logging
        </p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="Login">Login</SelectItem>
                <SelectItem value="View">View</SelectItem>
                <SelectItem value="Create">Create</SelectItem>
                <SelectItem value="Update">Update</SelectItem>
                <SelectItem value="Delete">Delete</SelectItem>
                <SelectItem value="Upload">Upload</SelectItem>
                <SelectItem value="Decision">Decision</SelectItem>
                <SelectItem value="Config Change">Config Change</SelectItem>
                <SelectItem value="Access Denied">Access Denied</SelectItem>
                <SelectItem value="Alert Triggered">Alert Triggered</SelectItem>
              </SelectContent>
            </Select>

            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="Admin">Admin</SelectItem>
                <SelectItem value="Graduate School Staff">Graduate School Staff</SelectItem>
                <SelectItem value="Adviser">Adviser</SelectItem>
                <SelectItem value="Student">Student</SelectItem>
                <SelectItem value="System">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
          <CardDescription>
            Append-only record of all system actions ({filteredLogs.length} entries)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      No audit log entries found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-accent/50">
                      <TableCell className="text-sm font-mono whitespace-nowrap">
                        {log.timestamp}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">{log.actor}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {log.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getActionBadgeVariant(log.action)} className="text-xs">
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{log.entity}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-muted-foreground max-w-md">
                          {log.description}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className="text-xs font-mono text-muted-foreground">
                          {log.ipAddress || "-"}
                        </p>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-accent/30 border-primary/20">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            <strong>Compliance Note:</strong> This audit log is append-only and cannot be modified or deleted. 
            All user actions, access attempts, and system events are automatically recorded for accountability, 
            security monitoring, and regulatory compliance purposes.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
