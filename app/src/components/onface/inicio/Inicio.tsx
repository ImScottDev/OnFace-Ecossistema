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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Bloco, PainelInicio } from "@/lib/inicio/tipos";
import { atualizarInicio } from "@/app/(produto)/inicio/actions";
import { BlocoComErro } from "./compartilhado";
import { HeroDeEntrega, HeroDeFila, HeroDeMeta, HeroDeFaturamento } from "./herois";
import { FaixaDeKpis } from "./kpis";
import { AgendaDoDia, Atalhos, PrecisaDeVoce } from "./listas";
import { CartaoDeEntrega, CartaoFinanceiro, FunilComercial, SaudeDasIntegracoes } from "./cartoes";
import { abrirNexo } from "@/lib/nexo/cliente";
import "./inicio.css";
import "./inicio-cockpit.css";

export type TomDoInicio = "claro" | "escuro";
const COOKIE_TOM = "onface-inicio-tom";

const ROTULOS = {
  gestao: { nome: "Visão executiva", descricao: "Acompanhe receita, crescimento e o que precisa de decisão.", icone: LayoutDashboard },
  operacao: { nome: "Central de operação", descricao: "Entregas, qualidade e clientes que precisam de cuidado.", icone: Workflow },
  closer: { nome: "Meu comercial", descricao: "Suas metas, oportunidades e próximos compromissos.", icone: Target },
  sdr: { nome: "Minha pré-venda", descricao: "Novos leads, tempo de resposta e reuniões.", icone: Users },
  leitor: { nome: "Panorama do negócio", descricao: "Indicadores consolidados em modo de consulta.", icone: Compass },
} as const;

const marcoDoDia = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit",
  });

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

export function Inicio({ painel, tomInicial }: { painel: PainelInicio; tomInicial: TomDoInicio }) {
  const router = useRouter();
  const [tom, setTom] = React.useState<TomDoInicio>(tomInicial);
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

  const trocarTom = (v: string) => {
    if (v !== "claro" && v !== "escuro") return;
    setTom(v);
    // Cookie, não localStorage: o servidor lê no próximo carregamento e a página
    // já nasce no tom certo, sem piscar o claro antes do escuro.
    document.cookie = `${COOKIE_TOM}=${v}; path=/; max-age=31536000; samesite=lax`;
  };

  function renderBloco<T>(bloco: Bloco<T> | null, titulo: string, desenhar: (d: T) => React.ReactNode) {
    if (!bloco) return null;
    return bloco.ok ? desenhar(bloco.dados) : <ModuloErro titulo={titulo} tentar={atualizar} />;
  }

  const nColunasOperacao = [painel.entrega, painel.financeiro, painel.saude].filter(Boolean).length;

  return (
    <main
      className="onface-pagina ini ic"
      data-lente={painel.lente}
      data-tom={tom === "escuro" ? "escuro" : undefined}
      data-onface-superficie={tom === "escuro" ? "escura" : undefined}
      aria-busy={carregando}
    >
      <header className="ic-header">
        <div className="ic-header-id">
          <h1>{painel.saudacao}</h1>
          <p className="ic-subtitulo">{lente.descricao}</p>
          <div className="ic-contexto">
            <span><CalendarDays aria-hidden="true" />{painel.data}</span>
            {painel.organizacao ? <span><LenteIcon aria-hidden="true" />{painel.organizacao}</span> : null}
            {painel.lente === "leitor" ? <span>Somente leitura</span> : null}
            <span><Clock3 aria-hidden="true" />Atualizado às {marcoDoDia(painel.geradoEm)}</span>
          </div>
        </div>
        <div className="ini-cab-acoes">
          <Button type="button" variant="ghost" size="sm" onClick={atualizar} disabled={carregando} aria-label="Atualizar o Início agora">
            <RefreshCw data-girando={carregando ? "true" : undefined} aria-hidden="true" />Atualizar
          </Button>
          <ToggleGroup type="single" value={tom} onValueChange={trocarTom} aria-label="Tom do painel" size="sm">
            <ToggleGroupItem value="claro" className="px-3">Claro</ToggleGroupItem>
            <ToggleGroupItem value="escuro" className="px-3">Escuro</ToggleGroupItem>
          </ToggleGroup>
          {painel.podeAgir ? <Button asChild size="sm" className="ini-cta"><Link href="/tarefas?nova=1"><Plus aria-hidden="true" />Nova atividade</Link></Button> : null}
        </div>
      </header>

      <Tabs value={aba} onValueChange={(v) => setAba(v as AbaId)} className="ic-tabs">
        <div className="ic-menu">
          <TabsList variant="line" className="ic-abas" aria-label="Seções do Início">
            {abas.map(({ id, rotulo, Icone }) => (
              <TabsTrigger key={id} value={id}><Icone aria-hidden="true" />{rotulo}</TabsTrigger>
            ))}
          </TabsList>
          {painel.podeAgir ? (
            <button type="button" onClick={() => abrirNexo()} className="ic-pergunte"><Sparkles aria-hidden="true" /><span className="ic-pergunte-texto">Perguntar ao NEXO</span><kbd>⌘J</kbd></button>
          ) : <span className="ic-somente"><CircleHelp aria-hidden="true" />Visão consolidada</span>}
        </div>

      <div className="ic-conteudo" data-atualizando={carregando ? "true" : undefined}>
          <TabsContent value="panorama" className="ic-painel">
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
          </TabsContent>

          <TabsContent value="meu-dia" className="ic-painel">
            <Secao titulo={painel.lente === "leitor" ? "Agenda e atividades" : "Seu dia, em ordem de prioridade"} descricao="O que precisa de uma decisão ou ação agora, sem perder o contexto.">
              <div className="ic-duas-colunas" data-sozinha={!painel.atencao || !painel.agenda ? "true" : undefined}>
                {renderBloco(painel.atencao, "prioridades", (a) => <PrecisaDeVoce a={a} />)}
                {renderBloco(painel.agenda, "agenda de hoje", (a) => <AgendaDoDia a={a} />)}
              </div>
            </Secao>
          </TabsContent>

          <TabsContent value="jornada" className="ic-painel">
            <Secao titulo="Da oportunidade ao resultado" descricao="Os estágios do fluxo comercial, com volume e valores reais." extra={comLinks ? <Link href="/pipeline" className="ini-link">Abrir pipeline <ArrowUpRight aria-hidden="true" /></Link> : null}>
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
            </Secao>
          </TabsContent>

          <TabsContent value="operacao" className="ic-painel">
            <Secao titulo="Saúde do negócio" descricao="Acompanhe a execução, os riscos e as integrações que sustentam a operação.">
              <div className="ic-operacao-grid" data-colunas={nColunasOperacao}>
                {renderBloco(painel.entrega, "implantação e retenção", (e) => <CartaoDeEntrega e={e} />)}
                {renderBloco(painel.financeiro, "financeiro", (f) => <CartaoFinanceiro f={f} />)}
                {renderBloco(painel.saude, "integrações", (s) => <SaudeDasIntegracoes s={s} />)}
              </div>
            </Secao>
          </TabsContent>

        <Secao titulo="Continue de onde precisa" descricao="Acesso direto aos módulos do seu perfil.">
          <Atalhos atalhos={painel.atalhos} comNexo={painel.podeAgir} />
        </Secao>
      </div>
      </Tabs>
    </main>
  );
}
