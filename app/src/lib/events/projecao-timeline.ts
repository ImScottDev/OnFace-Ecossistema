/**
 * Projeção de evento de domínio na linha do tempo (SPEC §24.3).
 *
 * `timeline_events` tinha 14.078 linhas, TODAS do backfill: `projetarTimeline`
 * existia e só era chamada em teste. Nenhum fato de runtime virava linha na
 * tela — a timeline mostrava a história até o dia da carga e parava ali.
 *
 * É o mesmo defeito do adapter da CAPI sem caller, no mesmo dia: a peça existe,
 * o teste passa, e nada em produção a usa.
 *
 * ## Nem todo evento vira linha
 *
 * `domain_events` é o registro completo: tudo que aconteceu, inclusive o que só
 * interessa a outro sistema. A timeline é o que uma PESSOA lê para entender a
 * conta. Projetar tudo transformaria a tela num log — e um log que ninguém lê é
 * pior que uma timeline curta, porque esconde o que importa no meio do ruído.
 *
 * Por isso a política é explícita e o título é escrito para humano.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { projetarTimeline } from "@onface/platform-events";

interface EventoParaProjetar {
  id: string;
  organizacaoId: string;
  eventType: string;
  aggregateType: string | null;
  aggregateId: string | null;
  payload: Record<string, unknown> | null;
  createdAt: Date | string;
}

/** Como cada evento aparece para quem lê a conta. */
interface RegraProjecao {
  tipo: string;
  titulo: (p: Record<string, unknown>) => string;
  icone?: string;
}

const PROJETAVEIS: Record<string, RegraProjecao> = {
  AcquisitionCreated: { tipo: "aquisicao", titulo: (p) => `Entrou por ${p.origem ?? "origem não informada"}`, icone: "entrada" },
  AcquisitionQualified: { tipo: "qualificacao", titulo: () => "Qualificado", icone: "check" },
  AcquisitionDisqualified: { tipo: "desqualificacao", titulo: (p) => `Desqualificado${p.motivo ? `: ${p.motivo}` : ""}`, icone: "x" },
  StageChanged: { tipo: "etapa", titulo: (p) => `Etapa mudou para ${p.toStage ?? p.stage ?? "outra"}`, icone: "seta" },
  OpportunityCreated: { tipo: "oportunidade", titulo: () => "Oportunidade criada", icone: "alvo" },
  OpportunityWon: { tipo: "oportunidade_ganha", titulo: () => "Venda ganha", icone: "trofeu" },
  OpportunityLost: { tipo: "oportunidade_perdida", titulo: (p) => `Venda perdida${p.motivo ? `: ${p.motivo}` : ""}`, icone: "x" },
  ProposalSent: { tipo: "proposta_enviada", titulo: () => "Proposta enviada", icone: "documento" },
  ProposalAccepted: { tipo: "proposta_aceita", titulo: () => "Proposta aceita", icone: "check" },
  ContractSigned: { tipo: "contrato", titulo: () => "Contrato assinado", icone: "assinatura" },
  PaymentConfirmed: { tipo: "pagamento", titulo: (p) => `Pagamento confirmado${p.valor ? ` — R$ ${Number(p.valor).toFixed(2)}` : ""}`, icone: "dinheiro" },
  MeetingScheduled: { tipo: "reuniao", titulo: () => "Reunião agendada", icone: "calendario" },
  TagAdded: { tipo: "tag", titulo: (p) => `Tag "${p.tag ?? ""}" adicionada`, icone: "etiqueta" },
  // Fora de propósito: `TagRemoved` (remover tag não é fato que alguém procura
  // na história), e todo evento de integração, que interessa a outro sistema e
  // não a quem lê a conta.
};

/**
 * Projeta o evento, quando ele deve aparecer para humano.
 *
 * Best-effort: a projeção é DERIVADA do registro, e o registro já está gravado.
 * Se falhar, o fato continua existindo e a linha pode ser reprojetada — o que
 * não pode acontecer é uma falha de projeção derrubar a entrega da consequência.
 */
export async function projetarEventoNaTimeline(evento: EventoParaProjetar): Promise<boolean> {
  const regra = PROJETAVEIS[evento.eventType];
  if (!regra) return false;

  const p = evento.payload ?? {};
  try {
    // Os vínculos saem do payload canônico. Sem nenhum deles a linha não teria
    // onde aparecer, e uma linha órfã na timeline é pior que linha nenhuma:
    // ocupa espaço no registro e não é encontrada por ninguém.
    const empresaId = (p.empresa_id as string) ?? null;
    const pessoaId = (p.pessoa_id as string) ?? null;
    const aquisicaoId = (p.aquisicao_id as string) ?? null;
    const oportunidadeId = (p.oportunidade_id as string)
      ?? (evento.aggregateType === "oportunidade" ? evento.aggregateId : null);
    if (!empresaId && !pessoaId && !aquisicaoId && !oportunidadeId) return false;

    await projetarTimeline(db as never, sql as never, {
      organizacaoId: evento.organizacaoId,
      // O id do REGISTRO, não o da fila: a FK de timeline_events aponta para
      // domain_events, e o publicador canônico põe esse id no payload do
      // outbox justamente para a projeção poder amarrar os dois.
      domainEventId: (p.domain_event_id as string) ?? null,
      empresaId, pessoaId, aquisicaoId, oportunidadeId,
      tipo: regra.tipo,
      titulo: regra.titulo(p),
      actorType: "SYSTEM",
      ocorridoEm: evento.createdAt,
      metadata: { origem: "projecao", evento: evento.eventType },
    });
    return true;
  } catch (e) {
    console.error(`[timeline] projeção de ${evento.eventType} falhou:`, e);
    return false;
  }
}
