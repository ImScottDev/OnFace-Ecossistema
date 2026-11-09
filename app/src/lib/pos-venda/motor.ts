/**
 * O MOTOR do pós-venda: preenche o projeto que o Ganho acabou de abrir.
 *
 * NÃO é um quinto caminho de Ganho. A jornada (fulfillment) continua nascendo nos dois pontos de sempre,
 * `criarPosVendaDoNegocio` (lib/crm/pos-venda.ts) e `criarFulfillmentsParaServicos` (lib/crm/fulfillment.ts);
 * os dois chamam `prepararProjeto` logo depois do INSERT, no lugar de criar a "primeira tarefa" na unha.
 *
 * O que preenche (e que ninguém preenchia: target_at nulo em 74 de 74, escopo_vendido_snapshot em 0):
 *   - escopo_vendido_snapshot, congelado UMA vez (nunca sobrescreve);
 *   - target_at e due_at, do prazo total do playbook;
 *   - responsável, da configuração por família (playbook.responsavel_padrao_id);
 *   - as tarefas do playbook por `criarTarefaCs` (origem ONBOARDING, chave `ONBOARDING:{projeto}:{passo}`), cada uma
 *     com o playbook em markdown na descrição e o checklist como subtarefas;
 *   - upgrade: cliente que já concluiu a mesma família -> `fulfillment_anterior_id` + `etapas_herdadas` e SÓ a
 *     tarefa de contato (mais, se o complemento vendido é novo, o conteúdo condicional dele).
 *
 * Idempotente: roda duas vezes e não duplica (chave de idempotência da tarefa; escrita do projeto só onde está vazio).
 * Nunca lança para o chamador: o Ganho já aconteceu. Falha vira `{ aplicado: false, motivo }` e log com contexto.
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { tarefaSubtarefas } from "@/lib/db/schema";
import { criarTarefaCs, type OrigemTarefa } from "@/lib/cs/tarefas";
import { escopoDaOportunidade, type EscopoCongelado } from "./escopo";
import { linhasBase, type LinhaBase } from "./leitura-base";
import { playbookAtivo, type PassoDoMotor, type PlaybookDoMotor } from "./playbook";
import { dataDe, vencimentoDoPasso } from "./regras";

const DIA = 86_400_000;

export interface ResultadoDoMotor {
  aplicado: boolean;
  motivo?: string;
  tarefasCriadas: number;
  tarefasJaExistiam: number;
  upgrade: boolean;
  anteriorId: string | null;
}
const nada = (motivo: string): ResultadoDoMotor => ({ aplicado: false, motivo, tarefasCriadas: 0, tarefasJaExistiam: 0, upgrade: false, anteriorId: null });

/** Chave determinística da tarefa do passo: impede duplicar as 7 e liga a tarefa ao projeto na leitura. */
export const chaveDoPasso = (origem: OrigemTarefa, projetoId: string, passo: string) => `${origem}:${projetoId}:${passo}`;

export interface EtapaHerdada { passo: string; titulo: string; concluidaEm: string | null; tarefaId: string | null }

/** Passos que a nova jornada cria, dado o que foi vendido e se é upgrade. Pura: o teste prova a regra sem banco. */
export function passosDaJornada(
  playbook: Pick<PlaybookDoMotor, "passos">,
  o: { complementos: string[]; upgrade: boolean; complementosAnteriores: string[] | null },
): Array<{ passo: PassoDoMotor; titulo: string; playbook: string; itens: string[]; conteudoCondicional: boolean }> {
  const saida: Array<{ passo: PassoDoMotor; titulo: string; playbook: string; itens: string[]; conteudoCondicional: boolean }> = [];
  for (const p of [...playbook.passos].sort((a, b) => a.ordem - b.ordem)) {
    if (p.condicao && !o.complementos.includes(p.condicao.complemento)) continue;
    const aplicaveis = p.itensCondicionais.filter((c) => o.complementos.includes(c.complemento));
    if (o.upgrade) {
      // Upgrade: o passo de contato nasce na sua variante; o conteúdo condicional só nasce se o complemento é NOVO
      // (anterior conhecido e sem ele). Anterior desconhecido não dispara: melhor não criar do que repetir treino.
      if (p.varianteUpgrade) {
        saida.push({ passo: p, titulo: p.varianteUpgrade.titulo, playbook: p.varianteUpgrade.playbook, itens: p.varianteUpgrade.itens, conteudoCondicional: false });
        continue;
      }
      const novos = aplicaveis.filter((c) => o.complementosAnteriores != null && !o.complementosAnteriores.includes(c.complemento));
      if (novos.length) {
        saida.push({ passo: p, titulo: p.titulo, playbook: novos.map((c) => c.playbook).join("\n\n"), itens: novos.flatMap((c) => c.itens), conteudoCondicional: true });
      }
      continue;
    }
    saida.push({
      passo: p, titulo: p.titulo,
      playbook: [p.playbook, ...aplicaveis.map((c) => c.playbook)].filter(Boolean).join("\n\n"),
      itens: [...p.itens, ...aplicaveis.flatMap((c) => c.itens)],
      conteudoCondicional: aplicaveis.length > 0,
    });
  }
  return saida;
}

/** Prioridade que `criarTarefaCs` aceita (alta|media|baixa); urgente vira alta. */
const prioridadeDaTarefa = (p: string): "alta" | "media" | "baixa" => (p === "baixa" ? "baixa" : p === "media" ? "media" : "alta");

export async function prepararProjeto(p: { organizacaoId: string; fulfillmentId: string; agora?: Date }): Promise<ResultadoDoMotor> {
  try {
    return await preparar(p);
  } catch (e) {
    console.error(`[pos-venda/motor] falha ao preparar o projeto ${p.fulfillmentId} (o Ganho segue valendo):`, e);
    return nada(e instanceof Error ? e.message : String(e));
  }
}

async function preparar(p: { organizacaoId: string; fulfillmentId: string }): Promise<ResultadoDoMotor> {
  const { organizacaoId, fulfillmentId } = p;
  const [l] = await linhasBase(organizacaoId, [fulfillmentId]);
  if (!l) return nada("projeto não encontrado (ou família fora das três do contrato)");
  const playbook = await playbookAtivo(organizacaoId, l.familia, l.tipo);
  if (!playbook) return nada(`sem playbook ativo para ${l.familia}/${l.tipo}`);
  if (l.status === "COMPLETED" || l.status === "CANCELED") return nada(`projeto ${l.status}: não recebe tarefas novas`);
  if (!l.empresa.resolvida) return nada("projeto sem empresa identificável: tarefas precisam de empresa");

  const entrouEm = dataDe(l.entrouEm) ?? new Date();
  const escopo = await escopoDaOportunidade(organizacaoId, l.oportunidadeId, l.familia);
  const anterior = await jornadaAnterior(organizacaoId, l);
  const upgrade = anterior != null;

  // 1. O projeto. Cada coluna só é escrita enquanto está vazia: o motor preenche, não sobrescreve decisão humana.
  const alvo = new Date(entrouEm.getTime() + playbook.prazoTotalDias * DIA).toISOString();
  const responsavelId = playbook.responsavelPadraoId ?? l.responsavel?.id ?? null;
  await db.execute(sql`
    UPDATE fulfillments SET
      target_at = COALESCE(target_at, ${alvo}::timestamptz),
      due_at = COALESCE(due_at, ${alvo}::timestamptz),
      escopo_vendido_snapshot = COALESCE(escopo_vendido_snapshot, ${escopo ? JSON.stringify(escopo) : null}::jsonb),
      -- a configuração por família manda; sem ela, mantém o responsável que o caminho de criação já resolveu
      responsavel_id = COALESCE(${playbook.responsavelPadraoId}::uuid, responsavel_id),
      fulfillment_anterior_id = COALESCE(fulfillment_anterior_id, ${anterior?.id ?? null}::uuid),
      etapas_herdadas = CASE WHEN ${anterior ? JSON.stringify(anterior.etapas) : null}::jsonb IS NULL THEN etapas_herdadas
                             ELSE ${anterior ? JSON.stringify(anterior.etapas) : null}::jsonb END,
      updated_at = now()
     WHERE id = ${fulfillmentId}::uuid AND organizacao_id = ${organizacaoId}::uuid`);

  // 2. As tarefas.
  const origem: OrigemTarefa = l.tipo === "IMPLEMENTATION" ? "IMPLANTACAO" : "ONBOARDING";
  const complementos = escopo?.complementos ?? [];
  const passos = passosDaJornada(playbook, { complementos, upgrade, complementosAnteriores: anterior?.complementos ?? null });
  let criadas = 0, existiam = 0;
  for (const j of passos) {
    const venceEm = vencimentoDoPasso(playbook, j.passo, entrouEm);
    const r = await criarTarefaCs({
      organizacaoId, empresaId: l.empresa.id, titulo: j.titulo, tipo: `${origem.toLowerCase()}_${j.passo.passo}`, origem,
      descricao: j.playbook, prioridade: prioridadeDaTarefa(j.passo.prioridade), venceEm,
      servicoCanonicoId: l.servicoId, usuarioId: responsavelId ?? l.responsavel?.id ?? null,
      chaveIdempotencia: chaveDoPasso(origem, fulfillmentId, j.passo.passo),
    });
    if (!r.id) throw new Error(`tarefa do passo ${j.passo.passo} não foi criada nem encontrada`);
    if (!r.criada) { existiam += 1; continue; }
    criadas += 1;
    // Checklist do passo = subtarefas. Inserção direta, e não `criarSubtarefa`: aquela porta exige um USUÁRIO como autor
    // (grava o evento em nome dele e o notifica), e aqui quem age é o sistema no Ganho.
    if (j.itens.length) {
      await db.insert(tarefaSubtarefas).values(j.itens.map((titulo, i) => ({ organizacaoId, tarefaId: r.id!, titulo, ordem: i })));
    }
  }
  return { aplicado: true, tarefasCriadas: criadas, tarefasJaExistiam: existiam, upgrade, anteriorId: anterior?.id ?? null };
}

/**
 * A jornada concluída anterior da mesma empresa, mesma família e tipo, de OUTRA venda. Null = primeira jornada.
 * Etapas herdadas: as tarefas que ela concluiu (id e data originais); jornada anterior sem tarefas por passo
 * (anterior ao motor, 54 em produção) herda todos os passos do playbook, com a data de conclusão da jornada.
 */
async function jornadaAnterior(organizacaoId: string, l: LinhaBase): Promise<{ id: string; etapas: EtapaHerdada[]; complementos: string[] | null } | null> {
  const [ant] = await db.execute<{ id: string; concluido_em: string | null; snapshot: unknown }>(sql`
    SELECT f.id::text, to_json(f.completed_at)#>>'{}' AS concluido_em, f.escopo_vendido_snapshot AS snapshot
      FROM fulfillments f
      JOIN servicos_canonicos sc ON sc.id = f.servico_canonico_id
     WHERE f.organizacao_id = ${organizacaoId}::uuid AND f.id <> ${l.id}::uuid
       AND f.tipo = ${l.tipo} AND COALESCE(sc.service_family, f.service_family) = ${l.familia}
       AND f.status = 'COMPLETED' AND f.completed_at IS NOT NULL AND f.cancelled_at IS NULL
       -- só o que veio ANTES: reexecutar o motor num projeto velho não pode herdar de um mais novo
       AND f.created_at < (SELECT created_at FROM fulfillments WHERE id = ${l.id}::uuid AND organizacao_id = ${organizacaoId}::uuid)
       AND (${l.oportunidadeId}::uuid IS NULL OR f.oportunidade_id IS DISTINCT FROM ${l.oportunidadeId}::uuid)
       AND COALESCE(sc.empresa_id, (SELECT lx.empresa_id FROM leads lx WHERE lx.id = sc.lead_id)) IN
           (SELECT e.id FROM empresas e WHERE e.organizacao_id = ${organizacaoId}::uuid AND (e.id = ${l.empresa.id}::uuid OR e.canonical_empresa_id = ${l.empresa.id}::uuid))
     ORDER BY f.completed_at DESC LIMIT 1`);
  if (!ant) return null;

  const feitas = await db.execute<{ id: string; chave: string; titulo: string; concluida_em: string | null }>(sql`
    SELECT t.id::text, t.chave_idempotencia AS chave, t.titulo, to_json(t.concluida_em)#>>'{}' AS concluida_em
      FROM tarefas t
     WHERE t.organizacao_id = ${organizacaoId}::uuid AND t.status = 'concluida'
       AND (t.chave_idempotencia LIKE ${`ONBOARDING:${ant.id}:%`} OR t.chave_idempotencia LIKE ${`IMPLANTACAO:${ant.id}:%`})`);
  let etapas: EtapaHerdada[] = feitas.map((t) => ({ passo: t.chave.split(":").slice(2).join(":"), titulo: t.titulo, concluidaEm: t.concluida_em, tarefaId: t.id }));
  if (etapas.length === 0) {
    const pb = await playbookAtivo(organizacaoId, l.familia, l.tipo);
    etapas = (pb?.passos ?? []).filter((x) => !x.condicao).map((x) => ({ passo: x.passo, titulo: x.titulo, concluidaEm: ant.concluido_em, tarefaId: null }));
  }
  const snap = typeof ant.snapshot === "string" ? safeJson(ant.snapshot) : ant.snapshot;
  const comp = snap && typeof snap === "object" && Array.isArray((snap as EscopoCongelado).complementos) ? (snap as EscopoCongelado).complementos : null;
  return { id: ant.id, etapas, complementos: comp };
}
function safeJson(s: string): unknown { try { return JSON.parse(s); } catch { return null; } }
