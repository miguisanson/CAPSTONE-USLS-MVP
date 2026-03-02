import request from "supertest";
import { RoleName } from "@prisma/client";

type BootOptions = {
  enableOpenAi: boolean;
  openAiKey?: string;
  openAiResponseText?: string;
};

const buildMockStudents = () => [
  {
    id: 1,
    currentStage: "PROPOSAL_DEVELOPMENT",
    updatedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
    riskFlag: true,
    lifecycleHistory: [{ enteredAt: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000) }],
    tasks: [
      {
        id: 11,
        dueAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        status: "OVERDUE",
        nextActionOwnerRole: "ADVISER",
      },
    ],
    milestoneStatuses: [{ id: 1 }],
    scheduleRequests: [{ createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000), status: "REQUESTED" }],
    timelineEvents: [{ occurredAt: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000) }],
  },
];

const loadApp = async (options: BootOptions) => {
  jest.resetModules();

  const prismaMock = {
    student: {
      findMany: jest.fn().mockResolvedValue(buildMockStudents()),
    },
    alertThreshold: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({ id: 1 }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
  };

  jest.doMock("../src/lib/prisma", () => ({
    prisma: prismaMock,
  }));

  jest.doMock("../src/middleware/authenticate", () => ({
    authenticate: (req: any, _res: any, next: () => void) => {
      req.user = {
        id: 1,
        email: "admin@gs.local",
        fullName: "Admin User",
        roles: [String(req.headers["x-role"] ?? RoleName.ADMIN)],
      };
      next();
    },
  }));

  jest.doMock("../src/config/env", () => ({
    env: {
      NODE_ENV: "test",
      PORT: 4001,
      DATABASE_URL: "mysql://test:test@localhost:3306/test_db",
      JWT_SECRET: "test_secret_for_jwt_signing_1234567890",
      JWT_EXPIRES_IN: "8h",
      CLIENT_URL: "http://localhost:5173",
      PORTAL_BASE_URL: "http://localhost:5173",
      UPLOAD_DIR: "uploads",
      SMTP_PORT: 587,
      SMTP_SECURE: false,
      MONITOR_CRON: "*/30 * * * *",
      ENABLE_OPENAI_ASSIST: options.enableOpenAi,
      OPENAI_API_KEY: options.openAiKey,
      OPENAI_MODEL: "gpt-4.1-mini",
    },
  }));

  if (options.openAiResponseText) {
    const createMock = jest.fn().mockResolvedValue({
      output_text: options.openAiResponseText,
    });

    jest.doMock("openai", () => ({
      __esModule: true,
      default: jest.fn().mockImplementation(() => ({
        responses: {
          create: createMock,
        },
      })),
    }));
  }

  const { createApp } = await import("../src/app");
  return { app: createApp(), prismaMock };
};

describe("/api/analytics/prescriptive", () => {
  it("returns disabled AI state when feature flag is false", async () => {
    const { app } = await loadApp({ enableOpenAi: false });
    const response = await request(app).post("/api/analytics/prescriptive").set("x-role", RoleName.ADMIN).send({});

    expect(response.status).toBe(200);
    expect(response.body.ai.status).toBe("disabled");
    expect(Array.isArray(response.body.priority_actions)).toBe(true);
  });

  it("returns clear error when AI enabled but OPENAI_API_KEY is missing", async () => {
    const { app } = await loadApp({ enableOpenAi: true });
    const response = await request(app).post("/api/analytics/prescriptive").set("x-role", RoleName.ADMIN).send({});

    expect(response.status).toBe(500);
    expect(String(response.body.message)).toMatch(/OPENAI_API_KEY/i);
  });

  it("returns valid JSON payload when AI is enabled and OpenAI response is mocked", async () => {
    const aiJson = JSON.stringify({
      generated_at: new Date().toISOString(),
      summary: "Prioritize overdue proposal cases and delayed scheduling items.",
      priority_actions: [
        {
          action: "Prioritize overdue cases",
          why: "Overdue count increased this week.",
          who: "Graduate School Staff",
          timeframe: "48 hours",
          confidence: "high",
        },
      ],
      top_cases: [
        {
          student_ref: "S-001",
          reason: "Overdue tasks and stage overrun.",
          recommended_next_action: "Escalate to adviser and secure updated timeline.",
          owner_role: "ADVISER",
          confidence: "med",
          data_needed: ["latest milestone evidence"],
        },
      ],
    });

    const { app } = await loadApp({
      enableOpenAi: true,
      openAiKey: "test-openai-key",
      openAiResponseText: aiJson,
    });

    const response = await request(app).post("/api/analytics/prescriptive").set("x-role", RoleName.ADMIN).send({});

    expect(response.status).toBe(200);
    expect(response.body.ai.status).toBe("success");
    expect(Array.isArray(response.body.priority_actions)).toBe(true);
    expect(Array.isArray(response.body.top_cases)).toBe(true);
    expect(response.body.top_cases[0].student_ref).toBe("S-001");
  });
});
