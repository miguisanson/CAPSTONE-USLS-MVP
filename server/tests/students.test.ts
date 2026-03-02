import request from "supertest";
import { RoleName } from "@prisma/client";

jest.mock("../src/lib/prisma", () => {
  const prisma = {
    student: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };
  return { prisma };
});

jest.mock("../src/middleware/authenticate", () => ({
  authenticate: (req: any, _res: any, next: () => void) => {
    req.user = {
      id: 321,
      email: "student1@gs.local",
      fullName: "Student One",
      roles: [RoleName.STUDENT],
    };
    next();
  },
}));

import { prisma } from "../src/lib/prisma";
import { createApp } from "../src/app";

describe("Students API", () => {
  const app = createApp();

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.student.count as jest.Mock).mockResolvedValue(1);
    (prisma.student.findMany as jest.Mock).mockResolvedValue([
      {
        id: 11,
        studentNumber: "2024-0001",
        firstName: "Ana",
        lastName: "Santos",
        currentStage: "COURSEWORK",
        riskFlag: false,
        program: { code: "MSCS", name: "MS Computer Science" },
      },
    ]);
  });

  it("returns scoped student list for student role", async () => {
    const response = await request(app).get("/api/students");

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(response.body.items[0].studentNumber).toBe("2024-0001");

    const whereArg = (prisma.student.findMany as jest.Mock).mock.calls[0][0].where;
    expect(whereArg.AND[0].OR).toEqual([{ userAccountId: 321 }]);
  });
});

