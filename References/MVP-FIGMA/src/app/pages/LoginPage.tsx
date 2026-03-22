import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth, UserRole } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";

export function LoginPage() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [email, setEmail] = useState("maria.santos@usls.edu.ph");
  const [password, setPassword] = useState("password");
  const [selectedRole, setSelectedRole] = useState<UserRole>("Graduate School Staff");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Mock user based on selected role
    const mockUser = {
      id: "1",
      name: getRoleName(selectedRole),
      email: email,
      role: selectedRole,
    };

    setUser(mockUser);
    navigate("/");
  };

  const getRoleName = (role: UserRole): string => {
    const names: Record<UserRole, string> = {
      "Admin": "System Administrator",
      "Graduate School Staff": "Dr. Maria Santos",
      "Academic Coordinator": "Dr. Roberto Cruz",
      "Research Coordinator": "Dr. Elena Rodriguez",
      "Adviser": "Dr. Patricia Cruz",
      "Panel Member": "Dr. Robert Tan",
      "Student": "Juan Carlos Reyes",
    };
    return names[role];
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid md:grid-cols-2 gap-8 items-center">
        {/* Left side - Branding */}
        <div className="hidden md:block">
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-2xl">USLS</span>
              </div>
              <div>
                <h1 className="text-3xl font-semibold text-foreground">Graduate School Portal</h1>
                <p className="text-muted-foreground">University of St. La Salle</p>
              </div>
            </div>
            <div className="space-y-4 pt-8">
              <h2 className="text-xl font-medium text-foreground">
                Graduate Student Lifecycle Monitoring and Analytics Platform
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                A comprehensive system for tracking graduate students across the academic and research lifecycle.
                Monitor stage progression, milestones, task ownership, and analytics to support operational
                decision-making for graduate school staff, coordinators, advisers, and panel members.
              </p>
              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="p-4 bg-card border border-border rounded-lg">
                  <p className="text-sm text-muted-foreground">Student Monitoring</p>
                  <p className="text-2xl font-semibold text-primary mt-1">125</p>
                </div>
                <div className="p-4 bg-card border border-border rounded-lg">
                  <p className="text-sm text-muted-foreground">Active Programs</p>
                  <p className="text-2xl font-semibold text-primary mt-1">4</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Login Form */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>
              Enter your credentials to access the Graduate School Portal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@usls.edu.ph"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Sign in as (Demo)</Label>
                <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as UserRole)}>
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Admin">Admin</SelectItem>
                    <SelectItem value="Graduate School Staff">Graduate School Staff</SelectItem>
                    <SelectItem value="Academic Coordinator">Academic Coordinator</SelectItem>
                    <SelectItem value="Research Coordinator">Research Coordinator</SelectItem>
                    <SelectItem value="Adviser">Adviser</SelectItem>
                    <SelectItem value="Panel Member">Panel Member</SelectItem>
                    <SelectItem value="Student">Student</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Select a role to view the portal from different perspectives
                </p>
              </div>

              <Button type="submit" className="w-full bg-primary hover:bg-primary-hover">
                Sign In
              </Button>

              <div className="text-center space-y-2 pt-4">
                <a href="#" className="text-sm text-primary hover:underline block">
                  Forgot password?
                </a>
                <p className="text-xs text-muted-foreground">
                  For support, contact the Graduate School Office
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
