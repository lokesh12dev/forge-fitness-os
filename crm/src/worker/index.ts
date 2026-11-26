import { Worker } from "bullmq";
import IORedis from "ioredis";
import { logEvent } from "../lib/observability";

const redisUrl = process.env.REDIS_URL?.trim() || "redis://127.0.0.1:6379";
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

const worker = new Worker(
  "forge-crm-jobs",
  async (job) => {
    logEvent("info", "Processing BullMQ job", {
      jobId: job.id,
      name: job.name,
    });
    return { ok: true, processedAt: new Date().toISOString() };
  },
  { connection }
);

worker.on("failed", (job, err) => {
  logEvent("error", "BullMQ job moved toward DLQ", {
    jobId: job?.id,
    name: job?.name,
    err: err.message,
  });
});

logEvent("info", "FORGE CRM worker listening on queue forge-crm-jobs");
