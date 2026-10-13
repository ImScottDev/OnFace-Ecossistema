"use client";

/**
 * Os heróis do Início: um por lente, sempre o único momento grafite da tela.
 *
 * Um herói é UM número que decide o dia de quem abriu a tela:
 *   gestão e leitor   faturamento do mês, com os últimos seis meses (o MRR fica no rodapé)
 *   closer            quanto falta para a meta do mês e se o ritmo dá
 *   sdr               quantos leads esperam o 1º contato e há quanto tempo
 *   operação          quantas entregas estão abertas e o que as trava
 *
 * O resto da tela recua para o herói poder ser grande.
 */
import Link from "next/link";
import { CalendarClock, ShoppingBag, TrendingUp } from "lucide-react";
import { brlInteiro, moedaCompacta } from "@/lib/inicio/lente";
import { deltaDePct } from "@/lib/inicio/lente";
import type { HeroEntrega, HeroFaturamento, HeroFila, HeroMeta } from "@/lib/inicio/tipos";
import { AreaDeMeta, BarrasDeFaturamento } from "./graficos";
import { SeloDelta, horasLegivel, inteiro } from "./compartilhado";

const mesPorExtenso = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", month: "long" });

function Rodape({ itens }: { itens: Array<{ rotulo: string; valor: string; apoio?: string; tom?: "risco"; href?: string | null; icone?: React.ReactNode; selo?: React.ReactNode }> }) {
  return (
    <dl className="ini-hero-rodape">
      {itens.map((i) => {
        const conteudo = (
          <>
            {i.icone ? <span className="ini-hero-celula-icone" aria-hidden="true">{i.icone}</span> : null}
            <div className="ini-hero-celula-corpo">
              <dt>{i.rotulo}</dt>
              <dd data-tom={i.tom}>{i.valor}{i.selo}</dd>
              {i.apoio ? <small>{i.apoio}</small> : null}
            </div>
          </>
        );
        return i.href
          ? <Link key={i.rotulo} href={i.href} className="ini-hero-celula" data-link="true">{conteudo}</Link>
          : <div key={i.rotulo} className="ini-hero-celula">{conteudo}</div>;
      })}
    </dl>
  );
}

function BarraDeMeta({ pct, rotulo }: { pct: number; rotulo: string }) {
  const largura = Math.min(100, Math.max(pct > 0 ? 1.5 : 0, pct));
  return (
    <div className="ini-meta-barra" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, pct)} aria-label={rotulo}>
      <span style={{ width: `${largura}%` }} data-batida={pct >= 100 ? "true" : undefined} />
    </div>
  );
}

/* ═══ Gestão e leitor ═════════════════════════════════════════════════════ */

export function HeroDeFaturamento({ d, geradoEm, comLinks }: { d: HeroFaturamento; geradoEm: string; comLinks: boolean }) {
  const delta = deltaDePct(d.deltaPct);
  const mesNome = mesPorExtenso(geradoEm);
  const mrrDelta = deltaDePct(d.mrr.deltaPct);
  return (
    <section className="ini-hero" data-onface-superficie="escura" data-tipo="faturamento" aria-labelledby="ini-h-fat">
      <div className="ini-hero-corpo">
        <div className="ini-hero-principal">
          <h2 id="ini-h-fat" className="ini-hero-rotulo">Faturamento de {mesNome}</h2>
          <p className="ini-hero-valor">{brlInteiro(d.realizado)}</p>
          <p className="ini-hero-apoio">
            <SeloDelta delta={delta} />
            <span>{d.deltaPct === null ? "sem base no mesmo período do mês anterior" : "contra o mesmo período do mês anterior"}</span>
          </p>
          {d.metaMes ? (
            <div className="ini-hero-meta">
              <p>
                <span>Meta de faturamento de {mesNome}</span>
                <b>{d.metaMes.pct}%</b>
              </p>
              <BarraDeMeta pct={d.metaMes.pct} rotulo={`Meta de faturamento de ${mesNome}`} />
              <p className="ini-hero-meta-detalhe">
                {brlInteiro(d.metaMes.realizado)} de {brlInteiro(d.metaMes.alvo)}
                {d.metaMes.ritmoPorDia !== null
                  ? ` · faltam ${brlInteiro(d.metaMes.ritmoPorDia)} por dia útil (${d.metaMes.diasUteisRestantes} restantes)`
                  : " · meta batida"}
              </p>
            </div>
          ) : (
            <p className="ini-hero-meta-detalhe">Sem meta de faturamento definida para {mesNome}.</p>
          )}
        </div>
        <div className="ini-hero-grafico">
          <h3 className="ini-hero-subtitulo">Faturamento por mês, 6 meses</h3>
          <BarrasDeFaturamento meses={d.meses} />
        </div>
      </div>
      <Rodape
        itens={[
          { icone: <ShoppingBag />, rotulo: "Vendas ganhas", valor: inteiro(d.ganhos), apoio: `em ${mesNome}, até hoje`, href: comLinks ? "/vendas" : null },
          { icone: <CalendarClock />, rotulo: "Mês anterior", valor: moedaCompacta(d.mesAnterior), apoio: "fechado inteiro" },
          {
            icone: <TrendingUp />,
            rotulo: "MRR ativo",
            valor: moedaCompacta(d.mrr.atual),
            selo: <SeloDelta delta={mrrDelta} />,
            apoio: `em ${d.mrr.janelaDias} dias`,
            href: comLinks ? "/clientes" : null,
          },
        ]}
      />
    </section>
  );
}

/* ═══ Closer ══════════════════════════════════════════════════════════════ */

export function HeroDeMeta({ d, geradoEm }: { d: HeroMeta; geradoEm: string }) {
  const mes = mesPorExtenso(geradoEm);
  const falta = d.alvo !== null ? Math.max(0, d.alvo - d.realizado) : null;
  return (
    <section className="ini-hero" data-tipo="meta" aria-labelledby="ini-h-meta">
      <div className="ini-hero-corpo">
        <div className="ini-hero-principal">
          <h2 id="ini-h-meta" className="ini-hero-rotulo">Seu faturamento em {mes}</h2>
          <p className="ini-hero-valor">{brlInteiro(d.realizado)}</p>
          {d.alvo !== null && d.pct !== null ? (
            <div className="ini-hero-meta">
              <p><span>Meta de {brlInteiro(d.alvo)}</span><b>{d.pct}%</b></p>
              <BarraDeMeta pct={d.pct} rotulo={`Meta de faturamento de ${mes}`} />
              <p className="ini-hero-meta-detalhe">
                {falta && falta > 0 && d.ritmoPorDia !== null
                  ? `Faltam ${brlInteiro(falta)}: ${brlInteiro(d.ritmoPorDia)} por dia útil, ${d.diasUteisRestantes} restantes`
                  : "Meta batida"}
              </p>
            </div>
          ) : (
            <p className="ini-hero-meta-detalhe">Sem meta de faturamento definida para você em {mes}. Quem define é a gestão, em Ajustes.</p>
          )}
        </div>
        <div className="ini-hero-grafico">
          <h3 className="ini-hero-subtitulo">Acumulado do mês</h3>
          <AreaDeMeta acumulado={d.acumulado} diasNoMes={d.diasNoMes} alvo={d.alvo} mesRotulo={mes} />
        </div>
      </div>
      <Rodape
        itens={[
          { rotulo: "Ganhos no mês", valor: inteiro(d.ganhos), href: "/pipeline" },
          { rotulo: "Dias úteis restantes", valor: inteiro(d.diasUteisRestantes) },
          ...(d.posicao ? [{ rotulo: "Posição entre as closers", valor: `${d.posicao.n}º de ${d.posicao.de}` }] : []),
        ]}
      />
    </section>
  );
}

/* ═══ SDR ═════════════════════════════════════════════════════════════════ */

export function HeroDeFila({ d }: { d: HeroFila }) {
  const total = Math.max(1, d.semContato);
  const seg = (n: number) => `${(n / total) * 100}%`;
  return (
    <section className="ini-hero" data-tipo="fila" aria-labelledby="ini-h-fila">
      <div className="ini-hero-corpo">
        <div className="ini-hero-principal">
          <h2 id="ini-h-fila" className="ini-hero-rotulo">Fila de primeiro contato</h2>
          <p className="ini-hero-valor">{inteiro(d.semContato)}</p>
          <p className="ini-hero-apoio"><span>{d.semContato === 1 ? "lead seu esperando o 1º contato" : "leads seus esperando o 1º contato"}</span></p>
          {d.semContato > 0 ? (
            <div className="ini-fila">
              <div className="ini-fila-barra" role="img"
                aria-label={`${d.foraDoSla} fora do SLA, ${d.vencendo} vencendo, ${d.noPrazo} no prazo`}>
                {d.foraDoSla > 0 ? <span data-faixa="fora" style={{ width: seg(d.foraDoSla) }} /> : null}
                {d.vencendo > 0 ? <span data-faixa="vencendo" style={{ width: seg(d.vencendo) }} /> : null}
                {d.noPrazo > 0 ? <span data-faixa="prazo" style={{ width: seg(d.noPrazo) }} /> : null}
              </div>
              <ul className="ini-fila-legenda">
                <li><i data-faixa="fora" /><b>{inteiro(d.foraDoSla)}</b> fora do SLA</li>
                <li><i data-faixa="vencendo" /><b>{inteiro(d.vencendo)}</b> vencendo</li>
                <li><i data-faixa="prazo" /><b>{inteiro(d.noPrazo)}</b> no prazo</li>
              </ul>
            </div>
          ) : (
            <p className="ini-hero-meta-detalhe">Ninguém esperando. Todo lead seu já teve o primeiro toque.</p>
          )}
        </div>
        <dl className="ini-hero-lado">
          <div>
            <dt>Mediana até o 1º contato</dt>
            <dd>{d.medianaHoras !== null ? horasLegivel(d.medianaHoras) : "sem contato nos últimos 30 dias"}</dd>
            <small>Seus leads dos últimos 30 dias</small>
          </div>
          <Link href="/pre-vendas?view=sem-dono" className="ini-hero-lado-link">
            <dt>Sem responsável</dt>
            <dd>{inteiro(d.semDono)}</dd>
            <small>Fila geral: qualquer SDR pode assumir</small>
          </Link>
          <div>
            <dt>Meta de reuniões</dt>
            {d.meta ? (
              <>
                <dd>{d.meta.realizado} de {d.meta.alvo}</dd>
                <small>{d.meta.pct}% do mês</small>
              </>
            ) : (
              <>
                <dd>Sem meta</dd>
                <small>Nenhuma meta de reuniões definida para você neste mês</small>
              </>
            )}
          </div>
        </dl>
      </div>
      <p className="ini-hero-nota">SLA do lead novo: primeiro contato em até 24 h, com alerta a partir de 4 h.</p>
    </section>
  );
}

/* ═══ Operação ════════════════════════════════════════════════════════════ */

export function HeroDeEntrega({ d }: { d: HeroEntrega }) {
  const total = Math.max(1, d.ativas);
  const seg = (n: number) => `${(n / total) * 100}%`;
  return (
    <section className="ini-hero" data-tipo="entrega" aria-labelledby="ini-h-entrega">
      <div className="ini-hero-corpo">
        <div className="ini-hero-principal">
          <h2 id="ini-h-entrega" className="ini-hero-rotulo">Entregas em curso</h2>
          <p className="ini-hero-valor">{inteiro(d.ativas)}</p>
          <p className="ini-hero-apoio"><span>{d.ativas === 1 ? "implantação ou onboarding aberto" : "implantações e onboardings abertos"}</span></p>
          {d.ativas > 0 ? (
            <div className="ini-fila">
              <div className="ini-fila-barra" role="img"
                aria-label={`${d.emAndamento} em andamento, ${d.aguardandoCliente} aguardando o cliente, ${d.bloqueadas} bloqueadas`}>
                {d.bloqueadas > 0 ? <span data-faixa="fora" style={{ width: seg(d.bloqueadas) }} /> : null}
                {d.aguardandoCliente > 0 ? <span data-faixa="vencendo" style={{ width: seg(d.aguardandoCliente) }} /> : null}
                {d.emAndamento > 0 ? <span data-faixa="prazo" style={{ width: seg(d.emAndamento) }} /> : null}
              </div>
              <ul className="ini-fila-legenda">
                <li><i data-faixa="fora" /><b>{inteiro(d.bloqueadas)}</b> bloqueadas</li>
                <li><i data-faixa="vencendo" /><b>{inteiro(d.aguardandoCliente)}</b> aguardando o cliente</li>
                <li><i data-faixa="prazo" /><b>{inteiro(d.emAndamento)}</b> em andamento</li>
              </ul>
            </div>
          ) : null}
        </div>
        <dl className="ini-hero-lado">
          <Link href="/pos-vendas?aba=imp" className="ini-hero-lado-link">
            <dt>Com prazo vencido</dt>
            <dd data-tom={d.atrasadas > 0 ? "risco" : undefined}>{inteiro(d.atrasadas)}</dd>
            <small>Prazo-alvo já passou e a entrega segue aberta</small>
          </Link>
          <Link href="/clientes/risco" className="ini-hero-lado-link">
            <dt>Clientes em risco</dt>
            <dd data-tom={d.clientesEmRisco > 0 ? "risco" : undefined}>{inteiro(d.clientesEmRisco)}</dd>
            <small>Risco crítico ou em risco, aberto na carteira</small>
          </Link>
          <Link href="/clientes/cs" className="ini-hero-lado-link">
            <dt>Renovações em 30 dias</dt>
            <dd>{inteiro(d.renovacoes30d)}</dd>
            <small>{inteiro(d.tarefasCsAtrasadas)} tarefas de CS em atraso</small>
          </Link>
        </dl>
      </div>
      <p className="ini-hero-nota">MRR ativo da carteira: {brlInteiro(d.mrrAtual)}</p>
    </section>
  );
}
