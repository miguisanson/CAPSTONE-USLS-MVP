import { useState } from "react";
import { mockDocuments } from "../data/mockData";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Textarea } from "../components/ui/textarea";
import { FileText, Download, Upload, MessageSquare, Search } from "lucide-react";
import { RecommendedActions } from "../components/QuickInsights";

export function DocumentsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [comment, setComment] = useState("");

  const filteredDocuments = mockDocuments.filter(doc =>
    doc.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.checklistItem.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.fileName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Generate Recommended Actions
  const recommendedActions = [];
  
  const revisionRequested = filteredDocuments.filter(d => d.status === "Revision Requested");
  if (revisionRequested.length > 0) {
    recommendedActions.push({
      id: 'follow-up-revisions',
      title: 'Follow Up on Revision Requests',
      description: `${revisionRequested.length} document${revisionRequested.length > 1 ? 's have' : ' has'} revision requests pending. Contact students to confirm they have received and understood the feedback, and set resubmission deadlines.`,
      priority: 'high' as const,
      category: 'Document Review'
    });
  }

  const pendingReview = filteredDocuments.filter(d => d.status === "Under Review");
  if (pendingReview.length >= 3) {
    recommendedActions.push({
      id: 'expedite-reviews',
      title: 'Expedite Document Reviews',
      description: `${pendingReview.length} documents are awaiting review. Long review times can delay student progression. Consider scheduling dedicated review sessions to clear the backlog.`,
      priority: 'high' as const,
      category: 'Document Review'
    });
  }

  const multipleVersions = filteredDocuments.filter(d => d.version > 2);
  if (multipleVersions.length >= 2) {
    recommendedActions.push({
      id: 'version-control-review',
      title: 'Review Multiple-Revision Documents',
      description: `${multipleVersions.length} documents have undergone multiple revisions (v3+). Review feedback clarity to ensure students understand revision requirements and reduce unnecessary resubmissions.`,
      priority: 'medium' as const,
      category: 'Process Improvement'
    });
  }

  const approvedRecent = filteredDocuments.filter(d => d.status === "Approved");
  if (approvedRecent.length >= 5) {
    recommendedActions.push({
      id: 'milestone-completion-tracking',
      title: 'Track Milestone Completion',
      description: `${approvedRecent.length} documents have been approved. Ensure these approvals trigger next-stage progression in the student lifecycle workflow to avoid delays.`,
      priority: 'low' as const,
      category: 'Workflow Automation'
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Documents</h1>
          <p className="text-muted-foreground mt-1">
            Document management and revision tracking
          </p>
        </div>
        <Button className="gap-2">
          <Upload className="h-4 w-4" />
          Upload Document
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Document Repository</CardTitle>
          <CardDescription>All submitted documents with version control</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Document Type</TableHead>
                  <TableHead>File Name</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Upload Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      No documents found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDocuments.map(doc => (
                    <TableRow key={doc.id} className="hover:bg-accent/50">
                      <TableCell>
                        <p className="font-medium text-foreground">{doc.studentName}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{doc.checklistItem}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" />
                          <p className="text-sm">{doc.fileName}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">v{doc.version}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          doc.status === "Approved" ? "default" :
                          doc.status === "Revision Requested" ? "destructive" :
                          "secondary"
                        }>
                          {doc.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-muted-foreground">{doc.uploadedDate}</p>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm">
                            <Download className="h-4 w-4" />
                          </Button>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MessageSquare className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Document Details</DialogTitle>
                                <DialogDescription>
                                  {doc.fileName} - {doc.studentName}
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                {doc.revisionNotes && (
                                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                                    <Label className="text-sm font-medium text-destructive">Revision Notes</Label>
                                    <p className="text-sm text-muted-foreground mt-1">{doc.revisionNotes}</p>
                                  </div>
                                )}
                                <div className="space-y-3">
                                  <Label>Comments ({doc.comments.length})</Label>
                                  {doc.comments.map(c => (
                                    <div key={c.id} className="p-3 bg-accent rounded-lg">
                                      <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium">{c.author}</p>
                                        <Badge variant="outline" className="text-xs">{c.role}</Badge>
                                      </div>
                                      <p className="text-sm text-muted-foreground mt-1">{c.comment}</p>
                                      <p className="text-xs text-muted-foreground mt-1">{c.date}</p>
                                    </div>
                                  ))}
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="new-comment">Add Comment</Label>
                                  <Textarea
                                    id="new-comment"
                                    placeholder="Enter your comment..."
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    rows={3}
                                  />
                                  <Button className="w-full">Post Comment</Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <RecommendedActions actions={recommendedActions} />
    </div>
  );
}