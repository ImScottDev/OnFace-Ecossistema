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
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BellRing,
  CalendarDays, CheckCircle2, ChevronRight, CircleHelp, Clock3,
  Command, Compass, LayoutDashboard, Plus, RefreshCw, Sparkles,
  Target, TrendingUp, Users, Workflow, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Bloco, PainelInicio } from "@/lib/inicio/tipos";
import { atualizarInicio } from "@/app/(produto)/inicio/actions";
import { BlocoComErro } from "./compartilhado";
import { HeroDeEntrega, HeroDeFila, HeroDeMeta, HeroDeMrr } from "./herois";
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
  id, numero, titulo, descricao, extra, children,
}: {
  id: string; numero: string; titulo: string; descricao: string;
  extra?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="ic-secao" id={id} aria-labelledby={id + "-titulo"}>
      <div className="ic-secao-topo">
        <div className="ic-secao-copy">
          <span className="ic-secao-numero">{numero}</span>
          <div><h2 id={id + "-titulo"}>{titulo}</h2><p>{descricao}</p></div>
        </div>
        {extra ? <div className="ic-secao-extra">{extra}</div> : null}
      </div>
      {children}
    </section>
  );
}

function SituacaoDoDia({ painel }: { painel: PainelInicio }) {
  const quantidade = painel.atencao?.ok ? painel.atencao.dados.total : null;
  const criticos = painel.atencao?.ok ? painel.atencao.dados.porSeveridade.critico : null;
  const reunioes = painel.agenda?.ok ? painel.agenda.dados.reunioes : null;
  const agendaDisponivel = painel.agenda !== null;
  const vazio = quantidade === 0 && (reunioes === 0 || reunioes === null);
  return (
    <aside className="ic-brief" aria-label="Resumo de prioridades do dia">
      <div className="ic-brief-top">
        <span className="ic-brief-kicker"><Zap size={13} aria-hidden="true" /> SEU PONTO DE PARTIDA</span>
        <span className="ic-live"><i aria-hidden="true" /> Dados reais</span>
      </div>
      <div className="ic-brief-head">
        <span className="ic-brief-icon">{vazio ? <CheckCircle2 aria-hidden="true" /> : <BellRing aria-hidden="true" />}</span>
        <div>
          <h2>{vazio ? "Tudo sob controle." : "O que merece atenção."}</h2>
          <p>{painel.foco?.frases.length ? painel.foco.frases.join(" · ") : "Confira seus compromissos e indicadores de hoje."}</p>
        </div>
      </div>
      <div className="ic-brief-numeros">
        {painel.atencao !== null ? (
          <a href="#prioridades" className="ic-brief-num">
            <strong>{quantidade === null ? "—" : quantidade.toLocaleString("pt-BR")}</strong>
            <span>itens na fila</span>
            <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        ) : null}
        {painel.atencao !== null ? (
          <a href="#prioridades" className="ic-brief-num" data-risco={criticos !== null && criticos > 0 ? "true" : undefined}>
            <strong>{criticos === null ? "—" : criticos.toLocaleString("pt-BR")}</strong>
            <span>críticos</span>
            <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        ) : null}
        {agendaDisponivel ? (
          <a href="#prioridades" className="ic-brief-num">
            <strong>{reunioes === null ? "—" : reunioes.toLocaleString("pt-BR")}</strong>
            <span>reuniões hoje</span>
            <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        ) : null}
      </div>
      <div className="ic-brief-links">
        {painel.atencao ? <a href="#prioridades">Ver prioridades <ArrowRight size={14} aria-hidden="true" /></a> : null}
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

export function Inicio({ painel, tomInicial }: { painel: PainelInicio; tomInicial: TomDoInicio }) {
  const router = useRouter();
  const [tom, setTom] = React.useState<TomDoInicio>(tomInicial);
  const [carregando, iniciar] = React.useTransition();
  const lente = ROTULOS[painel.lente];
  const LenteIcon = lente.icone;
  const comLinks = painel.lente !== "leitor";
  const gestao = painel.lente === "gestao";
  const mostrarJornada = gestao;
  const mostrarOperacao = Boolean(painel.entrega || painel.financeiro || painel.saude);

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

  const trocarTom = React.useCallback((novo: TomDoInicio) => {
    setTom(novo);
    document.cookie = COOKIE_TOM + "=" + novo + "; path=/; max-age=31536000; samesite=lax";
  }, []);

  function renderBloco<T>(bloco: Bloco<T> | null, titulo: string, desenhar: (d: T) => React.ReactNode) {
    if (!bloco) return null;
    return bloco.ok ? desenhar(bloco.dados) : <ModuloErro titulo={titulo} tentar={atualizar} />;
  }

  return (
    <main
      className="onface-pagina ini ic"
      data-lente={painel.lente}
      data-tom={tom === "escuro" ? "escuro" : undefined}
      data-onface-superficie={tom === "escuro" ? "escura" : undefined}
      aria-busy={carregando}
    >
      <header className="ic-header">
        <div className="ic-header-content">
          <div className="ic-overline"><span className="ic-monograma">O</span><span>ONFACE</span><ChevronRight size={13} aria-hidden="true" /><span>{lente.nome}</span></div>
          <h1>{painel.saudacao}</h1>
          <p className="ic-subtitulo">{lente.descricao}</p>
          <div className="ic-contexto">
            <span><CalendarDays size={14} aria-hidden="true" />{painel.data}</span>
            {painel.organizacao ? <span><LenteIcon size={14} aria-hidden="true" />{painel.organizacao}</span> : null}
            {painel.lente === "leitor" ? <span>Somente leitura</span> : null}
          </div>
        </div>
        <div className="ic-header-actions">
          <span className="ic-atualizado"><Clock3 size={13} aria-hidden="true" /> Atualizado às {marcoDoDia(painel.geradoEm)}</span>
          <button className="ic-ghost-btn" type="button" onClick={atualizar} disabled={carregando} aria-label="Atualizar dados do painel" title="Atualizar dados">
            <RefreshCw size={16} className={carregando ? "ic-spin" : ""} aria-hidden="true" />
            <span>Atualizar</span>
          </button>
          <div className="ic-tema" role="group" aria-label="Aparência da página">
            <button type="button" aria-pressed={tom === "claro"} onClick={() => trocarTom("claro")}>Claro</button>
            <button type="button" aria-pressed={tom === "escuro"} onClick={() => trocarTom("escuro")}>Escuro</button>
          </div>
          {painel.podeAgir ? <Button asChild size="sm" className="ic-nova"><Link href="/tarefas?nova=1"><Plus size={16} aria-hidden="true" />Nova atividade</Link></Button> : null}
        </div>
      </header>

      <nav className="ic-menu" aria-label="Navegação desta página">
        <div className="ic-menu-itens">
          <a href="#panorama"><LayoutDashboard size={16} aria-hidden="true" /> Panorama</a>
          {painel.atencao || painel.agenda ? <a href="#prioridades"><BellRing size={16} aria-hidden="true" /> Meu dia</a> : null}
          {painel.funil ? <a href="#jornada"><TrendingUp size={16} aria-hidden="true" /> Jornada comercial</a> : null}
          {mostrarOperacao ? <a href="#operacao"><Activity size={16} aria-hidden="true" /> Operação</a> : null}
        </div>
        {painel.podeAgir ?
          <button type="button" onClick={() => abrirNexo()} className="ic-pergunte"><Sparkles size={15} aria-hidden="true" /> Perguntar ao NEXO <span>⌘J</span></button>
          : <span className="ic-somente"><CircleHelp size={14} aria-hidden="true" /> Visão consolidada</span>}
      </nav>

      <div className="ic-conteudo" data-atualizando={carregando ? "true" : undefined}>
        <section className="ic-top" id="panorama" aria-label="Panorama principal">
          <div className="ic-painel-principal">
            <div className="ic-painel-selo"><span className="ic-selo-ponto" /> RESULTADO EM FOCO <span className="ic-painel-separador" /> {lente.nome}</div>
            {renderBloco(painel.hero, "destaque do dia", (h) =>
              h.tipo === "mrr" ? <HeroDeMrr d={h} geradoEm={painel.geradoEm} comLinks={comLinks} />
                : h.tipo === "meta" ? <HeroDeMeta d={h} geradoEm={painel.geradoEm} />
                  : h.tipo === "fila" ? <HeroDeFila d={h} />
                    : <HeroDeEntrega d={h} />)}
          </div>
          {painel.atencao || painel.agenda ? <SituacaoDoDia painel={painel} /> : (
            <div className="ic-leitor-card">
              <Compass size={23} aria-hidden="true" />
              <strong>Panorama consolidado</strong>
              <p>Os dados refletem a visão autorizada para o seu perfil.</p>
              <Link href="/relatorios">Explorar relatórios <ArrowRight size={15} aria-hidden="true" /></Link>
            </div>
          )}
        </section>

        <div className="ic-indicadores">
          <div className="ic-indicadores-label"><span>INDICADORES</span><small>Comparativos e tendência do período informado em cada métrica</small></div>
          {renderBloco(painel.kpis, "indicadores", (k) => <FaixaDeKpis kpis={k} />)}
        </div>

        {painel.atencao || painel.agenda ? (
          <Secao id="prioridades" numero="01" titulo={painel.lente === "leitor" ? "Agenda e atividades" : "Seu dia, em ordem de prioridade"} descricao="O que precisa de uma decisão ou ação agora — sem perder o contexto.">
            <div className="ic-duas-colunas" data-sozinha={!painel.atencao || !painel.agenda ? "true" : undefined}>
              {renderBloco(painel.atencao, "prioridades", (a) => <PrecisaDeVoce a={a} />)}
              {renderBloco(painel.agenda, "agenda de hoje", (a) => <AgendaDoDia a={a} />)}
            </div>
          </Secao>
        ) : null}

        {painel.funil ? (
          <Secao id="jornada" numero={painel.atencao || painel.agenda ? "02" : "01"} titulo="Da oportunidade ao resultado" descricao="Os estágios do fluxo comercial, com volume e valores reais." extra={comLinks ? <Link href="/pipeline" className="ic-secao-link">Abrir pipeline <ArrowUpRight size={15} aria-hidden="true" /></Link> : null}>
            <div className="ic-pipeline-coluna">{renderBloco(painel.funil, "funil comercial", (f) => <FunilComercial f={f} comLinks={comLinks} />)}</div>
            {mostrarJornada ? (
              <div className="ic-jornada" aria-label="Jornada comercial e operacional">
                {JORNADA.map((etapa, index) => {
                  const Icone = etapa.icon;
                  return <Link href={etapa.href} key={etapa.nome} className="ic-jornada-etapa">
                    <span className="ic-jornada-index">0{index + 1}</span><Icone size={18} aria-hidden="true" />
                    <span><strong>{etapa.nome}</strong><small>{etapa.subtitulo}</small></span><ArrowRight size={16} aria-hidden="true" />
                  </Link>;
                })}
              </div>
            ) : null}
          </Secao>
        ) : null}

        {mostrarOperacao ? (
          <Secao id="operacao" numero={painel.funil ? (painel.atencao || painel.agenda ? "03" : "02") : "02"} titulo="Saúde do negócio" descricao="Acompanhe a execução, os riscos e as integrações que sustentam a operação.">
            <div className="ic-operacao-grid" data-colunas={[painel.entrega,painel.financeiro,painel.saude].filter(Boolean).length}>
              {renderBloco(painel.entrega, "implantação e retenção", (e) => <CartaoDeEntrega e={e} />)}
              {renderBloco(painel.financeiro, "financeiro", (f) => <CartaoFinanceiro f={f} />)}
              {renderBloco(painel.saude, "integrações", (s) => <SaudeDasIntegracoes s={s} />)}
            </div>
          </Secao>
        ) : null}

        <Secao id="atalhos" numero="↗" titulo="Continue de onde precisa" descricao="Acesso direto aos módulos do seu perfil.">
          <Atalhos atalhos={painel.atalhos} comNexo={painel.podeAgir} />
        </Secao>
        <footer className="ic-rodape"><span><span className="ic-rodape-marca">ONFACE</span> · Seu workspace, de ponta a ponta.</span><span>Dados conforme permissões do seu perfil · {marcoDoDia(painel.geradoEm)}</span></footer>
      </div>
    </main>
  );
}
