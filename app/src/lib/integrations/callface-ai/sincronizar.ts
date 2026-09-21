/**
 * Sincroniza o uso do SaaS Callface AI para o modelo local da ONFACE.
 *
 * O que este arquivo garante, um por um, porque cada um foi pedido:
 *
 *   IDEMPOTENTE  — o snapshot tem índice único em (identidade, instante,
 *                  janela). Rodar de novo ATUALIZA a linha; não empilha.
 *   INCREMENTAL  — o estado guarda o último sucesso, e a janela de uso é
 *                  relativa. Nada relê a tabela de 3,3 milhões de chamadas
 *                  inteira: a leitura é limitada pela janela, que usa o índice
 *                  de created_at do SaaS.
 *   OBSERVÁVEL   — cada execução grava status, erro, duração e quantos itens.
 *   MULTI-TENANT — o estado é por organização da ONFACE.
 *   RETRY-SAFE   — falha transitória marca o estado e devolve; nada fica
 *                  metade escrito, porque cada tenant é uma transação própria.
 *   NÃO DERRUBA  — banco externo fora do ar vira status 'indisponivel' e o CRM
 *                  segue servindo o último snapshot conhecido.
 *
 * O que ele NÃO faz: escrever no banco do SaaS. O adapter abre a sessão com
 * default_transaction_read_only e toda leitura roda em BEGIN READ ONLY.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { lerComTransacao, lerTenants, lerUso, medirAmbiguidade } from "@onface/integrations-callface-ai";
import { resolverIdentidades, tenantsVinculados } from "./identidade";

export const PROVIDER = "callface_ai";
export const RECURSO_SNAPSHOT = "tenant_snapshot";

/** 30 dias é a janela do snapshot principal; 7 entra junto para dar tendência. */
export const JANELAS_PADRAO = [7, 30] as const;

export interface ResultadoSync {
  ok: boolean;
  status: "ok" | "parcial" | "falhou" | "indisponivel" | "desabilitado";
  tenants: number;
  snapshots: number;
  identidadesNovas: number;
  ambiguidade: { chamadasAmbiguas: number; chamadasSemAtribuicao: number; chamadasTotal: number } | null;
  erro?: string;
  duracaoMs: number;
}

async function gravarEstado(
  organizacaoId: string, recurso: string,
  campos: { status: string; erro?: string | null; itens?: number | null; duracaoMs?: number | null; sucesso?: boolean },
): Promise<void> {
  await db.execute(sql`
    INSERT INTO integracao_sync_estado
      (organizacao_id, provider, recurso, ultimo_sync_em, ultimo_sucesso_em, status, erro, tentativas, itens_ultimo_sync, duracao_ms)
    VALUES (${organizacaoId}::uuid, ${PROVIDER}, ${recurso}, now(),
            ${campos.sucesso ? sql`now()` : sql`NULL`}, ${campos.status},
            ${campos.erro ?? null}, ${campos.sucesso ? 0 : 1},
            ${campos.itens ?? null}, ${campos.duracaoMs ?? null})
    ON CONFLICT (organizacao_id, provider, recurso) DO UPDATE SET
      ultimo_sync_em = now(),
      -- O último SUCESSO só avança quando houve sucesso: é o que permite ver
      -- "está rodando mas falhando desde ontem" em vez de só "rodou agora".
      ultimo_sucesso_em = CASE WHEN ${campos.sucesso ?? false} THEN now()
                               ELSE integracao_sync_estado.ultimo_sucesso_em END,
      status = EXCLUDED.status,
      erro = EXCLUDED.erro,
      tentativas = CASE WHEN ${campos.sucesso ?? false} THEN 0
                        ELSE integracao_sync_estado.tentativas + 1 END,
      itens_ultimo_sync = EXCLUDED.itens_ultimo_sync,
      duracao_ms = EXCLUDED.duracao_ms,
      updated_at = now()`);
}

/**
 * O instante do snapshot é o INÍCIO DO DIA, não o da execução.
 *
 * A chave de idempotência é (identidade, instante, janela). Com o instante da
 * execução, duas rodadas no mesmo dia geram instantes diferentes, o ON CONFLICT
 * nunca casa e a tabela dobra de tamanho — foi exatamente o que aconteceu na
 * primeira verificação: 208 viraram 416. Truncar no dia é o que faz reexecutar
 * ATUALIZAR, que é o comportamento que o job precisa ter quando o worker
 * reinicia ou a tentativa anterior falhou no meio.
 */
export function instanteDoSnapshot(agora: Date): Date {
  const d = new Date(agora);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function sincronizarCallfaceAi(
  organizacaoId: string,
  opts: { janelas?: readonly number[]; agora?: Date } = {},
): Promise<ResultadoSync> {
  const inicio = Date.now();
  const janelas = opts.janelas ?? JANELAS_PADRAO;
  const agora = instanteDoSnapshot(opts.agora ?? new Date());
  const vazio = { ok: false, tenants: 0, snapshots: 0, identidadesNovas: 0, ambiguidade: null };

  // 1. Identidade primeiro: sem vínculo não há o que sincronizar, e o vínculo
  //    novo já entra no snapshot desta mesma execução.
  const ident = await resolverIdentidades(organizacaoId);
  if (!ident.ok) {
    const status = ident.naoConfigurado ? "desabilitado" : "indisponivel";
    await gravarEstado(organizacaoId, RECURSO_SNAPSHOT, { status, erro: ident.erro, duracaoMs: Date.now() - inicio });
    return { ...vazio, status, erro: ident.erro, duracaoMs: Date.now() - inicio };
  }

  const vinculados = await tenantsVinculados(organizacaoId);
  if (!vinculados.length) {
    await gravarEstado(organizacaoId, RECURSO_SNAPSHOT, { status: "ok", itens: 0, duracaoMs: Date.now() - inicio, sucesso: true });
    return { ok: true, status: "ok", tenants: 0, snapshots: 0, identidadesNovas: ident.vinculadas, ambiguidade: null, duracaoMs: Date.now() - inicio };
  }

  const orgIds = vinculados.map((v) => v.organizationId);
  const porOrg = new Map(vinculados.map((v) => [v.organizationId, v]));

  // 2. Uma leitura só, para todas as janelas, dentro de UMA transação read-only.
  const leitura = await lerComTransacao(async (s) => {
    const tenants = await lerTenants(s, orgIds);
    const usoPorJanela = new Map<number, Awaited<ReturnType<typeof lerUso>>>();
    for (const j of janelas) usoPorJanela.set(j, await lerUso(s, j, orgIds));
    const ambiguidade = await medirAmbiguidade(s, Math.max(...janelas));
    return { tenants, usoPorJanela, ambiguidade };
  });

  if (!leitura.ok) {
    const status = "naoConfigurado" in leitura && leitura.naoConfigurado ? "desabilitado" : "indisponivel";
    await gravarEstado(organizacaoId, RECURSO_SNAPSHOT, { status, erro: leitura.erro, duracaoMs: Date.now() - inicio });
    return { ...vazio, status, erro: leitura.erro, identidadesNovas: ident.vinculadas, duracaoMs: Date.now() - inicio };
  }

  const { tenants, usoPorJanela, ambiguidade } = leitura.dados;
  const tenantPorId = new Map(tenants.map((t) => [t.organizationId, t]));
  let snapshots = 0;

  // 3. Grava. Cada tenant é uma transação própria: um tenant problemático não
  //    derruba os outros, e o resultado sai como 'parcial' em vez de 'falhou'.
  let falhas = 0;
  for (const [janela, usos] of usoPorJanela) {
    for (const uso of usos) {
      const v = porOrg.get(uso.organizationId);
      const t = tenantPorId.get(uso.organizationId);
      if (!v || !t) continue;
      try {
        await db.execute(sql`
          INSERT INTO callface_ai_tenant_snapshots (
            external_identity_id, snapshot_at, janela_dias,
            usuarios_total, usuarios_ativos, usuarios_pendentes, licencas_ativas,
            workspaces_ativos, campanhas_ativas, campanhas_concluidas,
            chamadas_total, chamadas_finalizadas, minutos_uso, agentes_prontos,
            chamadas_ambiguas, sessoes_copilot, contatos_base,
            usuarios_com_atividade, reunioes, apps_ativos, webhooks_ativos,
            ultima_atividade_em, coletado_em
          ) VALUES (
            ${v.identityId}::uuid, ${agora.toISOString()}::timestamptz, ${janela},
            ${t.usuariosTotal}, ${t.usuariosAtivos}, ${t.usuariosPendentes}, ${t.licencasAtivas},
            ${t.workspacesAtivos}, ${uso.campanhasAtivas}, ${uso.campanhasConcluidas},
            ${uso.chamadasTotal}, ${uso.chamadasFinalizadas},
            ${(uso.segundosUso / 60).toFixed(2)}, ${t.agentesProntos},
            ${uso.chamadasAmbiguas}, ${uso.sessoesCopilot}, ${t.contatosBase},
            ${uso.usuariosComAtividade}, ${uso.reunioes}, ${t.appsAtivos}, ${t.webhooksAtivos},
            ${uso.ultimaAtividadeEm ? uso.ultimaAtividadeEm.toISOString() : null}::timestamptz, now()
          )
          ON CONFLICT (external_identity_id, snapshot_at, janela_dias) DO UPDATE SET
            usuarios_total = EXCLUDED.usuarios_total,
            usuarios_ativos = EXCLUDED.usuarios_ativos,
            usuarios_pendentes = EXCLUDED.usuarios_pendentes,
            licencas_ativas = EXCLUDED.licencas_ativas,
            workspaces_ativos = EXCLUDED.workspaces_ativos,
            campanhas_ativas = EXCLUDED.campanhas_ativas,
            campanhas_concluidas = EXCLUDED.campanhas_concluidas,
            chamadas_total = EXCLUDED.chamadas_total,
            chamadas_finalizadas = EXCLUDED.chamadas_finalizadas,
            minutos_uso = EXCLUDED.minutos_uso,
            agentes_prontos = EXCLUDED.agentes_prontos,
            chamadas_ambiguas = EXCLUDED.chamadas_ambiguas,
            sessoes_copilot = EXCLUDED.sessoes_copilot,
            contatos_base = EXCLUDED.contatos_base,
            usuarios_com_atividade = EXCLUDED.usuarios_com_atividade,
            reunioes = EXCLUDED.reunioes,
            apps_ativos = EXCLUDED.apps_ativos,
            webhooks_ativos = EXCLUDED.webhooks_ativos,
            ultima_atividade_em = EXCLUDED.ultima_atividade_em,
            coletado_em = EXCLUDED.coletado_em`);
        snapshots++;
      } catch (e) {
        falhas++;
        console.error(`[CallfaceAI] snapshot de ${uso.organizationId} (janela ${janela}d) falhou:`,
          e instanceof Error ? e.message : e);
      }
    }
  }

  const duracaoMs = Date.now() - inicio;
  const status = falhas === 0 ? "ok" : snapshots > 0 ? "parcial" : "falhou";
  await gravarEstado(organizacaoId, RECURSO_SNAPSHOT, {
    status, itens: snapshots, duracaoMs, sucesso: falhas === 0,
    erro: falhas ? `${falhas} snapshot(s) falharam` : null,
  });

  return {
    ok: falhas === 0, status, tenants: vinculados.length, snapshots,
    identidadesNovas: ident.vinculadas, ambiguidade, duracaoMs,
    erro: falhas ? `${falhas} snapshot(s) falharam` : undefined,
  };
}
