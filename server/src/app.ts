import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import path from "node:path";
import { env } from "./config/env";
import { authenticate } from "./middleware/authenticate";
import { errorHandler } from "./middleware/error-handler";
import { notFound } from "./middleware/not-found";
import { adminRouter } from "./modules/admin/admin.routes";
import { alertsRouter } from "./modules/alerts/alerts.routes";
import { analyticsRouter } from "./modules/analytics/analytics.routes";
import { assistantRouter } from "./modules/assistant/assistant.routes";
import { auditRouter } from "./modules/audit/audit.routes";
import { authRouter } from "./modules/auth/auth.routes";
import { documentsRouter } from "./modules/documents/documents.routes";
import { homeRouter } from "./modules/home/home.routes";
import { milestonesRouter } from "./modules/milestones/milestones.routes";
import { schedulingRouter } from "./modules/scheduling/scheduling.routes";
import { studentsRouter } from "./modules/students/students.routes";
import { tasksRouter } from "./modules/tasks/tasks.routes";
import { usersRouter } from "./modules/users/users.routes";

export const createApp = (): express.Express => {
  const app = express();

  app.use(
    cors({
      origin: env.CLIENT_URL,
      credentials: false,
    })
  );
  app.use(helmet());
  app.use(express.json({ limit: "5mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
  app.use("/uploads", express.static(path.resolve(process.cwd(), env.UPLOAD_DIR)));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  app.use("/api/auth", authRouter);

  app.use("/api", authenticate);
  app.use("/api/home", homeRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/students", studentsRouter);
  app.use("/api/milestones", milestonesRouter);
  app.use("/api/tasks", tasksRouter);
  app.use("/api", documentsRouter);
  app.use("/api/scheduling", schedulingRouter);
  app.use("/api/alerts", alertsRouter);
  app.use("/api/analytics", analyticsRouter);
  app.use("/api/audit-logs", auditRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/assistant", assistantRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
};

