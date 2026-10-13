import { Queue } from "bullmq";

/**
 * Filas PREGUIÇOSAS, pelo mesmo motivo de `@/lib/db`.
 *
 * Antes, as 8 filas eram instanciadas no topo do módulo: importar qualquer
 * coisa que chegasse aqui por transitividade (o Cadence Engine, por exemplo)
 * abria conexão com o Redis na hora. Processos que não iam usar fila nenhuma
 * — teste, script, rota de leitura — ficavam com o event loop preso e nunca
 * encerravam. Agora cada fila nasce no primeiro uso real.
 */
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

const instancias = new Map<string, Queue>();

/** Cria (uma vez) e devolve a fila pelo nome. */
function obterFila(nome: string, opcoes: Record<string, unknown> = defaultJobOptions): Queue {
  let fila = instancias.get(nome);
  if (!fila) {
    fila = new Queue(nome, { connection, defaultJobOptions: opcoes });
    instancias.set(nome, fila);
  }
  return fila;
}

/** Proxy com a mesma superfície de uma Queue — só adia a conexão até o primeiro acesso. */
function filaPreguicosa(nome: string, opcoes?: Record<string, unknown>): Queue {
  return new Proxy({} as Queue, {
    get(_alvo, prop) {
      const real = obterFila(nome, opcoes) as unknown as Record<string | symbol, unknown>;
      const valor = real[prop];
      return typeof valor === "function" ? (valor as (...a: unknown[]) => unknown).bind(real) : valor;
    },
  });
}

export const leadScoringQueue = filaPreguicosa("lead-scoring");
export const notificationQueue = filaPreguicosa("notifications");
export const whatsappIncomingQueue = filaPreguicosa("whatsapp-incoming");
export const whatsappOutgoingQueue = filaPreguicosa("whatsapp-outgoing");
export const whatsappStatusQueue = filaPreguicosa("whatsapp-status-update");
export const enrichmentQueue = filaPreguicosa("enrichment");
export const siteLeadQualifyQueue = filaPreguicosa("site-lead-qualify", groqJobOptions);
// Eventos de ligação finalizada vindos do webhook de saída da Callface.
// Retry generoso: se o worker falhar (banco fora etc.), o evento não se perde.
export const callfaceCallEventsQueue = filaPreguicosa("callface-call-events", {
  ...defaultJobOptions,
  attempts: 5,
  backoff: { type: "exponential" as const, delay: 30000 },
});

// Reprocesso de webhooks do Stripe que falharam (produtor: rota /api/webhooks/stripe e rota admin;
// consumidor: worker/index.ts). Retry com backoff exponencial: 30s, 1min, 2min, 4min, 8min.
export const stripeWebhookEventsQueue = filaPreguicosa("stripe-webhook-events", {
  ...defaultJobOptions,
  attempts: 6,
  backoff: { type: "exponential" as const, delay: 30000 },
});

/** Fecha as filas que chegaram a ser abertas. Útil em script/teste que precisa terminar. */
export async function fecharFilas(): Promise<void> {
  for (const fila of instancias.values()) await fila.close();
  instancias.clear();
}
