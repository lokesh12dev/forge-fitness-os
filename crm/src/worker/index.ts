import { Worker } from "bullmq";
import IORedis from "ioredis";
import { PrismaClient } from "@prisma/client";
import { logEvent } from "../lib/observability";

const prisma = new PrismaClient();
const redisUrl = process.env.REDIS_URL?.trim() || "redis://127.0.0.1:6379";
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

const worker = new Worker(
  "forge-crm-jobs",
  async (job) => {
    logEvent("info", "Processing FORGE CRM background job", {
      jobId: job.id,
      name: job.name,
    });

    if (job.name === "dunning.retry" && job.data?.orgId) {
      const pending = await prisma.dunningAttempt.findMany({
        where: { orgId: String(job.data.orgId), status: "RETRY_SCHEDULED" },
        take: 25,
      });
      await prisma.dunningAttempt.updateMany({
        where: { id: { in: pending.map((p) => p.id) } },
        data: { status: "NOTIFIED", executedAt: new Date() },
      });
      return { ok: true, retriedCount: pending.length };
    }

    if (job.name === "webhook.reconcile" && job.data?.orgId) {
      const dlq = await prisma.webhookEvent.findMany({
        where: { orgId: String(job.data.orgId), status: "DLQ" },
        take: 10,
      });
      return { ok: true, inspectedDlq: dlq.length };
    }

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
