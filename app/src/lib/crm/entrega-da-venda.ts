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

/** Upgrade: separa o que falta fazer do que o cliente já cumpriu numa entrega anterior do mesmo produto. */
export function complementoDoUpgrade(
  checklist: ChecklistSeed,
  concluidas: { workstream: string; titulo: string }[],
): { pendentes: ChecklistSeed; herdadas: { workstream: string; titulo: string }[] } {
  const feitas = new Set(concluidas.map(chaveEtapa));
  const pendentes: ChecklistSeed = [];
  const herdadas: { workstream: string; titulo: string }[] = [];
  for (const item of checklist) {
    if (feitas.has(chaveEtapa(item))) herdadas.push({ workstream: item.workstream, titulo: item.titulo });
    else pendentes.push(item);
  }
  return { pendentes, herdadas };
}
