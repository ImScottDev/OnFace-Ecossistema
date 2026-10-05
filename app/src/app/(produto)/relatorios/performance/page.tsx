import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { isPersonalView } from "@/lib/auth/roles";
import {
  getPerformance, ordenarPerformance, ehPeriodoPerformance, PERIODOS_PERFORMANCE, ORDENS_PERFORMANCE,
  type OrdemPerformance, type PeriodoPerformance, type LinhaPerformance,
} from "@/lib/relatorios/performance";
import { GO_LIVE } from "@/lib/relatorios/periodo";
import { Pagina, PaginaCabecalho, PaginaResumo, type ItemResumo } from "@/components/onface/shell/Pagina";
import { moeda } from "@/components/onface/vendas/formato";
import "@/components/onface/relatorios/relatorios.css";

export const metadata = { title: "Performance" };
export const dynamic = "force-dynamic";

const inteiro = (v: number) => v.toLocaleString("pt-BR");
const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const dia = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" });

function href(periodo: PeriodoPerformance, ordem: OrdemPerformance) {
  return `/relatorios/performance?periodo=${periodo}&ordem=${ordem}`;
}

/** Zero vira cinza claro: numa grade de números o olho precisa achar o que
 *  aconteceu, não ler vinte zeros com o mesmo peso. */
function Num({ v, children }: { v: number; children?: React.ReactNode }) {
  return <span className={v === 0 ? "rel-zero" : undefined}>{children ?? inteiro(v)}</span>;
}

export default async function RelatoriosPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; ordem?: string }>;
}) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const p = await searchParams;
  const periodo: PeriodoPerformance = ehPeriodoPerformance(p.periodo) ? p.periodo : "30d";
  const ordem: OrdemPerformance = ORDENS_PERFORMANCE.includes(p.ordem as OrdemPerformance) ? (p.ordem as OrdemPerformance) : "faturamento";

  // Closer/SDR veem só a própria linha — mesma blindagem do /relatorios/equipe.
  // Papel efetivo (respeita view-as), como no resto do CRM.
  const pessoal = isPersonalView(ctx.userRole);
  const dados = await getPerformance(ctx.organizacaoId, periodo, pessoal ? ctx.userId : null);
  const linhas = ordenarPerformance(dados.linhas, ordem);

  const soma = (k: keyof LinhaPerformance) => linhas.reduce((s, l) => s + (Number(l[k]) || 0), 0);
  const ganhos = soma("ganhos");
  const perdidos = soma("perdidos");
  const totais = {
    faturamento: soma("faturamento"),
    ganhos,
    perdidos,
    conversao: ganhos + perdidos > 0 ? ganhos / (ganhos + perdidos) : null,
    reunioes: soma("reunioesAgendadas"),
    esforco: soma("esforco"),
    ligacoes: soma("ligacoes"),
    minutos: soma("minutosLigacao"),
    whatsapp: soma("whatsapp"),
    notas: soma("notas"),
    etapas: soma("etapas"),
    tarefas: soma("tarefas"),
  };

  // until é exclusivo (mês passado termina em 01/MM 00:00): -1ms mostra o último dia real.
  const janela = `${dia.format(dados.since)} – ${dia.format(new Date(dados.until.getTime() - 1))}`;
  const cortadoNoGoLive = dados.since.getTime() === GO_LIVE.getTime();

  const resumo: ItemResumo[] = [
    { rotulo: "Faturamento fechado", valor: moeda(totais.faturamento), detalhe: "mensalidade + setup dos ganhos", destaque: true },
    { rotulo: "Ganhos", valor: totais.ganhos, detalhe: `${totais.perdidos} perdido(s) no período` },
    { rotulo: "Conversão", valor: pct(totais.conversao), detalhe: "ganhos ÷ (ganhos + perdidos)" },
    { rotulo: "Reuniões agendadas", valor: totais.reunioes, detalhe: "régua da meta da SDR" },
    { rotulo: "Ações registradas", valor: inteiro(totais.esforco), detalhe: `${inteiro(totais.ligacoes)} ligações · ${inteiro(totais.whatsapp)} WhatsApp` },
  ];

  const colunas: Array<{ chave: OrdemPerformance | null; titulo: string }> = [
    { chave: "nome", titulo: "Pessoa" },
    { chave: "faturamento", titulo: "Faturamento" },
    { chave: "ganhos", titulo: "Ganhos" },
    { chave: null, titulo: "Perdidos" },
    { chave: "conversao", titulo: "Conversão" },
    { chave: "reunioesAgendadas", titulo: "Reuniões" },
    { chave: "ligacoes", titulo: "Ligações" },
    { chave: null, titulo: "WhatsApp" },
    { chave: null, titulo: "Notas" },
    { chave: null, titulo: "Etapas" },
    { chave: null, titulo: "Tarefas" },
    { chave: "esforco", titulo: "Total ações" },
  ];

  return (
    <Pagina>
      <PaginaCabecalho
        titulo="Performance"
        descricao={
          pessoal
            ? `Seu resultado e seu esforço no período (${janela}).`
            : `Resultado e esforço de cada pessoa, lado a lado (${janela}).`
        }
        acoes={
          linhas.length > 0 ? (
            <a className="rel-btn" href={`/relatorios/performance/exportar?periodo=${periodo}&ordem=${ordem}`} download>
              Exportar CSV
            </a>
          ) : (
            <span className="rel-motivo">Nada para exportar neste período</span>
          )
        }
      />
      <PaginaResumo itens={resumo} />

      <section className="rel" aria-label="Performance por pessoa">
        <div className="rel-filtros">
          <nav className="rel-segmento" aria-label="Período">
            {PERIODOS_PERFORMANCE.map((op) => (
              <Link key={op.chave} href={href(op.chave, ordem)} aria-current={periodo === op.chave ? "page" : undefined}>
                {op.rotulo}
              </Link>
            ))}
          </nav>
          {cortadoNoGoLive ? (
            <span className="rel-motivo">Janela começa no go-live (01/07/2026): antes disso o histórico é do Zoho.</span>
          ) : null}
        </div>

        {linhas.length === 0 ? (
          <div className="rel-vazio">
            <strong>Nenhum movimento neste período</strong>
            <span>
              Nenhuma ligação, mensagem, nota, mudança de etapa, tarefa concluída ou negócio fechado foi registrado
              entre {janela}. Tente uma janela maior.
            </span>
          </div>
        ) : (
          <div className="rel-tabela-wrap">
            <table className="rel-tabela">
              <thead>
                <tr className="rel-grupo">
                  <th />
                  <th colSpan={5} style={{ textAlign: "center" }}>Resultado</th>
                  <th colSpan={6} style={{ textAlign: "center" }}>Esforço</th>
                </tr>
                <tr>
                  {colunas.map((c) => (
                    <th key={c.titulo} scope="col">
                      {c.chave ? (
                        <Link href={href(periodo, c.chave)} aria-current={ordem === c.chave ? "true" : undefined}>{c.titulo}</Link>
                      ) : c.titulo}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.usuarioId}>
                    <td>
                      <span className="rel-pessoa">
                        <strong>{l.nome}</strong>
                        <span>{l.papel.replace("_", " ")}</span>
                      </span>
                    </td>
                    <td><Num v={l.faturamento}>{moeda(l.faturamento)}</Num></td>
                    <td><Num v={l.ganhos} /></td>
                    <td><Num v={l.perdidos} /></td>
                    <td>{pct(l.conversao)}</td>
                    <td><Num v={l.reunioesAgendadas} /></td>
                    <td>
                      <Num v={l.ligacoes} />
                      {l.ligacoes > 0 ? <span className="rel-sub">{inteiro(l.minutosLigacao)} min</span> : null}
                    </td>
                    <td><Num v={l.whatsapp} /></td>
                    <td><Num v={l.notas} /></td>
                    <td><Num v={l.etapas} /></td>
                    <td><Num v={l.tarefas} /></td>
                    <td><strong>{inteiro(l.esforco)}</strong></td>
                  </tr>
                ))}
              </tbody>
              {linhas.length > 1 ? (
                <tfoot>
                  <tr>
                    <td>Time ({linhas.length})</td>
                    <td>{moeda(totais.faturamento)}</td>
                    <td>{inteiro(totais.ganhos)}</td>
                    <td>{inteiro(totais.perdidos)}</td>
                    <td>{pct(totais.conversao)}</td>
                    <td>{inteiro(totais.reunioes)}</td>
                    <td>{inteiro(totais.ligacoes)}<span className="rel-sub">{inteiro(totais.minutos)} min</span></td>
                    <td>{inteiro(totais.whatsapp)}</td>
                    <td>{inteiro(totais.notas)}</td>
                    <td>{inteiro(totais.etapas)}</td>
                    <td>{inteiro(totais.tarefas)}</td>
                    <td>{inteiro(totais.esforco)}</td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        )}

        {!pessoal && dados.semMovimento.length > 0 ? (
          <p className="rel-nota">
            <strong>Sem movimento no período ({dados.semMovimento.length}):</strong> {dados.semMovimento.join(", ")}.
          </p>
        ) : null}
        <p className="rel-nota">
          Faturamento = mensalidade + setup dos negócios ganhos na janela (a mesma soma da meta comercial). Perdidos
          contam o evento de perda na janela. Reuniões = leads que a própria pessoa moveu para reunião agendada sendo
          dona do card.
          {dados.ligacoesSemUsuario > 0
            ? ` ${inteiro(dados.ligacoesSemUsuario)} ligações sem usuário ativo vinculado (sem e-mail ou de quem não está no CRM) não entram nas linhas nem no total.`
            : null}{" "}
          Esforço por dia e por pessoa fica em{" "}
          <Link href="/relatorios/biblioteca/atividade-time">Atividade do time</Link>.
        </p>
      </section>
    </Pagina>
  );
}
