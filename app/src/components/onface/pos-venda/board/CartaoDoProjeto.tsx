/**
 * Cartão de projeto (visão em cartões).
 *
 * Existe para quem prefere varrer por blocos: estado e sinal no topo, nome,
 * progresso com percentual e "31/45 tarefas", o que fazer agora, e quem está
 * no projeto. Os mesmos dados da linha, em outro arranjo.
 *
 * O dado é esparso, então todo bloco tem o seu "não há": sem tarefas, sem
 * responsável, sem contatos, sem prazo. O cartão tem sempre a mesma altura de
 * uma coluna de grade, cheio ou vazio.
 */
import Link from "next/link";
import { AlarmClock, CalendarClock, CheckCircle2, CircleDashed, CornerDownRight, Hourglass, ShieldCheck } from "lucide-react";
import type { CartaoDoProjeto } from "@/lib/pos-venda/contrato";
import { FAMILIAS, percentual, primeiroNome, TIPO } from "../formatos";
import { Avatar, AvatarVazio, Barra, PilhaDeAvatares, PilulaDeEstado } from "../pecas";
import { estaAberto, idadeCurta, nomeParaExibir, sinalDo } from "./analise";

const ICONE_DO_SINAL = { risco: AlarmClock, validacao: ShieldCheck, espera: Hourglass, andamento: CornerDownRight, ok: CheckCircle2, neutro: CircleDashed } as const;

export function CartaoDoProjetoView({ c, agora, repetidos }: { c: CartaoDoProjeto; agora: Date; repetidos: number }) {
  const aberto = estaAberto(c);
  const nome = nomeParaExibir(c.empresa.nome);
  const sinal = sinalDo(c, agora);
  const Icone = ICONE_DO_SINAL[sinal.tom];

  return (
    <li className="pv-cartao">
      <div className="pv-cartao-topo">
        <PilulaDeEstado estado={c.estado} />
        {sinal.tom === "risco" ? (
          <span className="pv-pilula" data-pv-tom="risco"><AlarmClock aria-hidden />Pede ação</span>
        ) : null}
      </div>

      <div className="pv-cartao-quem">
        <h3 className="pv-cartao-titulo">
          <Link href={`/pos-vendas/${c.id}`} title={c.empresa.nome} data-suspeito={nome.suspeito || undefined}>{nome.texto}</Link>
        </h3>
        <span className="pv-cartao-sub">
          {FAMILIAS[c.familia].rotulo} · {TIPO[c.tipo]}
          {c.escopoResumo ? ` · ${c.escopoResumo}` : ""}
          {repetidos > 1 ? <span className="pv-repetido">{repetidos} projetos</span> : null}
        </span>
      </div>

      <div className="pv-progresso">
        <div className="pv-progresso-linha">
          <span>
            {c.tarefasTotal > 0 ? (
              <><span className="pv-num">{c.tarefasConcluidas}/{c.tarefasTotal}</span> tarefas</>
            ) : (
              "Sem tarefas ainda"
            )}
          </span>
          <strong>{percentual(c.progresso)}%</strong>
        </div>
        <Barra fracao={c.progresso} tom={c.estado === "CONCLUIDO" ? "ok" : "andamento"} rotulo={`Progresso de ${c.empresa.nome}`} />
      </div>

      <div className="pv-proxima" data-pv-tom={sinal.tom}>
        <Icone aria-hidden />
        <span className="pv-proxima-texto">
          <span className="pv-proxima-titulo">{sinal.texto}</span>
          {sinal.quando ? <span className="pv-proxima-quando">{sinal.quando}</span> : null}
        </span>
      </div>

      <div className="pv-cartao-pe">
        <div className="pv-cartao-gente">
          <PilhaDeAvatares pessoas={c.pessoas} rotuloVazio="Sem contatos cadastrados" />
          {c.responsavel ? (
            <span className="pv-responsavel">
              <Avatar quem={c.responsavel} tamanho="sm" titulo={false} decorativo />
              <span className="pv-truncar">{primeiroNome(c.responsavel.nome)}</span>
            </span>
          ) : (
            <span className="pv-responsavel" data-vazio="true">
              <AvatarVazio tamanho="sm" rotulo="Sem responsável" />
              <span className="pv-truncar">Sem dono</span>
            </span>
          )}
        </div>
        {aberto ? (
          <span className="pv-prazo" data-pv-tom={(c.relogios.diasDeAtraso ?? 0) > 0 ? "risco" : undefined} title={c.relogios.venceEm ? "Prazo do projeto" : "Tempo desde a entrada"}>
            <CalendarClock aria-hidden />
            {c.relogios.venceEm ? ((c.relogios.diasDeAtraso ?? 0) > 0 ? `+${c.relogios.diasDeAtraso} d` : "no prazo") : `${idadeCurta(c, agora)} na casa`}
          </span>
        ) : null}
      </div>
    </li>
  );
}
