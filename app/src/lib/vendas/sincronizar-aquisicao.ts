/**
 * Propaga o estado do lead legado para a aquisição canônica (SPEC §17).
 *
 * Por que isto existe: o board de pré-vendas passou a LER `aquisicoes`,
 * enquanto as oito ações do módulo — mover etapa, qualificar, nutrir,
 * desqualificar, reativar, atribuir, registrar contato, salvar qualificação —
 * continuam ESCREVENDO em `leads`. Sem esta ponte, o usuário qualifica um lead,
 * salva, e o card não sai do lugar. Nada dá erro; o produto parece ter engolido
 * a ação, que é o pior tipo de bug porque ninguém consegue reportar.
 *
 * A regra que isto materializa: **leitura canônica exige que a sincronização
 * cubra tudo que a leitura usa.** Migrar a fonte sem conferir a propagação é
 * trocar a leitura e torcer.
 *
 * Some na fase 25, quando a escrita também for canônica e o lead legado deixar
 * de ser a fonte.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

/**
 * Espelha em `aquisicoes` o que a leitura do board usa.
 *
 * Best-effort de propósito: a ação comercial já foi gravada no legado, e falhar
 * aqui atrasa a tela, não perde o trabalho. O backfill reconcilia.
 */
export async function sincronizarAquisicaoDoLead(leadId: string): Promise<void> {
  // Etapa vigente da aquisição (gravada) com o legado como reserva.
  const etapaAtual = sql.raw(
    "COALESCE((SELECT pe.codigo FROM pipeline_etapas pe WHERE pe.id = a.etapa_id), l.estagio_pre_vendas)",
  );
  try {
    await db.execute(sql`
      UPDATE aquisicoes a
         SET
         -- COALESCE (B5, marco zero): a carga grava qualificado, desqualificado
             -- e nutricao na aquisição, e o lead legado pode chegar com esses
             -- campos vazios (e com estagio_pre_vendas defasado). Sobrescrever
             -- com o vazio do legado apagava o estado e devolvia o card ao
             -- Pré-vendas ativo, sem erro nenhum. O legado preenche, nunca
             -- apaga. Quem decide se o estado ainda vale é a ETAPA GRAVADA da
             -- aquisição, que já foi movida pelo comando antes desta ponte
             -- rodar; o estágio do lead só entra quando a aquisição não tem etapa.
             qualificado = COALESCE(l.qualificado, false)
               OR (a.qualificado AND ${etapaAtual} IN ('qualificado', 'oportunidade')),
             qualificado_em = COALESCE(l.qualificado_em, a.qualificado_em),
             desqualificado_em = CASE
               WHEN ${etapaAtual} = 'desqualificado' THEN COALESCE(l.desqualificado_em, a.desqualificado_em)
               ELSE l.desqualificado_em
             END,
             motivo_desqualificacao = CASE
               WHEN ${etapaAtual} = 'desqualificado' THEN COALESCE(l.desqualificacao_motivo, a.motivo_desqualificacao)
               ELSE l.desqualificacao_motivo
             END,
             -- Estado de nutrição é derivado: o legado guarda motivo e data de
             -- retomada, e a leitura só precisa saber SE está em nutrição.
             nutricao_status = CASE
               WHEN ${etapaAtual} = 'nutricao' THEN COALESCE(NULLIF(l.nutricao_motivo, ''), NULLIF(a.nutricao_status, ''), 'em_nutricao')
               ELSE NULL
             END,
             retomar_em = CASE
               WHEN ${etapaAtual} = 'nutricao' THEN COALESCE(l.nutricao_retomar_em, a.retomar_em)
             END,
             responsavel_id = l.responsavel_id,
             -- A empresa do lead faltava aqui, e a Empresa 360 lista os leads
             -- da conta por aquisicoes.empresa_id. Vincular uma empresa a um
             -- lead depois da criacao nao chegava no canonico, entao o lead nao
             -- aparecia na conta dele. Achado pelo aceite de vendas, que monta
             -- lead e empresa do zero: com o dado de producao ja sincronizado
             -- pelo backfill, medir o banco nao acusava nada.
             --
             -- COALESCE: o legado preenche, nunca apaga. Desvincular empresa no
             -- lead e raro e nao deveria orfanar a aquisicao em silencio.
             empresa_id = COALESCE(l.empresa_id, a.empresa_id),
             last_touch_at = GREATEST(
               COALESCE(l.last_contact_at, a.last_touch_at, l.created_at),
               COALESCE(a.first_touch_at, l.created_at)
             ),
             -- Aquisição encerra quando a pré-venda sai do fluxo ativo: virou
             -- oportunidade ou foi desqualificada. Encerrar por desqualificação
             -- é o que tira o card do board de ativos.
             closed_at = CASE
               WHEN l.desqualificado_em IS NOT NULL THEN l.desqualificado_em
               ELSE a.closed_at
             END,
             updated_at = now()
        FROM leads l
       WHERE l.id = ${leadId}::uuid AND a.lead_legado_id = l.id`);
  } catch (e) {
    console.error("[sincronizar-aquisicao] falhou; a ação comercial seguiu:", e);
  }
}

/**
 * O espelho confirma o que a ação acabou de gravar?
 *
 * `sincronizarAquisicaoDoLead` engole o erro de propósito (a ação comercial já
 * foi gravada no legado e o backfill reconcilia), o que é certo para o
 * pipeline de eventos mas deixa a TELA sem saber: o usuário salvava, via
 * "sucesso" e o board continuava no lugar antigo. Aqui a ação lê de volta pela
 * MESMA expressão do board (etapa gravada na aquisição; o legado só refina
 * "qualificacao") e, se divergir, tenta o espelho UMA vez e confere de novo.
 *
 * Devolve a mensagem para a tela, ou null quando concorda (ou quando não há
 * aquisição para espelhar: lead antigo sem ela não tem o que divergir).
 *
 * NÃO desfaz a gravação nem lança dentro do espelho: quem chama decide como
 * mostrar. A mensagem diz a verdade: gravou, mas o board não confirmou.
 */
export async function confirmarEspelho(
  organizacaoId: string,
  leadId: string,
  esperado: { etapa?: string; responsavelId?: string | null },
): Promise<string | null> {
  const ler = async () => {
    const [r] = await db.execute<{ tem: boolean; etapa: string | null; responsavel_id: string | null }>(sql`
      SELECT a.id IS NOT NULL AS tem,
             CASE WHEN l.estagio_pre_vendas = 'qualificacao' THEN 'qualificacao'
                  ELSE COALESCE(pe.codigo, l.estagio_pre_vendas) END AS etapa,
             a.responsavel_id::text AS responsavel_id
        FROM leads l
        LEFT JOIN aquisicoes a ON a.lead_legado_id = l.id
        LEFT JOIN pipeline_etapas pe ON pe.id = a.etapa_id
       WHERE l.id = ${leadId}::uuid AND l.organizacao_id = ${organizacaoId}::uuid`);
    return r ?? null;
  };
  const diverge = (r: Awaited<ReturnType<typeof ler>>) => {
    if (!r?.tem) return null;
    if (esperado.etapa !== undefined && r.etapa !== esperado.etapa) return `etapa (board: ${r.etapa ?? "vazia"}, esperado: ${esperado.etapa})`;
    if (esperado.responsavelId !== undefined && (r.responsavel_id ?? null) !== (esperado.responsavelId ?? null)) return "responsável";
    return null;
  };

  let falha = diverge(await ler());
  if (!falha) return null;
  await sincronizarAquisicaoDoLead(leadId);
  falha = diverge(await ler());
  if (!falha) return null;
  console.error(`[espelho] lead ${leadId}: o board não confirmou a gravação (${falha})`);
  return "Gravei no lead, mas o board ainda não reflete a mudança. Atualize a página; se continuar assim, avise o time.";
}
