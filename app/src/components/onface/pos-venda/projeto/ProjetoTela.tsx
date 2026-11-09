"use client";

/**
 * Tela do projeto de pós-venda.
 *
 * Cabeçalho, os dois relógios e, abaixo, o conteúdo em abas ao lado da coluna
 * de contexto. A aba ativa vive na URL (`?aba=`): o link compartilhado abre na
 * mesma aba e F5 não perde onde a pessoa estava. A troca usa
 * `history.replaceState`, que o Next integra ao roteador, então é instantânea e
 * não refaz a leitura no servidor.
 */
import { useState } from "react";
import { Tabs as T } from "radix-ui";
import type { Projeto, Usuario } from "@/lib/pos-venda/contrato";
import type { AcoesDaTela } from "./acoes";
import { Cabecalho } from "./Cabecalho";
import { Contexto } from "./Contexto";
import { Levantamento } from "./Levantamento";
import { LinhaDoTempo } from "./LinhaDoTempo";
import { Materiais } from "./Materiais";
import { Relogios } from "./Relogios";
import { Tarefas } from "./Tarefas";
import { VisaoGeral } from "./VisaoGeral";
import { abaDoProjeto, type AbaDoProjeto } from "../parametros";

export function ProjetoTela({ projeto, equipe, agora, acoes, abaInicial }: { projeto: Projeto; equipe: Usuario[]; agora: Date; acoes: AcoesDaTela; abaInicial: AbaDoProjeto }) {
  const [aba, setAba] = useState<AbaDoProjeto>(abaInicial);

  const trocar = (v: string) => {
    const nova = abaDoProjeto(v);
    setAba(nova);
    const url = new URL(window.location.href);
    if (nova === "visao") url.searchParams.delete("aba");
    else url.searchParams.set("aba", nova);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  };

  const encerrado = projeto.estado === "CONCLUIDO" || projeto.estado === "CANCELADO";
  const abertas = projeto.tarefas.filter((t) => t.estado !== "CONCLUIDA" && t.estado !== "NAO_SE_APLICA").length;

  const abas: Array<{ chave: AbaDoProjeto; rotulo: string; contagem?: number }> = [
    { chave: "visao", rotulo: "Visão geral" },
    { chave: "tarefas", rotulo: "Tarefas", contagem: abertas },
    { chave: "levantamento", rotulo: "Levantamento" },
    { chave: "materiais", rotulo: "Materiais" },
    { chave: "tempo", rotulo: "Linha do tempo", contagem: projeto.timeline.length },
  ];

  return (
    <div className="pv">
      <Cabecalho projeto={projeto} agora={agora} acoes={acoes} />
      <Relogios projeto={projeto} agora={agora} acoes={acoes} />

      <div className="pv-corpo">
        <div className="pv-principal">
          <T.Root value={aba} onValueChange={trocar} activationMode="automatic">
            <T.List className="pv-abas" aria-label="Seções do projeto">
              {abas.map((a) => (
                <T.Trigger key={a.chave} value={a.chave} className="pv-aba">
                  {a.rotulo}
                  {a.contagem !== undefined ? <span className="pv-contagem">{a.contagem}</span> : null}
                </T.Trigger>
              ))}
            </T.List>

            <T.Content value="visao" className="pv-painel pv-painel-aba" tabIndex={-1}>
              <VisaoGeral projeto={projeto} agora={agora} acoes={acoes} aoVerTudo={() => trocar("tempo")} />
            </T.Content>
            <T.Content value="tarefas" className="pv-painel pv-painel-aba" tabIndex={-1}>
              <Tarefas projetoId={projeto.id} tarefas={projeto.tarefas} equipe={equipe} agora={agora} acoes={acoes} podeConcluir={projeto.permissoes.podeConcluirTarefa} encerrado={encerrado} />
            </T.Content>
            <T.Content value="levantamento" className="pv-painel pv-painel-aba" tabIndex={-1}>
              <Levantamento levantamento={projeto.levantamento} acoes={acoes} podeEditar={!encerrado} />
            </T.Content>
            <T.Content value="materiais" className="pv-painel pv-painel-aba" tabIndex={-1}>
              <Materiais projeto={projeto} agora={agora} acoes={acoes} />
            </T.Content>
            <T.Content value="tempo" className="pv-painel pv-painel-aba" tabIndex={-1}>
              <LinhaDoTempo eventos={projeto.timeline} agora={agora} />
            </T.Content>
          </T.Root>
        </div>

        <Contexto projeto={projeto} />
      </div>
    </div>
  );
}
