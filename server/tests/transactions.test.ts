import request from "supertest";
import { RoleName } from "@prisma/client";

const txMock = {
  program: {
    findFirst: jest.fn(),
  },
  student: {
    create: jest.fn(),
  },
  studentLifecycle: {
    create: jest.fn(),
  },
  documentRecord: {
    createMany: jest.fn(),
  },
  task: {
    create: jest.fn(),
    update: jest.fn(),
  },
};

const prismaMock = {
  $transaction: jest.fn(),
  auditLog: {
    create: jest.fn(),
  },
  timelineEvent: {
    create: jest.fn(),
  },
};

jest.mock("../src/lib/prisma", () => ({
  prisma: prismaMock,
}));

jest.mock("../src/middleware/authenticate", () => ({
  authenticate: (req: any, _res: any, next: () => void) => {
    req.user = {
      id: 7,
      email: "staff@gs.local",
      fullName: "Graduate School Staff",
      roles: [RoleName.GRADUATE_SCHOOL_STAFF],
    };
    next();
  },
}));

import { createApp } from "../src/app";

describe("Transaction API", () => {
  const app = createApp();

  beforeEach(() => {
    jest.clearAllMocks();
    txMock.program.findFirst.mockResolvedValue({ id: 1, code: "MSCS", name: "MS Computer Science" });
    txMock.student.create.mockResolvedValue({
      id: 300,
      studentNumber: "2026-0300",
      firstName: "Demo",
      lastName: "Student",
    });
    txMock.studentLifecycle.create.mockResolvedValue({ id: 1 });
    txMock.documentRecord.createMany.mockResolvedValue({ count: 2 });
    txMock.task.create.mockResolvedValue({ id: 55 });
    txMock.task.update.mockResolvedValue({ id: 55 });
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof txMock) => Promise<void>) => callback(txMock));
    prismaMock.auditLog.create.mockResolvedValue({ id: 1 });
    prismaMock.timelineEvent.create.mockResolvedValue({ id: 1 });
  });

  it("returns transaction-list definitions with P0 workflows", async () => {
    const response = await request(app).get("/api/transactions/definitions");

    expect(response.status).toBe(200);
    const transactions = response.body.components.flatMap((component: any) => component.transactions);
    expect(transactions.some((item: any) => item.key === "STUDENT_HANDOFF" && item.priority === "P0")).toBe(true);
    expect(transactions.some((item: any) => item.key === "PANEL_MATCH" && item.priority === "P0")).toBe(true);
    expect(transactions.some((item: any) => item.key === "DEFENSE_SCHEDULE" && item.priority === "P0")).toBe(true);
  });

  it("records P0 student handoff into monitoring tables", async () => {
    const response = await request(app)
      .post("/api/transactions/record")
      .send({
        transactionKey: "STUDENT_HANDOFF",
        actorRole: RoleName.GRADUATE_SCHOOL_STAFF,
        sourceReference: "AIMS handoff batch 2026-01",
        statusResult: "received with missing items",
        missingItems: ["Admission handoff confirmation", "Enrollment signal"],
        nextOwnerRole: RoleName.GRADUATE_SCHOOL_STAFF,
        studentProfile: {
          studentNumber: "2026-0300",
          firstName: "Demo",
          lastName: "Student",
          email: "demo.student@student.gs.local",
          programCode: "MSCS",
        },
      });

    expect(response.status).toBe(201);
    expect(response.body.studentId).toBe(300);
    expect(txMock.student.create).toHaveBeenCalled();
    expect(txMock.studentLifecycle.create).toHaveBeenCalled();
    expect(txMock.documentRecord.createMany).toHaveBeenCalled();
    expect(txMock.task.create).toHaveBeenCalled();
    expect(prismaMock.timelineEvent.create).toHaveBeenCalled();
    expect(prismaMock.auditLog.create).toHaveBeenCalled();
  });
});
