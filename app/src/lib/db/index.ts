import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Conexão PREGUIÇOSA de propósito.
 *
 * Antes, o pool do postgres-js era aberto no topo do módulo — bastava
 * importar qualquer arquivo que (direta ou transitivamente) tocasse em
 * `@/lib/db` pra o processo abrir conexão. Efeito real medido em 14/09:
 * `npm run test:ai-platform` nunca terminava, porque
 * `event-dispatcher.test.ts` importa o dispatcher, que importa este módulo,
 * e o pool aberto segurava o event loop vivo pra sempre. O mesmo valia pra
 * qualquer script que só quisesse usar uma função pura do domínio.
 *
 * Agora o pool só nasce no primeiro acesso de verdade ao `db`. Quem não
 * consulta o banco, não conecta — e o processo consegue encerrar sozinho.
 */
let clientPool: ReturnType<typeof postgres> | null = null;
let instancia: ReturnType<typeof drizzle<typeof schema>> | null = null;

function conectar() {
  if (!instancia) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL não definida — o banco só é conectado no primeiro uso, então este erro aparece na primeira query, não no import."
      );
    }
    clientPool = postgres(connectionString, {
      max: parseInt(process.env.DB_POOL_SIZE || "15", 10),
      idle_timeout: 30,
      connect_timeout: 10,
      max_lifetime: 60 * 10,       // recycle connections every 10min (prevents stale)
      fetch_types: false,           // skip type fetching (faster cold start)
      // JIT do Postgres desligado: as telas pesadas (Pré-vendas, Pipeline,
      // Contatos) têm custo ESTIMADO acima de 100.000 por causa dos LATERAL e
      // EXISTS, o planner liga o JIT, e compilar levava 180-250 ms por
      // consulta para executar 5-40 ms. Medido em homologação (14/10/2026).
      connection: {
        jit: "off",
        /* Quem é a conexão. O trigger de auditoria de responsável grava este
           nome junto da consulta: é assim que "apareceu na Jenifer" vira
           "foi o worker" ou "foi um script rodado na mão". */
        application_name: process.env.APP_NAME || "onface-app",
      },
    });
    instancia = drizzle(clientPool, { schema });
  }
  return instancia;
}

type Db = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Mesma superfície de antes (`db.select()`, `db.transaction()`, `db.execute()`…) —
 * o proxy só adia a criação do pool até a primeira propriedade ser lida.
 */
export const db: Db = new Proxy({} as Db, {
  get(_alvo, prop, receiver) {
    const real = conectar() as unknown as Record<string | symbol, unknown>;
    const valor = Reflect.get(real, prop, receiver === undefined ? real : real);
    return typeof valor === "function" ? (valor as (...a: unknown[]) => unknown).bind(real) : valor;
  },
  has(_alvo, prop) {
    return prop in (conectar() as unknown as object);
  },
});

/** Fecha o pool, quando ele existe. Útil em script/teste que precisa terminar. */
export async function fecharConexao(): Promise<void> {
  if (clientPool) {
    await clientPool.end({ timeout: 5 });
    clientPool = null;
    instancia = null;
  }
}
