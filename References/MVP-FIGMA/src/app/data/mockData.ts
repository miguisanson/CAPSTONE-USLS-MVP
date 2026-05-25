export type LifecycleStage = 
  | "Admission"
  | "Coursework"
  | "Proposal Development"
  | "Proposal Defense"
  | "Data Collection"
  | "Dissertation Writing"
  | "Oral Defense"
  | "LOA"
  | "Completed";

export type AlertType = 
  | "Prolonged Stage"
  | "Unresolved Handoff"
  | "Delayed Scheduling"
  | "Inactivity";

export type TaskDecision = "Approve" | "Revise" | "Return";

export type TaskStatus = "Pending" | "In Progress" | "Completed" | "Overdue";

export interface Student {
  id: string;
  name: string;
  studentId: string;
  program: string;
  currentStage: LifecycleStage;
  riskFlag: boolean;
  adviser: string;
  panelMembers: string[];
  enrollmentDate: string;
  lastUpdated: string;
  email: string;
  milestones: Milestone[];
  timeline: TimelineEvent[];
}

export interface Milestone {
  id: string;
  name: string;
  stage: LifecycleStage;
  status: "Completed" | "Pending" | "In Progress";
  completedDate?: string;
  dueDate?: string;
}

export interface TimelineEvent {
  id: string;
  date: string;
  action: string;
  actor: string;
  description: string;
}

export interface Task {
  id: string;
  studentId: string;
  studentName: string;
  program: string;
  stage: LifecycleStage;
  taskType: string;
  description: string;
  assignedTo: string;
  assignedRole: string;
  dueDate: string;
  status: TaskStatus;
  priority: "High" | "Medium" | "Low";
  age: number;
  recommendedAction?: string;
}

export interface Alert {
  id: string;
  studentId: string;
  studentName: string;
  program: string;
  alertType: AlertType;
  status: "Open" | "In Progress" | "Resolved";
  triggeredDate: string;
  age: number;
  assignedHandler: string;
  interventions: Intervention[];
  closureEvidence?: string;
}

export interface Intervention {
  id: string;
  date: string;
  action: string;
  performedBy: string;
  notes: string;
}

export interface Document {
  id: string;
  studentId: string;
  studentName: string;
  checklistItem: string;
  fileName: string;
  uploadedBy: string;
  uploadedDate: string;
  version: number;
  status: "Pending Review" | "Approved" | "Revision Requested";
  revisionNotes?: string;
  comments: DocumentComment[];
}

export interface DocumentComment {
  id: string;
  author: string;
  role: string;
  date: string;
  comment: string;
}

export interface SchedulingRequest {
  id: string;
  studentId: string;
  studentName: string;
  defenseType: "Proposal Defense" | "Oral Defense";
  requestedDate: string;
  status: "Pending Availability" | "Confirmed" | "Rescheduled" | "Cancelled";
  participants: Participant[];
  confirmedDate?: string;
  confirmedTime?: string;
  venue?: string;
  history: SchedulingHistory[];
}

export interface Participant {
  name: string;
  role: string;
  availability: string[];
  conflicts?: string[];
}

export interface SchedulingHistory {
  date: string;
  action: string;
  performedBy: string;
  notes: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  role: string;
  action: string;
  entity: string;
  entityId: string;
  description: string;
  ipAddress?: string;
}

// Mock Students
export const mockStudents: Student[] = [
  {
    id: "1",
    name: "Juan Carlos Reyes",
    studentId: "2023-MS-CS-001",
    program: "MS Computer Science",
    currentStage: "Proposal Development",
    riskFlag: true,
    adviser: "Dr. Patricia Cruz",
    panelMembers: ["Dr. Robert Tan", "Dr. Lisa Martinez"],
    enrollmentDate: "2023-08-15",
    lastUpdated: "2026-03-10",
    email: "jc.reyes@student.usls.edu.ph",
    milestones: [
      { id: "m1", name: "Admission Documents Complete", stage: "Admission", status: "Completed", completedDate: "2023-08-20" },
      { id: "m2", name: "Course Plan Approved", stage: "Coursework", status: "Completed", completedDate: "2024-01-15" },
      { id: "m3", name: "Proposal Draft Submitted", stage: "Proposal Development", status: "In Progress", dueDate: "2026-03-25" },
      { id: "m4", name: "Panel Pre-Review Complete", stage: "Proposal Development", status: "Pending", dueDate: "2026-04-10" },
    ],
    timeline: [
      { id: "t1", date: "2026-03-10", action: "Stage Update", actor: "Dr. Patricia Cruz", description: "Student submitted revised proposal draft" },
      { id: "t2", date: "2026-02-28", action: "Task Decision", actor: "Dr. Patricia Cruz", description: "Decision: Revise - Needs methodology clarification" },
      { id: "t3", date: "2026-02-15", action: "Document Upload", actor: "Juan Carlos Reyes", description: "Uploaded proposal draft v1" },
    ],
  },
  {
    id: "2",
    name: "Maria Teresa Santos",
    studentId: "2022-MA-ED-015",
    program: "MA Education",
    currentStage: "Data Collection",
    riskFlag: true,
    adviser: "Dr. Emmanuel Garcia",
    panelMembers: ["Dr. Sofia Reyes", "Dr. Anthony Lim"],
    enrollmentDate: "2022-08-20",
    lastUpdated: "2026-03-18",
    email: "mt.santos@student.usls.edu.ph",
    milestones: [
      { id: "m5", name: "Admission Documents Complete", stage: "Admission", status: "Completed", completedDate: "2022-08-25" },
      { id: "m6", name: "Proposal Defense Completed", stage: "Proposal Defense", status: "Completed", completedDate: "2024-05-12" },
      { id: "m7", name: "Data Collection Ethics Clearance", stage: "Data Collection", status: "Completed", completedDate: "2024-06-30" },
      { id: "m8", name: "Data Collection Progress Update", stage: "Data Collection", status: "Pending", dueDate: "2026-03-30" },
    ],
    timeline: [
      { id: "t4", date: "2026-03-18", action: "Alert Triggered", actor: "System", description: "Prolonged Stage alert - 280 days in Data Collection" },
      { id: "t5", date: "2024-06-30", action: "Milestone Complete", actor: "Dr. Emmanuel Garcia", description: "Ethics clearance approved" },
    ],
  },
  {
    id: "3",
    name: "Roberto Villareal",
    studentId: "2023-MBA-042",
    program: "MBA",
    currentStage: "Dissertation Writing",
    riskFlag: false,
    adviser: "Dr. Catherine Lee",
    panelMembers: ["Dr. Michael Wong", "Dr. Jennifer Tan"],
    enrollmentDate: "2023-01-10",
    lastUpdated: "2026-03-20",
    email: "r.villareal@student.usls.edu.ph",
    milestones: [
      { id: "m9", name: "Proposal Defense Completed", stage: "Proposal Defense", status: "Completed", completedDate: "2024-08-15" },
      { id: "m10", name: "Draft Chapters Submitted", stage: "Dissertation Writing", status: "In Progress" },
      { id: "m11", name: "Final Oral Defense Schedule", stage: "Oral Defense", status: "Pending" },
    ],
    timeline: [
      { id: "t6", date: "2026-03-20", action: "Document Upload", actor: "Roberto Villareal", description: "Uploaded Chapter 3 draft" },
      { id: "t7", date: "2026-03-15", action: "Task Decision", actor: "Dr. Catherine Lee", description: "Decision: Approve - Chapter 2 accepted" },
    ],
  },
  {
    id: "4",
    name: "Ana Luisa Fernandez",
    studentId: "2021-PHD-ENG-003",
    program: "PhD Engineering",
    currentStage: "Oral Defense",
    riskFlag: false,
    adviser: "Dr. Ramon Santos",
    panelMembers: ["Dr. Carlos Mendoza", "Dr. Elena Ramos", "Dr. Thomas Chen"],
    enrollmentDate: "2021-08-15",
    lastUpdated: "2026-03-21",
    email: "al.fernandez@student.usls.edu.ph",
    milestones: [
      { id: "m12", name: "Dissertation Complete", stage: "Dissertation Writing", status: "Completed", completedDate: "2026-02-28" },
      { id: "m13", name: "Final Oral Defense Schedule", stage: "Oral Defense", status: "Completed", completedDate: "2026-03-15" },
      { id: "m14", name: "Oral Defense Completed", stage: "Oral Defense", status: "Pending", dueDate: "2026-04-05" },
    ],
    timeline: [
      { id: "t8", date: "2026-03-21", action: "Scheduling", actor: "Graduate School Staff", description: "Defense confirmed for April 5, 2026, 2:00 PM" },
      { id: "t9", date: "2026-03-15", action: "Milestone Complete", actor: "Graduate School Staff", description: "Defense schedule finalized" },
    ],
  },
  {
    id: "5",
    name: "Gabriel Aquino",
    studentId: "2024-MS-CS-018",
    program: "MS Computer Science",
    currentStage: "Coursework",
    riskFlag: false,
    adviser: "Dr. Patricia Cruz",
    panelMembers: [],
    enrollmentDate: "2024-08-15",
    lastUpdated: "2026-03-19",
    email: "g.aquino@student.usls.edu.ph",
    milestones: [
      { id: "m15", name: "Admission Documents Complete", stage: "Admission", status: "Completed", completedDate: "2024-08-20" },
      { id: "m16", name: "Course Plan Approved", stage: "Coursework", status: "Completed", completedDate: "2024-09-10" },
      { id: "m17", name: "Coursework Completion", stage: "Coursework", status: "In Progress", dueDate: "2026-05-30" },
    ],
    timeline: [
      { id: "t10", date: "2026-03-19", action: "Update", actor: "Gabriel Aquino", description: "Completed CS 501 - Advanced Algorithms" },
      { id: "t11", date: "2024-09-10", action: "Milestone Complete", actor: "Dr. Patricia Cruz", description: "Course plan approved" },
    ],
  },
];

// Mock Tasks
export const mockTasks: Task[] = [
  {
    id: "t1",
    studentId: "1",
    studentName: "Juan Carlos Reyes",
    program: "MS Computer Science",
    stage: "Proposal Development",
    taskType: "Proposal Review",
    description: "Review revised methodology section of proposal",
    assignedTo: "Dr. Patricia Cruz",
    assignedRole: "Adviser",
    dueDate: "2026-03-20",
    status: "Overdue",
    priority: "High",
    age: 12,
    recommendedAction: "Review and provide feedback on methodology revisions",
  },
  {
    id: "t2",
    studentId: "2",
    studentName: "Maria Teresa Santos",
    program: "MA Education",
    stage: "Data Collection",
    taskType: "Progress Check",
    description: "Review data collection progress and timeline",
    assignedTo: "Dr. Emmanuel Garcia",
    assignedRole: "Adviser",
    dueDate: "2026-03-25",
    status: "Pending",
    priority: "High",
    age: 5,
    recommendedAction: "Schedule meeting to assess data collection status",
  },
  {
    id: "t3",
    studentId: "3",
    studentName: "Roberto Villareal",
    program: "MBA",
    stage: "Dissertation Writing",
    taskType: "Chapter Review",
    description: "Review Chapter 3 - Research Methodology",
    assignedTo: "Dr. Catherine Lee",
    assignedRole: "Adviser",
    dueDate: "2026-03-28",
    status: "In Progress",
    priority: "Medium",
    age: 2,
  },
  {
    id: "t4",
    studentId: "4",
    studentName: "Ana Luisa Fernandez",
    program: "PhD Engineering",
    stage: "Oral Defense",
    taskType: "Defense Coordination",
    description: "Finalize defense logistics and venue setup",
    assignedTo: "Graduate School Staff",
    assignedRole: "Staff",
    dueDate: "2026-04-02",
    status: "Pending",
    priority: "High",
    age: 1,
  },
  {
    id: "t5",
    studentId: "1",
    studentName: "Juan Carlos Reyes",
    program: "MS Computer Science",
    stage: "Proposal Development",
    taskType: "Panel Pre-Review",
    description: "Conduct pre-review of proposal draft",
    assignedTo: "Dr. Robert Tan",
    assignedRole: "Panel Member",
    dueDate: "2026-04-10",
    status: "Pending",
    priority: "Medium",
    age: 0,
  },
];

// Mock Alerts
export const mockAlerts: Alert[] = [
  {
    id: "a1",
    studentId: "2",
    studentName: "Maria Teresa Santos",
    program: "MA Education",
    alertType: "Prolonged Stage",
    status: "In Progress",
    triggeredDate: "2026-03-18",
    age: 4,
    assignedHandler: "Dr. Emmanuel Garcia",
    interventions: [
      {
        id: "i1",
        date: "2026-03-19",
        action: "Meeting Scheduled",
        performedBy: "Dr. Emmanuel Garcia",
        notes: "Scheduled progress meeting for March 25 to assess data collection timeline",
      },
    ],
  },
  {
    id: "a2",
    studentId: "1",
    studentName: "Juan Carlos Reyes",
    program: "MS Computer Science",
    alertType: "Unresolved Handoff",
    status: "Open",
    triggeredDate: "2026-03-15",
    age: 7,
    assignedHandler: "Dr. Patricia Cruz",
    interventions: [],
  },
  {
    id: "a3",
    studentId: "5",
    studentName: "Gabriel Aquino",
    program: "MS Computer Science",
    alertType: "Inactivity",
    status: "Open",
    triggeredDate: "2026-03-20",
    age: 2,
    assignedHandler: "Dr. Patricia Cruz",
    interventions: [],
  },
];

// Mock Documents
export const mockDocuments: Document[] = [
  {
    id: "d1",
    studentId: "1",
    studentName: "Juan Carlos Reyes",
    checklistItem: "Proposal Manuscript",
    fileName: "proposal_draft_v2.pdf",
    uploadedBy: "Juan Carlos Reyes",
    uploadedDate: "2026-03-10",
    version: 2,
    status: "Pending Review",
    revisionNotes: "Please clarify methodology section and expand literature review",
    comments: [
      {
        id: "c1",
        author: "Dr. Patricia Cruz",
        role: "Adviser",
        date: "2026-02-28",
        comment: "The methodology needs more detail on data collection instruments",
      },
    ],
  },
  {
    id: "d2",
    studentId: "3",
    studentName: "Roberto Villareal",
    checklistItem: "Chapter 3 - Methodology",
    fileName: "chapter3_draft.pdf",
    uploadedBy: "Roberto Villareal",
    uploadedDate: "2026-03-20",
    version: 1,
    status: "Pending Review",
    comments: [],
  },
  {
    id: "d3",
    studentId: "4",
    studentName: "Ana Luisa Fernandez",
    checklistItem: "Final Dissertation",
    fileName: "dissertation_final.pdf",
    uploadedBy: "Ana Luisa Fernandez",
    uploadedDate: "2026-02-28",
    version: 3,
    status: "Approved",
    comments: [
      {
        id: "c2",
        author: "Dr. Ramon Santos",
        role: "Adviser",
        date: "2026-02-28",
        comment: "Excellent work. Ready for defense.",
      },
    ],
  },
];

// Mock Scheduling
export const mockScheduling: SchedulingRequest[] = [
  {
    id: "s1",
    studentId: "4",
    studentName: "Ana Luisa Fernandez",
    defenseType: "Oral Defense",
    requestedDate: "2026-03-15",
    status: "Confirmed",
    participants: [
      { name: "Ana Luisa Fernandez", role: "Student", availability: ["2026-04-05", "2026-04-08"] },
      { name: "Dr. Ramon Santos", role: "Adviser", availability: ["2026-04-05", "2026-04-08", "2026-04-12"] },
      { name: "Dr. Carlos Mendoza", role: "Panel Chair", availability: ["2026-04-05", "2026-04-15"] },
      { name: "Dr. Elena Ramos", role: "Panel Member", availability: ["2026-04-05", "2026-04-08"] },
      { name: "Dr. Thomas Chen", role: "Panel Member", availability: ["2026-04-05"] },
    ],
    confirmedDate: "2026-04-05",
    confirmedTime: "2:00 PM",
    venue: "Graduate School Conference Room A",
    history: [
      {
        date: "2026-03-21",
        action: "Defense Confirmed",
        performedBy: "Graduate School Staff",
        notes: "All participants confirmed availability for April 5",
      },
      {
        date: "2026-03-18",
        action: "Availability Collected",
        performedBy: "Graduate School Staff",
        notes: "Collected availability from all panel members",
      },
    ],
  },
  {
    id: "s2",
    studentId: "1",
    studentName: "Juan Carlos Reyes",
    defenseType: "Proposal Defense",
    requestedDate: "2026-03-01",
    status: "Pending Availability",
    participants: [
      { name: "Juan Carlos Reyes", role: "Student", availability: [] },
      { name: "Dr. Patricia Cruz", role: "Adviser", availability: [] },
      { name: "Dr. Robert Tan", role: "Panel Member", availability: [] },
      { name: "Dr. Lisa Martinez", role: "Panel Member", availability: [] },
    ],
    history: [
      {
        date: "2026-03-01",
        action: "Request Submitted",
        performedBy: "Juan Carlos Reyes",
        notes: "Proposal defense scheduling request submitted",
      },
    ],
  },
];

// Mock Audit Log
export const mockAuditLog: AuditLogEntry[] = [
  {
    id: "log1",
    timestamp: "2026-03-22 09:15:23",
    actor: "Dr. Patricia Cruz",
    role: "Adviser",
    action: "Login",
    entity: "User",
    entityId: "user_123",
    description: "User logged in successfully",
    ipAddress: "10.0.1.45",
  },
  {
    id: "log2",
    timestamp: "2026-03-22 09:18:45",
    actor: "Dr. Patricia Cruz",
    role: "Adviser",
    action: "View",
    entity: "Student",
    entityId: "1",
    description: "Viewed student profile: Juan Carlos Reyes",
  },
  {
    id: "log3",
    timestamp: "2026-03-21 14:30:12",
    actor: "Graduate School Staff",
    role: "Graduate School Staff",
    action: "Update",
    entity: "Scheduling",
    entityId: "s1",
    description: "Confirmed defense schedule for Ana Luisa Fernandez",
  },
  {
    id: "log4",
    timestamp: "2026-03-21 11:20:05",
    actor: "Juan Carlos Reyes",
    role: "Student",
    action: "Upload",
    entity: "Document",
    entityId: "d1",
    description: "Uploaded document: proposal_draft_v2.pdf",
  },
  {
    id: "log5",
    timestamp: "2026-03-20 16:45:30",
    actor: "System",
    role: "System",
    action: "Alert Triggered",
    entity: "Alert",
    entityId: "a3",
    description: "Inactivity alert triggered for Gabriel Aquino",
  },
  {
    id: "log6",
    timestamp: "2026-03-20 10:15:00",
    actor: "Dr. Catherine Lee",
    role: "Adviser",
    action: "Decision",
    entity: "Task",
    entityId: "t3",
    description: "Task decision: Approve - Chapter 2 accepted for Roberto Villareal",
  },
  {
    id: "log7",
    timestamp: "2026-03-19 13:22:18",
    actor: "Admin",
    role: "Admin",
    action: "Config Change",
    entity: "Threshold",
    entityId: "th_1",
    description: "Updated Task Escalation Days threshold from 5 to 7",
  },
  {
    id: "log8",
    timestamp: "2026-03-18 08:05:45",
    actor: "Student User",
    role: "Student",
    action: "Access Denied",
    entity: "Analytics",
    entityId: "analytics",
    description: "Access denied: Student attempted to access analytics page",
  },
];

export const programs = [
  "MS Computer Science",
  "MA Education",
  "MBA",
  "PhD Engineering",
];

export const lifecycleStages: LifecycleStage[] = [
  "Admission",
  "Coursework",
  "Proposal Development",
  "Proposal Defense",
  "Data Collection",
  "Dissertation Writing",
  "Oral Defense",
  "LOA",
  "Completed",
];
