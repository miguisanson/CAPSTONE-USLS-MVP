import cron from "node-cron";
import { env } from "../config/env";
import { runMonitoringCycle } from "../modules/alerts/monitoring.service";

export const registerAlertJob = (): void => {
  cron.schedule(env.MONITOR_CRON, async () => {
    try {
      await runMonitoringCycle();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Monitoring job failed:", error);
    }
  });
};

