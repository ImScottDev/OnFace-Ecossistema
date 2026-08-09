import { Queue } from "bullmq";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const url = new URL(redisUrl);

const connection = {
  host: url.hostname,
  port: parseInt(url.port || "6379"),
  ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
  db: parseInt(url.pathname?.slice(1) || "0"),
  maxRetriesPerRequest: null as null,
  retryStrategy: (times: number) => Math.min(times * 500, 10000),
  enableOfflineQueue: true,
};

const defaultJobOptions = { removeOnComplete: { count: 200 }, removeOnFail: { count: 500 } };
const groqJobOptions = { ...defaultJobOptions, attempts: 5, backoff: { type: "exponential" as const, delay: 60000 } };

export const leadScoringQueue = new Queue("lead-scoring", { connection, defaultJobOptions });
export const notificationQueue = new Queue("notifications", { connection, defaultJobOptions });
export const whatsappIncomingQueue = new Queue("whatsapp-incoming", { connection, defaultJobOptions });
export const whatsappOutgoingQueue = new Queue("whatsapp-outgoing", { connection, defaultJobOptions });
export const whatsappStatusQueue = new Queue("whatsapp-status-update", { connection, defaultJobOptions });
export const enrichmentQueue = new Queue("enrichment", { connection, defaultJobOptions });
export const siteLeadQualifyQueue = new Queue("site-lead-qualify", { connection, defaultJobOptions: groqJobOptions });
// Eventos de ligação finalizada vindos do webhook de saída da Callface.
// Retry generoso: se o worker falhar (banco fora etc.), o evento não se perde.
export const callfaceCallEventsQueue = new Queue("callface-call-events", {
  connection,
  defaultJobOptions: { ...defaultJobOptions, attempts: 5, backoff: { type: "exponential" as const, delay: 30000 } },
});
