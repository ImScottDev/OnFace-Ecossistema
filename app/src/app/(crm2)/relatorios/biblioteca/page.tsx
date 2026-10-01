import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { BIBLIOTECA, podeVer, type EntradaBiblioteca } from "@/lib/relatorios/biblioteca";
import { Pagina, PaginaCabecalho, PaginaResumo } from "@/components/onface/shell/Pagina";
import "@/components/onface/relatorios/relatorios.css";

export const metadata = { title: "Relatórios" };
export const dynamic = "force-dynamic";

function abrirHref(e: EntradaBiblioteca) {
  return e.tipo === "link" && e.href ? e.href : `/relatorios/biblioteca/${e.id}`;
}

function filtroHref(area: string | null, q: string) {
  const p = new URLSearchParams();
  if (area) p.set("area", area);
  if (q) p.set("q", q);
  const s = p.toString();
  return s ? `/relatorios/biblioteca?${s}` : "/relatorios/biblioteca";
}

const sem = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export default async function RelatoriosBibliotecaPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; q?: string }>;
}) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  // Some o que o backend negaria: oferecer e devolver 403 seria botão mentiroso.
  const visiveis = BIBLIOTECA.filter((e) => podeVer(e.acesso, ctx.userRole));
  const restritos = BIBLIOTECA.length - visiveis.length;

  const p = await searchParams;
  const areas = [...new Set(visiveis.map((e) => e.area))];
  const area = p.area && areas.includes(p.area) ? p.area : null;
  const q = (p.q ?? "").trim().slice(0, 80);

  // Filtro no servidor via querystring: sobrevive ao reload e ao link colado,
  // e a lista é pequena demais para justificar estado no cliente.
  const lista = visiveis.filter(
    (e) => (!area || e.area === area) && (!q || sem(`${e.nome} ${e.descricao} ${e.area}`).includes(sem(q))),
  );

  const exportaveis = visiveis.filter((e) => e.formatos.some((f) => f !== "Tela")).length;

  return (
    <Pagina>
      <PaginaCabecalho
        titulo="Relatórios"
        descricao="Os relatórios e métricas oficiais que o CRM calcula hoje. Cada um abre a consulta real, com exportação onde ela existe."
      />
      <PaginaResumo
        itens={[
          { rotulo: "Relatórios disponíveis", valor: visiveis.length, destaque: true, detalhe: restritos > 0 ? `${restritos} restrito(s) à gestão` : "todos liberados para o seu papel" },
          { rotulo: "Com exportação", valor: exportaveis, detalhe: "CSV ou planilha" },
          { rotulo: "Métricas oficiais", valor: visiveis.filter((e) => e.tipo === "metrica").length, detalhe: "com definição e drill-down" },
        ]}
      />

      <section className="rel" aria-label="Biblioteca de relatórios">
        <div className="rel-filtros">
          <nav className="rel-segmento" aria-label="Área">
            <Link href={filtroHref(null, q)} aria-current={!area ? "page" : undefined}>Todos</Link>
            {areas.map((a) => (
              <Link key={a} href={filtroHref(a, q)} aria-current={area === a ? "page" : undefined}>{a}</Link>
            ))}
          </nav>
          <form action="/relatorios/biblioteca" method="get" role="search">
            {area ? <input type="hidden" name="area" value={area} /> : null}
            <input className="rel-busca" type="search" name="q" defaultValue={q} placeholder="Buscar relatório" aria-label="Buscar relatório" />
          </form>
        </div>

        {lista.length === 0 ? (
          <div className="rel-vazio">
            <strong>Nenhum relatório neste recorte</strong>
            <span>Nada corresponde a {q ? `“${q}”` : "este filtro"}.</span>
            <Link className="rel-voltar" href="/relatorios/biblioteca">Limpar filtros</Link>
          </div>
        ) : (
          <ol className="rel-lista">
            <li className="rel-cab" aria-hidden="true">
              <span>Relatório</span>
              <span>Área</span>
              <span>Fonte</span>
              <span>Formatos</span>
              <span />
            </li>
            {lista.map((e) => (
              <li key={e.id} className="rel-linha">
                <span className="rel-nome">
                  <Link href={abrirHref(e)}>{e.nome}</Link>
                  <span>{e.descricao}</span>
                </span>
                <span className="rel-area">{e.area}</span>
                <span className="rel-fonte">{e.fonte}</span>
                <span className="rel-formatos">
                  {e.formatos.map((f) => (
                    <span key={f} className="rel-selo" data-tom={f === "Tela" ? undefined : "exporta"}>{f}</span>
                  ))}
                </span>
                <span className="rel-acao">
                  {e.download ? (
                    <a className="rel-btn" href={e.download} download>Baixar</a>
                  ) : (
                    <Link className="rel-btn" href={abrirHref(e)}>Abrir</Link>
                  )}
                </span>
              </li>
            ))}
          </ol>
        )}
        <p className="rel-nota">
          Salvar um relatório personalizado ainda não existe no produto: esta biblioteca lista só o que já é calculado.
          A visão geral dos números fica em <Link href="/relatorios">Insights</Link>.
        </p>
      </section>
    </Pagina>
  );
}
