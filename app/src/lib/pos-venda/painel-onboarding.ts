/**
 * Painel de Onboarding (/pos-vendas) — a leitura que alimenta o desenho do
 * handoff (`OnboardingProto`).
 *
 * O protótipo lia um STORE (`window.OnFaceProjetos`) que calculava fase, gate
 * e estado a partir de chaves próprias ("kick", "form", "passagem") que o banco
 * não tem. Em vez de portar aquele `calc()`, o servidor devolve o resultado já
 * calculado sobre o dado REAL: checklist em `fulfillment_itens` e o gate de
 * handoff com as MESMAS regras de `handoff-implantacao.ts` (kickoff realizado,
 * material enviado, implantador definido).
 *
 * Arquivo próprio da tela: `lib/vendas/consultas.ts` é compartilhado.
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { MARCOS_AI, MARCO_AI_POR_WORKSTREAM, FASE_PABX_POR_WORKSTREAM } from "@/lib/crm/pos-venda-checklists";

export interface ItemOnboarding {
  id: string; titulo: string; workstream: string; status: string; ordem: number;
  blockerType: string | null; blockerReason: string | null; blockedAt: string | null;
}

export interface ProjetoOnboarding {
  id: string;
  tipo: "onboarding" | "implantacao";
  status: string;
  familia: string;
  empresa: string;
  empresaId: string | null;
  oferta: string;
  oppId: string | null;
  resp: string;
  respId: string | null;
  pessoa: string;
  cargo: string;
  telefone: string | null;
  email: string | null;
  notas: { texto: string }[];
  eventos: { t: string; meta: string; quando: string }[];
  bloqueio: { kind: "cliente" | "externo"; t: string } | null;
  /* Sem prazo no banco (target_at, due_at e due_date vazios em 100% das
     linhas). `null` é a verdade; o adaptador troca o "prazo NaN/NaN" que o
     desenho montaria por "sem prazo definido". */
  prazo: null;
  concluido: false;
  handoff: null;
  c: Record<string, any>;
}

export interface AtividadeHoje {
  id: string; projetoId: string; tipo: "Reunião"; titulo: string; empresa: string; resp: string;
  iniD: string; iniH: string; situacao: string;
}

export interface PainelOnboarding {
  projetos: ProjetoOnboarding[];
  hoje: AtividadeHoje[];
  equipe: { id: string; nome: string }[];
}

const FASE_PABX_ROTULO: Record<string, string> = {
  planejamento: "Planejamento", preparacao: "Preparação", execucao: "Execução", validacao: "Validação",
};

function iso(v: unknown): string | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Fase exibida no cartão: o vocabulário que o produto já usa por família. */
function faseDe(familia: string, primeiroPendente: ItemOnboarding | undefined): string {
  if (!primeiroPendente) return "Checklist concluído";
  if (familia === "CALLFACE_AI") {
    const k = MARCO_AI_POR_WORKSTREAM[primeiroPendente.workstream];
    return MARCOS_AI.find((m) => m.key === k)?.label ?? primeiroPendente.workstream;
  }
  if (familia === "PABX") {
    const k = FASE_PABX_POR_WORKSTREAM[primeiroPendente.workstream];
    return k ? FASE_PABX_ROTULO[k] : primeiroPendente.workstream;
  }
  return primeiroPendente.workstream;
}

export async function painelOnboarding(organizacaoId: string): Promise<PainelOnboarding> {
  const linhas = await db.execute<Record<string, any>>(sql`
    SELECT f.id::text, f.tipo, f.status, f.service_family,
           f.responsavel_id::text AS resp_id, u.nome AS resp_nome,
           sc.id::text AS servico_id, sc.empresa_id::text, sc.lead_id::text,
           sc.oportunidade_origem_id::text AS opp_id, sc.canonical_product,
           e.nome AS empresa_nome, l.empresa AS lead_empresa,
           l.nome AS contato_nome, l.cargo, l.email, l.telefone,
           oc.implementation_required AS exige_implantacao,
           /* Gate de handoff: cópia LITERAL de handoff-implantacao.ts:carregar.
              Repetir aqui evita N consultas (uma por projeto) e o critério é o
              mesmo que o command aplica ao confirmar — se divergir, o command
              recusa e a tela mostra o motivo. */
           (EXISTS (SELECT 1 FROM reunioes r
                     WHERE r.organizacao_id = f.organizacao_id
                       AND r.status IN ('realizada','concluida')
                       AND (r.negocio_id = sc.oportunidade_origem_id OR r.lead_id = sc.lead_id))
            OR EXISTS (SELECT 1 FROM fulfillment_itens i
                        WHERE i.fulfillment_id = f.id AND i.completed_at IS NOT NULL
                          AND (lower(i.titulo) LIKE '%kickoff%' OR lower(i.workstream) LIKE '%kickoff%'))
           ) AS tem_kickoff,
           (EXISTS (SELECT 1 FROM file_links fl WHERE fl.entity_type = 'fulfillment' AND fl.entity_id = f.id)
            OR EXISTS (SELECT 1 FROM fulfillment_itens i
                        WHERE i.fulfillment_id = f.id AND i.completed_at IS NOT NULL
                          AND (lower(i.titulo) LIKE '%material%' OR lower(i.titulo) LIKE '%formul%'))
           ) AS material_enviado,
           (SELECT f2.id::text FROM fulfillments f2
             WHERE f2.servico_canonico_id = f.servico_canonico_id AND f2.tipo = 'IMPLEMENTATION' LIMIT 1
           ) AS implantacao_existente
      FROM fulfillments f
      JOIN servicos_canonicos sc ON sc.id = f.servico_canonico_id
      LEFT JOIN empresas e ON e.id = sc.empresa_id
      LEFT JOIN leads l ON l.id = sc.lead_id
      LEFT JOIN usuarios u ON u.id = f.responsavel_id
      LEFT JOIN ofertas_comerciais oc ON oc.id = sc.oferta_comercial_id
     WHERE f.organizacao_id = ${organizacaoId}::uuid
       AND f.completed_at IS NULL AND f.cancelled_at IS NULL
     ORDER BY f.started_at DESC NULLS LAST`);

  const ids = linhas.map((l) => l.id as string);
  const equipeRows = await db.execute<{ id: string; nome: string }>(sql`
    SELECT id::text, nome FROM usuarios
     WHERE organizacao_id = ${organizacaoId}::uuid AND ativo ORDER BY nome`);
  const equipe = equipeRows.map((u) => ({ id: u.id, nome: u.nome }));
  if (!ids.length) return { projetos: [], hoje: [], equipe };

  const idsSql = sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `);
  const itensRows = await db.execute<Record<string, any>>(sql`
    SELECT id::text, fulfillment_id::text, titulo, workstream, status, ordem,
           blocker_type, blocker_reason, blocked_at
      FROM fulfillment_itens WHERE fulfillment_id IN (${idsSql}) ORDER BY ordem`);
  const itensPor = new Map<string, ItemOnboarding[]>();
  for (const r of itensRows) {
    const l = itensPor.get(r.fulfillment_id) ?? [];
    l.push({ id: r.id, titulo: r.titulo, workstream: r.workstream, status: r.status, ordem: r.ordem,
      blockerType: r.blocker_type, blockerReason: r.blocker_reason, blockedAt: iso(r.blocked_at) });
    itensPor.set(r.fulfillment_id, l);
  }

  // Timeline do drawer: os 4 fatos mais recentes do serviço, da oportunidade
  // de origem ou da empresa — os três ganchos que `timeline_events` tem.
  const tlRows = await db.execute<Record<string, any>>(sql`
    SELECT f.id::text AS fid, t.titulo, t.descricao, t.occurred_at
      FROM fulfillments f
      JOIN servicos_canonicos sc ON sc.id = f.servico_canonico_id
      CROSS JOIN LATERAL (
        SELECT titulo, descricao, occurred_at FROM timeline_events t
         WHERE t.organizacao_id = f.organizacao_id
           AND (t.servico_canonico_id = sc.id
                OR (sc.oportunidade_origem_id IS NOT NULL AND t.oportunidade_id = sc.oportunidade_origem_id)
                OR (sc.empresa_id IS NOT NULL AND t.empresa_id = sc.empresa_id))
         ORDER BY occurred_at DESC LIMIT 4) t
     WHERE f.id IN (${idsSql})`);

  const notasRows = await db.execute<Record<string, any>>(sql`
    SELECT DISTINCT ON (n.lead_id) n.lead_id::text, n.conteudo
      FROM notas n WHERE n.organizacao_id = ${organizacaoId}::uuid
       AND n.lead_id IN (SELECT sc.lead_id FROM fulfillments f JOIN servicos_canonicos sc ON sc.id = f.servico_canonico_id WHERE f.id IN (${idsSql}))
     ORDER BY n.lead_id, n.created_at DESC`);
  const notaPorLead = new Map(notasRows.map((n) => [n.lead_id as string, String(n.conteudo)]));

  /* "Agenda de hoje": reuniões de HOJE (fuso de São Paulo) dos leads dos
     projetos ativos. É a única fonte com data — os itens de checklist não têm
     due_date. Hoje (01/10) são zero: as 7 reuniões ligadas estão no passado. */
  const hojeRows = await db.execute<Record<string, any>>(sql`
    SELECT r.id::text, f.id::text AS fid, r.titulo, r.status, u.nome AS resp,
           to_char(r.data AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS d,
           to_char(r.data AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') AS h
      FROM fulfillments f
      JOIN servicos_canonicos sc ON sc.id = f.servico_canonico_id
      JOIN reunioes r ON r.organizacao_id = f.organizacao_id
                     AND (r.lead_id = sc.lead_id OR r.negocio_id = sc.oportunidade_origem_id)
      LEFT JOIN usuarios u ON u.id = r.responsavel_id
     WHERE f.id IN (${idsSql})
       AND (r.data AT TIME ZONE 'America/Sao_Paulo')::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date
       AND coalesce(r.status, 'agendada') NOT IN ('cancelada')`);

  // Nome do cartão: a empresa. Quando dois projetos ativos da MESMA família
  // têm a mesma empresa (3x "Direcional", 2x "Meta Auto Center"), os cartões
  // ficavam idênticos — o produto canônico é o que os distingue.
  const nomeBase = (l: Record<string, any>) => String(l.empresa_nome ?? l.lead_empresa ?? l.canonical_product ?? "Sem empresa");
  const contagem = new Map<string, number>();
  for (const l of linhas) { const k = nomeBase(l) + "|" + l.service_family; contagem.set(k, (contagem.get(k) ?? 0) + 1); }

  const projetos: ProjetoOnboarding[] = linhas.map((l) => {
    const itens = itensPor.get(l.id) ?? [];
    const aplicaveis = itens.filter((i) => i.status !== "NOT_APPLICABLE");
    const feitas = aplicaveis.filter((i) => i.status === "DONE").length;
    const abertasItens = aplicaveis.filter((i) => i.status !== "DONE");
    const pct = aplicaveis.length ? Math.round((feitas / aplicaveis.length) * 100) : 0;
    const tudo = aplicaveis.length > 0 && abertasItens.length === 0;
    const familia = String(l.service_family);
    const cai = familia === "CALLFACE_AI";
    const tipo = l.tipo === "IMPLEMENTATION" ? "implantacao" : "onboarding";

    const bloqueado = itens.find((i) => i.status === "BLOCKED");
    const bloqueio = bloqueado
      ? { kind: bloqueado.blockerType === "CUSTOMER" ? "cliente" as const : "externo" as const, t: bloqueado.blockerReason || bloqueado.titulo }
      : null;
    const dBloq = bloqueado?.blockedAt ? Math.max(0, Math.floor((Date.now() - new Date(bloqueado.blockedAt).getTime()) / 864e5)) : 0;

    /* Gate — mesmo critério de `verificarHandoff`. O implantador NÃO trava o
       botão: o modal de handoff existe justamente para escolhê-lo, e o command
       aceita `implantadorId`. Kickoff e material, sim — esses só o fato
       resolve. */
    const exige = l.exige_implantacao ?? ["PABX", "WHITE_LABEL"].includes(familia);
    const gate = [
      { n: "Reunião de kickoff realizada", ok: Boolean(l.tem_kickoff) },
      { n: "Material/formulário enviado", ok: Boolean(l.material_enviado) },
      { n: "Implantador definido", ok: Boolean(l.resp_id) },
    ];
    const gateOk = gate[0].ok && gate[1].ok;
    const pronto = tipo === "onboarding" && (exige && !cai
      ? gateOk && !l.implantacao_existente
      : l.status === "READY_FOR_VALIDATION");

    /* Próxima ação: o primeiro item pendente do checklist. Quando o checklist
       acabou mas o gate não, a próxima ação REAL é o que falta no gate — é o
       que `verificarHandoff` diria. Sem isso o cartão dizia "Sem próxima ação
       definida" para PABX com 51/51 tarefas feitas. */
    // `tipo` aparece como subtítulo da tarefa no drawer: a etapa no vocabulário
    // do produto, não o slug do workstream ("abertura").
    const paraK = (i: ItemOnboarding) => ({ id: i.id, titulo: i.titulo, tipo: faseDe(familia, i), sub: [], fimD: null, fimH: "" });
    const faltaGate = gate.filter((g, ix) => ix < 2 && !g.ok).map((g) => g.n.toLowerCase());
    const atual = abertasItens[0]
      ? paraK(abertasItens[0])
      : !pronto && exige && !cai && faltaGate.length
        ? { id: null, titulo: "Handoff pendente: " + faltaGate.join(" e "), tipo: "Gate de handoff", sub: [], fimD: null, fimH: "" }
        : null;

    const estado = bloqueio ? (bloqueio.kind === "cliente" ? "aguardando" : "bloqueado") : pronto ? "pronto" : "andamento";
    const nome = nomeBase(l);
    const repetido = (contagem.get(nome + "|" + familia) ?? 0) > 1;

    return {
      id: l.id, tipo, status: l.status, familia,
      empresa: repetido && l.canonical_product ? `${nome} · ${l.canonical_product}` : nome,
      empresaId: l.empresa_id ?? null,
      // Não há oferta comercial vinculada (0 de 26 serviços); o produto
      // canônico é o nome mais próximo do que foi vendido.
      oferta: String(l.canonical_product ?? "—"),
      oppId: l.opp_id ?? null,
      resp: l.resp_nome ?? "Sem responsável",
      respId: l.resp_id ?? null,
      pessoa: l.contato_nome ?? "",
      cargo: l.cargo ?? "",
      telefone: l.telefone || null,
      email: l.email || null,
      notas: notaPorLead.has(l.lead_id) ? [{ texto: notaPorLead.get(l.lead_id)! }] : [],
      eventos: tlRows.filter((t) => t.fid === l.id).map((t) => ({ t: String(t.titulo), meta: String(t.descricao ?? ""), quando: iso(t.occurred_at) ?? "" })),
      bloqueio, prazo: null, concluido: false, handoff: null,
      c: {
        ativo: true, pct, feitas, total: aplicaveis.length, kids: itens.length,
        atual, atualIdx: 0, proxSub: -1, faseNome: faseDe(familia, abertasItens[0]),
        abertas: abertasItens.map(paraK),
        gate, gateOk, tudo, pronto, cai,
        // Sem prazo no banco: nada está PROVADO atrasado, nem perto do go-live.
        // `dPrazo` grande e não `null` — o desenho faz `dPrazo <= 7`, e `null`
        // passaria nesse teste por coerção.
        atraso: 0, dPrazo: 9999, dBloq, estado, golive: false,
        semProx: !atual && !pronto && !bloqueio,
        // Nenhuma marcação de tarefa herdada no banco.
        herdadas: 0, nTarefas: aplicaveis.length,
      },
    };
  });

  const hoje: AtividadeHoje[] = hojeRows.map((r) => {
    const p = projetos.find((x) => x.id === r.fid);
    return { id: r.id, projetoId: r.fid, tipo: "Reunião", titulo: r.titulo, empresa: p?.empresa ?? "",
      resp: r.resp ?? "", iniD: r.d, iniH: r.h, situacao: r.status === "realizada" ? "Feita" : "A fazer" };
  });

  return { projetos, hoje, equipe };
}
