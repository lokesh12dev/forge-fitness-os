import { Queue } from "bullmq";
import IORedis from "ioredis";
import { logEvent } from "./observability";

export type CrmJobName =
  | "dunning.retry"
  | "webhook.reconcile"
  | "outreach.dispatch"
  | "report.daily_summary";

const globalForQueue = globalThis as unknown as {
  redisConn?: IORedis;
  crmQueue?: Queue;
};

function getRedisConnection(): IORedis | null {
  if (globalForQueue.redisConn) return globalForQueue.redisConn;
  try {
    const url = process.env.REDIS_URL?.trim() || "redis://127.0.0.1:6379";
    const conn = new IORedis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    });
    conn.on("error", (err) => {
      logEvent("warn", "Redis connection warning", { err: err.message });
    });
    globalForQueue.redisConn = conn;
    return conn;
  } catch {
    return null;
  }
}

export async function enqueueCrmJob(
  name: CrmJobName,
  payload: Record<string, unknown>,
  options: { delayMs?: number; attempts?: number } = {}
): Promise<{ queued: boolean; mode: "BULLMQ" | "INLINE_FALLBACK"; jobId: string }> {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    const conn = getRedisConnection();
    if (conn) {
      if (!globalForQueue.crmQueue) {
        globalForQueue.crmQueue = new Queue("forge-crm-jobs", {
          connection: conn,
          defaultJobOptions: {
            attempts: options.attempts ?? 3,
            backoff: { type: "exponential", delay: 5000 },
            removeOnComplete: 100,
            removeOnFail: 250,
          },
        });
      }
      await Promise.race([
        globalForQueue.crmQueue.add(name, payload, {
          jobId,
          delay: options.delayMs,
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Redis timeout")), 600)),
      ]);
      return { queued: true, mode: "BULLMQ", jobId };
    }
  } catch (err) {
    logEvent("warn", "BullMQ unavailable; executing inline job record", {
      name,
      reason: err instanceof Error ? err.message : "unknown",
    });
  }
  return { queued: false, mode: "INLINE_FALLBACK", jobId };
}
