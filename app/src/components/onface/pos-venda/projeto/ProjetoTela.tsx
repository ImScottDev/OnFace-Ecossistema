"use client";

/**
 * Tela do projeto de pós-venda.
 *
 * Reorganizada a partir da jornada, não do conteúdo. Quem chega aqui veio da
 * mesa, clicando numa AÇÃO ("Agendar reunião de onboarding"). Abrir numa
 * visão geral é um desvio: a pessoa já sabe o que veio fazer.
 *
 * Por isso duas mudanças de estrutura:
 *
 * 1. A ABA "VISÃO GERAL" DEIXOU DE EXISTIR. Ela era onde as sobras moravam, e
 *    o dono reprovou exatamente isso ("totalmente desorganizada"). O conteúdo
 *    tem casas melhores: próximos passos É a lista de tarefas, progresso é
 *    uma linha no cabeçalho, atividade recente é a linha do tempo, e as notas
 *    foram para a coluna de contexto, que é onde se olha "o que o próximo
 *    precisa saber".
 *
 * 2. A TELA ABRE NAS TAREFAS. É o trabalho. O resto é consulta.
 *
 * A aba ativa continua na URL (`?aba=`), e `history.replaceState` troca sem
 * refazer a leitura no servidor.
 */
import { useState } from "react";
import { Tabs as T } from "radix-ui";
import { History } from "lucide-react";
import type { Projeto, Usuario } from "@/lib/pos-venda/contrato";
import type { AcoesDaTela } from "./acoes";
import { Cabecalho } from "./Cabecalho";
import { Contexto } from "./Contexto";
import { Levantamento } from "./Levantamento";
import { LinhaDoTempo } from "./LinhaDoTempo";
import { Materiais } from "./Materiais";
import { Relogios } from "./Relogios";
import { Tarefas } from "./Tarefas";
import { dia } from "../formatos";
import { abaDoProjeto, type AbaDoProjeto } from "../parametros";

export function ProjetoTela({ projeto, equipe, agora, acoes, abaInicial }: { projeto: Projeto; equipe: Usuario[]; agora: Date; acoes: AcoesDaTela; abaInicial: AbaDoProjeto }) {
  const [aba, setAba] = useState<AbaDoProjeto>(abaInicial);

  const trocar = (v: string) => {
    const nova = abaDoProjeto(v);
    setAba(nova);
    const url = new URL(window.location.href);
    /* "tarefas" é o padrão agora, então ele sai da URL em vez de "visao". */
    if (nova === "tarefas") url.searchParams.delete("aba");
    else url.searchParams.set("aba", nova);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  };

  const encerrado = projeto.estado === "CONCLUIDO" || projeto.estado === "CANCELADO";
  const abertas = projeto.tarefas.filter((t) => t.estado !== "CONCLUIDA" && t.estado !== "NAO_SE_APLICA").length;

  const abas: Array<{ chave: AbaDoProjeto; rotulo: string; contagem?: number }> = [
    { chave: "tarefas", rotulo: "Tarefas", contagem: abertas },
    { chave: "levantamento", rotulo: "Levantamento" },
    { chave: "materiais", rotulo: "Materiais" },
    { chave: "tempo", rotulo: "Linha do tempo", contagem: projeto.timeline.length },
  ];

  return (
    <div className="pv">
      <Cabecalho projeto={projeto} equipe={equipe} agora={agora} acoes={acoes} />
      <Relogios projeto={projeto} agora={agora} acoes={acoes} />

      {projeto.herdadoDe && projeto.herdadoDe.passosHerdados.length > 0 ? (
        <div className="pv-aviso" data-pv-tom="validacao">
          <History aria-hidden />
          <span>
            Este projeto herdou {projeto.herdadoDe.passosHerdados.length} {projeto.herdadoDe.passosHerdados.length === 1 ? "passo" : "passos"} de uma jornada anterior
            {projeto.herdadoDe.concluidoEm ? `, concluída em ${dia(projeto.herdadoDe.concluidoEm, agora)}` : ""}. Eles não precisam ser refeitos.
          </span>
        </div>
      ) : null}

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

        <Contexto projeto={projeto} agora={agora} acoes={acoes} />
      </div>
    </div>
  );
}
