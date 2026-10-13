"use client";

/**
 * ONFACE / Início — Cockpit de trabalho.
 * A lente e todas as leituras continuam em lib/inicio/montar.ts.
 * Esta superfície só organiza decisões e ações. Não faz consulta, não presume
 * valores ausentes nem expõe links de gestão nas lentes restritas.
 */
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity, ArrowRight, ArrowUpRight, BellRing, CalendarDays, CheckCircle2,
  CircleHelp, Clock3, Compass, LayoutDashboard, Plus, RefreshCw, Sparkles,
  Target, TrendingUp, Users, Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Pagina, PaginaCabecalho } from "@/components/onface/shell/Pagina";
import type { Bloco, PainelInicio } from "@/lib/inicio/tipos";
import { atualizarInicio } from "@/app/(produto)/inicio/actions";
import { BlocoComErro } from "./compartilhado";
import { HeroDeEntrega, HeroDeFila, HeroDeMeta, HeroDeFaturamento } from "./herois";
import { FaixaDeKpis } from "./kpis";
import { AgendaDoDia, Atalhos, PrecisaDeVoce } from "./listas";
import { CartaoDeEntrega, CartaoFinanceiro, FunilComercial, SaudeDasIntegracoes } from "./cartoes";
import "./inicio.css";
import "./inicio-cockpit.css";

const ROTULOS = {
  gestao: { nome: "Visão executiva", descricao: "Acompanhe receita, crescimento e o que precisa de decisão.", icone: LayoutDashboard },
  operacao: { nome: "Central de operação", descricao: "Entregas, qualidade e clientes que precisam de cuidado.", icone: Workflow },
  closer: { nome: "Meu comercial", descricao: "Suas metas, oportunidades e próximos compromissos.", icone: Target },
  sdr: { nome: "Minha pré-venda", descricao: "Novos leads, tempo de resposta e reuniões.", icone: Users },
  leitor: { nome: "Panorama do negócio", descricao: "Indicadores consolidados em modo de consulta.", icone: Compass },
} as const;

function ModuloErro({ titulo, tentar }: { titulo: string; tentar: () => void }) {
  return <section className="ini-cartao"><BlocoComErro titulo={titulo} aoTentar={tentar} /></section>;
}

function Secao({
  titulo, descricao, extra, children,
}: {
  titulo: string; descricao: string; extra?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="ic-secao">
      <div className="ic-secao-topo">
        <div>
          <h2>{titulo}</h2>
          <p>{descricao}</p>
        </div>
        {extra ? <div className="ic-secao-extra">{extra}</div> : null}
      </div>
      {children}
    </section>
  );
}

function SituacaoDoDia({ painel, irParaMeuDia }: { painel: PainelInicio; irParaMeuDia: () => void }) {
  const quantidade = painel.atencao?.ok ? painel.atencao.dados.total : null;
  const criticos = painel.atencao?.ok ? painel.atencao.dados.porSeveridade.critico : null;
  const reunioes = painel.agenda?.ok ? painel.agenda.dados.reunioes : null;
  const vazio = quantidade === 0 && (reunioes === 0 || reunioes === null);
  const numero = (n: number | null) => (n === null ? "—" : n.toLocaleString("pt-BR"));
  return (
    <aside className="ini-cartao ic-brief" aria-label="Resumo de prioridades do dia">
      <div className="ic-brief-head">
        <span className="ic-brief-icone">{vazio ? <CheckCircle2 aria-hidden="true" /> : <BellRing aria-hidden="true" />}</span>
        <div>
          <h2>{vazio ? "Tudo sob controle." : "O que merece atenção."}</h2>
          <p>{painel.foco?.frases.length ? painel.foco.frases.join(" · ") : "Confira seus compromissos e indicadores de hoje."}</p>
        </div>
      </div>
      <div className="ic-brief-numeros">
        {painel.atencao !== null ? (
          <button type="button" className="ic-brief-num" onClick={irParaMeuDia}>
            <strong>{numero(quantidade)}</strong><span>itens na fila</span>
          </button>
        ) : null}
        {painel.atencao !== null ? (
          <button type="button" className="ic-brief-num" data-risco={criticos !== null && criticos > 0 ? "true" : undefined} onClick={irParaMeuDia}>
            <strong>{numero(criticos)}</strong><span>críticos</span>
          </button>
        ) : null}
        {painel.agenda !== null ? (
          <button type="button" className="ic-brief-num" onClick={irParaMeuDia}>
            <strong>{numero(reunioes)}</strong><span>reuniões hoje</span>
          </button>
        ) : null}
      </div>
      <div className="ic-brief-links">
        {painel.atencao ? <button type="button" onClick={irParaMeuDia}>Ver prioridades <ArrowRight size={14} aria-hidden="true" /></button> : null}
        {painel.agenda ? <Link href="/calendario">Abrir calendário <ArrowRight size={14} aria-hidden="true" /></Link> : null}
      </div>
    </aside>
  );
}

const JORNADA = [
  { nome: "Aquisição", subtitulo: "Da origem ao primeiro contato", href: "/pre-vendas", icon: Users },
  { nome: "Vendas", subtitulo: "Da oportunidade ao contrato", href: "/pipeline", icon: TrendingUp },
  { nome: "Operação", subtitulo: "Da implantação à entrega", href: "/pos-vendas", icon: Workflow },
  { nome: "Clientes", subtitulo: "Da adoção à expansão", href: "/clientes", icon: Activity },
] as const;

type AbaId = "panorama" | "meu-dia" | "jornada" | "operacao";

export function Inicio({ painel }: { painel: PainelInicio }) {
  const router = useRouter();
  const [aba, setAba] = React.useState<AbaId>("panorama");
  const [carregando, iniciar] = React.useTransition();
  const lente = ROTULOS[painel.lente];
  const LenteIcon = lente.icone;
  const comLinks = painel.lente !== "leitor";
  const mostrarJornada = painel.lente === "gestao";
  const temMeuDia = Boolean(painel.atencao || painel.agenda);

  // Abas de verdade (estado, não âncora): âncora fazia o navegador rolar a casca
  // inteira para cima e escondia a barra do topo.
  const abas = [
    { id: "panorama" as const, rotulo: "Panorama", Icone: LayoutDashboard, existe: true },
    { id: "meu-dia" as const, rotulo: "Meu dia", Icone: BellRing, existe: temMeuDia },
    { id: "jornada" as const, rotulo: "Jornada comercial", Icone: TrendingUp, existe: Boolean(painel.funil) },
    { id: "operacao" as const, rotulo: "Operação", Icone: Activity, existe: Boolean(painel.entrega || painel.financeiro || painel.saude) },
  ].filter((x) => x.existe);

  const atualizar = React.useCallback(() => {
    iniciar(async () => {
      try {
        await atualizarInicio();
        router.refresh();
      } catch (error) {
        console.error("[inicio] não foi possível atualizar:", error);
        router.refresh();
      }
    });
  }, [router]);

  function renderBloco<T>(bloco: Bloco<T> | null, titulo: string, desenhar: (d: T) => React.ReactNode) {
    if (!bloco) return null;
    return bloco.ok ? desenhar(bloco.dados) : <ModuloErro titulo={titulo} tentar={atualizar} />;
  }

  const nColunasOperacao = [painel.entrega, painel.financeiro, painel.saude].filter(Boolean).length;

  return (
    <Pagina className="ini ic">
      <PaginaCabecalho
        titulo={painel.saudacao}
        descricao={`${painel.data}${painel.organizacao ? ` · ${painel.organizacao}` : ""}${painel.lente === "leitor" ? " · somente leitura" : ""}`}
        acoes={painel.podeAgir ? <Button asChild size="sm"><Link href="/tarefas?nova=1"><Plus aria-hidden="true" />Nova atividade</Link></Button> : null}
      />

      <ToggleGroup type="single" value={aba} onValueChange={(v) => { if (v) setAba(v as AbaId); }} aria-label="Seções do Início" className="ic-abas">
        {abas.map(({ id, rotulo, Icone }) => (
          <ToggleGroupItem key={id} value={id} className="ic-aba"><Icone aria-hidden="true" />{rotulo}</ToggleGroupItem>
        ))}
      </ToggleGroup>

      <div className="ic-conteudo" data-atualizando={carregando ? "true" : undefined} aria-busy={carregando}>
          {aba === "panorama" ? (
          <div className="ic-painel">
              <section className="ic-top" aria-label="Panorama principal">
                <div className="ic-painel-principal">
                  {renderBloco(painel.hero, "destaque do dia", (h) =>
                    h.tipo === "faturamento" ? <HeroDeFaturamento d={h} geradoEm={painel.geradoEm} comLinks={comLinks} />
                      : h.tipo === "meta" ? <HeroDeMeta d={h} geradoEm={painel.geradoEm} />
                        : h.tipo === "fila" ? <HeroDeFila d={h} />
                          : <HeroDeEntrega d={h} />)}
                </div>
                {temMeuDia ? <SituacaoDoDia painel={painel} irParaMeuDia={() => setAba("meu-dia")} /> : (
                  <div className="ini-cartao ic-leitor-card">
                    <Compass aria-hidden="true" />
                    <strong>Panorama consolidado</strong>
                    <p>Os dados refletem a visão autorizada para o seu perfil.</p>
                    <Link href="/relatorios">Explorar relatórios <ArrowRight size={15} aria-hidden="true" /></Link>
                  </div>
                )}
              </section>
              <section className="ic-indicadores" aria-label="Indicadores">
                <div className="ic-indicadores-topo"><h2>Indicadores</h2><small>Comparativo e tendência do período informado em cada métrica</small></div>
                {renderBloco(painel.kpis, "indicadores", (k) => <FaixaDeKpis kpis={k} />)}
              </section>
          </div>
          ) : null}

          {aba === "meu-dia" ? (
          <div className="ic-painel">
            <>
              <div className="ic-duas-colunas" data-sozinha={!painel.atencao || !painel.agenda ? "true" : undefined}>
                {renderBloco(painel.atencao, "prioridades", (a) => <PrecisaDeVoce a={a} />)}
                {renderBloco(painel.agenda, "agenda de hoje", (a) => <AgendaDoDia a={a} />)}
              </div>
            </>
          </div>
          ) : null}

          {aba === "jornada" ? (
          <div className="ic-painel">
            <>
            {comLinks ? <Link href="/pipeline" className="ini-link ic-jornada-link">Abrir pipeline <ArrowUpRight aria-hidden="true" /></Link> : null}
              {renderBloco(painel.funil, "funil comercial", (f) => <FunilComercial f={f} comLinks={comLinks} />)}
              {mostrarJornada ? (
                <div className="ic-jornada" aria-label="Jornada comercial e operacional">
                  {JORNADA.map((etapa) => {
                    const Icone = etapa.icon;
                    return (
                      <Link href={etapa.href} key={etapa.nome} className="ic-jornada-etapa">
                        <span className="ic-jornada-icone"><Icone aria-hidden="true" /></span>
                        <span className="ic-jornada-texto"><strong>{etapa.nome}</strong><small>{etapa.subtitulo}</small></span>
                        <ArrowRight className="ic-jornada-seta" aria-hidden="true" />
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </>
          </div>
          ) : null}

          {aba === "operacao" ? (
          <div className="ic-painel">
            <>
              <div className="ic-operacao-grid" data-colunas={nColunasOperacao}>
                {renderBloco(painel.entrega, "implantação e retenção", (e) => <CartaoDeEntrega e={e} />)}
                {renderBloco(painel.financeiro, "financeiro", (f) => <CartaoFinanceiro f={f} />)}
                {renderBloco(painel.saude, "integrações", (s) => <SaudeDasIntegracoes s={s} />)}
              </div>
            </>
          </div>
          ) : null}

        <Secao titulo="Atalhos" descricao="Acesso direto aos módulos do seu perfil.">
          <Atalhos atalhos={painel.atalhos} comNexo={painel.podeAgir} />
        </Secao>
      </div>
    </Pagina>
  );
}
