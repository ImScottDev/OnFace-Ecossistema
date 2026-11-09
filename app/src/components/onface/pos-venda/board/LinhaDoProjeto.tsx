/**
 * Uma linha da lista: o projeto em uma varredura horizontal.
 *
 * Ordem de leitura = ordem do trabalho: quem é, o que fazer agora, em que
 * estado está, quanto falta, quem segura, há quanto tempo está ali. O link é
 * esticado no nome (o `::after` cobre a linha), então o leitor de tela ouve um
 * destino só e não há controle aninhado em link.
 *
 * Projeto real vem esparso, e a linha foi desenhada para isso: sem
 * responsável, sem contato e sem prazo cada um vira um texto no lugar, com a
 * mesma altura de uma linha cheia, para a lista não pular.
 */
import Link from "next/link";
import { AlarmClock, CheckCircle2, CircleDashed, CornerDownRight, Hourglass, ShieldCheck } from "lucide-react";
import type { CartaoDoProjeto } from "@/lib/pos-venda/contrato";
import { FAMILIAS, percentual, primeiroNome, TIPO } from "../formatos";
import { Avatar, AvatarVazio, Barra, PilulaDeEstado } from "../pecas";
import { estaAberto, idadeCurta, nomeParaExibir, sinalDo } from "./analise";

const ICONE_DO_SINAL = { risco: AlarmClock, validacao: ShieldCheck, espera: Hourglass, andamento: CornerDownRight, ok: CheckCircle2, neutro: CircleDashed } as const;

export function LinhaDoProjeto({ c, agora, repetidos }: { c: CartaoDoProjeto; agora: Date; repetidos: number }) {
  const aberto = estaAberto(c);
  const nome = nomeParaExibir(c.empresa.nome);
  const sinal = sinalDo(c, agora);
  const Icone = ICONE_DO_SINAL[sinal.tom];
  const prazoReal = c.relogios.venceEm;
  const pessoas = c.pessoas.length;

  return (
    <li className="pv-lp" data-aberto={aberto || undefined}>
      <div className="pv-lp-empresa">
        <span className="pv-lp-nome-linha">
          <Link className="pv-lp-nome" href={`/pos-vendas/${c.id}`} title={c.empresa.nome} data-suspeito={nome.suspeito || undefined}>
            {nome.texto}
          </Link>
          {repetidos > 1 ? (
            <span className="pv-repetido" title={`Há ${repetidos} projetos desta empresa na lista`}>
              {repetidos} projetos
            </span>
          ) : null}
        </span>
        <span className="pv-lp-sinal" data-pv-tom={sinal.tom}>
          <Icone aria-hidden />
          <span className="pv-lp-sinal-texto">{sinal.texto}</span>
          {sinal.quando ? <span className="pv-lp-sinal-quando">{sinal.quando}</span> : null}
        </span>
      </div>

      <div className="pv-lp-estado">
        <PilulaDeEstado estado={c.estado} />
        <span className="pv-lp-produto">{FAMILIAS[c.familia].rotulo} · {TIPO[c.tipo]}</span>
      </div>

      <div className="pv-lp-progresso">
        <Barra fracao={c.progresso} tom={c.estado === "CONCLUIDO" ? "ok" : "andamento"} rotulo={`Progresso de ${c.empresa.nome}`} />
        <span className="pv-lp-progresso-texto">
          {c.tarefasTotal > 0 ? (
            <>
              <b>{percentual(c.progresso)}%</b> <span>{c.tarefasConcluidas}/{c.tarefasTotal}</span>
            </>
          ) : (
            <span>Sem tarefas</span>
          )}
        </span>
      </div>

      <div className="pv-lp-equipe">
        {c.responsavel ? (
          <span className="pv-responsavel">
            <Avatar quem={c.responsavel} tamanho="sm" titulo={false} decorativo />
            <span className="pv-truncar">{primeiroNome(c.responsavel.nome)}</span>
          </span>
        ) : (
          <span className="pv-responsavel" data-vazio="true" data-urgente={aberto || undefined}>
            <AvatarVazio tamanho="sm" rotulo="Sem responsável" />
            <span className="pv-truncar">Sem dono</span>
          </span>
        )}
        <span className="pv-lp-contatos">{pessoas > 0 ? `${pessoas}${pessoas >= 3 ? "+" : ""} ${pessoas === 1 ? "contato" : "contatos"}` : "Sem contatos"}</span>
      </div>

      <div className="pv-lp-idade" title={prazoReal ? "Prazo do projeto" : "Tempo desde a entrada"}>
        {aberto && prazoReal ? <span>{c.relogios.diasDeAtraso !== null && c.relogios.diasDeAtraso > 0 ? `+${c.relogios.diasDeAtraso} d` : "no prazo"}</span> : <span>{idadeCurta(c, agora)}</span>}
        <span className="pv-lp-idade-rotulo">{aberto && prazoReal ? "prazo" : "na casa"}</span>
      </div>
    </li>
  );
}
