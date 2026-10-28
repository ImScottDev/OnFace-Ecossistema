"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowUpRight, BellRing, CalendarDays, Check, ChevronRight, Clock3, Layers, ListTodo, Plus, RefreshCw, ShieldCheck, Sparkles, Target, TrendingUp, Workflow, AlertTriangle, BarChart3 } from "lucide-react";
import { Pagina } from "@/components/onface/shell/Pagina";
import { abrirNexo } from "@/lib/nexo/cliente";
import { brlInteiro, moedaCompacta, deltaDePct } from "@/lib/inicio/lente";
import { atualizarInicio } from "@/app/(produto)/inicio/actions";
import type { Atencao, Entrega, Financeiro, Funil, Hero, Kpi, PainelInicio, Saude } from "@/lib/inicio/tipos";
import "./inicio-next.css";

type Aba = "panorama" | "meu-dia" | "jornada" | "operacao";
const descricoes = {
  gestao: "Uma visão clara do negócio, das prioridades e de onde agir.",
  operacao: "Entregas, clientes e decisões que destravam o dia.",
  closer: "Sua meta, suas oportunidades e o próximo negócio.",
  sdr: "Conversas, novos leads e velocidade de atendimento.",
  leitor: "Indicadores consolidados no seu escopo de acesso.",
} as const;
const numero = (n: number) => n.toLocaleString("pt-BR");
const percentual = (n: number) => Math.max(0, Math.min(100, n)) + "%";
const bom = <T,>(b: PainelInicio[keyof Pick<PainelInicio, "atencao"|"funil"|"entrega"|"financeiro"|"saude"|"agenda">]): T | null => b && b.ok ? b.dados as T : null;

function Falha({ titulo, refresh }: { titulo: string; refresh: () => void }) {
  return <div className="nx-fail" role="status"><AlertTriangle size={18}/><span>{titulo} indisponível. Não mostramos zero quando a leitura falha.</span><button type="button" onClick={refresh}>Tentar de novo</button></div>;
}
function Titulo({ indice, titulo, subtitulo, href, texto }: { indice: string; titulo: string; subtitulo?: string; href?: string; texto?: string }) {
  return <div className="nx-section-title"><div><span>{indice}</span><div><h2>{titulo}</h2>{subtitulo ? <p>{subtitulo}</p> : null}</div></div>{href ? <Link href={href}>{texto ?? "Explorar"} <ArrowUpRight size={16}/></Link> : null}</div>;
}
function Hero({ hero, data, permitirLinks }: { hero: Hero; data: string; permitirLinks: boolean }) {
  const [selecionado, setSelecionado] = React.useState<number|null>(null);
  const fat = hero.tipo === "faturamento" ? hero : null;
  const meta = hero.tipo === "meta" ? hero : null;
  const fila = hero.tipo === "fila" ? hero : null;
  const entrega = hero.tipo === "entrega" ? hero : null;
  const meses = fat?.meses ?? [];
  const selecionadoIndex = selecionado === null || selecionado >= meses.length ? meses.length-1 : selecionado;
  const maior = Math.max(1, ...meses.map(m => m.valor));
  const mesAtual = new Date(data).toLocaleDateString("pt-BR", { month: "long", timeZone: "America/Sao_Paulo" });
  const titulo = fat ? "Faturamento deste mês" : meta ? (meta.unidade === "faturamento" ? "Sua meta comercial" : "Reuniões neste mês") : hero.tipo === "fila" ? "Leads sem primeiro contato" : "Entregas em andamento";
  const valor = fat ? brlInteiro(fat.realizado) : meta ? (meta.unidade === "faturamento" ? brlInteiro(meta.realizado) : numero(meta.realizado)) : fila ? numero(fila.semContato) : entrega ? numero(entrega.ativas) : "—";
  const pct = fat?.metaMes?.pct ?? meta?.pct ?? null;
  const caminho = fat ? "/relatorios" : meta ? "/pipeline" : hero.tipo === "fila" ? "/pre-vendas" : "/pos-vendas";
  const infos = fat ? [
    ["Vendas ganhas",numero(fat.ganhos)], ["Mês anterior",moedaCompacta(fat.mesAnterior)], ["MRR ativo",moedaCompacta(fat.mrr.atual)]
  ] : meta ? [
    ["Negócios ganhos",numero(meta.ganhos)], ["Dias úteis restantes",numero(meta.diasUteisRestantes)], ["Sua colocação",meta.posicao ? `${meta.posicao.n}º de ${meta.posicao.de}` : "—"]
  ] : fila ? [
    ["Fora do SLA",numero(fila.foraDoSla)], ["Vencendo",numero(fila.vencendo)], ["Dentro do prazo",numero(fila.noPrazo)]
  ] : entrega ? [["Aguardando cliente",numero(entrega.aguardandoCliente)],["Bloqueadas",numero(entrega.bloqueadas)],["Clientes em risco",numero(entrega.clientesEmRisco)]] : [];
  return <section className="nx-hero" aria-label="Indicador prioritário">
    <div className="nx-hero-texture" aria-hidden="true" />
    <div className="nx-hero-body">
      <div className="nx-hero-top"><span><i/> RESULTADO EM FOCO <b>/</b> {mesAtual.toUpperCase()}</span><span>01 / 04</span></div>
      <div className="nx-hero-middle">
        <div className="nx-hero-figure"><span className="nx-hero-label">{titulo}</span><strong>{valor}</strong>
          {/* `deltaDePct` é quem arredonda e escreve o sinal — imprimir `deltaPct`
              cru punha "-76.65859549848565%" no card principal. */}
          {fat ? <p className="nx-hero-context"><span data-negative={deltaDePct(fat.deltaPct).tom==="risco"}>{fat.deltaPct === null ? "Sem base" : deltaDePct(fat.deltaPct).texto}</span> comparado ao mesmo período anterior</p> :
            meta ? <p className="nx-hero-context">{meta.alvo===null ? "Ainda não existe meta definida" : `Objetivo: ${meta.unidade==="faturamento" ? brlInteiro(meta.alvo) : numero(meta.alvo)}`}</p> :
            fila ? <p className="nx-hero-context">{numero(fila.foraDoSla)} fora do SLA · {numero(fila.vencendo)} perto do prazo</p> : entrega ? <p className="nx-hero-context">{numero(entrega.bloqueadas)} bloqueadas · {numero(entrega.atrasadas)} atrasadas</p> : null}
          {pct !== null ? <div className="nx-progress"><div><span>Progresso da meta</span><strong>{numero(pct)}%</strong></div><div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100,pct)} aria-label="Progresso da meta"><span style={{width:percentual(pct)}}/></div><small>{fat?.metaMes ? `${brlInteiro(fat.metaMes.realizado)} de ${brlInteiro(fat.metaMes.alvo)}` : meta?.alvo ? `${numero(meta.realizado)} de ${numero(meta.alvo)}` : ""}</small></div> : null}
        </div>
        {meses.length ? <div className="nx-hero-graph"><div className="nx-chart-caption"><span>TRAJETÓRIA / ÚLTIMOS 6 MESES</span><b>{meses[selecionadoIndex]?.rotulo}: {brlInteiro(meses[selecionadoIndex]?.valor ?? 0)}</b></div><div className="nx-bars" role="group" aria-label="Selecione um mês para consultar seu faturamento">
          {meses.map((m,i) => <button type="button" key={m.rotulo+i} onFocus={()=>setSelecionado(i)} onMouseEnter={()=>setSelecionado(i)} onMouseLeave={()=>setSelecionado(null)} onClick={()=>setSelecionado(i)} aria-pressed={i===selecionadoIndex} aria-label={`${m.rotulo}: ${brlInteiro(m.valor)}`}><span className="nx-bar-rail"><span data-current={i===selecionadoIndex} style={{height:percentual(Math.max(2,100*m.valor/maior))}}/></span><small>{m.rotulo}</small></button>)}
        </div></div> : <div className="nx-hero-extra"><span>{hero.tipo === "fila" ? "AGUARDANDO DISTRIBUIÇÃO" : hero.tipo === "entrega" ? "RISCO NA CARTEIRA" : "VENDAS GANHAS"}</span><strong>{fila ? numero(fila.semDono) : entrega ? numero(entrega.clientesEmRisco) : meta ? numero(meta.ganhos) : "—"}</strong><p>{hero.tipo === "fila" ? "leads sem responsável" : hero.tipo === "entrega" ? "clientes que precisam de atenção" : "no mês corrente"}</p>{permitirLinks?<Link href={caminho}>Abrir detalhe <ArrowUpRight size={17}/></Link>:null}</div>}
      </div>
      <div className="nx-hero-foot">{infos.map(([rotulo,n])=><div key={rotulo}><span>{rotulo}</span><strong>{n}</strong></div>)}{permitirLinks?<Link href={caminho} aria-label="Abrir relatório de performance"><ArrowUpRight size={20}/></Link>:null}</div>
    </div>
  </section>;
}
function Radar({ a, agenda, irParaDia }: { a: Atencao|null; agenda: PainelInicio["agenda"]; irParaDia: ()=>void }) {
  const itens = a?.itens.slice(0,3) ?? [];
  const agendaAtual = bom<{reunioes:number}>(agenda);
  const criticos = a?.porSeveridade.critico ?? 0;
  return <aside className="nx-radar" aria-label="Prioridades do seu dia"><div className="nx-radar-head"><div><small>RADAR DE ATENÇÃO</small><h2>O que merece atenção</h2></div><span><BellRing size={18}/></span></div>
    <div className="nx-radar-numbers"><button onClick={irParaDia} type="button"><strong>{a?numero(a.total):"—"}</strong><span>Na fila</span></button><button onClick={irParaDia} type="button"><strong data-risk={criticos>0}>{a?numero(criticos):"—"}</strong><span>Críticos</span></button><button onClick={irParaDia} type="button"><strong>{agendaAtual?numero(agendaAtual.reunioes):"—"}</strong><span>Reuniões</span></button></div>
    <div className="nx-radar-items">{itens.length ? itens.map((it,i) => <Link href={it.href} key={it.id}><span>{String(i+1).padStart(2,"0")}</span><div><strong>{it.titulo}</strong><small>{it.tipo} · {it.detalhe}</small></div><ChevronRight size={16}/></Link>) : <div className="nx-radar-empty"><Check size={18}/>Nenhum sinal prioritário neste momento.</div>}</div>
    <button className="nx-radar-link" type="button" onClick={irParaDia}>Ver prioridades e agenda <ArrowRight size={16}/></button>
  </aside>;
}
function Spark({serie,rotulo}:{serie:number[]|null;rotulo:string}) {
  if(!serie||serie.length<2)return <small className="nx-no-trend">Sem série disponível</small>;
  const min=Math.min(...serie),amplitude=Math.max(...serie)-min||1;
  const p=serie.map((v,i)=>`${i*150/(serie.length-1)},${40-(v-min)*33/amplitude}`).join(" ");
  return <svg viewBox="0 0 150 44" preserveAspectRatio="none" role="img" aria-label={`Tendência de ${rotulo}`}><polyline points={p} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function Indicadores({kpis,leitor,refresh}:{kpis:PainelInicio["kpis"];leitor:boolean;refresh:()=>void}) {
  if(!kpis.ok)return <Falha titulo="Indicadores" refresh={refresh}/>;
  if(!kpis.dados.length)return <p className="nx-empty">Não há indicadores para esta visão.</p>;
  return <div className="nx-metric-grid">{kpis.dados.slice(0,4).map((k:Kpi)=>{
    const children = <><div className="nx-metric-head"><span>{k.rotulo}</span>{!leitor&&k.href?<ArrowUpRight size={16}/>:null}</div><strong>{k.valor}</strong><div className="nx-metric-bottom"><div><span data-tone={k.delta?.tom||"neutro"}>{k.delta?.texto ?? ""}</span><small>{k.apoio}</small></div><Spark serie={k.serie} rotulo={k.rotulo}/></div></>;
    return !leitor&&k.href?<Link className="nx-metric" href={k.href} key={k.chave}>{children}</Link>:<div className="nx-metric" key={k.chave}>{children}</div>;
  })}</div>;
}
function Jornada({f,leitor}:{f:Funil;leitor:boolean}) {
  const [modo,setModo]=React.useState<"pipeline"|"prevendas">(f.etapas.length?"pipeline":"prevendas");
  const elementos=modo==="prevendas"&&f.preVendas?f.preVendas.colunas.map(c=>({rotulo:c.rotulo,chave:c.chave,n:c.total,valor:0,href:"/pre-vendas"})):f.etapas;
  const maximo=Math.max(1,...elementos.map(x=>x.n));
  return <section className="nx-journey"><header><div><small>02 / JORNADA</small><h3>Movimento comercial</h3></div><div className="nx-segments" aria-label="Escolher visão do funil">{f.etapas.length?<button type="button" onClick={()=>setModo("pipeline")} aria-pressed={modo==="pipeline"}>Pipeline</button>:null}{f.preVendas?<button type="button" onClick={()=>setModo("prevendas")} aria-pressed={modo==="prevendas"}>Pré-vendas</button>:null}</div></header>
    {elementos.length?<div className="nx-stages">{elementos.map((et,i)=>{
      const inner=<><div><span><b>{String(i+1).padStart(2,"0")}</b>{et.rotulo}</span><strong>{numero(et.n)}</strong></div><div className="nx-stage-track"><span style={{width:percentual(et.n/maximo*100)}}/></div>{et.valor>0?<small>{moedaCompacta(et.valor)}</small>:null}</>;
      return !leitor&&et.href?<Link href={et.href} className="nx-stage" key={et.chave}>{inner}</Link>:<div className="nx-stage" key={et.chave}>{inner}</div>;
    })}</div>:<p className="nx-empty">Nenhuma etapa com negócios abertos neste recorte.</p>}
    <footer><span><b>{numero(f.abertas)}</b> negócios abertos</span><span><b>{moedaCompacta(f.valorAberto)}</b> em negociação</span>{!leitor?<Link href={modo==="prevendas"?"/pre-vendas":"/pipeline"}>Abrir módulo <ArrowRight size={15}/></Link>:null}</footer>
  </section>;
}
function Operacao({e,f,s,leitor}:{e:Entrega|null;f:Financeiro|null;s:Saude|null;leitor:boolean}) {
  const linhas=[...(e?[{name:"Implantações em andamento",n:e.emAndamento,url:"/pos-vendas",risk:false},{name:"Entregas atrasadas",n:e.atrasadas,url:"/pos-vendas?aba=imp",risk:true},{name:"Clientes em risco",n:e.clientesEmRisco,url:"/clientes/risco",risk:true},{name:"Renovações em 30 dias",n:e.renovacoes30d,url:"/clientes/cs",risk:false}]:[]),...(f?[{name:"Faturas vencidas",n:f.atrasadoCount,url:"/clientes/financeiro",risk:true}]:[])];
  const problemas=s?.itens.filter(i=>i.estado==="falha"||i.estado==="atencao").length ?? 0;
  return <section className="nx-ops"><header><div><small>03 / OPERAÇÃO</small><h3>Entrega & relacionamento</h3></div>{!leitor?<Link href="/pos-vendas" aria-label="Abrir pós-venda"><ArrowUpRight size={18}/></Link>:null}</header>
    {linhas.length?<div className="nx-ops-list">{linhas.map((l,i)=>{const content=<><span><i data-danger={l.risk&&l.n>0}/>{l.name}</span><strong data-danger={l.risk&&l.n>0}>{numero(l.n)}</strong>{!leitor?<ChevronRight size={16}/>:null}</>;return !leitor?<Link href={l.url} key={i}>{content}</Link>:<div key={i}>{content}</div>})}</div>:<p className="nx-empty">Sem indicadores operacionais nesta visão.</p>}
    {s?<div className="nx-ops-health"><ShieldCheck size={17}/><span>Integrações</span><strong data-danger={problemas>0}>{problemas?`${problemas} pedindo atenção`:s.itens.length?"Sem alertas":"Sem dados"}</strong>{!leitor?<Link href="/ajustes/integracoes" aria-label="Abrir integrações"><ArrowUpRight size={16}/></Link>:null}</div>:null}
  </section>;
}
function Dia({p,refresh}:{p:PainelInicio;refresh:()=>void}) {
  const a=bom<Atencao>(p.atencao),agenda=bom<{itens:Array<{id:string;hora:string;titulo:string;detalhe:string;href:string}>;atrasadas:number;tarefasHoje:number}>(p.agenda);
  return <div className="nx-day"><section><Titulo indice="01" titulo="Fila de prioridades" subtitulo="Do que está mais urgente ao próximo passo."/>{p.atencao&&!p.atencao.ok?<Falha titulo="Prioridades" refresh={refresh}/>:a?.itens.length?<div className="nx-day-list">{a.itens.map(i=><Link href={i.href} key={i.id}><span data-risk={i.severidade}/><div><b>{i.titulo}</b><small>{i.tipo} · {i.detalhe}</small></div><strong>{i.peso||i.acao}</strong><ArrowUpRight size={16}/></Link>)}</div>:<p className="nx-empty">Sua fila está livre de prioridades urgentes.</p>}</section><section><Titulo indice="02" titulo="Agenda de hoje" href="/calendario" texto="Abrir agenda"/>{p.agenda&&!p.agenda.ok?<Falha titulo="Agenda" refresh={refresh}/>:agenda?.itens.length?<div className="nx-day-list">{agenda.itens.map(i=><Link key={i.id} href={i.href}><time>{i.hora}</time><div><b>{i.titulo}</b><small>{i.detalhe}</small></div><ArrowUpRight size={16}/></Link>)}</div>:<p className="nx-empty">Sem eventos com horário agendado hoje.</p>}{agenda?<p className="nx-day-summary">{numero(agenda.tarefasHoje)} tarefas para hoje · {numero(agenda.atrasadas)} atrasadas</p>:null}</section></div>;
}
function Acessos({p}:{p:PainelInicio}) {return <section className="nx-access"><div><small>SEU ESPAÇO DE TRABALHO</small><h2>Continue de onde precisa</h2></div><nav aria-label="Atalhos do seu perfil">{p.atalhos.map(a=><Link href={a.href} key={a.href}><span>{a.rotulo}</span>{a.contagem&&a.contagem>0?<b>{numero(a.contagem)}</b>:null}<ArrowUpRight size={16}/></Link>)}{p.podeAgir?<button type="button" onClick={()=>abrirNexo()}><Sparkles size={17}/><span>Perguntar ao NEXO</span><kbd>⌘J</kbd><ArrowUpRight size={16}/></button>:null}</nav></section>}

export function Inicio({painel}:{painel:PainelInicio}) {
  const router=useRouter();const [aba,setAba]=React.useState<Aba>("panorama");const [carregando,iniciar]=React.useTransition();
  const leitor=painel.lente==="leitor";
  const tabs:Array<{id:Aba;nome:string;Icon:typeof TrendingUp;visivel:boolean}>=[{id:"panorama",nome:"Panorama",Icon:BarChart3,visivel:true},{id:"meu-dia",nome:"Meu dia",Icon:ListTodo,visivel:!!(painel.atencao||painel.agenda)},{id:"jornada",nome:"Jornada comercial",Icon:TrendingUp,visivel:!!painel.funil},{id:"operacao",nome:"Operação & CS",Icon:Workflow,visivel:!!(painel.entrega||painel.financeiro||painel.saude)}];
  const atualizar=React.useCallback(()=>iniciar(async()=>{try{await atualizarInicio()}catch(e){console.error("[inicio] falha de atualização",e)}router.refresh()}),[router]);
  const funil=bom<Funil>(painel.funil),entrega=bom<Entrega>(painel.entrega),financeiro=bom<Financeiro>(painel.financeiro),saude=bom<Saude>(painel.saude);
  return <Pagina className="nx-root"><header className="nx-header"><div><div className="nx-overline"><span className="nx-brand-dot"/> ONFACE <b>/</b> INÍCIO <em>CENTRAL DE COMANDO</em></div><h1>{painel.saudacao}<span>.</span></h1><p>{descricoes[painel.lente]}{painel.organizacao?" · "+painel.organizacao:""}</p></div><div className="nx-header-tools"><span><CalendarDays size={16}/>{painel.data}</span><button type="button" onClick={atualizar} disabled={carregando} aria-label="Atualizar indicadores" title="Atualizar"><RefreshCw size={17} className={carregando?"nx-spin":""}/></button>{painel.podeAgir?<Link href="/tarefas?nova=1"><Plus size={16}/> Nova atividade</Link>:null}</div></header>
    <div className="nx-control"><div><span/> VISÃO DO NEGÓCIO</div><div><Clock3 size={14}/> Atualizado às {new Date(painel.geradoEm).toLocaleTimeString("pt-BR",{timeZone:"America/Sao_Paulo",hour:"2-digit",minute:"2-digit"})}</div></div>
    <nav className="nx-tabs" aria-label="Seções da página Início">{tabs.filter(t=>t.visivel).map(({id,nome,Icon})=><button type="button" key={id} onClick={()=>setAba(id)} aria-pressed={aba===id}><Icon size={16}/>{nome}{id==="meu-dia"&&bom<Atencao>(painel.atencao)?.total?<b>{numero(bom<Atencao>(painel.atencao)!.total)}</b>:null}</button>)}</nav>
    <div className="nx-panels" aria-busy={carregando}>{aba==="panorama"?<><div className="nx-opening">{painel.hero.ok?<Hero hero={painel.hero.dados} data={painel.geradoEm} permitirLinks={!leitor}/>:<Falha titulo="Performance" refresh={atualizar}/ >}{painel.atencao||painel.agenda?<Radar a={bom<Atencao>(painel.atencao)} agenda={painel.agenda} irParaDia={()=>setAba("meu-dia")}/>:<div className="nx-reader-note"><Layers size={28}/><h2>Visão consolidada</h2><p>Seus indicadores respeitam o escopo e as permissões deste perfil.</p></div>}</div><div className="nx-metrics"><Titulo indice="01" titulo="Indicadores essenciais" subtitulo="Resultados, comparação e tendência do período." href={!leitor?"/relatorios":undefined} texto="Ver relatórios"/><Indicadores kpis={painel.kpis} leitor={leitor} refresh={atualizar}/></div>{painel.funil||painel.entrega||painel.financeiro||painel.saude?<div className="nx-flow"><Titulo indice="02" titulo="O negócio em movimento" subtitulo="Da aquisição à retenção, com caminhos para agir."/><div className="nx-flow-grid" data-only-one={!painel.funil||!(painel.entrega||painel.financeiro||painel.saude)}>{painel.funil?.ok?<Jornada f={painel.funil.dados} leitor={leitor}/>:painel.funil?<Falha titulo="Funil comercial" refresh={atualizar}/>:null}{painel.entrega||painel.financeiro||painel.saude?<Operacao e={entrega} f={financeiro} s={saude} leitor={leitor}/>:null}</div></div>:null}</>:null}
      {aba==="meu-dia"?<Dia p={painel} refresh={atualizar}/>:null}{aba==="jornada"?<div className="nx-full"><Titulo indice="03" titulo="Jornada comercial" subtitulo="Cada etapa mostra onde agir no negócio." href={!leitor?"/pipeline":undefined} texto="Abrir pipeline"/>{funil?<Jornada f={funil} leitor={leitor}/>:<Falha titulo="Funil" refresh={atualizar}/>}</div>:null}{aba==="operacao"?<div className="nx-full"><Titulo indice="04" titulo="Operação e sucesso do cliente" subtitulo="Implantações, riscos, renovação e integrações." href={!leitor?"/clientes/cs":undefined} texto="Abrir CS"/><Operacao e={entrega} f={financeiro} s={saude} leitor={leitor}/></div>:null}
      <Acessos p={painel}/><footer className="nx-footer"><span><span className="nx-brand-dot"/> ONFACE / Decisões conectadas aos dados</span><span>Recorte de acesso individual · Horário de Brasília</span></footer></div></Pagina>;
}
