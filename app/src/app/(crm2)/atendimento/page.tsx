import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { paginaDeAtendimento } from "@/lib/atendimento/tela";
import { contextoDosLeads } from "@/lib/atendimento/contexto";
/* A tela é o desenho do handoff, convertido por máquina.
   Ver docs/design/comparacao-com-o-prototipo.md. O workspace antigo
   (components/crm2/atendimento/Workspace) continua no repositório. */
import { AtendimentoProto } from "@/components/onface/proto/AtendimentoProto";

export const metadata = { title: "Atendimento" };
export const dynamic = "force-dynamic";

/**
 * Atendimento — inbox de WhatsApp.
 *
 * A página só lê: todas as conversas de WhatsApp que quem está logado pode
 * ver (regra de lib/whatsapp/acesso), com a direção da última mensagem, a
 * caixa (whatsapp_sessao) e o responsável por nome. A thread de cada conversa
 * é carregada pelo cliente ao abrir, pela rota que já existe.
 *
 * Só WhatsApp nesta versão: e-mail e ligação têm dado farto (5.113 e-mails,
 * 5.221 ligações), mas o desenho gera remetente/assinatura de e-mail e clona
 * uma análise de ligação inventada para todo contato — ver pendências em
 * docs/design/DEFEITOS-DO-HANDOFF.md.
 */
export default async function AtendimentoPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const dados = await paginaDeAtendimento(ctx);
  const contexto = await contextoDosLeads(ctx.organizacaoId, dados.leads.map((l) => l.id));
  return <AtendimentoProto dados={dados} contexto={contexto} />;
}
