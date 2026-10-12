import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { isPersonalView } from "@/lib/auth/roles";
import { entrada, podeVer, type EntradaBiblioteca } from "@/lib/relatorios/biblioteca";
import { definicao } from "@/lib/metricas/catalogo";
import { ehPeriodoPerformance, PERIODOS_PERFORMANCE, type PeriodoPerformance } from "@/lib/relatorios/performance";
import { GO_LIVE } from "@/lib/relatorios/periodo";
import { listarVendasFechadas, listarAgendasRealizadas, listarVendasAtribuidasSdr } from "@/lib/relatorios/fechamento-comercial";
import { Pagina, PaginaCabecalho, PaginaResumo } from "@/components/onface/shell/Pagina";
import { InsightsRelatorio } from "@/components/onface/relatorios/InsightsRelatorio";
import { ExploradorMetrica } from "@/components/onface/relatorios/ExploradorMetrica";
import { moeda, moedaExata, dataCurta } from "@/components/onface/vendas/formato";
import "@/components/onface/relatorios/relatorios.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: entrada(id)?.nome ?? "Relatório" };
}

type Busca = { periodo?: string; mes?: string };

// Mesma regex do /relatorios: ?periodo= vai para o PeriodSelector e para a
// querystring do Hono, então valor fora do formato cai no padrão.
const PERIODO_OK = /^(mes_atual|mes_passado|7d|30d|60d|90d|365d|12m|custom:\d{4}-\d{2}-\d{2}:\d{4}-\d{2}-\d{2})$/;

const QUEM_VE: Record<string, string> = {
  admin: "admin e gestão",
  admin_leitor: "admin, gestão e o perfil leitor",
  gestao: "a gestão",
};

export default async function RelatorioDaBibliotecaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Busca>;
}) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");
  const { id } = await params;
  const e = entrada(id);
  if (!e) notFound();
  // Entrada que é atalho para outra tela: o deep-link leva para lá, não para 404.
  if (e.tipo === "link") redirect(e.href ?? "/relatorios/biblioteca");

  const busca = await searchParams;
  const voltar = <Link className="rel-voltar" href="/relatorios/biblioteca">← Relatórios</Link>;

  if (!podeVer(e.acesso, ctx.userRole)) {
    // Deep-link de quem não tem acesso: diz por quê, em vez de 404 ou de uma
    // tela que vai quebrar com 403 em cada bloco.
    return (
      <Pagina>
        <PaginaCabecalho titulo={e.nome} acoes={voltar} />
        <div className="rel-vazio">
          <strong>Relatório restrito</strong>
          <span>Este relatório é visível para {QUEM_VE[e.acesso] ?? "a gestão"}. O seu papel não tem acesso a ele.</span>
        </div>
      </Pagina>
    );
  }

  if (e.tipo === "insights") {
    return (
      <Pagina>
        <PaginaCabecalho titulo={e.nome} descricao={e.descricao} acoes={voltar} />
        <InsightsRelatorio
          aba={e.id}
          pessoal={isPersonalView(ctx.userRole)}
          periodoInicial={typeof busca.periodo === "string" && PERIODO_OK.test(busca.periodo) ? busca.periodo : "mes_atual"}
        />
      </Pagina>
    );
  }

  if (e.tipo === "metrica") return <Metrica e={e} voltar={voltar} />;
  return <Fechamento e={e} organizacaoId={ctx.organizacaoId} busca={busca} voltar={voltar} />;
}

/* ── Métrica oficial ───────────────────────────────────────────────────── */

function formatarCelula(chave: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  // Em todos os drills do catálogo `valor` é dinheiro, inclusive nas métricas
  // de contagem (oportunidades_abertas): a unidade é do número, não da coluna.
  if (chave === "valor" || chave === "mrr") return moedaExata(Number(v));
  if (v instanceof Date) return dataCurta(v.toISOString());
  if (/_at$|_em$|previsao/.test(chave)) return dataCurta(String(v));
  return String(v);
}

async function Metrica({ e, voltar }: { e: EntradaBiblioteca; voltar: React.ReactNode }) {
  const codigo = e.id.replace(/^metrica-/, "");
  const def = definicao(codigo)!;
  return (
    <Pagina>
      <PaginaCabecalho titulo={def.nome} descricao={def.tipo === "SNAPSHOT" ? "Retrato de agora, com os registros que o compõem." : "Evento por período, com os registros que o compõem."} acoes={voltar} />
      {/* O explorador lê da rota /api/relatorios/metricas: o mesmo recorte vale para número, gráfico, lista e CSV. */}
      <ExploradorMetrica codigo={codigo} />
    </Pagina>
  );
}

/* ── Fechamento comercial ─────────────────────────────────────────────── */

/** Meses fechados desde o go-live, mais o corrente. O Financeiro fecha mês a
 *  mês; o período é o mês calendário, no formato que parsePeriodo aceita. */
function meses(): Array<{ chave: string; rotulo: string; periodo: string }> {
  const out = [];
  const agora = new Date();
  for (let d = new Date(GO_LIVE.getFullYear(), GO_LIVE.getMonth(), 1); d <= agora; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    const fim = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
    out.push({
      chave: iso(d).slice(0, 7),
      rotulo: d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" }).replace(".", ""),
      periodo: `custom:${iso(d)}:${iso(fim)}`,
    });
  }
  return out;
}

async function Fechamento({ organizacaoId, busca, voltar }: { e: EntradaBiblioteca; organizacaoId: string; busca: Busca; voltar: React.ReactNode }) {
  const opcoes = meses();
  // Padrão = mês passado, o mesmo do endpoint (é o mês que o Financeiro fecha).
  const escolhido = opcoes.find((m) => m.chave === busca.mes) ?? opcoes[Math.max(opcoes.length - 2, 0)];
  const [, de, ate] = escolhido.periodo.split(":");
  const since = new Date(`${de}T00:00:00`);
  const until = new Date(`${ate}T23:59:59.999`);

  const [vendas, agendas, atribuidas] = await Promise.all([
    listarVendasFechadas(organizacaoId, since, until),
    listarAgendasRealizadas(organizacaoId, since, until),
    listarVendasAtribuidasSdr(organizacaoId, since, until),
  ]);

  const mensalidade = vendas.reduce((s, v) => s + v.mrrFechado, 0);
  const setup = vendas.reduce((s, v) => s + v.valorSetup, 0);
  const comComprovante = vendas.filter((v) => v.faturaHostedUrl || v.stripeSubscriptionId || v.stripeCustomerId || v.contratoZohoId).length;

  return (
    <Pagina>
      <PaginaCabecalho
        titulo="Fechamento comercial"
        descricao="Vendas ganhas no mês com a evidência de pagamento, agendas realizadas e vendas atribuídas a SDR."
        acoes={
          <>
            {voltar}
            {/* A planilha sai do Hono, com a mesma consulta desta tela (pedido
                explícito do comercial: exportação nunca de query paralela). */}
            <a className="rel-btn rel-btn-primario" href={`/api/relatorios/fechamento-comercial/export?periodo=${encodeURIComponent(escolhido.periodo)}`} download>
              Baixar planilha (.xlsx)
            </a>
          </>
        }
      />
      <PaginaResumo
        itens={[
          { rotulo: "Faturamento fechado", valor: moeda(mensalidade + setup), destaque: true, detalhe: `${moeda(mensalidade)} mensalidade + ${moeda(setup)} setup` },
          { rotulo: "Vendas", valor: vendas.length, detalhe: `${comComprovante} com evidência de pagamento` },
          { rotulo: "Sem evidência", valor: vendas.length - comComprovante, sinal: true, detalhe: "sem Stripe, fatura nem Zoho" },
          { rotulo: "Agendas realizadas", valor: agendas.length },
          { rotulo: "Atribuídas a SDR", valor: atribuidas.length },
        ]}
      />
      <section className="rel" aria-label="Vendas fechadas">
        <div className="rel-filtros">
          <nav className="rel-segmento" aria-label="Mês">
            {opcoes.map((m) => (
              <Link key={m.chave} href={`/relatorios/biblioteca/fechamento-comercial?mes=${m.chave}`} aria-current={m.chave === escolhido.chave ? "page" : undefined}>{m.rotulo}</Link>
            ))}
          </nav>
        </div>
        {vendas.length === 0 ? (
          <div className="rel-vazio">
            <strong>Nenhuma venda ganha neste mês</strong>
            <span>Quando um negócio for marcado como ganho com data neste mês, ele aparece aqui e na planilha.</span>
          </div>
        ) : (
          <div className="rel-tabela-wrap">
            <table className="rel-tabela">
              <thead>
                <tr>
                  <th scope="col">Empresa</th><th scope="col">Ganho em</th><th scope="col">Closer</th><th scope="col">SDR</th>
                  <th scope="col">Família</th><th scope="col">Mensalidade</th><th scope="col">Setup</th><th scope="col">Comprovante</th>
                </tr>
              </thead>
              <tbody>
                {vendas.map((v) => {
                  const comprovante = v.faturaHostedUrl
                    ?? (v.stripeSubscriptionId ? `https://dashboard.stripe.com/subscriptions/${v.stripeSubscriptionId}` : null)
                    ?? (v.stripeCustomerId ? `https://dashboard.stripe.com/customers/${v.stripeCustomerId}` : null);
                  return (
                    <tr key={v.negocioId}>
                      <td>
                        {/* /pipeline/[id] recebe o id do NEGÓCIO (detalheOportunidade(org, negocioId)). */}
                        {v.negocioId ? <Link href={`/pipeline/${v.negocioId}`}><strong>{v.empresaNome ?? v.contatoNome ?? "—"}</strong></Link> : <strong>{v.empresaNome ?? v.contatoNome ?? "—"}</strong>}
                      </td>
                      <td>{dataCurta(v.ganhoAt)}</td>
                      <td className="rel-texto">{v.closerNome ?? "—"}</td>
                      <td className="rel-texto">{v.sdrNome ?? "—"}</td>
                      <td className="rel-texto">{v.serviceFamily ?? "—"}</td>
                      <td>{moedaExata(v.mrrFechado)}</td>
                      <td>{v.valorSetup ? moedaExata(v.valorSetup) : <span className="rel-zero">—</span>}</td>
                      <td>
                        {comprovante ? <a href={comprovante} target="_blank" rel="noreferrer">Abrir</a>
                          : v.contratoZohoId ? <span title={`Sales Order Zoho ${v.contratoZohoId}`}>Zoho</span>
                          : <span className="rel-zero">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="rel-nota">
          A planilha traz as três abas (vendas, agendas e atribuídas a SDR) com todos os campos de auditoria. Faturamento
          fechado = mensalidade + setup, a mesma soma da meta comercial.
        </p>
      </section>
    </Pagina>
  );
}
