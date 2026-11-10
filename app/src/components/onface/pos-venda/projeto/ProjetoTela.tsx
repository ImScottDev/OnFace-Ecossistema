"use client";

/**
 * Tela do projeto de pós-venda.
 *
 * Duas colunas: à esquerda a ficha do cliente (quem é, como falar com ele, o que comprou, o que aconteceu),
 * à direita o trabalho. Quem chega aqui veio da mesa clicando numa ação, então a tela abre em TAREFAS — não
 * numa visão geral onde as sobras moravam (spec §6.4). A aba vive na URL (`?aba=`).
 */
import { useState } from "react";
import { Tabs as T } from "radix-ui";
import { Pause, Play } from "lucide-react";
import type { Projeto, Usuario } from "@/lib/pos-venda/contrato";
import type { AcoesDaTela } from "./acoes";
import { useAcao } from "./acoes";
import { Cabecalho } from "./Cabecalho";
import { Ficha } from "./Ficha";
import { Levantamento } from "./Levantamento";
import { LinhaDoTempo } from "./LinhaDoTempo";
import { Materiais } from "./Materiais";
import { Tarefas } from "./Tarefas";
import { abaDoProjeto, type AbaDoProjeto } from "../parametros";
import { dia, duracao, haQuanto, MOTIVOS, percentual } from "../formatos";

type Aba = Exclude<AbaDoProjeto, "visao">;
const daUrl = (a: AbaDoProjeto): Aba => (a === "visao" ? "tarefas" : a);

export function ProjetoTela({ projeto, equipe, agora, acoes, abaInicial }: { projeto: Projeto; equipe: Usuario[]; agora: Date; acoes: AcoesDaTela; abaInicial: AbaDoProjeto }) {
  const [aba, setAba] = useState<Aba>(daUrl(abaInicial));

  const trocar = (v: string) => {
    const nova = daUrl(abaDoProjeto(v));
    setAba(nova);
    const url = new URL(window.location.href);
    if (nova === "tarefas") url.searchParams.delete("aba");
    else url.searchParams.set("aba", nova);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  };

  const encerrado = projeto.estado === "CONCLUIDO" || projeto.estado === "CANCELADO";
  const abertas = projeto.tarefas.filter((t) => t.estado !== "CONCLUIDA" && t.estado !== "NAO_SE_APLICA").length;
  const abas: Array<{ chave: Aba; rotulo: string; contagem?: number }> = [
    { chave: "tarefas", rotulo: "Tarefas", contagem: abertas },
    { chave: "levantamento", rotulo: "Levantamento" },
    { chave: "materiais", rotulo: "Materiais" },
    { chave: "tempo", rotulo: "Linha do tempo", contagem: projeto.timeline.length },
  ];

  return (
    <div className="pv pvp">
      <aside className="pvp-ficha" aria-label="Ficha do cliente">
        <Ficha projeto={projeto} agora={agora} />
      </aside>

      <div className="pvp-trabalho">
        <Cabecalho projeto={projeto} agora={agora} acoes={acoes} />
        <Indicadores projeto={projeto} agora={agora} acoes={acoes} />

        <T.Root value={aba} onValueChange={trocar} activationMode="automatic">
          <T.List className="pvp-abas" aria-label="Seções do projeto">
            {abas.map((a) => (
              <T.Trigger key={a.chave} value={a.chave} className="pvp-aba">
                {a.rotulo}
                {a.contagem !== undefined ? <span className="pvp-contagem">{a.contagem}</span> : null}
              </T.Trigger>
            ))}
          </T.List>
          <T.Content value="tarefas" className="pvp-painel" tabIndex={-1}>
            {projeto.tarefas.length === 0 ? (
              <div className="pvp-sem-tarefa">
                <strong>Este projeto ainda não tem tarefas.</strong>
                <p>{projeto.links.cliente360
                  ? "As tarefas nascem do playbook da família. Se ele estiver vazio, ajuste em Ajustes › Pós-venda."
                  : "O projeto não tem empresa vinculada, e tarefa precisa de empresa. Vincule a empresa na venda para o playbook ser aplicado."}</p>
              </div>
            ) : (
              <Tarefas projetoId={projeto.id} tarefas={projeto.tarefas} equipe={equipe} agora={agora} acoes={acoes} podeConcluir={projeto.permissoes.podeConcluirTarefa} encerrado={encerrado} />
            )}
          </T.Content>
          <T.Content value="levantamento" className="pvp-painel" tabIndex={-1}>
            <Levantamento levantamento={projeto.levantamento} acoes={acoes} podeEditar={!encerrado} />
          </T.Content>
          <T.Content value="materiais" className="pvp-painel" tabIndex={-1}>
            <Materiais projeto={projeto} agora={agora} acoes={acoes} />
          </T.Content>
          <T.Content value="tempo" className="pvp-painel" tabIndex={-1}>
            <LinhaDoTempo eventos={projeto.timeline} agora={agora} />
          </T.Content>
        </T.Root>
      </div>
    </div>
  );
}

/**
 * Três números grandes, cada um com a frase que o explica. Quando os dois relógios marcam o mesmo
 * (nenhuma espera), vira um só — dois números iguais lado a lado é pedir ao leitor para subtrair (spec §2.2).
 */
function Indicadores({ projeto: p, agora, acoes }: { projeto: Projeto; agora: Date; acoes: AcoesDaTela }) {
  const { pendente, rodar } = useAcao();
  const r = p.relogios;
  const feitas = p.tarefas.filter((t) => t.estado === "CONCLUIDA" || t.estado === "NAO_SE_APLICA").length;
  const pct = percentual(p.progresso);
  const divergem = Math.abs(r.horasCorridas - r.horasDoTime) >= 1;
  const atraso = r.diasDeAtraso;

  return (
    <div className="pvp-kpis">
      <div className="pvp-kpi">
        <span className="pvp-kpi-rotulo">Progresso</span>
        <span className="pvp-kpi-valor">{pct}%</span>
        <span className="pvp-barra" aria-hidden><span style={{ width: `${pct}%` }} /></span>
        <span className="pvp-kpi-nota">
          {p.tarefas.length > 0 ? `${feitas} de ${p.tarefas.length} tarefas concluídas` : p.checklist ? `${p.checklist.feitos} de ${p.checklist.total} itens do checklist anterior` : "Sem tarefas para medir"}
        </span>
      </div>

      <div className="pvp-kpi" data-tom={atraso != null && atraso > 0 ? "risco" : undefined}>
        <span className="pvp-kpi-rotulo">Prazo</span>
        <span className="pvp-kpi-valor">
          {r.venceEm == null ? "—" : atraso != null && atraso > 0 ? `${Math.ceil(atraso)} d atrasado` : atraso != null ? `${Math.floor(-atraso)} d restantes` : dia(r.venceEm, agora)}
        </span>
        <span className="pvp-kpi-nota">
          {r.venceEm == null ? `Prazo ainda não definido · padrão da família: ${r.prazoDias} dias corridos` : `Vence ${dia(r.venceEm, agora)}`}
        </span>
      </div>

      <div className="pvp-kpi" data-tom={r.esperando ? "espera" : undefined}>
        <span className="pvp-kpi-rotulo">{r.esperando ? MOTIVOS[r.esperando.motivo].frase : divergem ? "Relógio do time" : "Tempo em andamento"}</span>
        <span className="pvp-kpi-valor">{duracao(divergem ? r.horasDoTime : r.horasCorridas)}</span>
        <span className="pvp-kpi-nota">
          {r.esperando
            ? `Pausado ${haQuanto(r.esperando.desde, agora)}${r.esperando.detalhe ? ` · ${r.esperando.detalhe}` : ""}`
            : divergem
              ? `Cliente esperando há ${duracao(r.horasCorridas)} no total`
              : "Nenhuma espera registrada, os dois relógios marcam o mesmo"}
        </span>
        {r.esperando ? (
          <button type="button" className="pvp-kpi-acao" disabled={pendente} onClick={() => rodar(() => acoes.encerrarEspera(), "A bola voltou para o time.")}>
            <Play aria-hidden /> Retomar a bola
          </button>
        ) : (
          <span className="pvp-kpi-dica"><Pause aria-hidden /> Use “Marcar espera” quando a bola sair do time</span>
        )}
      </div>
    </div>
  );
}
