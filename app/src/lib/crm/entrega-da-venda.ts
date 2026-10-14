/**
 * Regras PURAS da entrega por venda (sem `db`, para as telas e os testes importarem).
 *
 * Decisão do dono: "uma venda de três itens é um único onboard. Uma venda, uma oportunidade, é uma
 * venda" e, no upgrade, "etapa já cumprida para aquele produto não volta".
 *
 *  - Os serviços canônicos seguem sendo vários (um por item). A ENTREGA é uma por venda e por família.
 *  - Família = produto = trilha. PABX, White Label e Callface AI têm vocabulário de fase, checklist e
 *    tela próprios (a trava `entrega-fase-cobre-checklist` cobra isso); misturar as três num board só
 *    jogaria etapa de uma família na coluna de outra. Por isso venda com famílias diferentes gera UMA
 *    entrega POR FAMÍLIA, ligadas pela mesma oportunidade.
 */
import type { ChecklistSeed } from "@/lib/crm/pos-venda-checklists";

export interface ServicoDaVenda {
  id: string;
  serviceFamily: string;
  oportunidadeId: string | null;
  contratoId: string | null;
}

export interface GrupoDeEntrega {
  chave: string;
  oportunidadeId: string | null;
  serviceFamily: string;
  /** O primeiro é o serviço principal da entrega. */
  servicoIds: string[];
}

/** Venda = oportunidade; sem oportunidade, o contrato; sem nenhum dos dois, o serviço sozinho. */
export function agruparServicosPorVenda(servicos: ServicoDaVenda[]): GrupoDeEntrega[] {
  const grupos = new Map<string, GrupoDeEntrega>();
  for (const s of servicos) {
    const venda = s.oportunidadeId ?? (s.contratoId ? `contrato:${s.contratoId}` : `servico:${s.id}`);
    const chave = `${venda}|${s.serviceFamily}`;
    const g = grupos.get(chave);
    if (g) g.servicoIds.push(s.id);
    else grupos.set(chave, { chave, oportunidadeId: s.oportunidadeId, serviceFamily: s.serviceFamily, servicoIds: [s.id] });
  }
  return [...grupos.values()];
}

const chaveEtapa = (e: { workstream: string; titulo: string }) => `${e.workstream}\u0000${e.titulo}`;

/** União dos checklists, sem repetir etapa (workstream + título); a primeira ocorrência vence. */
export function uniaoChecklists(listas: ChecklistSeed[]): ChecklistSeed {
  const vistas = new Set<string>();
  const uniao: ChecklistSeed = [];
  for (const lista of listas) {
    for (const item of lista) {
      const k = chaveEtapa(item);
      if (vistas.has(k)) continue;
      vistas.add(k);
      uniao.push(item);
    }
  }
  return uniao;
}

/** Quem cumpriu a etapa e quando, na entrega anterior. */
export interface EtapaCumprida {
  workstream: string;
  titulo: string;
  concluidaEm?: string | null;
  concluidaPor?: string | null;
  responsavelId?: string | null;
  /** Entrega onde ela foi cumprida. */
  fulfillmentId?: string | null;
}

/**
 * Upgrade: separa o que falta fazer do que o cliente já cumpriu numa entrega anterior do mesmo produto.
 * `herdadas` carrega data e responsável ORIGINAIS (se a etapa foi cumprida em mais de uma entrega, vale a
 * primeira vez), para a entrega nova registrá-la como cumprida, não em branco.
 */
export function complementoDoUpgrade(
  checklist: ChecklistSeed,
  concluidas: EtapaCumprida[],
): { pendentes: ChecklistSeed; herdadas: (EtapaCumprida & { item: ChecklistSeed[number] })[] } {
  const feitas = new Map<string, EtapaCumprida>();
  for (const c of concluidas) {
    const k = chaveEtapa(c);
    const atual = feitas.get(k);
    if (!atual || (c.concluidaEm && (!atual.concluidaEm || c.concluidaEm < atual.concluidaEm))) feitas.set(k, c);
  }
  const pendentes: ChecklistSeed = [];
  const herdadas: (EtapaCumprida & { item: ChecklistSeed[number] })[] = [];
  for (const item of checklist) {
    const f = feitas.get(chaveEtapa(item));
    if (f) herdadas.push({ ...f, workstream: item.workstream, titulo: item.titulo, item });
    else pendentes.push(item);
  }
  return { pendentes, herdadas };
}

/* ── Consolidação do histórico (backfill) ─────────────────────────────────────
 * A regra nova só vale para entrega que nasce depois. Aqui o plano para as antigas: uma entrega por
 * (venda, família, tipo, ciclo), a mesma chave do índice `uq_fulfillment_venda`. Pura: o script lê o
 * banco e grava; a DECISÃO (quem fica, quem é absorvida, quem não se mexe) mora aqui, testada. */
export interface EntregaDoHistorico {
  id: string;
  /** Venda resolvida do serviço principal; NULL = sem venda (fica como está). */
  oportunidadeId: string | null;
  /** O serviço ligava a mais de uma oportunidade: não se adivinha a venda. */
  vendaAmbigua: boolean;
  /** Já tem `oportunidade_id` gravado (nasceu pela regra nova ou já foi consolidada). */
  jaConsolidada: boolean;
  serviceFamily: string;
  tipo: string | null;
  cycleNumber: number;
  status: string;
  /** Nenhum trabalho registrado: NOT_STARTED, etapas todas pendentes e sem formulário/ramal/portabilidade. Só esta pode ser absorvida. */
  virgem: boolean;
  /** Etapas tocadas; desempata quem sobrevive entre entregas com trabalho. */
  progresso: number;
  criadaEm: number;
  servicoIds: string[];
}

export interface GrupoConsolidado {
  oportunidadeId: string;
  sobrevivente: string;
  /** Virgens, apagadas depois de seus serviços passarem para o sobrevivente. */
  absorvidas: string[];
  /** Têm trabalho e a venda já tem outra entrega: ficam como estão, para decisão humana. */
  conflitos: string[];
  /** Todos os serviços que a entrega do grupo passa a cobrir. */
  servicoIds: string[];
  /** O sobrevivente precisa receber `oportunidade_id` (false = já tinha). */
  gravarOportunidade: boolean;
}

export function planejarConsolidacao(entregas: EntregaDoHistorico[]): { grupos: GrupoConsolidado[]; semVenda: string[]; ambiguas: string[] } {
  const semVenda: string[] = [];
  const ambiguas: string[] = [];
  const porChave = new Map<string, EntregaDoHistorico[]>();
  for (const e of entregas) {
    if (e.vendaAmbigua) { ambiguas.push(e.id); continue; }
    if (!e.oportunidadeId || !e.tipo) { semVenda.push(e.id); continue; }
    const k = [e.oportunidadeId, e.serviceFamily, e.tipo, e.cycleNumber].join("|");
    (porChave.get(k) ?? porChave.set(k, []).get(k)!).push(e);
  }
  const grupos: GrupoConsolidado[] = [];
  for (const [, membros] of porChave) {
    const ordenados = [...membros].sort((a, b) =>
      Number(b.jaConsolidada) - Number(a.jaConsolidada) || // quem já ocupa a chave única fica
      Number(!b.virgem) - Number(!a.virgem) ||             // depois, quem tem trabalho
      b.progresso - a.progresso || a.criadaEm - b.criadaEm || a.id.localeCompare(b.id));
    const [sobrevivente, ...resto] = ordenados;
    const absorvidas = resto.filter((e) => e.virgem).map((e) => e.id);
    const conflitos = resto.filter((e) => !e.virgem).map((e) => e.id);
    const servicoIds = [...new Set([sobrevivente, ...resto.filter((e) => e.virgem)].flatMap((e) => e.servicoIds))];
    grupos.push({ oportunidadeId: sobrevivente.oportunidadeId!, sobrevivente: sobrevivente.id, absorvidas, conflitos, servicoIds, gravarOportunidade: !sobrevivente.jaConsolidada });
  }
  return { grupos, semVenda, ambiguas };
}
