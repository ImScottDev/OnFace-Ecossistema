import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { isPersonalView, isReader } from "@/lib/auth/roles";
import { listarCampanhas, podeGerirCampanhas, SEM_PERMISSAO_CAMPANHAS } from "@/lib/automacoes/campanhas";
import { Pagina, PaginaCabecalho, PaginaResumo } from "@/components/onface/shell/Pagina";
import { Campanhas } from "@/components/onface/campanhas/Campanhas";

export const metadata = { title: "Campanhas" };
export const dynamic = "force-dynamic";

/**
 * Campanhas em linguagem ONFACE. A lista vem do servidor (tenant da sessão),
 * não mais de `fetch("/api/campanhas")` no cliente: a página chega pronta e
 * o reload não pisca um esqueleto.
 */
export default async function AutomacoesCampanhasPage({ searchParams }: {
  searchParams: Promise<{ aba?: string }>;
}) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const [{ aba }, campanhas, podeGerir] = await Promise.all([
    searchParams, listarCampanhas(ctx.organizacaoId), podeGerirCampanhas(ctx),
  ]);
  // "Origem dos leads" mostra gasto da Meta, CPL, ROAS e MRR por campanha: é
  // o mesmo dado da aba Marketing de Insights, que é só da gestão. SDR, closer
  // e leitor não veem a aba nem por deep-link (?aba=origem cai em Outreach).
  const veOrigem = !isPersonalView(ctx.userRole) && !isReader(ctx.userRole);
  const enviados = campanhas.reduce((s, c) => s + c.totalEnviados, 0);
  const destinatarios = campanhas.reduce((s, c) => s + c.totalDestinatarios, 0);
  const por = (st: string) => campanhas.filter((c) => c.status === st).length;
  const emCurso = por("agendada") + por("enviando") + por("pausada");

  return (
    <Pagina>
      <PaginaCabecalho
        titulo="Campanhas"
        acoes={podeGerir
          ? <Link className="ov-botao" href="/automacoes/campanhas/nova">Nova campanha</Link>
          : <button type="button" className="ov-botao" disabled title={SEM_PERMISSAO_CAMPANHAS}>Nova campanha</button>}
      />
      <PaginaResumo
        itens={[
          { rotulo: "Campanhas", valor: campanhas.length, detalhe: `${por("rascunho")} rascunho · ${por("concluida")} concluída`, destaque: true },
          { rotulo: "Em curso", valor: emCurso, detalhe: `${por("agendada")} agendada · ${por("enviando")} enviando · ${por("pausada")} pausada` },
          { rotulo: "Destinatários", valor: destinatarios, detalhe: "quem as listas alcançam pelo canal" },
          { rotulo: "Enviados", valor: enviados, detalhe: "mensagens que saíram de fato" },
        ]}
      />
      {!podeGerir ? <p className="ov-nota" role="note">{SEM_PERMISSAO_CAMPANHAS} Você pode consultar, mas criar, editar e excluir fica com a gestão.</p> : null}
      <Campanhas
        campanhas={campanhas}
        aba={veOrigem && aba === "origem" ? "origem" : "outreach"}
        veOrigem={veOrigem}
        podeGerir={podeGerir}
      />
    </Pagina>
  );
}
