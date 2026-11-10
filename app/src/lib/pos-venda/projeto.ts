/**
 * Leitura do projeto completo. Contrato: `Projeto` em contrato.ts. Uma chamada, tudo pronto.
 *
 * As fontes de cada dado e o porquê estão em `leitura-base.ts`. O que é decidido AQUI:
 *  - escopo: o snapshot congelado no Ganho; sem snapshot (projeto antigo), recalcula dos itens da oportunidade;
 *  - tarefas herdadas (upgrade): vêm da jornada anterior, concluídas, com a data histórica, sem duplicar linha em `tarefas`;
 *  - timeline: `lerLinhaDoTempo` da empresa a partir da entrada + marcos do próprio projeto (espera, conclusão, remarcação);
 *  - financeiro: `billingDaConta` só para o vínculo Stripe da CONTA (cliente), que não sofre a perda de 55/110 assinaturas
 *    sem `servico_id` (essa perda só afeta ligar assinatura a UM serviço, e o projeto não precisa disso);
 *  - o que o banco não tem fica null: `Nps.abertoEm`, `Retrato.primeiroAcessoEm`, `contrato` (não há rota de contrato).
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/app-url";
import { billingDaConta, linkStripeCustomer } from "@/lib/cs/billing";
import { lerLinhaDoTempo } from "@/lib/vendas/eventos";
import { valorLegivel } from "@/lib/vendas/respostas-formulario";
import type { EventoDoProjeto, Familia, Levantamento, Nps, Projeto, RespostaDoFormulario, TarefaDoProjeto } from "./contrato";
import { escopoDaOportunidade, escopoDoSnapshot } from "./escopo";
import { esperasDosProjetos } from "./espera";
import { linhasBase, pessoasDasEmpresas, type LinhaBase } from "./leitura-base";
import { estadoDe, itensDeChecklist, ordenarTarefas, progressoDe, relogiosDe, seAplica } from "./montagem";
import { playbookAtivo } from "./playbook";
import { retratoDeUso } from "./retrato";
import { dataDe, faixaDoNps, type PeriodoDeEspera } from "./regras";
import { tarefasDosProjetos } from "./tarefas-do-projeto";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TRES_DIAS = 3 * 86_400_000;

export async function projetoCompleto(organizacaoId: string, projetoId: string, agora: Date = new Date()): Promise<Projeto | null> {
  if (!UUID.test(projetoId) || !UUID.test(organizacaoId)) return null;
  const [l] = await linhasBase(organizacaoId, [projetoId]);
  if (!l) return null;

  const playbook = await playbookAtivo(organizacaoId, l.familia, l.tipo);
  const [esperasMapa, tarefasMapa, pessoasMapa, checklist] = await Promise.all([
    esperasDosProjetos(organizacaoId, [l.id]),
    tarefasDosProjetos(organizacaoId, [{ id: l.id, servicoId: l.servicoId }]),
    pessoasDasEmpresas(organizacaoId, [l.empresa.id]),
    itensDeChecklist(organizacaoId, [l.id]),
  ]);
  const esperas = esperasMapa.get(l.id) ?? [];
  const entrouEm = dataDe(l.entrouEm) ?? agora;
  const estado = estadoDe(l, esperas);

  const escopo = escopoDoSnapshot(l.snapshot) ?? (await escopoDaOportunidade(organizacaoId, l.oportunidadeId, l.familia));
  const herdado = await jornadaHerdada(organizacaoId, l);
  const proprias = tarefasMapa.get(l.id) ?? [];
  const condicional = (passo: string) => {
    const p = playbook?.passos.find((x) => x.passo === passo);
    return !!p && p.itensCondicionais.some((c) => escopo?.complementos.includes(c.complemento));
  };
  const tarefas = ordenarTarefas([...herdado.tarefas, ...proprias], playbook, condicional);
  const empresaId = l.empresa.id;

  const [stripe, notas, levantamento, formulario, nps, retrato, timeline] = await Promise.all([
    stripeDaEmpresa(organizacaoId, empresaId),
    notasDaEmpresa(organizacaoId, empresaId),
    levantamentoDaEmpresa(organizacaoId, empresaId),
    formularioDoProjeto(organizacaoId, l),
    l.familia === "CALLFACE_AI" ? npsDoProjeto(organizacaoId, empresaId, entrouEm) : Promise.resolve(null),
    l.familia === "CALLFACE_AI" ? retratoDeUso(organizacaoId, empresaId, agora) : Promise.resolve(null),
    timelineDoProjeto(organizacaoId, l, tarefas, esperas, entrouEm),
  ]);

  const irmao = await projetoIrmao(organizacaoId, l);
  const [propostaId] = l.oportunidadeId ? await db.execute<{ id: string }>(sql`
    SELECT id::text FROM propostas WHERE organizacao_id = ${organizacaoId}::uuid AND oportunidade_id = ${l.oportunidadeId}::uuid
     ORDER BY (status = 'aceita') DESC, created_at DESC LIMIT 1`) : [];

  const aberto = estado !== "CONCLUIDO" && estado !== "CANCELADO";
  const aplicam = tarefas.filter(seAplica);
  const itensLegados = checklist.get(l.id) ?? null;
  // Lista vazia não é lista concluída: `[].every()` é true e liberaria o handoff de um projeto sem nada feito.
  // Sem tarefa do motor vale o checklist legado, e só se existir e estiver completo.
  const feitas = aplicam.length > 0
    ? aplicam.every((t) => t.estado === "CONCLUIDA")
    : itensLegados != null && itensLegados.total > 0 && itensLegados.feitos === itensLegados.total;
  const base = appUrl();

  return {
    id: l.id, tipo: l.tipo, familia: l.familia, estado, ciclo: l.ciclo,
    empresa: { id: l.empresa.id, nome: l.empresa.nome, documento: l.empresa.documento },
    pessoas: pessoasMapa.get(empresaId) ?? [],
    responsavel: l.responsavel, vendedor: l.vendedor,
    escopo,
    links: {
      cliente360: empresaId ? `/clientes/${empresaId}` : null,
      oportunidade: l.oportunidadeId ? `/pipeline/${l.oportunidadeId}` : null,
      proposta: propostaId ? `/propostas/${propostaId.id}` : null,
      contrato: null, // não há rota de contrato no produto; null, não "#"
      stripe: stripe ? linkStripeCustomer(stripe) : null,
      projetoIrmao: irmao ? `/projetos/${irmao}` : null,
      formularioPublico: formulario?.link ?? null,
    },
    entrouEm,
    // Callface AI não tem T0 (contrato.ts). PABX/WL têm, mas nenhuma coluna grava isso hoje: null é a verdade.
    t0Em: null,
    concluidoEm: dataDe(l.concluidoEm),
    relogios: relogiosDe(l, playbook, esperas, agora),
    tarefas,
    progresso: progressoDe(tarefas, checklist.get(l.id), estado === "CONCLUIDO"),
    checklist: itensLegados,
    // Nota do time é evento do projeto (troca de responsável, handoff, combinado com o cliente): entra na linha do tempo.
    timeline: [...timeline, ...notas.map((n) => ({ id: `nota:${n.id}`, em: n.em, tipo: "nota", titulo: n.texto, detalhe: null, autor: "time" as const, porQuem: n.por }))]
      .sort((a, b) => b.em.getTime() - a.em.getTime()),
    levantamento, notas, formulario, nps, retratoDeUso: retrato,
    herdadoDe: herdado.info,
    // Permissão por papel do usuário não cabe aqui: a assinatura (organizacao, projeto) não recebe o usuário.
    // Estes flags dizem se a AÇÃO faz sentido no estado atual; a ação confere o papel.
    permissoes: {
      podeConcluirTarefa: aberto,
      podeMarcarEspera: aberto,
      podeEscalarParaImplantacao: aberto && l.tipo === "ONBOARDING" && l.familia !== "CALLFACE_AI" && !irmao,
      // NPS ainda não tem página pública (0 respostas em produção): enquanto isso, concluir o passo de NPS
      // (o último do playbook) conta como encerramento. Quando o NPS existir, volta a exigir a resposta.
      podeFazerHandoff: aberto && (l.familia === "CALLFACE_AI" ? (nps?.respondidoEm != null || feitas) : feitas),
      podeDarBaixaSemNps: aberto && l.familia === "CALLFACE_AI" && nps?.respondidoEm == null && nps?.esperaAte != null && nps.esperaAte.getTime() <= agora.getTime(),
      podeEditarPrazo: aberto,
    },
  };
}

// ---------------------------------------------------------------------------

/** Upgrade: o projeto herda da jornada anterior os passos que ela concluiu (id, data e responsável originais). */
async function jornadaHerdada(organizacaoId: string, l: LinhaBase): Promise<{ tarefas: Array<import("./tarefas-do-projeto").TarefaComProjeto>; info: Projeto["herdadoDe"] }> {
  if (!l.anteriorId) return { tarefas: [], info: null };
  const [ant] = await linhasBase(organizacaoId, [l.anteriorId]);
  if (!ant) return { tarefas: [], info: null };
  const brutas = await tarefasDosProjetos(organizacaoId, [{ id: ant.id, servicoId: ant.servicoId }]);
  const etapas = Array.isArray(l.etapasHerdadas) ? (l.etapasHerdadas as Array<{ passo?: string }>) : [];
  const passos = etapas.map((e) => e.passo).filter((p): p is string => !!p);
  // Só entram as tarefas CONCLUÍDAS da jornada anterior cujo passo foi marcado como herdado.
  const tarefas = (brutas.get(ant.id) ?? []).filter((t) => t.tarefa.estado === "CONCLUIDA" && passos.includes(t.passo));
  return { tarefas, info: { projetoId: ant.id, concluidoEm: dataDe(ant.concluidoEm), passosHerdados: passos } };
}

async function stripeDaEmpresa(organizacaoId: string, empresaId: string): Promise<string | null> {
  if (!empresaId) return null;
  const b = await billingDaConta(organizacaoId, empresaId);
  if (b.stripeCustomerId) return b.stripeCustomerId;
  const [e] = await db.execute<{ c: string | null }>(sql`
    SELECT stripe_customer_id AS c FROM empresas WHERE id = ${empresaId}::uuid AND organizacao_id = ${organizacaoId}::uuid`);
  return e?.c ?? null;
}

async function notasDaEmpresa(organizacaoId: string, empresaId: string): Promise<Projeto["notas"]> {
  if (!empresaId) return [];
  const r = await db.execute<{ id: string; em: string; por: string | null; texto: string }>(sql`
    SELECT n.id::text, to_json(n.created_at)#>>'{}' AS em, COALESCE(u.nome, n.autor_display_name) AS por, n.conteudo AS texto
      FROM notas n LEFT JOIN usuarios u ON u.id = n.autor_id
     WHERE n.organizacao_id = ${organizacaoId}::uuid
       AND n.empresa_id IN (SELECT id FROM empresas WHERE organizacao_id = ${organizacaoId}::uuid AND (id = ${empresaId}::uuid OR canonical_empresa_id = ${empresaId}::uuid))
     ORDER BY n.created_at DESC LIMIT 100`);
  return r.flatMap((n) => { const em = dataDe(n.em); return em ? [{ id: n.id, em, por: n.por, texto: n.texto }] : []; });
}

/** Levantamento mora na EMPRESA: `empresas.campos_custom.levantamento` (convenção desta entrega; não havia outro lugar). */
async function levantamentoDaEmpresa(organizacaoId: string, empresaId: string): Promise<Levantamento> {
  const vazio: Levantamento = { perfilDeUso: null, crmQueUsa: null, objetivoComACallface: null, extras: [] };
  if (!empresaId) return vazio;
  const [r] = await db.execute<{ lev: unknown }>(sql`
    SELECT campos_custom->'levantamento' AS lev FROM empresas WHERE id = ${empresaId}::uuid AND organizacao_id = ${organizacaoId}::uuid`);
  const lev = typeof r?.lev === "string" ? safe(r.lev) : r?.lev;
  if (!lev || typeof lev !== "object") return vazio;
  const o = lev as Record<string, unknown>;
  const txt = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const extras = Array.isArray(o.extras)
    ? (o.extras as Array<Record<string, unknown>>).flatMap((x) => (txt(x.chave) && txt(x.rotulo) ? [{ chave: txt(x.chave)!, rotulo: txt(x.rotulo)!, valor: txt(x.valor) }] : []))
    : [];
  return { perfilDeUso: txt(o.perfilDeUso), crmQueUsa: txt(o.crmQueUsa), objetivoComACallface: txt(o.objetivoComACallface), extras };
}
function safe(s: string): unknown { try { return JSON.parse(s); } catch { return null; } }

const STATUS_FORMULARIO: Record<string, NonNullable<Projeto["formulario"]>["status"]> = {
  NOT_SENT: "nao_enviado", SENT: "enviado", IN_PROGRESS: "enviado", SUBMITTED: "respondido",
  IN_REVIEW: "em_revisao", CORRECTION_REQUIRED: "em_revisao", APPROVED: "aprovado",
};

/** Formulário público de coleta: só PABX e White Label têm (Callface AI não coleta material). */
async function formularioDoProjeto(organizacaoId: string, l: LinhaBase): Promise<Projeto["formulario"]> {
  const caminho = l.familia === "PABX" ? "/impl-pabx/" : l.familia === "WHITE_LABEL" ? "/impl-white-label/" : null;
  if (!caminho) return null;
  const [f] = await db.execute<{ status: string; respostas: unknown; enviado_em: string | null; submetido_em: string | null }>(sql`
    SELECT status, respostas, to_json(enviado_em)#>>'{}' AS enviado_em, to_json(submetido_em)#>>'{}' AS submetido_em
      FROM fulfillment_formularios WHERE organizacao_id = ${organizacaoId}::uuid AND fulfillment_id = ${l.id}::uuid
     ORDER BY created_at DESC LIMIT 1`);
  return {
    status: f ? (STATUS_FORMULARIO[f.status] ?? "nao_enviado") : "nao_enviado",
    enviadoEm: dataDe(f?.enviado_em), respondidoEm: dataDe(f?.submetido_em),
    respondidoPor: null, // o formulário público é anônimo (token): ninguém para nomear
    respostas: respostasLegiveis(f?.respostas),
    link: `${appUrl()}${caminho}${l.publicToken}`,
  };
}

/** jsonb cru -> pergunta/resposta. Estrutura aninhada vira texto JSON compacto; nada é descartado em silêncio. */
export function respostasLegiveis(bruto: unknown): RespostaDoFormulario[] {
  const o = typeof bruto === "string" ? safe(bruto) : bruto;
  if (!o || typeof o !== "object" || Array.isArray(o)) return [];
  return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => {
    if (v == null || v === "") return [];
    const pergunta = valorLegivel(k);
    if (typeof v === "string") return [{ pergunta, resposta: valorLegivel(v), arquivo: null }];
    if (typeof v === "number" || typeof v === "boolean") return [{ pergunta, resposta: String(v), arquivo: null }];
    return [{ pergunta, resposta: JSON.stringify(v), arquivo: null }];
  });
}

/** NPS de onboarding da empresa nascido depois da entrada. Sem linha = null (o `enviarNps` a cria). */
async function npsDoProjeto(organizacaoId: string, empresaId: string, entrouEm: Date): Promise<Nps | null> {
  if (!empresaId) return null;
  const [n] = await db.execute<{ token: string | null; score: number | null; comentario: string | null; enviado_em: string | null; respondido_em: string | null }>(sql`
    SELECT n.token, n.score, n.comentario, to_json(n.enviado_em)#>>'{}' AS enviado_em, to_json(n.respondido_em)#>>'{}' AS respondido_em
      FROM nps_respostas n
     WHERE n.organizacao_id = ${organizacaoId}::uuid AND n.tipo = 'onboarding' AND n.created_at >= ${entrouEm.toISOString()}::timestamptz
       AND (n.empresa_id IN (SELECT id FROM empresas WHERE organizacao_id = ${organizacaoId}::uuid AND (id = ${empresaId}::uuid OR canonical_empresa_id = ${empresaId}::uuid))
            OR n.lead_id IN (SELECT id FROM leads WHERE organizacao_id = ${organizacaoId}::uuid AND empresa_id = ${empresaId}::uuid))
     ORDER BY n.created_at DESC LIMIT 1`);
  if (!n || !n.token) return null;
  const enviadoEm = dataDe(n.enviado_em), respondidoEm = dataDe(n.respondido_em);
  return {
    enviadoEm,
    abertoEm: null, // a tabela não registra abertura; ver relatório
    respondidoEm, nota: n.score, faixa: faixaDoNps(n.score), comentario: n.comentario,
    link: `${appUrl()}/nps/${n.token}`,
    esperaAte: enviadoEm && !respondidoEm ? new Date(enviadoEm.getTime() + TRES_DIAS) : null,
  };
}

async function projetoIrmao(organizacaoId: string, l: LinhaBase): Promise<string | null> {
  const outro = l.tipo === "ONBOARDING" ? "IMPLEMENTATION" : "ONBOARDING";
  const [r] = await db.execute<{ id: string }>(sql`
    SELECT id::text FROM fulfillments
     WHERE organizacao_id = ${organizacaoId}::uuid AND tipo = ${outro} AND id <> ${l.id}::uuid AND cancelled_at IS NULL
       AND ((${l.oportunidadeId}::uuid IS NOT NULL AND oportunidade_id = ${l.oportunidadeId}::uuid AND service_family = ${l.familia})
         OR servico_canonico_id = ${l.servicoId}::uuid)
     ORDER BY created_at DESC LIMIT 1`);
  return r?.id ?? null;
}

async function timelineDoProjeto(
  organizacaoId: string, l: LinhaBase, tarefas: TarefaDoProjeto[], esperas: PeriodoDeEspera[], entrouEm: Date,
): Promise<EventoDoProjeto[]> {
  const eventos: EventoDoProjeto[] = [{
    id: `entrada:${l.id}`, em: entrouEm, tipo: "projeto_criado", titulo: "Projeto criado", detalhe: null, autor: "sistema", porQuem: null,
  }];
  const concluido = dataDe(l.concluidoEm);
  if (concluido) eventos.push({ id: `fim:${l.id}`, em: concluido, tipo: "projeto_concluido", titulo: "Projeto concluído", detalhe: null, autor: "time", porQuem: null });
  for (const e of esperas) {
    eventos.push({ id: `espera:${e.inicio.getTime()}`, em: e.inicio, tipo: "espera_iniciada", titulo: `Aguardando ${e.motivo}`, detalhe: e.detalhe, autor: "time", porQuem: null });
    if (e.fim) eventos.push({ id: `espera-fim:${e.fim.getTime()}`, em: e.fim, tipo: "espera_encerrada", titulo: `Espera de ${e.motivo} encerrada`, detalhe: null, autor: "time", porQuem: null });
  }
  for (const t of tarefas) {
    if (t.concluidaEm) eventos.push({ id: `tarefa:${t.id}`, em: t.concluidaEm, tipo: "tarefa_concluida", titulo: `Concluiu: ${t.titulo}`, detalhe: null, autor: "time", porQuem: t.responsavel?.nome ?? null });
  }
  // Remarcações: guardam a data ANTERIOR (a spec exige que o ajuste seja visível, não apague histórico).
  const ids = tarefas.map((t) => t.id);
  if (ids.length) {
    const rem = await db.execute<{ id: string; aggregate_id: string; em: string; de: string | null; para: string | null; nome: string | null }>(sql`
      SELECT e.id::text, e.aggregate_id::text, to_json(e.occurred_at)#>>'{}' AS em, e.payload->>'de' AS de, e.payload->>'para' AS para, u.nome
        FROM domain_events e LEFT JOIN usuarios u ON u.id = e.actor_id
       WHERE e.organizacao_id = ${organizacaoId}::uuid AND e.aggregate_type = 'tarefa' AND e.event_type = 'TaskRescheduled'
         AND e.aggregate_id IN (${sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `)})`);
    const nomeDe = new Map(tarefas.map((t) => [t.id, t.titulo]));
    const dia = (v: string | null) => { const d = dataDe(v); return d ? d.toISOString().slice(0, 10) : "sem data"; };
    for (const r of rem) {
      const em = dataDe(r.em);
      if (em) eventos.push({ id: `remarca:${r.id}`, em, tipo: "prazo_remarcado", titulo: `Prazo remarcado: ${nomeDe.get(r.aggregate_id) ?? "tarefa"}`, detalhe: `de ${dia(r.de)} para ${dia(r.para)}`, autor: "time", porQuem: r.nome });
    }
  }
  if (l.empresa.id) {
    const linhas = await lerLinhaDoTempo({ organizacaoId, empresaId: l.empresa.id, limite: 200 });
    for (const x of linhas) {
      const em = dataDe(x.ocorridoEm);
      if (!em || em < entrouEm) continue;
      const direcao = (x.contexto as Record<string, unknown> | null)?.direcao;
      const resumo = (x.contexto as Record<string, unknown> | null)?.resumo;
      eventos.push({
        id: x.id, em, tipo: String(x.tipo), titulo: x.titulo ?? String(x.tipo), detalhe: typeof resumo === "string" && resumo ? resumo : null,
        autor: direcao === "in" ? "cliente" : /^(SYSTEM|AUTOMATION)$/i.test(x.atorTipo) ? "sistema" : "time", porQuem: x.usuarioNome,
      });
    }
  }
  return eventos.sort((a, b) => b.em.getTime() - a.em.getTime());
}
