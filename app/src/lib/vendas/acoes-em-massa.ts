/**
 * Ações em massa de Pré-vendas (Documento Mestre v0.13, Módulo 01 §9).
 *
 * A regra que decide o desenho inteiro deste arquivo está no §9.5:
 *
 *     "Nunca falhar silenciosamente por causa de um registro sem telefone
 *      válido."
 *
 * Por isso nada aqui é "sucesso" ou "erro" da operação toda. Cada registro
 * devolve o próprio desfecho, e a tela mostra enviados, ignorados e falhas
 * separados — 40 de 50 enviados com 10 ignorados por telefone inválido é um
 * resultado útil; "falhou" não é.
 *
 * NENHUMA AÇÃO REIMPLEMENTA REGRA. Cada uma entra pela porta única que já
 * existe:
 *
 *     responsável → registrarMudancaResponsavel  (propaga e audita)
 *     tag         → lib/crm/tags                 (evento TagAdded/TagRemoved)
 *     cadência    → cadence-engine
 *     discador    → integrations/callface
 *
 * Fazer diferente criaria a enésima cópia da mesma regra, que é o defeito que
 * este refactor existe para acabar.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { registrarMudancaResponsavel } from "@/lib/crm/owner";
import { adicionarTag, removerTag } from "@/lib/crm/tags";

/** Mesmo helper de consultas.ts: literal de array do Postgres. */
function literalDeArray(valores: readonly string[]): string {
  return `{${valores.join(",")}}`;
}

export type AcaoEmMassa =
  | "atribuir_responsavel"
  | "adicionar_tag"
  | "remover_tag"
  | "incluir_em_cadencia"
  | "enviar_para_discador";

export type DesfechoItem = "aplicado" | "ignorado" | "falhou";

export interface ResultadoItem {
  leadId: string;
  desfecho: DesfechoItem;
  /** Por que foi ignorado ou falhou. Em português, para a tela mostrar. */
  motivo?: string;
}

export interface ResultadoEmMassa {
  acao: AcaoEmMassa;
  total: number;
  aplicados: number;
  ignorados: number;
  falhas: number;
  itens: ResultadoItem[];
}

interface Alvo extends Record<string, unknown> {
  id: string;
  nome: string | null;
  telefone: string | null;
  responsavel_id: string | null;
}

/**
 * Carrega os alvos JÁ filtrados pela organização. É aqui que o isolamento
 * acontece: um id de outra organização simplesmente não volta, e vira
 * "ignorado" com motivo — nunca uma escrita cruzada.
 */
async function carregarAlvos(organizacaoId: string, leadIds: string[]): Promise<Map<string, Alvo>> {
  if (!leadIds.length) return new Map();
  const linhas = await db.execute<Alvo>(sql`
    SELECT id::text, nome, telefone, responsavel_id::text
      FROM leads
     WHERE organizacao_id = ${organizacaoId}::uuid
       AND id = ANY(${literalDeArray(leadIds)}::uuid[])`);
  return new Map(linhas.map((l) => [l.id, l]));
}

/** Só dígitos; celular brasileiro válido tem 10 ou 11 com DDD. */
function telefoneUtilizavel(t: string | null): boolean {
  const d = (t ?? "").replace(/\D/g, "").replace(/^55/, "");
  return d.length === 10 || d.length === 11;
}

export async function executarEmMassa(params: {
  organizacaoId: string;
  acao: AcaoEmMassa;
  leadIds: string[];
  atorId?: string | null;
  /** Responsável novo, id da tag, id da cadência — conforme a ação. */
  valor?: string | null;
}): Promise<ResultadoEmMassa> {
  const { organizacaoId, acao, leadIds, valor } = params;
  const unicos = [...new Set(leadIds)];
  const alvos = await carregarAlvos(organizacaoId, unicos);
  const itens: ResultadoItem[] = [];

  for (const leadId of unicos) {
    const alvo = alvos.get(leadId);
    if (!alvo) {
      // Não existe, ou é de outra organização. As duas dão no mesmo para quem
      // pediu, e nenhuma vira escrita.
      itens.push({ leadId, desfecho: "ignorado", motivo: "registro não encontrado nesta organização" });
      continue;
    }

    try {
      switch (acao) {
        case "atribuir_responsavel": {
          if (!valor) { itens.push({ leadId, desfecho: "falhou", motivo: "responsável não informado" }); break; }
          if (alvo.responsavel_id === valor) {
            itens.push({ leadId, desfecho: "ignorado", motivo: "já era o responsável" });
            break;
          }
          // A escrita legada é do CHAMADOR, e `registrarMudancaResponsavel` é
          // a metade de propagação e auditoria — é assim que as sete rotas que
          // trocam dono fazem hoje. Chamar só a porta deixaria o dono
          // propagado na aquisição e inalterado no lead, que é pior do que não
          // trocar: a tela mostraria uma coisa e o board outra.
          await db.execute(sql`
            UPDATE leads SET responsavel_id = ${valor}::uuid, updated_at = now()
             WHERE id = ${leadId}::uuid AND organizacao_id = ${organizacaoId}::uuid`);
          await registrarMudancaResponsavel({
            organizacaoId, entityType: "lead", entityId: leadId,
            previousOwnerId: alvo.responsavel_id, newOwnerId: valor,
            actorId: params.atorId ?? null,
          });
          itens.push({ leadId, desfecho: "aplicado" });
          break;
        }

        case "adicionar_tag":
        case "remover_tag": {
          if (!valor) { itens.push({ leadId, desfecho: "falhou", motivo: "tag não informada" }); break; }
          const fn = acao === "adicionar_tag" ? adicionarTag : removerTag;
          const r = await fn({ organizacaoId, entityType: "lead", entityId: leadId, label: valor });
          if (!r.ok) { itens.push({ leadId, desfecho: "falhou", motivo: r.erro }); break; }
          // Tag que já estava não é erro nem trabalho: é no-op, e dizer isso
          // evita o relatório mentir que aplicou 50 quando mexeu em 3.
          itens.push({ leadId, desfecho: r.mudou ? "aplicado" : "ignorado", motivo: r.mudou ? undefined : "a tag já estava como pedido" });
          break;
        }

        case "incluir_em_cadencia": {
          if (!valor) { itens.push({ leadId, desfecho: "falhou", motivo: "cadência não informada" }); break; }
          // Elegibilidade antes da inscrição (§9.4): inscrever quem já está
          // inscrito duplicaria a régua de mensagens no mesmo contato.
          const [ja] = await db.execute<{ n: number }>(sql`
            SELECT count(*)::int AS n FROM cadencia_execucoes
             WHERE organizacao_id = ${organizacaoId}::uuid AND lead_id = ${leadId}::uuid
               AND status IN ('ativa','pendente','agendada')`);
          if (ja.n > 0) { itens.push({ leadId, desfecho: "ignorado", motivo: "já está em uma cadência ativa" }); break; }

          const { iniciarCadencia } = await import("@/lib/cadencia/cadence-engine");
          // A chave de idempotência é do PAR cadência+lead: clicar duas vezes
          // no mesmo lote não inscreve duas vezes.
          const enrollmentId = await iniciarCadencia({
            cadenceDefinitionId: valor, organizacaoId,
            entityType: "lead", entityId: leadId,
            idempotencyKey: `massa:${valor}:${leadId}`,
          });
          itens.push(enrollmentId
            ? { leadId, desfecho: "aplicado" }
            : { leadId, desfecho: "falhou", motivo: "a cadência não aceitou a inscrição" });
          break;
        }

        case "enviar_para_discador": {
          // A regra do §9.5 em uma linha: telefone ruim é IGNORADO com motivo,
          // não derruba o lote nem some.
          if (!telefoneUtilizavel(alvo.telefone)) {
            itens.push({ leadId, desfecho: "ignorado", motivo: alvo.telefone ? "telefone inválido" : "sem telefone" });
            break;
          }
          const { enviarParaDiscagem } = await import("@/lib/integrations/callface");
          const r = await enviarParaDiscagem({ nome: alvo.nome ?? "Contato", telefone: alvo.telefone! });
          itens.push(r.ok ? { leadId, desfecho: "aplicado" } : { leadId, desfecho: "falhou", motivo: r.detalhe });
          break;
        }
      }
    } catch (e) {
      // Um registro problemático não derruba os outros 49.
      itens.push({ leadId, desfecho: "falhou", motivo: (e instanceof Error ? e.message : String(e)).slice(0, 200) });
    }
  }

  return {
    acao, total: unicos.length,
    aplicados: itens.filter((i) => i.desfecho === "aplicado").length,
    ignorados: itens.filter((i) => i.desfecho === "ignorado").length,
    falhas: itens.filter((i) => i.desfecho === "falhou").length,
    itens,
  };
}

/**
 * Exportação (§9.1). O arquivo reflete o RECORTE escolhido — seleção, coluna
 * ou filtro — e não uma listagem genérica.
 */
export async function exportarLeads(organizacaoId: string, leadIds: string[]): Promise<string> {
  const alvos = await carregarAlvos(organizacaoId, leadIds);
  const linhas = await db.execute<Record<string, unknown>>(sql`
    SELECT l.nome, l.sobrenome, l.email, l.telefone, l.empresa,
           l.cargo, l.origem, l.utm_campaign AS campanha,
           u.nome AS responsavel, l.created_at::date AS criado_em
      FROM leads l
      LEFT JOIN usuarios u ON u.id = l.responsavel_id
     WHERE l.organizacao_id = ${organizacaoId}::uuid
       AND l.id = ANY(${literalDeArray([...alvos.keys()])}::uuid[])
     ORDER BY l.created_at DESC`);

  const colunas = ["nome", "sobrenome", "email", "telefone", "empresa", "cargo", "origem", "campanha", "responsavel", "criado_em"];
  const escapar = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // Ponto e vírgula: o Excel em português abre CSV com vírgula numa coluna só.
  return [colunas.join(";"), ...linhas.map((l) => colunas.map((c) => escapar(l[c])).join(";"))].join("\n");
}
