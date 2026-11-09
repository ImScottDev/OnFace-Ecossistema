/**
 * Cartão de projeto do board.
 *
 * O cartão inteiro é o alvo de clique por link esticado (o `::after` do
 * título cobre a área). Assim não há botão dentro de link nem link dentro de
 * link, e o leitor de tela anuncia um destino só: o nome da empresa.
 *
 * A hierarquia é a do trabalho: quem é, em que pé está, o que vem agora e
 * quem segura. A próxima tarefa ganha o único destaque de cor do cartão, e só
 * quando o dado diz que está atrasada.
 */
import Link from "next/link";
import { AlarmClock, CalendarClock, CheckCircle2, CornerDownRight, Hourglass } from "lucide-react";
import type { CartaoDoProjeto, MotivoDaEspera } from "@/lib/pos-venda/contrato";
import { haQuanto, prazo, primeiroNome, TIPO } from "../formatos";
import { Avatar, AvatarVazio, Barra, MarcaDaFamilia, PilhaDeAvatares, PilulaDeEstado } from "../pecas";

const COM_QUEM: Record<MotivoDaEspera, string> = {
  cliente: "Com o cliente",
  operadora: "Com a operadora",
  interno: "Com outra área da casa",
};

export function CartaoDoProjetoView({ c, agora }: { c: CartaoDoProjeto; agora: Date }) {
  const concluido = c.estado === "CONCLUIDO";
  const cancelado = c.estado === "CANCELADO";
  const proxima = c.proximaTarefa;
  const prazoDaProxima = proxima ? prazo(proxima.venceEm, agora) : null;
  const prazoDoProjeto = prazo(c.relogios.venceEm, agora, "Prazo começa no T0");
  const espera = c.relogios.esperando;

  return (
    <article className="pv-cartao">
      <div className="pv-cartao-topo">
        <span className="pv-cartao-origem">
          <MarcaDaFamilia familia={c.familia} />
          <span aria-hidden>·</span>
          <span>{TIPO[c.tipo]}</span>
        </span>
        <PilulaDeEstado estado={c.estado} />
      </div>

      <div className="pv-cartao-quem">
        <h3 className="pv-cartao-titulo">
          <Link href={`/pos-vendas/${c.id}`}>{c.empresa.nome}</Link>
        </h3>
        {c.escopoResumo ? <span className="pv-cartao-sub">{c.escopoResumo}</span> : null}
      </div>

      <div className="pv-progresso">
        <div className="pv-progresso-linha">
          <span>
            <span className="pv-num">{c.tarefasConcluidas}</span> de <span className="pv-num">{c.tarefasTotal}</span> tarefas
          </span>
          <strong>{Math.round(c.progresso * 100)}%</strong>
        </div>
        <Barra fracao={c.progresso} tom={concluido ? "ok" : "andamento"} rotulo={`Progresso de ${c.empresa.nome}`} />
      </div>

      {espera && !concluido && !cancelado ? (
        <div className="pv-espera-linha" data-pv-tom="espera">
          <Hourglass aria-hidden />
          {COM_QUEM[espera.motivo]} {haQuanto(espera.desde, agora)}
        </div>
      ) : null}

      {proxima && prazoDaProxima ? (
        <div className="pv-proxima" data-pv-tom={proxima.atrasada ? "risco" : undefined}>
          {proxima.atrasada ? <AlarmClock aria-hidden /> : <CornerDownRight aria-hidden />}
          <span className="pv-proxima-texto">
            <span className="pv-proxima-titulo">{proxima.titulo}</span>
            <span className="pv-proxima-quando">{prazoDaProxima.texto}</span>
          </span>
        </div>
      ) : c.estado === "EM_VALIDACAO" ? (
        <div className="pv-proxima" data-pv-tom="validacao">
          <CheckCircle2 aria-hidden />
          <span className="pv-proxima-texto">
            <span className="pv-proxima-titulo">Tarefas feitas, falta o aceite</span>
            <span className="pv-proxima-quando">Aguardando validação</span>
          </span>
        </div>
      ) : concluido ? (
        <div className="pv-proxima" data-pv-tom="ok">
          <CheckCircle2 aria-hidden />
          <span className="pv-proxima-texto">
            <span className="pv-proxima-titulo">Todas as tarefas concluídas</span>
          </span>
        </div>
      ) : null}

      <div className="pv-cartao-pe">
        <div className="pv-cartao-gente">
          <PilhaDeAvatares pessoas={c.pessoas} />
          {c.responsavel ? (
            <span className="pv-responsavel">
              <Avatar quem={c.responsavel} tamanho="sm" titulo={false} decorativo />
              <span className="pv-truncar">{primeiroNome(c.responsavel.nome)}</span>
            </span>
          ) : (
            <span className="pv-responsavel" data-vazio="true">
              <AvatarVazio tamanho="sm" rotulo="Sem responsável" />
              Sem responsável
            </span>
          )}
        </div>
        {!concluido && !cancelado ? (
          <span className="pv-prazo" data-pv-tom={prazoDoProjeto.tom === "risco" ? "risco" : undefined}>
            <CalendarClock aria-hidden />
            {prazoDoProjeto.texto}
          </span>
        ) : null}
      </div>
    </article>
  );
}
