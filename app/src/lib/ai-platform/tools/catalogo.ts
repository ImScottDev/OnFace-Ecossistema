/**
 * Catálogo de ferramentas para a tela: o que cada uma faz, o que afeta, a permissão que exige,
 * se pede confirmação e se está DE FATO disponível neste ambiente (credencial, número, fonte).
 * Disponível não é "ligada": é "se ligarem, funciona". Dependência ausente aparece como bloqueada.
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { AGENT_TOOL_CATALOG } from "@/lib/ai/agent-studio";
import { PERMISSAO_POR_FERRAMENTA } from "../permissao-delegada";
import { META_FERRAMENTA, CLASSES_AUTONOMIA, type DominioFerramenta } from "./politica";
import { microsoftCalendar } from "@/lib/calendario/microsoft";
import { googleCalendar } from "@/lib/calendario/google";

export interface FerramentaDaTela {
  id: string; nome: string; descricao: string; modo: "leitura" | "acao"; dominio: DominioFerramenta; classe: string; classeRotulo: string;
  entidades: string[]; permissao: string | null; efeitos: string; exigeConfirmacao: boolean; resultado: string;
  disponibilidade: { estado: "disponivel" | "bloqueado"; motivo: string | null };
}

export const DOMINIOS: DominioFerramenta[] = ["Leitura", "Atendimento", "Comercial", "Atividades", "Calendário", "Cadências", "Integrações"];

export async function catalogoDeFerramentas(organizacaoId: string): Promise<FerramentaDaTela[]> {
  const [{ conectadas }] = await db.execute<{ conectadas: number }>(sql`SELECT count(*)::int AS conectadas FROM whatsapp_sessao WHERE organizacao_id = ${organizacaoId}::uuid AND status = 'connected'`) as unknown as { conectadas: number }[];
  const [{ aprovadas }] = await db.execute<{ aprovadas: number }>(sql`SELECT count(*)::int AS aprovadas FROM ai_knowledge_sources WHERE organizacao_id = ${organizacaoId}::uuid AND governanca = 'aprovado' AND status = 'ready'`) as unknown as { aprovadas: number }[];
  const calendario = microsoftCalendar.configurado() || googleCalendar.configurado();
  const bloqueio = (id: string): string | null => {
    if (id === "message.prepare" && conectadas === 0) return "Nenhum número de WhatsApp conectado nesta organização.";
    if (id === "knowledge.search" && aprovadas === 0) return "Nenhuma fonte de conhecimento aprovada e indexada.";
    if ((id.startsWith("meeting.") || id === "agenda.slots") && !calendario) return "Calendário não configurado neste ambiente (credenciais Microsoft/Google ausentes).";
    if (id === "callface.call" && !process.env.CALLFACE_INBOUND_TOKEN) return "Integração com o discador da Callface sem credencial neste ambiente.";
    return null;
  };
  return AGENT_TOOL_CATALOG.map((t) => {
    const m = META_FERRAMENTA[t.id];
    const motivo = bloqueio(t.id);
    return {
      id: t.id, nome: t.nome, descricao: t.descricao, modo: t.modo, dominio: m?.dominio ?? "Atendimento", classe: m?.classe ?? "comercial",
      classeRotulo: CLASSES_AUTONOMIA.find((c) => c.id === (m?.classe ?? "comercial"))?.rotulo ?? "", entidades: m?.entidades ?? [], permissao: PERMISSAO_POR_FERRAMENTA[t.id] ?? null,
      efeitos: m?.efeitos ?? "—", exigeConfirmacao: m?.exigeConfirmacao ?? false, resultado: m?.resultado ?? "—",
      disponibilidade: { estado: motivo ? "bloqueado" : "disponivel", motivo },
    };
  });
}
