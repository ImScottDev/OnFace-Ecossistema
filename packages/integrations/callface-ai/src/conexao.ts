/**
 * Conexão SOMENTE-LEITURA com o Postgres do SaaS Callface AI.
 *
 * Este é o único lugar do ONFACE que sabe que esse banco existe. Nenhuma tela,
 * nenhuma rota e nenhum agente de IA fala com ele: todos leem o modelo local
 * normalizado (SPEC §3.2 — sistemas externos não são donos do estado de
 * negócio do ONFACE).
 *
 * TRÊS TRAVAS, porque uma escrita acidental aqui é um incidente em produção do
 * nosso próprio produto:
 *
 *   1. `default_transaction_read_only=on` na própria conexão. O servidor recusa
 *      qualquer escrita, inclusive a que passar por cima da revisão de código.
 *   2. Toda consulta roda dentro de `BEGIN READ ONLY`.
 *   3. Um teste de arquitetura proíbe verbo de escrita no código do pacote.
 *
 * Credencial vem SÓ de variável de ambiente. Sem ela o adapter responde "não
 * configurado" e o CRM segue funcionando — banco externo fora do ar não pode
 * derrubar o CRM (requisito explícito da integração).
 */
import postgres, { type Sql } from "postgres";

export interface ConfigCallfaceAi {
  url: string;
  /** Quantas conexões o pool abre. Baixo de propósito: é leitura de fundo. */
  poolMax: number;
  timeoutMs: number;
}

export function configDoAmbiente(env: NodeJS.ProcessEnv = process.env): ConfigCallfaceAi | null {
  const url = env.CALLFACE_AI_DATABASE_URL?.trim();
  if (!url) return null;
  return {
    url,
    poolMax: Number(env.CALLFACE_AI_POOL_MAX ?? 2),
    timeoutMs: Number(env.CALLFACE_AI_TIMEOUT_MS ?? 120_000),
  };
}

let pool: Sql | null = null;
let poolDaUrl: string | null = null;

/**
 * Pool preguiçoso. Não abre conexão até alguém consultar, então importar este
 * módulo num ambiente sem a credencial não custa nada e não falha.
 */
export function conexao(config: ConfigCallfaceAi): Sql {
  if (pool && poolDaUrl === config.url) return pool;
  pool = postgres(config.url, {
    max: config.poolMax,
    idle_timeout: 30,
    connect_timeout: 15,
    ssl: "require",
    fetch_types: false,
    onnotice: () => {},
    connection: {
      // A trava que vale mesmo: o servidor recusa escrita nesta sessão.
      // Cast porque os tipos do driver só conhecem alguns parâmetros de
      // sessão; estes são parâmetros válidos do Postgres, não invenção.
      default_transaction_read_only: "on",
      statement_timeout: String(config.timeoutMs),
      application_name: "onface-crm-leitura",
    } as unknown as Record<string, string>,
  });
  poolDaUrl = config.url;
  return pool;
}

export async function fecharConexao(): Promise<void> {
  if (!pool) return;
  const p = pool;
  pool = null;
  poolDaUrl = null;
  await p.end({ timeout: 5 }).catch(() => undefined);
}

export type ResultadoLeitura<T> =
  | { ok: true; dados: T }
  | { ok: false; naoConfigurado: true; erro: string }
  | { ok: false; naoConfigurado?: false; erro: string; tentarDeNovo: boolean };

/**
 * Roda a leitura dentro de `BEGIN READ ONLY` e traduz qualquer falha em
 * resultado, nunca em exceção que suba para o CRM.
 *
 * A distinção entre "não configurado" e "falhou" não é cosmética: tratar as
 * duas como a mesma coisa faz o alerta disparar em ambiente que nunca teve a
 * integração ligada, e foi assim que a integração com a Meta gerou ruído até
 * alguém parar de olhar.
 */
export async function lerComTransacao<T>(
  fn: (sql: Sql) => Promise<T>,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ResultadoLeitura<T>> {
  const config = configDoAmbiente(env);
  if (!config) {
    return {
      ok: false,
      naoConfigurado: true,
      erro: "CALLFACE_AI_DATABASE_URL não configurada: a integração com o SaaS está desligada neste ambiente",
    };
  }
  try {
    const sql = conexao(config);
    const dados = await sql.begin("read only", (tx) => fn(tx as unknown as Sql)) as T;
    return { ok: true, dados };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Rede, timeout e indisponibilidade são transitórios: quem chama reagenda.
    // Erro de permissão ou de SQL não é, e reexecutar só repete o erro.
    const transitorio = /timeout|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|ECONNRESET|terminating connection|the database system is/i.test(msg);
    return { ok: false, erro: msg, tentarDeNovo: transitorio };
  }
}
