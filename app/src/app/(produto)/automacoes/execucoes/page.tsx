import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import {
  listarExecucoes, resumoExecucoes, STATUS_EXECUCAO,
  type FonteExecucao, type StatusExecucao,
} from "@/lib/automacoes/execucoes";
import { Pagina, PaginaCabecalho, PaginaResumo, type ItemResumo } from "@/components/onface/shell/Pagina";
import { agentesParaFiltro } from "@/lib/automacoes/agentes-tela";
import { ExecucoesAgentes } from "@/components/onface/automacoes/ExecucoesAgentes";
import Link from "next/link";
import { Execucoes } from "@/components/onface/automacoes/Execucoes";
import { ReprocessarBotao } from "@/components/onface/automacoes/ReprocessarBotao";
import { AbasAutomacoes } from "@/components/onface/automacoes/Abas";
// Estilo das abas (.oa-abas): todo seletor ali é escopado em .oa-*, então
// importar aqui não vaza para o resto da tela.
import "@/components/onface/automacoes/automacoes.css";

export const metadata = { title: "Execuções" };
export const dynamic = "force-dynamic";

// Mesmos papéis do Hono: GET /admin/event-outbox/falhas (ver) e
// POST /admin/event-outbox/reprocessar (agir). A tela não pode prometer mais
// do que o endpoint entrega.
const PODE_VER_FILA = ["admin", "super_admin", "gerente"];
const PODE_REPROCESSAR = ["admin", "super_admin"];

function idade(iso: string) {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

export default async function AutomacoesExecucoesPage({
  searchParams,
}: {
  searchParams: Promise<{ fonte?: string; status?: string; visao?: string; agente?: string; exec?: string }>;
}) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const verFila = PODE_VER_FILA.includes(ctx.userRole);
  const podeReprocessar = PODE_REPROCESSAR.includes(ctx.userRole);

  const p = await searchParams;
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const visaoAgentes = p.visao === "agentes";
  const seletorVisao = (
    <nav className="exe-segmento" aria-label="Tipo de execução" style={{ marginBottom: 12, alignSelf: "flex-start" }}>
      <Link href="/automacoes/execucoes" aria-current={!visaoAgentes ? "page" : undefined}>Fila, automações e cadências</Link>
      <Link href="/automacoes/execucoes?visao=agentes" aria-current={visaoAgentes ? "page" : undefined}>Agentes de IA</Link>
    </nav>
  );
  if (visaoAgentes) {
    const agentes = await agentesParaFiltro(ctx.organizacaoId);
    return (
      <Pagina>
        <div className="oa-barra" style={{ marginBottom: 12 }}><AbasAutomacoes atual="/automacoes/execucoes" /></div>
        <PaginaCabecalho titulo="Execuções" descricao="O que cada agente de IA consultou, decidiu e fez, com fontes, ferramentas, custo e resultado. Indicadores calculados só de fatos registrados." />
        {seletorVisao}
        <ExecucoesAgentes
          agentes={agentes}
          agenteInicial={UUID.test(p.agente ?? "") ? p.agente! : ""}
          execInicial={UUID.test(p.exec ?? "") ? p.exec! : null}
        />
      </Pagina>
    );
  }
  const fontesValidas: FonteExecucao[] = verFila ? ["fila", "automacao", "cadencia"] : ["automacao", "cadencia"];
  const fonte = fontesValidas.includes(p.fonte as FonteExecucao) ? (p.fonte as FonteExecucao) : null;
  // Recortes que só existem no outbox somem para quem não vê a fila: sem chip
  // correspondente, o filtro ficaria ativo e impossível de desmarcar.
  const SO_FILA: StatusExecucao[] = ["aguardando", "pendente"];
  const statusValidos = verFila ? STATUS_EXECUCAO : STATUS_EXECUCAO.filter((s) => !SO_FILA.includes(s));
  const status = statusValidos.includes(p.status as StatusExecucao) ? (p.status as StatusExecucao) : null;

  const [execucoes, resumo] = await Promise.all([
    listarExecucoes(ctx.organizacaoId, ctx.userId, { fonte, status, verFila }),
    resumoExecucoes(ctx.organizacaoId, ctx.userId),
  ]);

  const { fila } = resumo;
  const itens: ItemResumo[] = [
    ...(verFila
      ? [
          {
            rotulo: "Processados pela fila",
            valor: fila.processados,
            detalhe: `${fila.processados + fila.pendentes + fila.processando + fila.falhas} eventos no total`,
            destaque: true,
          },
          {
            rotulo: "Aguardando o worker",
            valor: fila.pendentes + fila.processando,
            // Idade do mais antigo é o que diz se o worker está parado: 5 na
            // fila há minutos é normal, há dias não é.
            detalhe: fila.pendenteMaisAntigo ? `mais antigo há ${idade(fila.pendenteMaisAntigo)}` : "fila vazia",
            sinal: true,
            href: "/automacoes/execucoes?fonte=fila&status=aguardando",
          },
          {
            rotulo: "Dead-letter",
            valor: fila.falhas,
            detalhe: "estouraram 5 tentativas",
            sinal: true,
            href: "/automacoes/execucoes?fonte=fila&status=erro",
          },
        ]
      : []),
    { rotulo: "Regras de automação", valor: resumo.automacoes, detalhe: "execuções registradas", destaque: !verFila },
    // Conta tudo de cadence_enrollment_events: passos e marcos da inscrição.
    { rotulo: "Eventos de cadência", valor: resumo.cadencias, detalhe: "passos e marcos da inscrição" },
  ];

  return (
    <Pagina>
      {/* Abas no topo, como nas irmãs. Ficavam entre o resumo e os filtros e
          liam como mais um filtro da lista. */}
      <div className="oa-barra" style={{ marginBottom: 12 }}><AbasAutomacoes atual="/automacoes/execucoes" /></div>
      <PaginaCabecalho
        titulo="Execuções"
        descricao="Fila de eventos do worker, regras de automação e passos de cadência, num único registro."
        acoes={
          verFila && fila.falhas > 0 ? (
            // reprocessarEventosFalhados (lib/events/consumer.ts) reenfileira
            // no máximo 200 por chamada; o rótulo não pode prometer mais.
            <ReprocessarBotao
              rotulo={fila.falhas > 200 ? "Reprocessar 200 falhas (até 200 por vez)" : `Reprocessar ${fila.falhas} falha(s)`} permitido={podeReprocessar} variante="primario" />
          ) : null
        }
      />
      {seletorVisao}
      <PaginaResumo itens={itens} />
      {!verFila ? (
        <p className="exe-aviso" style={{ marginBottom: 12 }}>
          A fila de eventos do worker é visível para admin e gerente.
        </p>
      ) : null}
      <Execucoes
        execucoes={execucoes}
        fonte={fonte}
        status={status}
        verFila={verFila}
        podeReprocessar={podeReprocessar}
      />
    </Pagina>
  );
}
