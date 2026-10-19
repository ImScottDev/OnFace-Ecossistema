import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { paginaDeAtendimento } from "@/lib/atendimento/tela";
import { contextoDosLeads } from "@/lib/atendimento/contexto";
import { garantirConversaDoLead } from "@/lib/atendimento/garantir-conversa";
import { cadenciasDosLeads } from "@/lib/atendimento/cadencias";
/* A tela é o desenho do handoff, convertido por máquina
   (ver docs/design/COMO-LIGAR-UMA-TELA.md). */
import { AtendimentoProto } from "@/components/onface/proto/AtendimentoProto";

export const metadata = { title: "Atendimento" };
export const dynamic = "force-dynamic";

/**
 * Atendimento — inbox de WhatsApp.
 *
 * A página só lê: as conversas de WhatsApp dos números de quem está logado e as
 * atribuídas a ele ("Minhas", regra única em lib/whatsapp/acesso); quem tem
 * permissão alterna para "Equipe". Vem com a direção da última mensagem, a
 * caixa (whatsapp_sessao) e o responsável por nome. A thread de cada conversa
 * é carregada pelo cliente ao abrir, pela rota que já existe.
 *
 * Só WhatsApp nesta versão: e-mail e ligação têm dado farto (5.113 e-mails,
 * 5.221 ligações), mas o desenho gera remetente/assinatura de e-mail e clona
 * uma análise de ligação inventada para todo contato — ver pendências em
 * docs/design/DEFEITOS-DO-HANDOFF.md.
 */
export default async function AtendimentoPage({ searchParams }: {
  searchParams: Promise<{ leadId?: string; canal?: string; escopo?: string }>;
}) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");
  /* `?leadId=` abre direto na conversa daquela pessoa. É assim que as fichas e
     o board de Pré-vendas mandam ("Enviar mensagem"), e a tela ignorava o
     parâmetro: caía sempre na caixa inteira. */
  const { leadId, escopo } = await searchParams;

  if (leadId) await garantirConversaDoLead(ctx.organizacaoId, leadId, ctx.userId ?? null);
  /* `?escopo=equipe` é o seletor Minhas / Equipe; sem permissão a tela volta para "Minhas". */
  const dados = await paginaDeAtendimento(ctx, escopo === "equipe" ? "equipe" : "minhas");
  const contexto = await contextoDosLeads(ctx.organizacaoId, dados.leads.map((l) => l.id));
  const cadencias = await cadenciasDosLeads(ctx.organizacaoId, ctx.userId, dados.leads.map((l) => l.id));
  return <AtendimentoProto dados={dados} contexto={contexto} cadencias={cadencias} leadInicial={leadId ?? null} />;
}
