"use client";

/**
 * As três formas de um projeto na mesa.
 *
 * Elas não são variações de estilo da mesma peça: carregam quantidades
 * diferentes de informação, de propósito, porque o que se pode fazer com cada
 * uma é diferente.
 *
 *   LinhaDeAcao    verbo na frente, empresa embaixo, ações no hover.
 *                  É uma linha de TAREFA, não de projeto: quem está aqui veio
 *                  fazer, e o nome da empresa sozinho não diz o que fazer.
 *
 *   LinhaCalma     empresa na frente, próxima tarefa atrás, em tinta suave.
 *                  Quem lê esta faixa está conferindo que nada parou, não
 *                  escolhendo trabalho.
 *
 *   FichaDeEspera  empresa e relógio, e só. A bola é de outro; a única
 *                  pergunta é "há quanto tempo", e a única ação é trazer de
 *                  volta.
 */
import Link from "next/link";
import { AlarmClock, Check, CornerDownRight, Hourglass, MoreHorizontal, UserRoundCheck } from "lucide-react";
import type { CartaoDoProjeto, MotivoDaEspera } from "@/lib/pos-venda/contrato";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { diasDeCalendario, FAMILIAS, MOTIVOS, primeiroNome, TIPO } from "../formatos";
import { Avatar, AvatarVazio } from "../pecas";
import { nomeParaExibir } from "../board/analise";
import { esperandoHa } from "./bola";

const MOTIVOS_ORDEM: MotivoDaEspera[] = ["cliente", "operadora", "interno"];

/** O menu de passar a bola. Mesma peça nas duas linhas, para a ação ser uma só no produto. */
function PassarABola({ rotulo, aoEscolher }: { rotulo: string; aoEscolher: (m: MotivoDaEspera) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="mz-acao" aria-label={rotulo} title="Marcar que a bola está com outra pessoa">
          <Hourglass aria-hidden />
          <span>Passar a bola</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>Quem está com a bola?</DropdownMenuLabel>
        {MOTIVOS_ORDEM.map((m) => (
          <DropdownMenuItem key={m} onSelect={() => aoEscolher(m)} className="mz-menu-item">
            <span className="mz-menu-rotulo">{MOTIVOS[m].rotulo}</span>
            <span className="mz-menu-apoio">{MOTIVOS[m].explicacao}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Quem({ c }: { c: CartaoDoProjeto }) {
  return c.responsavel ? (
    <Avatar quem={c.responsavel} tamanho="sm" titulo />
  ) : (
    <AvatarVazio tamanho="sm" rotulo="Sem responsável" />
  );
}

export function LinhaDeAcao({
  c, verbo, motivo, aoPassarBola,
}: {
  c: CartaoDoProjeto;
  verbo: string;
  motivo: string | null;
  aoPassarBola: (m: MotivoDaEspera) => void;
}) {
  const nome = nomeParaExibir(c.empresa.nome);
  const urgente = Boolean(c.proximaTarefa?.atrasada || (c.relogios.diasDeAtraso ?? 0) > 0);

  return (
    <li className="mz-acao-linha" data-urgente={urgente || undefined}>
      {/* O link cobre a linha (`::after`), então o leitor de tela ouve um
          destino só e as ações não ficam aninhadas dentro dele. */}
      <Link className="mz-acao-alvo" href={`/pos-vendas/${c.id}`}>
        <span className="mz-acao-verbo">
          {urgente ? <AlarmClock className="mz-acao-sino" aria-hidden /> : <CornerDownRight className="mz-acao-sino" aria-hidden />}
          {verbo}
        </span>
        <span className="mz-acao-ctx">
          <span className="mz-acao-empresa" data-suspeito={nome.suspeito || undefined}>{nome.texto}</span>
          <span className="mz-sep" aria-hidden>·</span>
          {FAMILIAS[c.familia].rotulo}
          <span className="mz-sep" aria-hidden>·</span>
          {TIPO[c.tipo]}
          {motivo ? <><span className="mz-sep" aria-hidden>·</span><span className="mz-acao-motivo">{motivo}</span></> : null}
        </span>
      </Link>

      <div className="mz-acao-fim">
        <Quem c={c} />
        <div className="mz-acao-botoes">
          <PassarABola rotulo={`Passar a bola de ${c.empresa.nome}`} aoEscolher={aoPassarBola} />
        </div>
      </div>
    </li>
  );
}

export function LinhaCalma({
  c, agora, aoPassarBola,
}: {
  c: CartaoDoProjeto;
  agora: Date;
  aoPassarBola: (m: MotivoDaEspera) => void;
}) {
  const nome = nomeParaExibir(c.empresa.nome);
  return (
    <li className="mz-calma">
      <Link className="mz-calma-alvo" href={`/pos-vendas/${c.id}`}>
        <span className="mz-calma-empresa" data-suspeito={nome.suspeito || undefined}>{nome.texto}</span>
        <span className="mz-calma-tarefa">{c.proximaTarefa?.titulo ?? "Em andamento"}</span>
        <span className="mz-calma-progresso mz-num">
          {c.tarefasTotal > 0 ? `${c.tarefasConcluidas}/${c.tarefasTotal}` : "—"}
        </span>
      </Link>
      <div className="mz-calma-fim">
        <Quem c={c} />
        <PassarABola rotulo={`Passar a bola de ${c.empresa.nome}`} aoEscolher={aoPassarBola} />
      </div>
    </li>
  );
}

export function FichaDeEspera({ c, agora, aoVoltar }: { c: CartaoDoProjeto; agora: Date; aoVoltar: () => void }) {
  const nome = nomeParaExibir(c.empresa.nome);
  const dias = esperandoHa(c, agora);
  /* Sem espera registrada, a ficha está aqui por estar "em validação". Dizer
     "há 0 dias" seria inventar; a ficha diz o que sabe. */
  const quanto = dias === null ? "aguardando aceite" : dias === 0 ? "desde hoje" : `há ${dias} ${dias === 1 ? "dia" : "dias"}`;
  /* Duas semanas paradas com outra pessoa deixa de ser espera e vira problema. */
  const demais = dias !== null && dias >= 14;

  return (
    <li className="mz-ficha" data-demais={demais || undefined}>
      <Link className="mz-ficha-alvo" href={`/pos-vendas/${c.id}`} title={`${c.empresa.nome} — ${quanto}`}>
        <span className="mz-ficha-empresa" data-suspeito={nome.suspeito || undefined}>{nome.texto}</span>
        <span className="mz-ficha-tempo mz-num">{quanto}</span>
      </Link>
      <button type="button" className="mz-ficha-voltar" onClick={aoVoltar} aria-label={`Trazer ${c.empresa.nome} de volta para a casa`} title="A bola voltou para a casa">
        <UserRoundCheck aria-hidden />
      </button>
    </li>
  );
}

/**
 * Entrega que entrou e nunca abriu a primeira tarefa.
 *
 * Mesma forma de ficha da espera, por um motivo: nos dois casos a pergunta é
 * "há quanto tempo" e a resposta cabe em duas palavras. A diferença é que
 * aqui a bola é da casa — por isso a ficha carrega quem é o responsável, ou
 * diz que não há, que é a informação que de fato destrava.
 */
export function FichaParada({ c, agora }: { c: CartaoDoProjeto; agora: Date }) {
  const nome = nomeParaExibir(c.empresa.nome);
  const dias = diasDeCalendario(c.entrouEm, agora);
  /* Um mês parado deixa de ser fila e vira esquecimento. */
  const demais = dias >= 30;

  return (
    <li className="mz-ficha" data-demais={demais || undefined}>
      <Link className="mz-ficha-alvo" href={`/pos-vendas/${c.id}`} title={`${c.empresa.nome} — entrou há ${dias} dias`}>
        {c.responsavel ? (
          <Avatar quem={c.responsavel} tamanho="sm" titulo={false} decorativo />
        ) : (
          <AvatarVazio tamanho="sm" rotulo="Sem responsável" />
        )}
        <span className="mz-ficha-empresa" data-suspeito={nome.suspeito || undefined}>{nome.texto}</span>
        <span className="mz-ficha-tempo mz-num">{dias === 0 ? "hoje" : `${dias} d`}</span>
      </Link>
    </li>
  );
}

/** Usado no modo foco, onde a linha vira cartão de decisão e cabe mais. */
export function ResumoDoProjeto({ c, verbo, motivo }: { c: CartaoDoProjeto; verbo: string; motivo: string | null }) {
  const nome = nomeParaExibir(c.empresa.nome);
  return (
    <div className="mz-foco-corpo">
      <span className="mz-foco-empresa" data-suspeito={nome.suspeito || undefined}>{nome.texto}</span>
      <h3 className="mz-foco-verbo">{verbo}</h3>
      <p className="mz-foco-ctx">
        {FAMILIAS[c.familia].rotulo} · {TIPO[c.tipo]}
        {motivo ? ` · ${motivo}` : ""}
        {c.responsavel ? ` · ${primeiroNome(c.responsavel.nome)}` : " · sem responsável"}
      </p>
      {c.tarefasTotal > 0 ? (
        <p className="mz-foco-progresso mz-num">
          <Check aria-hidden /> {c.tarefasConcluidas} de {c.tarefasTotal} tarefas concluídas
        </p>
      ) : null}
    </div>
  );
}

export { MoreHorizontal };
