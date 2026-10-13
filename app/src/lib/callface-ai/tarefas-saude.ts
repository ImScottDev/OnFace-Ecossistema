/**
 * TAREFAS DE CS que nascem da saúde de uso da Callface AI.
 *
 * Roda no fim de cada sync (e é idempotente). Mesma porta de tarefa do resto
 * do CS (`lib/cs/tarefas`): nunca insert solto.
 *
 * As quatro regras contra o spam, todas AQUI e testáveis:
 *   (i)   UMA tarefa aberta por cliente e motivo. Enquanto ela vive, o fato
 *         novo ATUALIZA a que existe (número, prioridade), nunca cria outra.
 *   (ii)  Silêncio não se multiplica por dia: a mesma tarefa ENVELHECE e sobe
 *         de prioridade (`prioridadeDoSilencio`).
 *   (iii) Fecha sozinha quando o motivo some (voltou a usar), escrevendo o fato.
 *   (iv)  O corpo traz o NÚMERO (vem de `MotivoSaude.detalhe`): quanto, desde
 *         quando, contra o período anterior.
 * E o respiro: se uma PESSOA fechou a tarefa, a regra não a reabre antes de
 * `RESPIRO_DIAS[motivo]` dias.
 *
 * Dono: o CS responsável pela conta (`clientes.responsavel_id`). Sem
 * responsável, a tarefa nasce SEM dono e cai no filtro "Sem responsável" (a
 * fila da gestão de CS): isso é dito no corpo, não escondido.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import {
  atualizarTarefaAutomatica, criarTarefaCs, fecharTarefaAutomatica, fechadaPorPessoaRecentemente,
  tarefaAutomaticaAberta,
} from "@/lib/cs/tarefas";
import type { MotivoSaude } from "./saude-regras";
import { MOTIVOS_COM_TAREFA, RESPIRO_DIAS, diaCivilSp, planejarTarefa, podeAbrirTarefaPosMarco, tipoDaTarefa, type DiaDeSaude } from "./tarefas-saude-plano";

export { MOTIVOS_COM_TAREFA, RESPIRO_DIAS, planejarTarefa, tipoDaTarefa, fimDoDiaSp, prioridadeDoSilencio } from "./tarefas-saude-plano";

const RANK: Record<string, number> = { baixa: 0, media: 1, alta: 2, urgente: 3 };
const PREFIXO_SEM_DONO = "[Sem CS responsável nesta conta: fila da gestão de CS]";
const RODAPE = "\n\nGerada pela saúde de uso do Callface AI. Se o motivo acabar (o cliente voltar a usar), esta tarefa se fecha sozinha.";

export interface ResultadoTarefasSaude {
  criadas: number; atualizadas: number; fechadas: number; emRespiro: number; semResponsavel: number; antesDoMarco: number;
}

interface LinhaSaude extends Record<string, unknown> {
  empresa_id: string; empresa_nome: string; semaforo: string; motivos: MotivoSaude[]; dias_silencio: number | null;
}

/** Avisa o closer da venda (responsável da última oportunidade ganha) que o cliente chegou no teto. */
async function avisarCloser(empresaId: string, empresaNome: string, titulo: string): Promise<void> {
  try {
    const [c] = await db.execute<{ id: string }>(sql`
      SELECT o.responsavel_id::text AS id FROM oportunidades o
       WHERE o.empresa_id = ${empresaId}::uuid AND o.ganho_at IS NOT NULL AND o.responsavel_id IS NOT NULL
       ORDER BY o.ganho_at DESC LIMIT 1`);
    if (!c) return;
    await db.execute(sql`
      INSERT INTO notificacoes (usuario_id, tipo, titulo, mensagem, link)
      VALUES (${c.id}::uuid, 'callface_ai_expansao', ${`Oportunidade de expansão: ${empresaNome}`},
              ${titulo}, ${`/clientes/${empresaId}`})`);
  } catch (e) {
    console.error("[callface-ai] aviso ao closer falhou:", e instanceof Error ? e.message : e);
  }
}

const PROVIDER = "callface_ai";
const RECURSO_MARCO = "marco_zero_tarefas_cs";

/**
 * Marco zero da organização: o instante do primeiro sync bem-sucedido. Fica em
 * `integracao_sync_estado` (recurso próprio, `cursor` = ISO), gravado UMA vez.
 * Na primeira chamada deriva do histórico já espelhado (a linha de saúde mais
 * antiga), que é quando o primeiro sync de fato rodou; sem histórico, agora.
 * Chamar a cada sync, também com a trava `off` ligada, para o marco ficar
 * fixado antes de a trava ser retirada.
 */
export async function garantirMarcoZero(organizacaoId: string): Promise<Date> {
  const [h] = await db.execute<{ t: Date | null }>(sql`
    SELECT min(s.calculado_em) AS t FROM callface_ai_saude_diaria s
      JOIN callface_ai_external_identities i ON i.id = s.external_identity_id
      JOIN empresas e ON e.id = i.entity_id AND e.organizacao_id = ${organizacaoId}::uuid
     WHERE i.entity_type = 'empresa'`);
  const inicial = (h?.t ? new Date(h.t) : new Date()).toISOString();
  await db.execute(sql`
    INSERT INTO integracao_sync_estado (organizacao_id, provider, recurso, cursor, status, ultimo_sync_em)
    VALUES (${organizacaoId}::uuid, ${PROVIDER}, ${RECURSO_MARCO}, ${inicial}, 'ok', now())
    ON CONFLICT (organizacao_id, provider, recurso) DO NOTHING`);
  const [r] = await db.execute<{ cursor: string }>(sql`
    SELECT cursor FROM integracao_sync_estado
     WHERE organizacao_id = ${organizacaoId}::uuid AND provider = ${PROVIDER} AND recurso = ${RECURSO_MARCO}`);
  return new Date(r.cursor);
}

/**
 * Concilia as tarefas com a saúde de HOJE (a linha mais recente de cada
 * cliente em `callface_ai_saude_diaria`). Só olha linha fresca (últimos 2
 * dias): saúde velha, de sync parado, não pode fechar nem abrir tarefa.
 */
export async function sincronizarTarefasDeSaude(organizacaoId: string, agora = new Date()): Promise<ResultadoTarefasSaude> {
  const r: ResultadoTarefasSaude = { criadas: 0, atualizadas: 0, fechadas: 0, emRespiro: 0, semResponsavel: 0, antesDoMarco: 0 };
  const marco = await garantirMarcoZero(organizacaoId);
  const hist = new Map<string, DiaDeSaude[]>();
  for (const h of await db.execute<{ empresa_id: string; dia: string; motivos: MotivoSaude[] }>(sql`
    SELECT DISTINCT ON (i.entity_id, s.dia) i.entity_id::text AS empresa_id, s.dia::text AS dia, s.motivos
      FROM callface_ai_saude_diaria s
      JOIN callface_ai_external_identities i ON i.id = s.external_identity_id
      JOIN empresas e ON e.id = i.entity_id AND e.organizacao_id = ${organizacaoId}::uuid
     WHERE i.entity_type = 'empresa' AND s.semaforo <> 'sem_dado' AND s.dia >= ${diaCivilSp(marco)}::date
     ORDER BY i.entity_id, s.dia, s.calculado_em DESC`)) {
    const l = hist.get(h.empresa_id) ?? [];
    l.push({ dia: String(h.dia).slice(0, 10), codigos: (h.motivos ?? []).map((m) => m.codigo) });
    hist.set(h.empresa_id, l);
  }
  const linhas = await db.execute<LinhaSaude>(sql`
    SELECT DISTINCT ON (i.entity_id) i.entity_id::text AS empresa_id, e.nome AS empresa_nome,
           s.semaforo, s.motivos, s.dias_silencio
      FROM callface_ai_saude_diaria s
      JOIN callface_ai_external_identities i ON i.id = s.external_identity_id
      JOIN empresas e ON e.id = i.entity_id AND e.organizacao_id = ${organizacaoId}::uuid
     WHERE i.entity_type = 'empresa' AND s.semaforo <> 'sem_dado'
       AND s.dia >= (now() AT TIME ZONE 'America/Sao_Paulo')::date - 1
     ORDER BY i.entity_id, s.dia DESC, s.calculado_em DESC`);

  for (const l of linhas) {
    const ativos = new Map((l.motivos ?? []).filter((m) => MOTIVOS_COM_TAREFA.includes(m.codigo)).map((m) => [m.codigo, m] as const));
    for (const codigo of MOTIVOS_COM_TAREFA) {
      const tipo = tipoDaTarefa(codigo);
      const aberta = await tarefaAutomaticaAberta(organizacaoId, l.empresa_id, tipo);
      const motivo = ativos.get(codigo);

      if (!motivo) {
        if (aberta) {
          await fecharTarefaAutomatica(organizacaoId, aberta.id, codigo === "silencio"
            ? `o cliente voltou a usar o Callface AI (${l.dias_silencio ?? 0} dia(s) desde a última atividade).`
            : `o motivo "${codigo.replace(/_/g, " ")}" não se aplica mais em ${agora.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`);
          r.fechadas++;
        }
        continue;
      }

      const plano = planejarTarefa(l.empresa_nome, motivo, agora);
      if (aberta) {
        // Prioridade só SOBE: uma pessoa que subiu a mão não é rebaixada pelo robô.
        const prioridade = RANK[plano.prioridade] >= (RANK[aberta.prioridade] ?? 1) ? plano.prioridade : aberta.prioridade;
        const prefixo = aberta.descricao?.startsWith(PREFIXO_SEM_DONO) ? `${aberta.descricao.split("\n\n")[0]}\n\n` : "";
        if (await atualizarTarefaAutomatica(organizacaoId, aberta, { titulo: plano.titulo, descricao: prefixo + plano.descricao + RODAPE, prioridade })) r.atualizadas++;
        continue;
      }
      // Fato anterior ao primeiro sync fica visível na tela, mas não vira tarefa.
      if (!podeAbrirTarefaPosMarco(motivo, marco, hist.get(l.empresa_id) ?? [])) { r.antesDoMarco++; continue; }
      if (await fechadaPorPessoaRecentemente(organizacaoId, l.empresa_id, tipo, RESPIRO_DIAS[codigo])) { r.emRespiro++; continue; }

      const { criada, id } = await criarTarefaCs({
        organizacaoId, empresaId: l.empresa_id, tipo, origem: "AUTOMACAO",
        titulo: plano.titulo, motivo: motivo.rotulo,
        descricao: plano.descricao + RODAPE,
        prioridade: plano.prioridade === "urgente" ? "alta" : (plano.prioridade as "alta" | "media" | "baixa"),
        venceEm: plano.venceEm,
        // Chave do DIA: duas execuções no mesmo dia (sync a cada 6h) nunca criam duas.
        chaveIdempotencia: `CAI:${codigo}:${l.empresa_id}:${new Date(agora.getTime() - 3 * 3600_000).toISOString().slice(0, 10)}`,
      });
      if (!criada || !id) continue;
      r.criadas++;
      if (plano.prioridade === "urgente") {
        await db.execute(sql`UPDATE tarefas SET prioridade = 'urgente' WHERE id = ${id}::uuid AND organizacao_id = ${organizacaoId}::uuid`);
      }
      const [dono] = await db.execute<{ usuario_id: string | null }>(sql`SELECT usuario_id::text FROM tarefas WHERE id = ${id}::uuid`);
      if (!dono?.usuario_id) {
        r.semResponsavel++;
        await db.execute(sql`
          UPDATE tarefas SET descricao = ${PREFIXO_SEM_DONO}::text || E'\n\n' || coalesce(descricao, '')
           WHERE id = ${id}::uuid AND organizacao_id = ${organizacaoId}::uuid`);
      }
      if (codigo === "no_teto") await avisarCloser(l.empresa_id, l.empresa_nome, plano.titulo);
    }
  }
  return r;
}
