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
import { lerComTransacao, lerDetalhe, lerSaude, lerTenants, lerUso, lerUsoDiario, medirAmbiguidade, type UsoDiarioCallfaceAi } from "@onface/integrations-callface-ai";
import { resolverIdentidades, tenantsVinculados } from "./identidade";
import { gravarSaudeDoDia } from "./saude-espelho";
import { garantirMarcoZero, sincronizarTarefasDeSaude, type ResultadoTarefasSaude } from "@/lib/callface-ai/tarefas-saude";

export const PROVIDER = "callface_ai";
export const RECURSO_SNAPSHOT = "tenant_snapshot";

/** 30 dias é a janela do snapshot principal; 7 entra junto para dar tendência. */
export const JANELAS_PADRAO = [7, 30] as const;

export { diaCivil } from "./calendario-sp";
import { diaCivil } from "./calendario-sp";

/** Série diária: 90 dias na primeira vez de cada vínculo, depois só os 4 últimos dias. */
const DIAS_SERIE = 90;
const DIAS_RELIDOS = 4;
const FATIA_DIAS = 15;

export interface ResultadoSync {
  ok: boolean;
  status: "ok" | "parcial" | "falhou" | "indisponivel" | "desabilitado";
  tenants: number;
  snapshots: number;
  detalhes: number;
  diasDeUso: number;
  identidadesNovas: number;
  ambiguidade: { chamadasAmbiguas: number; chamadasSemAtribuicao: number; chamadasTotal: number } | null;
  saude: { linhas: number; mudancasDeSemaforo: number } | null;
  tarefas: ResultadoTarefasSaude | null;
  erro?: string;
  duracaoMs: number;
}

export async function gravarEstado(
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

/**
 * O esquema local tem o que este sync grava? O sync nasceu na 0086/0105 e a
 * saúde diária na 0116 e o minuto tarifado na 0122: um banco do ONFACE ANTES delas (o `callface_crm`
 * antigo, que não recebe as migrations novas) estourava no meio do INSERT com
 * "column does not exist", depois de ler o SaaS inteiro. Aqui falha ANTES, em
 * uma frase que diz qual migration falta, e o estado fica 'falhou' (visível).
 */
export async function esquemaLocalCompleto(): Promise<{ ok: true } | { ok: false; falta: string[] }> {
  const exigidas: Array<[string, string[]]> = [
    ["integracao_sync_estado", ["organizacao_id", "provider", "recurso", "ultimo_sucesso_em"]],
    ["callface_ai_tenant_snapshots", ["janela_dias", "ultima_atividade_em", "coletado_em", "usuarios_com_atividade", "minutos_duracao", "chamadas_sem_tarifa"]],
    ["callface_ai_tenant_detalhe", ["external_identity_id", "licencas", "usuarios"]],
    ["callface_ai_uso_diario", ["external_identity_id", "dia", "minutos", "minutos_duracao", "chamadas_sem_tarifa"]],
    ["callface_ai_external_identities", ["evidencia", "estado", "org_nome"]],
    ["callface_ai_reconciliation_candidates", ["razao", "org_nome", "evidencia"]],
    ["callface_ai_saude_diaria", ["external_identity_id", "dia", "semaforo", "motivos"]],
  ];
  const linhas = await db.execute<{ t: string; c: string }>(sql`
    SELECT table_name AS t, column_name AS c FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = ANY(${`{${exigidas.map(([t]) => t).join(",")}}`}::text[])`);
  const tem = new Set(linhas.map((l) => `${l.t}.${l.c}`));
  const falta = exigidas.flatMap(([t, cs]) => cs.filter((c) => !tem.has(`${t}.${c}`)).map((c) => `${t}.${c}`));
  return falta.length ? { ok: false, falta } : { ok: true };
}

export async function sincronizarCallfaceAi(
  organizacaoId: string,
  opts: { janelas?: readonly number[]; agora?: Date } = {},
): Promise<ResultadoSync> {
  const inicio = Date.now();
  const janelas = opts.janelas ?? JANELAS_PADRAO;
  const agora = instanteDoSnapshot(opts.agora ?? new Date());
  const vazio = { ok: false, tenants: 0, snapshots: 0, detalhes: 0, diasDeUso: 0, identidadesNovas: 0, ambiguidade: null, saude: null, tarefas: null };

  const esquema = await esquemaLocalCompleto();
  if (!esquema.ok) {
    const erro = `esquema do ONFACE sem as migrations 0086/0105/0116/0122 (faltam: ${esquema.falta.slice(0, 6).join(", ")}${esquema.falta.length > 6 ? "…" : ""})`;
    await gravarEstado(organizacaoId, RECURSO_SNAPSHOT, { status: "falhou", erro, duracaoMs: Date.now() - inicio })
      .catch(() => undefined); // se até a tabela de estado falta, o log abaixo é o registro
    console.error(`[CallfaceAI] ${erro}`);
    return { ...vazio, status: "falhou", erro, duracaoMs: Date.now() - inicio };
  }

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
    return { ok: true, status: "ok", tenants: 0, snapshots: 0, detalhes: 0, diasDeUso: 0, identidadesNovas: ident.vinculadas, ambiguidade: null, saude: null, tarefas: null, duracaoMs: Date.now() - inicio };
  }

  const orgIds = vinculados.map((v) => v.organizationId);
  const porOrg = new Map(vinculados.map((v) => [v.organizationId, v]));

  // Quem já tem série diária só relê os últimos dias; quem não tem, busca 90.
  // Linha da janela com `chamadas_sem_tarifa` NULL foi gravada quando `minutos` ainda era a
  // DURAÇÃO (antes da 0122): quem tem uma delas relê os 90 dias inteiros, uma vez, e a
  // série passa a ser em minutos tarifados. Depois disso nenhuma linha da janela é NULL.
  const comSerie = new Set((await db.execute<{ org: string }>(sql`
    SELECT i.external_id AS org FROM callface_ai_uso_diario d
      JOIN callface_ai_external_identities i ON i.id = d.external_identity_id
     GROUP BY i.external_id
    HAVING count(*) FILTER (WHERE d.dia >= ${diaCivil(new Date(), -(DIAS_SERIE - 1))}::date
                              AND d.chamadas_sem_tarifa IS NULL) = 0`)).map((r) => r.org));
  const novos = orgIds.filter((o) => !comSerie.has(o));
  
  // 2. Uma leitura só, para todas as janelas, dentro de UMA transação read-only.
  const leitura = await lerComTransacao(async (s) => {
    const tenants = await lerTenants(s, orgIds);
    const usoPorJanela = new Map<number, Awaited<ReturnType<typeof lerUso>>>();
    for (const j of janelas) usoPorJanela.set(j, await lerUso(s, j, orgIds));
    const ambiguidade = await medirAmbiguidade(s, Math.max(...janelas));
    const detalhes = await lerDetalhe(s, orgIds);
    const saude = await lerSaude(s, orgIds);
    const serie: UsoDiarioCallfaceAi[] = [];
    const fim = diaCivil(new Date(), 1);
    if (comSerie.size) serie.push(...await lerUsoDiario(s, orgIds.filter((o) => comSerie.has(o)), diaCivil(new Date(), -DIAS_RELIDOS + 1), fim));
    for (let ini = DIAS_SERIE; novos.length && ini > 0; ini -= FATIA_DIAS) {
      serie.push(...await lerUsoDiario(s, novos, diaCivil(new Date(), -(ini - 1)), diaCivil(new Date(), -(Math.max(ini - FATIA_DIAS, 0) - 1))));
    }
    return { tenants, usoPorJanela, ambiguidade, detalhes, serie, saude };
  });

  if (!leitura.ok) {
    const status = "naoConfigurado" in leitura && leitura.naoConfigurado ? "desabilitado" : "indisponivel";
    await gravarEstado(organizacaoId, RECURSO_SNAPSHOT, { status, erro: leitura.erro, duracaoMs: Date.now() - inicio });
    return { ...vazio, status, erro: leitura.erro, identidadesNovas: ident.vinculadas, duracaoMs: Date.now() - inicio };
  }

  const { tenants, usoPorJanela, ambiguidade, detalhes, serie, saude } = leitura.dados;
  const saudePorOrg = new Map(saude.map((x) => [x.organizationId, x]));
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
            chamadas_total, chamadas_finalizadas, minutos_uso, minutos_duracao, chamadas_sem_tarifa, agentes_prontos,
            chamadas_ambiguas, sessoes_copilot, contatos_base,
            usuarios_com_atividade, reunioes, apps_ativos, webhooks_ativos,
            ultima_atividade_em, coletado_em
          ) VALUES (
            ${v.identityId}::uuid, ${agora.toISOString()}::timestamptz, ${janela},
            ${t.usuariosTotal}, ${t.usuariosAtivos}, ${t.usuariosPendentes}, ${t.licencasAtivas},
            ${t.workspacesAtivos}, ${uso.campanhasAtivas}, ${uso.campanhasConcluidas},
            ${uso.chamadasTotal}, ${uso.chamadasFinalizadas},
            ${(uso.segundosTarifados / 60).toFixed(2)}, ${(uso.segundosDuracao / 60).toFixed(2)}, ${uso.chamadasSemTarifa}, ${t.agentesProntos},
            ${uso.chamadasAmbiguas}, ${uso.sessoesCopilot}, ${t.contatosBase},
            ${uso.usuariosComAtividade}, ${uso.reunioes}, ${t.appsAtivos}, ${t.webhooksAtivos},
            ${(saudePorOrg.get(uso.organizationId)?.ultimaAtividadeEm ?? uso.ultimaAtividadeEm)?.toISOString() ?? null}::timestamptz, now()
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
            minutos_duracao = EXCLUDED.minutos_duracao,
            chamadas_sem_tarifa = EXCLUDED.chamadas_sem_tarifa,
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

  // 4. Detalhe (plano, licenças, usuários, campanhas, agentes, integrações).
  let nDetalhes = 0;
  for (const d of detalhes) {
    const v = porOrg.get(d.organizationId);
    if (!v) continue;
    const atrib = d.licencas.reduce((a, l) => a + l.atribuidas, 0);
    const contratadas = d.licencas.reduce((a, l) => a + l.qtd, 0);
    try {
      await db.execute(sql`
        INSERT INTO callface_ai_tenant_detalhe
          (external_identity_id, org_nome, org_criada_em, org_desativada_em, licencas, usuarios, campanhas, agentes, integracoes, coletado_em)
        VALUES (${v.identityId}::uuid, ${d.nome}, ${d.criadaEm ? d.criadaEm.toISOString() : null}::timestamptz,
                ${d.desativadaEm ? d.desativadaEm.toISOString() : null}::timestamptz,
                ${JSON.stringify({
                  contratadas, atribuidas: atrib,
                  minutosContratados: d.licencas.reduce((a, l) => a + l.minutos, 0),
                  ilimitado: d.licencas.some((l) => l.semLimite),
                  porPlano: d.licencas,
                })}::jsonb,
                ${JSON.stringify(d.usuarios)}::jsonb, ${JSON.stringify(d.campanhas)}::jsonb,
                ${JSON.stringify(d.agentes)}::jsonb, ${JSON.stringify(d.integracoes)}::jsonb, now())
        ON CONFLICT (external_identity_id) DO UPDATE SET
          org_nome = EXCLUDED.org_nome, org_criada_em = EXCLUDED.org_criada_em,
          org_desativada_em = EXCLUDED.org_desativada_em, licencas = EXCLUDED.licencas,
          usuarios = EXCLUDED.usuarios, campanhas = EXCLUDED.campanhas, agentes = EXCLUDED.agentes,
          integracoes = EXCLUDED.integracoes, coletado_em = EXCLUDED.coletado_em`);
      await db.execute(sql`UPDATE callface_ai_external_identities SET org_nome = ${d.nome} WHERE id = ${v.identityId}::uuid AND org_nome IS DISTINCT FROM ${d.nome}`);
      nDetalhes++;
    } catch (e) {
      falhas++;
      console.error(`[CallfaceAI] detalhe de ${d.organizationId} falhou:`, e instanceof Error ? e.message : e);
    }
  }

  // 5. Série diária: upsert por (vínculo, dia), em lotes (milhares de linhas no primeiro sync).
  let diasDeUso = 0;
  const linhasDia = serie.flatMap((u) => {
    const v = porOrg.get(u.organizationId);
    return v ? [{ id: v.identityId, dia: u.dia, ch: u.chamadas, fi: u.finalizadas, mi: u.minutos, md: u.minutosDuracao, st: u.chamadasSemTarifa, ua: u.usuariosAtivos }] : [];
  });
  for (let i = 0; i < linhasDia.length; i += 500) {
    const lote = linhasDia.slice(i, i + 500);
    try {
      await db.execute(sql`
        INSERT INTO callface_ai_uso_diario (external_identity_id, dia, chamadas, finalizadas, minutos, minutos_duracao, chamadas_sem_tarifa, usuarios_ativos, coletado_em)
        SELECT r.id, r.dia, r.ch, r.fi, r.mi, r.md, r.st, r.ua, now()
          FROM jsonb_to_recordset(${JSON.stringify(lote)}::jsonb)
               AS r(id uuid, dia date, ch int, fi int, mi numeric, md numeric, st int, ua int)
        ON CONFLICT (external_identity_id, dia) DO UPDATE SET
          chamadas = EXCLUDED.chamadas, finalizadas = EXCLUDED.finalizadas, minutos = EXCLUDED.minutos,
          minutos_duracao = EXCLUDED.minutos_duracao, chamadas_sem_tarifa = EXCLUDED.chamadas_sem_tarifa,
          usuarios_ativos = EXCLUDED.usuarios_ativos, coletado_em = EXCLUDED.coletado_em`);
      diasDeUso += lote.length;
    } catch (e) {
      falhas++;
      console.error(`[CallfaceAI] lote da série diária falhou:`, e instanceof Error ? e.message : e);
    }
  }

  // 6. Saúde do dia + semáforo + tarefas de CS. Isolados: se falharem, o
  //    espelho de uso que acabou de ser gravado continua valendo.
  let saudeGravada: ResultadoSync["saude"] = null;
  let tarefas: ResultadoTarefasSaude | null = null;
  try {
    const g = await gravarSaudeDoDia(organizacaoId, saude);
    saudeGravada = { linhas: g.linhas, mudancasDeSemaforo: g.mudancas.filter((m) => m.de !== null).length };
    falhas += g.falhas;
    await garantirMarcoZero(organizacaoId); // fixa o marco zero mesmo com a trava ligada
    // Trava de emergência: CALLFACE_AI_TAREFAS_CS=off mantém espelho e semáforo, mas não abre nem fecha tarefa.
    if (process.env.CALLFACE_AI_TAREFAS_CS?.trim().toLowerCase() !== "off") tarefas = await sincronizarTarefasDeSaude(organizacaoId);
  } catch (e) {
    falhas++;
    console.error("[CallfaceAI] saúde/tarefas falharam:", e instanceof Error ? e.message : e);
  }

  const duracaoMs = Date.now() - inicio;
  const status = falhas === 0 ? "ok" : snapshots > 0 ? "parcial" : "falhou";
  await gravarEstado(organizacaoId, RECURSO_SNAPSHOT, {
    status, itens: snapshots + nDetalhes + diasDeUso, duracaoMs, sucesso: falhas === 0,
    erro: falhas ? `${falhas} etapa(s) falharam (ver log [CallfaceAI])` : null,
  });

  return {
    ok: falhas === 0, status, tenants: vinculados.length, snapshots, detalhes: nDetalhes, diasDeUso,
    identidadesNovas: ident.vinculadas, ambiguidade, saude: saudeGravada, tarefas, duracaoMs,
    erro: falhas ? `${falhas} etapa(s) falharam` : undefined,
  };
}
