/**
 * A MESA DE TRABALHO do pós-venda (spec 09/11, §6.2).
 *
 * Quatorze entregas abertas num dia não pedem filtro, busca nem ordenação: pedem
 * saber quem está com a bola. Por isso a tela é uma lista só, agrupada por isso,
 * e cabe inteira sem rolar. O arquivo com filtros continua em `?arquivo=1`.
 *
 * Regra de densidade: linha completa só para o que tem ação diferente; o que é
 * massa homogênea ("nunca começaram") vira chip.
 */
import Link from "next/link";
import type { CartaoDoProjeto, TipoDeProjeto } from "@/lib/pos-venda/contrato";
import { FAMILIAS, TIPO, MOTIVOS, prazo, haQuanto, primeiroNome } from "../formatos";
import { Avatar, AvatarVazio } from "../pecas";
import { PassarABola } from "./PassarABola";

type Grupo = "voce" | "nunca" | "cliente" | "operadora";

const GRUPOS: Array<{ id: Grupo; titulo: string; nota: string }> = [
  { id: "voce", titulo: "Precisa do time", nota: "Começou e a próxima ação é nossa" },
  { id: "nunca", titulo: "Nunca começaram", nota: "Entraram e ninguém abriu a primeira tarefa" },
  { id: "cliente", titulo: "Com o cliente", nota: MOTIVOS.cliente.explicacao },
  { id: "operadora", titulo: "Com a operadora", nota: MOTIVOS.operadora.explicacao },
];

const aberto = (c: CartaoDoProjeto) => c.estado !== "CONCLUIDO" && c.estado !== "CANCELADO";

export function grupoDaMesa(c: CartaoDoProjeto): Grupo {
  const motivo = c.relogios.esperando?.motivo;
  if (motivo === "cliente") return "cliente";
  if (motivo === "operadora") return "operadora";
  if (c.tarefasConcluidas === 0 && c.estado === "NAO_INICIADO") return "nunca";
  return "voce";
}

function hrefMesa(p: { tipo: TipoDeProjeto | null; meu: boolean }) {
  const q = new URLSearchParams();
  if (p.tipo) q.set("aba", p.tipo === "ONBOARDING" ? "onb" : "imp");
  if (p.meu) q.set("quem", "eu");
  const s = q.toString();
  return s ? `/pos-vendas?${s}` : "/pos-vendas";
}

/** O prazo só aparece quando existe de verdade (spec §2.3: nunca fabricar atraso). */
function prazoDoCartao(c: CartaoDoProjeto, agora: Date) {
  const vence = c.proximaTarefa?.venceEm ?? c.relogios.venceEm;
  return prazo(vence, agora, "Prazo ainda não definido");
}

const iniciais = (nome: string) => nome.split(/\s+/).filter((p) => /^[A-Za-zÀ-ÿ]/.test(p)).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";

function Linha({ c, agora }: { c: CartaoDoProjeto; agora: Date }) {
  const p = prazoDoCartao(c, agora);
  const acao = c.proximaTarefa?.titulo
    ?? (c.tarefasTotal > 0 && c.tarefasConcluidas >= c.tarefasTotal
      ? (c.tipo === "IMPLEMENTATION" ? "Registrar a implantação finalizada" : "Encerrar o projeto e fazer o handoff")
      : "Definir a próxima tarefa do projeto");
  const pct = c.tarefasTotal > 0 ? Math.round((c.tarefasConcluidas / c.tarefasTotal) * 100) : 0;
  return (
    <li className="pvm-linha">
      <span className="pvm-logo" aria-hidden>{iniciais(c.empresa.nome)}</span>
      <Link href={`/pos-vendas/${c.id}`} className="pvm-linha-corpo">
        <span className="pvm-acao">{acao}</span>
        <span className="pvm-meta">
          <strong>{c.empresa.nome}</strong>
          <span className="pvm-tag">{FAMILIAS[c.familia].rotulo}</span>
          <span className="pvm-tag" data-tipo={c.tipo}>{TIPO[c.tipo]}</span>
          {c.relogios.esperando && <span>esperando desde {haQuanto(c.relogios.esperando.desde, agora)}</span>}
        </span>
      </Link>
      <span className="pvm-progresso" title={`${c.tarefasConcluidas} de ${c.tarefasTotal} tarefas`}>
        <span className="pvm-progresso-barra" aria-hidden><span style={{ width: `${pct}%` }} /></span>
        <span className="pvm-progresso-num">{c.tarefasConcluidas}/{c.tarefasTotal}</span>
      </span>
      <span className="pvm-prazo" data-tom={p.tom}>{p.texto}</span>
      <div className="pvm-lado">
        <PassarABola projetoId={c.id} esperando={c.relogios.esperando?.motivo ?? null} pabx={c.familia === "PABX"} />
        {c.responsavel ? <Avatar quem={c.responsavel} /> : <AvatarVazio rotulo="Sem responsável" />}
      </div>
    </li>
  );
}

function Chip({ c }: { c: CartaoDoProjeto }) {
  return (
    <li>
      <Link href={`/pos-vendas/${c.id}`} className="pvm-chip">
        <span className="pvm-chip-nome">{c.empresa.nome}</span>
        <span className="pvm-chip-meta">
          {FAMILIAS[c.familia].rotulo} · {TIPO[c.tipo]} · {c.responsavel ? primeiroNome(c.responsavel.nome) : "sem dono"}
        </span>
      </Link>
    </li>
  );
}

/** A primeira ação que mais se repete no grupo: vira o subtítulo em vez de repetir o verbo em cada chip. */
function primeiraComum(lista: CartaoDoProjeto[]): string | null {
  const conta = new Map<string, number>();
  for (const c of lista) if (c.proximaTarefa) conta.set(c.proximaTarefa.titulo, (conta.get(c.proximaTarefa.titulo) ?? 0) + 1);
  return [...conta.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

export function Mesa({
  cartoes, agora, tipo, meu, usuarioId,
}: { cartoes: CartaoDoProjeto[]; agora: Date; tipo: TipoDeProjeto | null; meu: boolean; usuarioId: string }) {
  const doTipo = cartoes.filter((c) => !tipo || c.tipo === tipo);
  const abertos = doTipo.filter(aberto);
  const encerrados = doTipo.length - abertos.length;
  const visiveis = meu ? abertos.filter((c) => c.responsavel?.id === usuarioId) : abertos;

  const porGrupo = new Map<Grupo, CartaoDoProjeto[]>(GRUPOS.map((g) => [g.id, []]));
  for (const c of visiveis) porGrupo.get(grupoDaMesa(c))!.push(c);
  // Mais atrasado primeiro; sem prazo vai para o fim, sem inventar urgência.
  for (const lista of porGrupo.values()) {
    lista.sort((a, b) => (a.proximaTarefa?.venceEm?.getTime() ?? Infinity) - (b.proximaTarefa?.venceEm?.getTime() ?? Infinity));
  }

  const comAlguem = (porGrupo.get("cliente")!.length + porGrupo.get("operadora")!.length);
  const nunca = porGrupo.get("nunca")!.length;
  const semDono = abertos.filter((c) => !c.responsavel).length;
  const precisam = porGrupo.get("voce")!.length + nunca;
  const atrasadas = visiveis.filter((c) => prazoDoCartao(c, agora).tom === "risco").length;

  const abas: Array<{ rotulo: string; tipo: TipoDeProjeto | null }> = [
    { rotulo: "Tudo", tipo: null },
    { rotulo: "Onboarding", tipo: "ONBOARDING" },
    { rotulo: "Implantação", tipo: "IMPLEMENTATION" },
  ];

  return (
    <div className="pv pvm">
      <div className="pvm-topo">
        <dl className="pvm-numeros">
          <div><dt>Em aberto</dt><dd>{abertos.length}</dd></div>
          <div><dt>Precisam do time</dt><dd>{precisam}</dd></div>
          <div><dt>Com cliente ou operadora</dt><dd>{comAlguem}</dd></div>
          <div data-tom={atrasadas > 0 ? "risco" : undefined}><dt>Atrasadas</dt><dd>{atrasadas}</dd></div>
        </dl>
        <nav className="pvm-abas" aria-label="Recorte da mesa">
          {abas.map((a) => (
            <Link key={a.rotulo} href={hrefMesa({ tipo: a.tipo, meu })} aria-current={a.tipo === tipo ? "page" : undefined}>{a.rotulo}</Link>
          ))}
          <span className="pvm-sep" aria-hidden />
          <Link href={hrefMesa({ tipo, meu: false })} aria-current={!meu ? "page" : undefined}>Do time</Link>
          <Link href={hrefMesa({ tipo, meu: true })} aria-current={meu ? "page" : undefined}>Só as minhas</Link>
        </nav>
      </div>

      {abertos.length === 0 ? (
        <section className="pvm-vazio">
          <h2>Nenhuma entrega em aberto</h2>
          <p>Os projetos nascem quando uma venda é ganha. Assim que a próxima fechar, ela aparece aqui com as tarefas e o prazo prontos.</p>
          {encerrados > 0 && <Link href="/pos-vendas?arquivo=1&estado=CONCLUIDO">Ver os {encerrados} encerrados</Link>}
        </section>
      ) : precisam === 0 ? (
        <section className="pvm-vazio" data-ok="true">
          <h2>Nada esperando {meu ? "você" : "o time"} agora.</h2>
          <p>{comAlguem} {comAlguem === 1 ? "entrega está" : "entregas estão"} com cliente ou operadora. Quando a bola voltar, ela reaparece no topo.</p>
        </section>
      ) : null}

      {GRUPOS.map((g) => {
        const lista = porGrupo.get(g.id)!;
        if (lista.length === 0) return null;
        return (
          <section key={g.id} className="pvm-grupo" aria-labelledby={`pvm-${g.id}`}>
            <header>
              <h2 id={`pvm-${g.id}`}>{g.titulo} <span className="pvm-conta">{lista.length}</span></h2>
              <p>{g.id === "nunca" && primeiraComum(lista) ? `Todas começam por: ${primeiraComum(lista)}` : g.nota}</p>
            </header>
            {g.id === "nunca" ? (
              <ul className="pvm-chips">{lista.map((c) => <Chip key={c.id} c={c} />)}</ul>
            ) : (
              <ul className="pvm-lista">{lista.map((c) => <Linha key={c.id} c={c} agora={agora} />)}</ul>
            )}
          </section>
        );
      })}

      <footer className="pvm-rodape">
        {semDono > 0 && (
          <p>{semDono} {semDono === 1 ? "entrega não tem" : "entregas não têm"} responsável. Defina o dono padrão de cada família no playbook, em Ajustes, para as próximas já nascerem com dono.</p>
        )}
        <Link href="/pos-vendas?arquivo=1">Todos os projetos{encerrados > 0 ? ` · ${encerrados} encerrados` : ""}</Link>
      </footer>
    </div>
  );
}
