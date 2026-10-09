"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, CircleCheck, CircleDashed, CircleX, TriangleAlert, Workflow } from "lucide-react";
import type { Entrega, EstadoSaude, Financeiro, Funil, Saude } from "@/lib/inicio/tipos";
import { brlInteiro } from "@/lib/inicio/lente";
import { TopoDeCartao, Vazio, horasLegivel, inteiro } from "./compartilhado";

/* ═══ Funil comercial ═════════════════════════════════════════════════════ */

interface LinhaDoGrupo { chave: string; rotulo: string; n: number; apoio?: string | null; href?: string | null }

function Grupo({ titulo, nota, linhas, rodape, comTitulo = true }: { titulo: string; nota: string; linhas: LinhaDoGrupo[]; rodape: React.ReactNode; comTitulo?: boolean }) {
  // Cada grupo tem a própria escala: pré-vendas tem centenas, pipeline tem dezenas,
  // e uma escala só deixaria o pipeline invisível ao lado dela.
  const maior = Math.max(1, ...linhas.map((l) => l.n));
  return (
    <div className="ini-grupo">
      {comTitulo ? <h3>{titulo}<span>{nota}</span></h3> : <p className="ini-sub">{nota}</p>}
      <ul data-apoio={linhas.some((l) => l.apoio !== undefined) ? "true" : undefined}>
        {linhas.map((l) => {
          const corpo = (
            <>
              <span className="ini-grupo-rotulo">{l.rotulo}</span>
              <span className="ini-grupo-trilho" aria-hidden="true">
                <span className="ini-grupo-barra" style={{ width: `${l.n === 0 ? 0 : Math.max(1.5, (l.n / maior) * 100)}%` }} />
              </span>
              <b className="ini-grupo-n">{inteiro(l.n)}</b>
              {l.apoio !== undefined ? <span className="ini-grupo-apoio">{l.apoio ?? ""}</span> : null}
            </>
          );
          return (
            <li key={l.chave}>
              {l.href ? <Link href={l.href} className="ini-grupo-linha" data-link="true">{corpo}</Link> : <div className="ini-grupo-linha">{corpo}</div>}
            </li>
          );
        })}
      </ul>
      <p className="ini-grupo-rodape">{rodape}</p>
    </div>
  );
}

export function FunilComercial({ f, comLinks }: { f: Funil; comLinks: boolean }) {
  const pv = f.preVendas;
  const temPipeline = f.etapas.length > 0;
  const titulo = f.escopo === "pessoal" ? "Seu pipeline" : temPipeline ? "Funil comercial" : "Pré-vendas do time";
  const vazio = !temPipeline && !pv;
  return (
    <section className="ini-cartao ini-funil" aria-labelledby="ini-h-funil">
      <TopoDeCartao id="ini-h-funil" titulo={titulo}
        direita={comLinks && temPipeline && f.ganhosMes > 0 ? <span className="ini-topo-nota">{inteiro(f.ganhosMes)} {f.ganhosMes === 1 ? "ganho" : "ganhos"} no mês</span> : null} />
      {vazio ? (
        <Vazio icone={<Workflow />} titulo="Sem dados de funil" texto="Nenhuma oportunidade aberta nem lead em pré-vendas." />
      ) : (
        <div className="ini-funil-corpo" data-grupos={pv && temPipeline ? "2" : "1"}>
          {pv ? (
            <Grupo
              titulo="Pré-vendas" nota="Retrato de agora, por etapa" comTitulo={temPipeline}
              linhas={pv.colunas.map((c) => ({ chave: c.chave, rotulo: c.rotulo, n: c.total, href: comLinks ? "/pre-vendas" : null }))}
              rodape={
                <>
                  <b data-tom={pv.foraDoSla > 0 ? "risco" : undefined}>{inteiro(pv.foraDoSla)} fora do SLA</b>
                  {` · ${inteiro(pv.semPrimeiroContato)} sem 1º contato`}
                  {pv.medianaHoras !== null ? ` · mediana de ${horasLegivel(pv.medianaHoras)} até o 1º contato` : ""}
                </>
              }
            />
          ) : null}
          {temPipeline ? (
            <Grupo
              titulo="Pipeline" nota={f.escopo === "pessoal" ? "suas oportunidades abertas" : "oportunidades abertas"}
              linhas={f.etapas.map((e) => ({ chave: e.chave, rotulo: e.rotulo, n: e.n, apoio: e.valor > 0 ? brlInteiro(e.valor) : "sem valor", href: comLinks ? e.href : null }))}
              rodape={<><b>{inteiro(f.abertas)}</b> {f.abertas === 1 ? "aberta" : "abertas"} · {brlInteiro(f.valorAberto)} em aberto</>}
            />
          ) : null}
        </div>
      )}
    </section>
  );
}

/* ═══ Implantação e retenção ══════════════════════════════════════════════ */

export function CartaoDeEntrega({ e }: { e: Entrega }) {
  const linhas: Array<{ rotulo: string; n: number; apoio: string; href: string; sinal?: boolean }> = [
    { rotulo: "Entregas ativas", n: e.ativas, apoio: `${inteiro(e.emAndamento)} em andamento · ${inteiro(e.aguardandoCliente)} aguardando o cliente · ${inteiro(e.bloqueadas)} bloqueadas`, href: "/pos-vendas" },
    { rotulo: "Com prazo vencido", n: e.atrasadas, apoio: "prazo-alvo passou e a entrega segue aberta", href: "/pos-vendas?aba=imp", sinal: true },
    { rotulo: "Clientes em risco", n: e.clientesEmRisco, apoio: "risco crítico ou em risco, aberto", href: "/clientes/risco", sinal: true },
    { rotulo: "Renovações em 30 dias", n: e.renovacoes30d, apoio: "contratos que vencem na janela", href: "/clientes/cs" },
    { rotulo: "Tarefas de CS em atraso", n: e.tarefasCsAtrasadas, apoio: "na carteira de clientes", href: "/clientes/cs", sinal: true },
  ];
  return (
    <section className="ini-cartao ini-entrega" aria-labelledby="ini-h-entrega-card">
      <TopoDeCartao id="ini-h-entrega-card" titulo="Implantação e retenção" />
      <ul className="ini-lista-fatos">
        {linhas.map((l) => (
          <li key={l.rotulo}>
            <Link href={l.href} className="ini-fato" data-link="true">
              <span className="ini-fato-texto"><strong>{l.rotulo}</strong><small>{l.apoio}</small></span>
              <b className="ini-fato-n" data-sinal={l.sinal && l.n > 0 ? "true" : undefined}>{inteiro(l.n)}</b>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ═══ Saúde das integrações ═══════════════════════════════════════════════ */

const ICONE_SAUDE: Record<EstadoSaude, React.ComponentType<{ "aria-hidden"?: boolean }>> = {
  ok: CircleCheck, atencao: TriangleAlert, falha: CircleX, ocioso: CircleDashed,
};
const ROTULO_SAUDE: Record<EstadoSaude, string> = {
  ok: "Funcionando", atencao: "Atenção", falha: "Fora do ar", ocioso: "Sem uso",
};

export function SaudeDasIntegracoes({ s }: { s: Saude }) {
  const problemas = s.itens.filter((i) => i.estado === "falha" || i.estado === "atencao").length;
  return (
    <section className="ini-cartao ini-saude" aria-labelledby="ini-h-saude">
      <TopoDeCartao id="ini-h-saude" titulo="Saúde das integrações"
        direita={<span className="ini-topo-nota" data-tom={problemas > 0 ? "risco" : undefined}>{problemas > 0 ? `${problemas} pedindo atenção` : "tudo no ar"}</span>} />
      <ul className="ini-saude-lista">
        {s.itens.map((i) => {
          const Icone = ICONE_SAUDE[i.estado];
          const corpo = (
            <>
              <span className="ini-saude-icone" data-estado={i.estado}><Icone aria-hidden /></span>
              <span className="ini-saude-texto">
                <strong>{i.rotulo}<span className="sr-only">: {ROTULO_SAUDE[i.estado]}</span></strong>
                <small>{i.detalhe}</small>
              </span>
              {i.href ? <ArrowRight className="ini-saude-seta" aria-hidden="true" /> : null}
            </>
          );
          return (
            <li key={i.chave}>
              {i.href ? <Link href={i.href} className="ini-saude-linha" data-link="true">{corpo}</Link> : <div className="ini-saude-linha">{corpo}</div>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ═══ Financeiro ══════════════════════════════════════════════════════════ */

export function CartaoFinanceiro({ f }: { f: Financeiro }) {
  const pctVencido = f.emAberto > 0 ? Math.min(100, (f.atrasadoValor / f.emAberto) * 100) : 0;
  return (
    <section className="ini-cartao ini-financeiro" aria-labelledby="ini-h-fin">
      <TopoDeCartao id="ini-h-fin" titulo="Financeiro"
        direita={<Link href="/clientes/financeiro" className="ini-link">Abrir<ArrowRight aria-hidden="true" /></Link>} />
      <p className="ini-fin-destaque">
        <span>Vencido</span>
        <strong data-sinal={f.atrasadoValor > 0 ? "true" : undefined}>{brlInteiro(f.atrasadoValor)}</strong>
        <small>{inteiro(f.atrasadoCount)} {f.atrasadoCount === 1 ? "fatura aberta e vencida" : "faturas abertas e vencidas"}</small>
      </p>
      {f.emAberto > 0 ? (
        <div className="ini-fin-barra" role="img" aria-label={`${Math.round(pctVencido)}% do valor em aberto está vencido`}>
          <span style={{ width: `${pctVencido}%` }} />
        </div>
      ) : null}
      <dl className="ini-fin-lista">
        <div><dt>Em aberto</dt><dd>{brlInteiro(f.emAberto)}</dd></div>
        <div><dt>Recebido no mês</dt><dd>{brlInteiro(f.recebidoMes)}</dd></div>
      </dl>
    </section>
  );
}
