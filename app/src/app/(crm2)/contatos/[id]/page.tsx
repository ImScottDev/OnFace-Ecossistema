import { redirect } from "next/navigation";

/** `/contatos/:id` → `/contatos/pessoas/:id`.
 *
 * Era a página completa do lead no CRM 2.0. Na virada ONFACE (18/09, F1 lote
 * 2) Contatos passou a separar explicitamente os dois objetos — a EMPRESA, que
 * é o que se trabalha, e a PESSOA, através de quem se trabalha — em
 * `/contatos/empresas/:id` e `/contatos/pessoas/:id`. Um `:id` solto não diz
 * qual dos dois é.
 *
 * Aponta para pessoas porque era isso que a rota servia: `leadId`. Redireciona
 * em vez de dar 404 porque o id aparece em link de e-mail, tarefa e histórico
 * — quebrar aqui quebraria navegação que o time já tem salva.
 *
 * `/contatos/empresas` e `/contatos/pessoas` são estáticas e ganham deste
 * segmento dinâmico no roteador, então elas não passam por aqui. */
export default async function ContatoPorIdLegado({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/contatos/pessoas/${id}`);
}
