import { useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { mockStudents, programs, lifecycleStages, LifecycleStage } from "../data/mockData";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Search, Filter, Download, AlertCircle, Eye } from "lucide-react";
import { RecommendedActions } from "../components/QuickInsights";

export function StudentsPage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [programFilter, setProgramFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");

  // Filter students based on criteria
  const filteredStudents = mockStudents.filter(student => {
    // If user is a student, only show their own record
    if (user?.role === "Student") {
      return student.email === user.email;
    }

    const matchesSearch = 
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.studentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.program.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStage = stageFilter === "all" || student.currentStage === stageFilter;
    const matchesProgram = programFilter === "all" || student.program === programFilter;
    const matchesRisk = riskFilter === "all" || 
      (riskFilter === "at-risk" && student.riskFlag) ||
      (riskFilter === "on-track" && !student.riskFlag);

    return matchesSearch && matchesStage && matchesProgram && matchesRisk;
  });

  const getStageColor = (stage: LifecycleStage) => {
    const colors: Record<LifecycleStage, string> = {
      "Admission": "bg-blue-100 text-blue-800",
      "Coursework": "bg-cyan-100 text-cyan-800",
      "Proposal Development": "bg-purple-100 text-purple-800",
      "Proposal Defense": "bg-indigo-100 text-indigo-800",
      "Data Collection": "bg-yellow-100 text-yellow-800",
      "Dissertation Writing": "bg-orange-100 text-orange-800",
      "Oral Defense": "bg-pink-100 text-pink-800",
      "LOA": "bg-gray-100 text-gray-800",
      "Completed": "bg-green-100 text-green-800",
    };
    return colors[stage] || "bg-gray-100 text-gray-800";
  };

  // Generate Recommended Actions
  const recommendedActions = [];
  
  if (user?.role !== "Student") {
    const atRiskStudents = filteredStudents.filter(s => s.riskFlag);
    if (atRiskStudents.length > 0) {
      recommendedActions.push({
        id: 'review-at-risk',
        title: 'Conduct At-Risk Student Case Reviews',
        description: `${atRiskStudents.length} student${atRiskStudents.length > 1 ? 's are' : ' is'} flagged as at-risk. Review individual profiles to identify common blockers such as prolonged stage duration, adviser availability, or milestone delays.`,
        priority: 'high' as const,
        category: 'Student Monitoring'
      });
    }

    const dataCollectionStudents = filteredStudents.filter(s => s.currentStage === "Data Collection");
    if (dataCollectionStudents.length >= 3) {
      recommendedActions.push({
        id: 'data-collection-support',
        title: 'Provide Data Collection Stage Support',
        description: `${dataCollectionStudents.length} students are currently in Data Collection. This stage often requires extended timelines. Consider scheduling group workshops on research methodology or data analysis tools.`,
        priority: 'medium' as const,
        category: 'Academic Support'
      });
    }

    const dissertationStudents = filteredStudents.filter(s => s.currentStage === "Dissertation Writing");
    if (dissertationStudents.length >= 2) {
      recommendedActions.push({
        id: 'dissertation-writing-support',
        title: 'Monitor Dissertation Writing Progress',
        description: `${dissertationStudents.length} students are in Dissertation Writing. Schedule progress check-ins with advisers to ensure steady advancement and identify any writing or formatting blockers.`,
        priority: 'medium' as const,
        category: 'Academic Support'
      });
    }

    if (filteredStudents.length > 50) {
      recommendedActions.push({
        id: 'high-enrollment',
        title: 'Assess Resource Allocation for High Enrollment',
        description: `Student enrollment is high (${filteredStudents.length} active students). Review adviser caseloads and administrative support capacity to ensure adequate support resources.`,
        priority: 'low' as const,
        category: 'Resource Planning'
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">
            {user?.role === "Student" ? "My Profile" : "Students"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {user?.role === "Student" 
              ? "View your academic progress and milestones"
              : `Monitoring ${filteredStudents.length} graduate students across all programs`
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      {user?.role !== "Student" && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="lg:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, ID, or program..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Stages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stages</SelectItem>
                  {lifecycleStages.map(stage => (
                    <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={programFilter} onValueChange={setProgramFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Programs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Programs</SelectItem>
                  {programs.map(program => (
                    <SelectItem key={program} value={program}>{program}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={riskFilter} onValueChange={setRiskFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Students" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Students</SelectItem>
                  <SelectItem value="at-risk">At-Risk Only</SelectItem>
                  <SelectItem value="on-track">On-Track Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Students Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Current Stage</TableHead>
                  <TableHead>Risk Status</TableHead>
                  <TableHead>Adviser</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      No students found matching your criteria
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStudents.map((student) => (
                    <TableRow key={student.id} className="hover:bg-accent/50">
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{student.name}</p>
                          <p className="text-sm text-muted-foreground">{student.studentId}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{student.program}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getStageColor(student.currentStage)}>
                          {student.currentStage}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {student.riskFlag ? (
                          <div className="flex items-center gap-1 text-destructive">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-sm font-medium">At-Risk</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">On-Track</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{student.adviser}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-muted-foreground">{student.lastUpdated}</p>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/students/${student.id}`}>
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      {user?.role !== "Student" && filteredStudents.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total Students</p>
              <p className="text-2xl font-semibold text-foreground mt-1">{filteredStudents.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">At-Risk</p>
              <p className="text-2xl font-semibold text-destructive mt-1">
                {filteredStudents.filter(s => s.riskFlag).length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">On-Track</p>
              <p className="text-2xl font-semibold text-success mt-1">
                {filteredStudents.filter(s => !s.riskFlag).length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Active Programs</p>
              <p className="text-2xl font-semibold text-foreground mt-1">
                {new Set(filteredStudents.map(s => s.program)).size}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recommended Actions */}
      {user?.role !== "Student" && filteredStudents.length > 0 && (
        <RecommendedActions 
          actions={recommendedActions}
          context="Based on student enrollment data, risk flags, lifecycle stage distribution, and program demographics"
        />
      )}
    </div>
  );
}