import request from "supertest";
import { RoleName } from "@prisma/client";

const prismaMock = {
  $queryRaw: jest.fn(),
  student: {
    count: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  alertThreshold: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
};

jest.mock("../src/lib/prisma", () => ({
  prisma: prismaMock,
}));

jest.mock("../src/middleware/authenticate", () => ({
  authenticate: (req: any, _res: any, next: () => void) => {
    const rawRoleHeader = String(req.headers["x-role"] ?? RoleName.STUDENT);
    const roles = rawRoleHeader
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    req.user = {
      id: Number(req.headers["x-user-id"] ?? 1),
      email: "mock@gs.local",
      fullName: "Mock User",
      roles,
    };
    next();
  },
}));

import { createApp } from "../src/app";

describe("RBAC and Privacy Boundaries", () => {
  const app = createApp();

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.$queryRaw.mockResolvedValue([]);
    prismaMock.student.count.mockResolvedValue(0);
    prismaMock.auditLog.findMany.mockResolvedValue([]);
    prismaMock.auditLog.count.mockResolvedValue(0);
    prismaMock.auditLog.create.mockResolvedValue({ id: 1 });
  });

  it("blocks student from /api/students list", async () => {
    const response = await request(app).get("/api/students").set("x-role", RoleName.STUDENT);
    expect(response.status).toBe(403);
  });

  it("blocks student from analytics endpoints", async () => {
    const response = await request(app).get("/api/analytics/descriptive").set("x-role", RoleName.STUDENT);
    expect(response.status).toBe(403);
  });

  it("blocks student from audit endpoint", async () => {
    const response = await request(app).get("/api/audit").set("x-role", RoleName.STUDENT);
    expect(response.status).toBe(403);
  });

  it("blocks student from team queue endpoint", async () => {
    const response = await request(app).get("/api/tasks/team").set("x-role", RoleName.STUDENT);
    expect(response.status).toBe(403);
  });

  it("prevents student IDOR access to another student", async () => {
    prismaMock.student.count.mockResolvedValue(0);
    const response = await request(app).get("/api/students/999").set("x-role", RoleName.STUDENT).set("x-user-id", "70");
    expect(response.status).toBe(403);
  });

  it("prevents adviser from reading unassigned student", async () => {
    prismaMock.student.count.mockResolvedValue(0);
    const response = await request(app).get("/api/students/1001").set("x-role", RoleName.ADVISER).set("x-user-id", "22");
    expect(response.status).toBe(403);
  });

  it("prevents panel member from updating lifecycle stage", async () => {
    const response = await request(app)
      .patch("/api/students/1/stage")
      .set("x-role", RoleName.PANEL_MEMBER)
      .send({ stage: "COURSEWORK" });
    expect(response.status).toBe(403);
  });

  it("allows admin to access analytics and audit endpoints", async () => {
    prismaMock.student.count.mockResolvedValue(1);
    prismaMock.auditLog.findMany.mockResolvedValue([]);
    prismaMock.auditLog.count.mockResolvedValue(0);

    const analytics = await request(app).get("/api/analytics/descriptive").set("x-role", RoleName.ADMIN);
    const audit = await request(app).get("/api/audit").set("x-role", RoleName.ADMIN);

    expect(analytics.status).toBe(200);
    expect(audit.status).toBe(200);
  });
});
