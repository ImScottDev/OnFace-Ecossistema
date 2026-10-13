"use client";

/**
 * Cliente 360 › Uso da Callface AI.
 *
 * Quem chega: CS, comercial e NEXO, vindos da carteira ou do CS, querendo
 * decidir UMA coisa — essa conta está bem, está indo embora ou está pronta
 * para comprar mais? A ordem da tela segue essa pergunta:
 *
 *   1. o vínculo (sem ele nenhum número abaixo é do cliente);
 *   2. o número que decide — minutos do mês contra o plano — num bloco só;
 *   3. os sinais, cada um com o porquê em números;
 *   4. a série diária para ver a forma do uso;
 *   5. o que está montado na conta (campanhas, agentes, integrações, usuários).
 *
 * Nada é calculado por chute: sem franquia não há "% do plano", sem coleta
 * não há número, e vínculo pendente mostra a sugestão com a evidência — não
 * os dados da organização sugerida.
 */

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle, Bot, CheckCircle2, Clock, Link2, Link2Off, Megaphone, MoreHorizontal, Plug,
  RefreshCw, ShieldCheck, Sparkles, TrendingDown, TrendingUp, Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { projecaoDoMes, sinaisComplementares, variacao, type Sinal } from "@/lib/callface-ai/sinais-de-uso";
import { LIMIARES_USO } from "@/lib/callface-ai/uso-regras";
import { LIMIARES_SAUDE } from "@/lib/callface-ai/saude-regras";
import { SerieDeUso } from "./SerieDeUso";
import { haQuanto, inteiro, pct } from "./formato";
import type { AcoesDeVinculo, ResultadoVinculo, SugestaoDeVinculo, UsoDoCliente, VinculoCallfaceAi } from "./tipos";

const CARTAO = "rounded-[var(--radius-card-lg)] bg-superficie shadow-[inset_0_0_0_1px_var(--line-hairline)]";
type ComDado = UsoDoCliente & {
  minutos: NonNullable<UsoDoCliente["minutos"]>; ligacoes: NonNullable<UsoDoCliente["ligacoes"]>;
  usuarios: NonNullable<UsoDoCliente["usuarios"]>; plano: NonNullable<UsoDoCliente["plano"]>;
};

export type PropsUsoDoCliente = {
  /** null = a leitura não achou a empresa nesta organização. */
  uso: UsoDoCliente | null;
  erro?: string | null;
  acoes?: AcoesDeVinculo;
  aoMudar?: () => void;
  /** Só para o laboratório congelar o "hoje". */
  agora?: Date;
};

export function UsoDoClientePainel({ uso, erro, acoes, aoMudar, agora: agoraFixo }: PropsUsoDoCliente) {
  const agora = agoraFixo ?? new Date();
  if (erro || !uso) {
    return <ErroDeUso mensagem={erro ?? "A empresa não foi encontrada na leitura de uso desta organização."} aoTentar={aoMudar} />;
  }
  const v = uso.vinculo;
  if (v.estado === "sem" || v.estado === "pendente") {
    return <SemVinculo uso={uso} acoes={acoes} aoMudar={aoMudar} />;
  }
  const temDado = !!(uso.minutos && uso.ligacoes && uso.usuarios && uso.plano);
  return (
    <div className="flex flex-col gap-3">
      <FaixaDoVinculo uso={uso} agora={agora} acoes={acoes} aoMudar={aoMudar} />
      {temDado ? <FaixaDeSaude uso={uso} agora={agora} /> : null}
      {temDado ? <Conteudo uso={uso as ComDado} agora={agora} /> : <AguardandoSync nomeOrg={v.nomeOrg} />}
    </div>
  );
}

/* ── Conteúdo com dado ─────────────────────────────────────────────────── */

function Conteudo({ uso, agora }: { uso: ComDado; agora: Date }) {
  const serie = uso.ligacoes.serieDiaria90d;
  const soma = (de: number, ate: number) => serie.slice(serie.length - ate, serie.length - de).reduce((a, d) => a + d.chamadas, 0);
  const lic = uso.plano.licencas;
  const sinais: Sinal[] = [
    ...uso.flags.map((f): Sinal => ({
      chave: f.codigo, titulo: f.rotulo, porque: f.detalhe,
      tom: f.gravidade === "oportunidade" ? "expansao" : f.gravidade,
    })),
    ...sinaisComplementares({
      agora, flags: uso.flags.map((f) => f.codigo), minutosMes: uso.minutos.mesCorrente, minutos30d: uso.minutos.d30,
      minutosContratados: uso.minutos.contratadosMes, licencasContratadas: lic.contratadas, licencasEmUso: lic.emUso,
    }),
  ];
  const conexao = uso.ligacoes.taxaConexao30d;
  const rodape = [
    conexao != null ? `Conexão nos últimos 30 dias: ${conexao.toLocaleString("pt-BR")}% das ligações finalizadas.` : null,
    uso.ligacoes.ambiguas30d > 0 ? `${inteiro(uso.ligacoes.ambiguas30d)} ligações de atribuição ambígua ficaram fora do total.` : null,
  ].filter(Boolean).join(" ");

  return (
    <>
      <Destaque uso={uso} agora={agora}
        lig7={{ v: uso.ligacoes.d7, d: variacao(soma(0, 7), soma(7, 14)) }}
        lig30={{ v: uso.ligacoes.d30, d: variacao(soma(0, 30), soma(30, 60)) }} />
      <div className="grid gap-3 desktop:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className={`${CARTAO} p-4`} aria-label="Série diária de uso">
          <SerieDeUso serie={serie} rodape={rodape || undefined} />
        </section>
        <Sinais sinais={sinais} />
      </div>
      <div className="grid gap-3 tablet:grid-cols-2 amplo:grid-cols-4">
        <ListaDeItens titulo="Campanhas" icone={<Megaphone aria-hidden />}
          resumo={uso.campanhas ? `${uso.campanhas.ativas} ativas · ${uso.campanhas.concluidas30d} concluídas em 30d` : "sem dado"}
          itens={(uso.campanhas?.recentes ?? []).map((c, i) => ({
            chave: String(i), nome: c.nome, status: c.status, ativo: /ativ|rodando|running|active/i.test(c.status),
            meta: c.total ? `${inteiro(c.discados)} de ${inteiro(c.total)} discados` : null,
          }))}
          vazio="Nenhuma campanha criada." />
        <ListaDeItens titulo="Agentes" icone={<Bot aria-hidden />}
          resumo={uso.agentes ? `${uso.agentes.prontos} prontos` : "sem dado"}
          itens={(uso.agentes?.lista ?? []).map((a, i) => ({ chave: String(i), nome: a.nome, status: a.status, ativo: /pront|ready|ativo|active|publi/i.test(a.status), meta: null }))}
          vazio="Nenhum agente configurado." />
        <ListaDeItens titulo="Integrações" icone={<Plug aria-hidden />}
          resumo={uso.integracoes ? `${uso.integracoes.appsAtivos} apps · ${uso.integracoes.webhooksAtivos} webhooks ativos` : "sem dado"}
          itens={(uso.integracoes?.apps ?? []).map((a, i) => ({ chave: String(i), nome: a.nome, status: a.ativo ? "Ativo" : "Inativo", ativo: a.ativo, meta: null }))}
          vazio="Nenhuma integração conectada." />
        <Usuarios uso={uso} agora={agora} />
      </div>
    </>
  );
}

/** O bloco que decide: minutos do mês contra o plano, e o apoio ao lado. */
function Destaque({ uso, agora, lig7, lig30 }: {
  uso: ComDado; agora: Date; lig7: { v: number; d: number | null }; lig30: { v: number; d: number | null };
}) {
  const contratado = uso.minutos.contratadosMes;
  const consumo = uso.minutos.percentualDoLimite;
  const proj = projecaoDoMes(uso.minutos.mesCorrente, agora);
  const tom = consumo == null ? "padrao" : consumo >= 100 ? "perigo" : consumo >= LIMIARES_USO.pertoDoLimitePct ? "atencao" : "padrao";
  const lic = uso.plano.licencas;
  const parado = uso.diasSemAtividade;
  const mes = agora.toLocaleDateString("pt-BR", { month: "long" });

  return (
    <section aria-label="Uso no mês" className="grid gap-x-8 gap-y-5 rounded-[var(--radius-card-lg)] bg-[var(--surface-shell)] p-5 text-[var(--text-on-shell)] desktop:grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)]">
      <div className="min-w-0">
        <p className="text-apoio font-semibold text-[var(--text-on-shell-muted)]">
          Minutos em {mes}{uso.plano.principal ? ` · plano ${uso.plano.principal}` : ""}
        </p>
        <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
          <strong className="font-[family-name:var(--font-onface-titulo)] text-hero font-extrabold">{inteiro(uso.minutos.mesCorrente)}</strong>
          <span className="text-corpo text-[var(--text-on-shell-muted)]">{contratado ? `de ${inteiro(contratado)} contratados` : "min"}</span>
        </p>
        {consumo != null ? (
          <div className="mt-3 flex flex-col gap-1.5">
            <Progress value={Math.min(100, consumo)} tom={tom} aria-label={`${Math.round(consumo)}% dos minutos do plano`} className="h-1.5 bg-[var(--onface-alpha-divider)]" />
            <p className="text-apoio tabular-nums text-[var(--text-on-shell-muted)]">
              {inteiro(consumo)}% do plano · no ritmo atual fecha o mês em ~{inteiro(proj)} min
            </p>
          </div>
        ) : (
          <p className="mt-3 text-apoio text-[var(--text-on-shell-muted)]">
            {lic.minutosSemLimite ? "Plano sem limite de minutos." : "Nenhuma franquia de minutos registrada nas licenças."} Projeção do mês: ~{inteiro(proj)} min.
          </p>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 self-center tablet:grid-cols-4">
        <Apoio rotulo="Ligações 7 dias" valor={inteiro(lig7.v)} delta={lig7.d} base="7 dias antes" />
        <Apoio rotulo="Ligações 30 dias" valor={inteiro(lig30.v)} delta={lig30.d} base="30 dias antes" />
        <Apoio rotulo="Licenças em uso" valor={lic.contratadas ? `${lic.emUso}/${lic.contratadas}` : inteiro(uso.usuarios.comAtividade30d)}
          apoio={lic.contratadas ? `${uso.usuarios.comAtividade7d} ligaram em 7 dias` : "usuários com ligação em 30 dias"} />
        <Apoio rotulo="Última atividade" valor={haQuanto(uso.ultimaAtividadeEm, agora)}
          apoio={uso.ultimaAtividadeEm ? new Date(uso.ultimaAtividadeEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "sem registro"}
          alerta={parado != null && parado >= LIMIARES_SAUDE.silencioDias} />
      </dl>
    </section>
  );
}

function Apoio({ rotulo, valor, apoio, delta, base, alerta }: {
  rotulo: string; valor: string; apoio?: string; delta?: number | null; base?: string; alerta?: boolean;
}) {
  const Seta = delta == null ? null : delta >= 0 ? TrendingUp : TrendingDown;
  return (
    <div className="min-w-0">
      <dt className="text-micro font-semibold text-[var(--text-on-shell-muted)]">{rotulo}</dt>
      <dd className={`mt-1 truncate font-[family-name:var(--font-onface-titulo)] text-kpi font-bold tabular-nums ${alerta ? "text-[var(--onface-coral)]" : ""}`} suppressHydrationWarning>{valor}</dd>
      <dd className="mt-0.5 flex items-center gap-1 text-micro text-[var(--text-on-shell-muted)]">
        {Seta ? (
          <>
            <Seta aria-hidden className="size-3" />
            <span className="tabular-nums text-[var(--text-on-shell)]">{pct(delta!)}</span>
            <span className="sr-only">{delta! >= 0 ? "alta" : "queda"}</span>
            <span className="truncate">vs {base}</span>
          </>
        ) : base ? <span className="truncate">sem base de comparação</span> : <span className="truncate">{apoio}</span>}
      </dd>
    </div>
  );
}

const SEMAFORO_UI = {
  verde: { badge: "success", rotulo: "Saudável", frase: "Usando e dentro do direito contratado." },
  amarelo: { badge: "warning", rotulo: "Atenção", frase: "Um sinal pede acompanhamento do CS." },
  vermelho: { badge: "danger", rotulo: "Em risco", frase: "O CS precisa agir agora." },
  sem_dado: { badge: "info", rotulo: "Sem dado", frase: "Ainda sem leitura suficiente." },
} as const;

/**
 * O semáforo do dia e o que o CS tem a fazer. Vem de `saude-regras` (a mesma
 * função da carteira, do Início e do NEXO); aqui só se desenha.
 */
function FaixaDeSaude({ uso, agora }: { uso: UsoDoCliente; agora: Date }) {
  const s = uso.saude;
  if (!s) {
    return (
      <section aria-label="Saúde do uso" className={`${CARTAO} flex items-start gap-3 p-4`}>
        <Clock aria-hidden className="mt-0.5 size-5 text-tinta-suave" />
        <p className="text-apoio text-tinta-suave">O semáforo deste cliente ainda não foi calculado. Ele nasce na próxima rodada do sincronizador, junto com a última atividade.</p>
      </section>
    );
  }
  const ui = SEMAFORO_UI[s.semaforo];
  const fontes = [
    { rotulo: "Chamada", quando: s.ultimaChamadaEm }, { rotulo: "Copiloto", quando: s.ultimaCopilotoEm }, { rotulo: "Reunião", quando: s.ultimaReuniaoEm },
  ];
  const velha = s.idadeHoras != null && s.idadeHoras > 36;
  return (
    <section aria-label="Saúde do uso" className={`${CARTAO} flex flex-col gap-3 p-4`}>
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={ui.badge} className="h-6">{ui.rotulo}</Badge>
        <p className="text-corpo font-semibold text-tinta">{ui.frase}</p>
        {velha ? <span className="ml-auto text-micro text-[var(--onface-coral-texto)]">Cálculo de {haQuanto(new Date(agora.getTime() - s.idadeHoras! * 3600e3).toISOString(), agora)}: o sincronizador pode estar parado.</span> : null}
      </div>
      <p className="text-apoio text-tinta-suave" suppressHydrationWarning>
        Última atividade: <strong className="text-tinta">{haQuanto(uso.ultimaAtividadeEm, agora)}</strong>
        {" "}({fontes.map((f) => `${f.rotulo} ${f.quando ? haQuanto(f.quando, agora) : "nunca"}`).join(" · ")}).
        {" "}O SaaS não guarda login; a atividade é derivada do uso real.
      </p>
      {s.copiloto.sessoes30d > 0 ? (
        <p className="text-apoio text-tinta-suave">
          Copiloto: {s.copiloto.sessoes30d} sessões em 30 dias{s.copiloto.adocaoPct != null ? `, ${s.copiloto.adocaoPct.toLocaleString("pt-BR")}% das sugestões aproveitadas` : ""}.
        </p>
      ) : null}
      {s.assinaturas.canceladas > 0 ? (
        <p className="text-apoio text-tinta-suave">
          Assinaturas: {s.assinaturas.canceladas} de {s.assinaturas.total} canceladas{s.assinaturas.canceladaEm ? `, a última ${haQuanto(s.assinaturas.canceladaEm, agora)}` : ""}{s.assinaturas.motivo ? ` (${s.assinaturas.motivo})` : ""}.
        </p>
      ) : null}
      {uso.tarefas.length > 0 ? (
        <div className="border-t border-linha pt-3">
          <p className="text-micro font-semibold text-tinta-suave">Tarefas de CS abertas por este sinal</p>
          <ul className="mt-1 flex flex-col gap-1">
            {uso.tarefas.map((t) => (
              <li key={t.id} className="flex flex-wrap items-baseline gap-x-2 text-apoio">
                <Link href="/tarefas" className="font-semibold text-tinta underline-offset-2 hover:underline">{t.titulo}</Link>
                <span className="text-tinta-suave" suppressHydrationWarning>
                  {t.responsavel ?? "sem CS responsável (fila da gestão)"}{t.venceEm ? ` · vence ${new Date(t.venceEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

const TOM_SINAL: Record<Sinal["tom"], { icone: React.ReactNode; badge: "danger" | "warning" | "info" | "success"; rotulo: string }> = {
  risco: { icone: <AlertTriangle aria-hidden />, badge: "danger", rotulo: "Risco" },
  atencao: { icone: <Clock aria-hidden />, badge: "warning", rotulo: "Atenção" },
  expansao: { icone: <Sparkles aria-hidden />, badge: "info", rotulo: "Expansão" },
  ok: { icone: <CheckCircle2 aria-hidden />, badge: "success", rotulo: "Saudável" },
};

function Sinais({ sinais }: { sinais: Sinal[] }) {
  return (
    <section className={`${CARTAO} flex flex-col p-4`} aria-label="Sinais de saúde">
      <h3 className="text-corpo font-semibold text-tinta">Sinais de saúde</h3>
      <p className="text-apoio text-tinta-suave">Do uso real; cada sinal diz de onde vem.</p>
      {sinais.length === 0 ? (
        <p className="mt-4 text-apoio text-tinta-suave">Sem uso suficiente nos últimos 90 dias para ler um sinal.</p>
      ) : (
        <ul className="mt-3 flex flex-col">
          {sinais.map((s) => {
            const t = TOM_SINAL[s.tom];
            return (
              <li key={s.chave} className="flex gap-3 border-t border-linha py-3 first:border-t-0 first:pt-1">
                <Badge variant={t.badge} className="mt-0.5 h-6">{t.icone}{t.rotulo}</Badge>
                <div className="min-w-0">
                  <p className="text-corpo font-semibold text-tinta">{s.titulo}</p>
                  <p className="text-apoio text-tinta-suave">{s.porque}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

type ItemDaLista = { chave: string; nome: string; status: string; ativo: boolean; meta: string | null };

function ListaDeItens({ titulo, icone, resumo, itens, vazio }: {
  titulo: string; icone: React.ReactNode; resumo: string; itens: ItemDaLista[]; vazio: string;
}) {
  return (
    <section className={`${CARTAO} flex flex-col p-4`} aria-label={titulo}>
      <header className="flex items-center gap-2 [&_svg]:size-4 [&_svg]:text-tinta-suave">
        {icone}
        <h3 className="text-corpo font-semibold text-tinta">{titulo}</h3>
        <span className="ml-auto truncate text-apoio tabular-nums text-tinta-suave">{resumo}</span>
      </header>
      {itens.length === 0 ? (
        <p className="mt-3 text-apoio text-tinta-suave">{vazio}</p>
      ) : (
        <ul className="mt-2 flex flex-col">
          {itens.slice(0, 6).map((i) => (
            <li key={i.chave} className="flex items-center gap-2 border-t border-linha py-2 first:border-t-0">
              <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${i.ativo ? "bg-positivo-solido" : "bg-linha-controle"}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-corpo text-tinta">{i.nome}</span>
                {i.meta ? <span className="block truncate text-micro text-tinta-suave">{i.meta}</span> : null}
              </span>
              <span className="shrink-0 text-micro text-tinta-suave">{i.status}</span>
            </li>
          ))}
          {itens.length > 6 ? <li className="pt-2 text-micro text-tinta-suave">e mais {itens.length - 6} na Callface AI</li> : null}
        </ul>
      )}
    </section>
  );
}

function Usuarios({ uso, agora }: { uso: ComDado; agora: Date }) {
  const u = uso.usuarios;
  /* Quem liga mais primeiro; quem nunca ligou no fim — é a lista de quem
     treinar. */
  const lista = [...u.lista].sort((a, b) => b.chamadas30d - a.chamadas30d).slice(0, 6);
  return (
    <section className={`${CARTAO} flex flex-col p-4`} aria-label="Usuários">
      <header className="flex items-center gap-2">
        <Users aria-hidden className="size-4 text-tinta-suave" />
        <h3 className="text-corpo font-semibold text-tinta">Usuários</h3>
        <span className="ml-auto truncate text-apoio tabular-nums text-tinta-suave">
          {u.ativos} ativos{u.pendentes ? ` · ${u.pendentes} convite${u.pendentes > 1 ? "s" : ""} pendente${u.pendentes > 1 ? "s" : ""}` : ""}
        </span>
      </header>
      {lista.length === 0 ? (
        <p className="mt-3 text-apoio text-tinta-suave">Nenhum usuário na organização.</p>
      ) : (
        <ul className="mt-2 flex flex-col">
          {lista.map((x, i) => (
            <li key={x.email ?? i} className="flex items-center gap-2 border-t border-linha py-2 first:border-t-0">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-corpo text-tinta">{x.nome ?? x.email ?? "Sem nome"}</span>
                <span className="block truncate text-micro text-tinta-suave">{x.papel}{x.ativo ? "" : " · inativo"}</span>
              </span>
              <span className="shrink-0 text-right text-micro tabular-nums">
                <span className="block text-tinta">{inteiro(x.chamadas30d)} lig. 30d</span>
                <span className={`block ${x.chamadas30d === 0 ? "text-[var(--onface-coral-texto)]" : "text-tinta-suave"}`} suppressHydrationWarning>
                  {x.ultimaChamadaEm ? haQuanto(x.ultimaChamadaEm, agora) : "nunca ligou"}
                </span>
              </span>
            </li>
          ))}
          {u.total > lista.length ? <li className="pt-2 text-micro text-tinta-suave">{u.total} usuários na organização</li> : null}
        </ul>
      )}
    </section>
  );
}

/* ── Vínculo ───────────────────────────────────────────────────────────── */

const ESTADO: Record<"auto" | "confirmado" | "manual", { rotulo: string; badge: "success" | "info" }> = {
  auto: { rotulo: "Vinculado por evidência forte", badge: "info" },
  confirmado: { rotulo: "Confirmado por pessoa", badge: "success" },
  manual: { rotulo: "Escolhido por pessoa", badge: "success" },
};

/** Frase curta da evidência: regra + os sinais que bateram. */
function resumoDaEvidencia(v: VinculoCallfaceAi): string {
  const e = v.evidencia;
  if (!e) return "sem evidência registrada";
  const sinais = (e.sinais ?? []).map((s) => `${s.chave} igual (${s.valor})`);
  const motivo = typeof e.motivo === "string" ? `motivo: ${e.motivo}` : null;
  const sugestao = (e.sugestao as { razao?: string } | undefined)?.razao ?? null;
  return [sinais.join(", ") || null, sugestao, motivo].filter(Boolean).join(" · ") || e.regra.replace(/_/g, " ");
}

function FaixaDoVinculo({ uso, agora, acoes, aoMudar }: { uso: UsoDoCliente; agora: Date; acoes?: AcoesDeVinculo; aoMudar?: () => void }) {
  const v = uso.vinculo;
  const s = uso.sincronizacao;
  const e = ESTADO[v.estado as keyof typeof ESTADO] ?? ESTADO.auto;
  const [evidencia, setEvidencia] = React.useState(false);
  const [remover, setRemover] = React.useState(false);
  /* Sync parado não some: o dado continua aqui, mas a idade fica à vista. */
  const velho = s.idadeHoras != null && s.idadeHoras > 24;
  return (
    <section aria-label="Vínculo com a Callface AI" className={`${CARTAO} flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3`}>
      <ShieldCheck aria-hidden className="size-4 shrink-0 text-tinta-suave" />
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="flex flex-wrap items-center gap-2 text-corpo">
          <span className="font-semibold text-tinta">{v.nomeOrg ?? "Organização sem nome"}</span>
          <Badge variant={e.badge}>{e.rotulo}</Badge>
        </p>
        <p className="truncate text-apoio text-tinta-suave">
          {resumoDaEvidencia(v)}
          {v.decididoPor ? ` · por ${v.decididoPor}` : ""}
          {v.vinculadoEm ? ` em ${new Date(v.vinculadoEm).toLocaleDateString("pt-BR")}` : ""}
        </p>
      </div>
      <span className={`flex items-center gap-1.5 text-micro ${s.erro || velho ? "text-[var(--onface-coral-texto)]" : "text-tinta-suave"}`} suppressHydrationWarning
        title={s.erro ?? undefined}>
        <RefreshCw aria-hidden className="size-3" />
        {s.ultimoSucessoEm ? `Sincronizado ${haQuanto(s.ultimoSucessoEm, agora)}` : "Ainda não sincronizado"}
        {s.erro ? " · último sync falhou" : ""}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon-sm" variant="ghost" aria-label="Mais ações do vínculo"><MoreHorizontal /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEvidencia(true)}>Ver evidência</DropdownMenuItem>
          {acoes ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setRemover(true)} className="text-negativo-foreground">Remover vínculo</DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <DialogoEvidencia aberto={evidencia} aoFechar={() => setEvidencia(false)} uso={uso} />
      {acoes ? <DialogoRemover aberto={remover} aoFechar={() => setRemover(false)} uso={uso} acoes={acoes} aoMudar={aoMudar} /> : null}
    </section>
  );
}

function DialogoEvidencia({ aberto, aoFechar, uso }: { aberto: boolean; aoFechar: () => void; uso: UsoDoCliente }) {
  const v = uso.vinculo;
  const ev = v.evidencia;
  return (
    <Dialog open={aberto} onOpenChange={(o) => { if (!o) aoFechar(); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Por que {uso.empresaNome} é {v.nomeOrg ?? "esta organização"}</DialogTitle>
          <DialogDescription>
            {ESTADO[v.estado as keyof typeof ESTADO]?.rotulo ?? "Vínculo"}
            {v.decididoPor ? ` por ${v.decididoPor}` : ""}{v.vinculadoEm ? ` em ${new Date(v.vinculadoEm).toLocaleString("pt-BR")}` : ""}.
            Identificador na Callface AI: {v.orgCallfaceId}.
          </DialogDescription>
        </DialogHeader>
        {ev?.sinais?.length ? (
          <table className="w-full text-apoio">
            <thead>
              <tr className="text-left text-micro text-tinta-suave"><th className="py-1 font-semibold">Sinal</th><th className="font-semibold">ONFACE</th><th className="font-semibold">Callface AI</th></tr>
            </thead>
            <tbody>
              {ev.sinais.map((s) => (
                <tr key={s.chave} className="border-t border-linha">
                  <td className="py-2 font-semibold text-tinta">{s.chave}</td><td className="text-tinta">{s.onface}</td><td className="text-tinta">{s.saas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="rounded-control bg-superficie-alt p-3 text-apoio text-tinta-suave">{resumoDaEvidencia(v)}</p>
        )}
        {ev?.regra ? <p className="text-micro text-tinta-suave">Regra: {ev.regra.replace(/_/g, " ")}</p> : null}
      </DialogContent>
    </Dialog>
  );
}

function DialogoRemover({ aberto, aoFechar, uso, acoes, aoMudar }: {
  aberto: boolean; aoFechar: () => void; uso: UsoDoCliente; acoes: AcoesDeVinculo; aoMudar?: () => void;
}) {
  const [motivo, setMotivo] = React.useState("");
  const [pendente, iniciar] = React.useTransition();
  const curto = motivo.trim().length < 5;
  const remover = () => iniciar(async () => {
    const r = await chamar(() => acoes.remover({ empresaId: uso.empresaId, motivo }));
    if (!r.ok) { toast.error(r.erro); return; }
    toast.success("Vínculo removido. O sincronizador não refaz este par.");
    setMotivo("");
    aoFechar();
    aoMudar?.();
  });
  return (
    <Dialog open={aberto} onOpenChange={(o) => { if (!o && !pendente) aoFechar(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remover vínculo com {uso.vinculo.nomeOrg}</DialogTitle>
          <DialogDescription>
            O uso some do Cliente 360 e da carteira, e este par fica marcado como recusado para o sincronizador não refazer.
            Novas sugestões, se houver, voltam para a fila de vínculos.
          </DialogDescription>
        </DialogHeader>
        <label className="flex flex-col gap-1.5 text-apoio font-semibold text-tinta">
          Motivo (fica no histórico)
          <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} placeholder="Ex.: organização é da filial, não da matriz" />
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={aoFechar} disabled={pendente}>Cancelar</Button>
          <Button variant="destructive" onClick={remover} disabled={curto || pendente} loading={pendente}><Link2Off /> Remover vínculo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const chamar = (fn: () => Promise<ResultadoVinculo>) =>
  fn().catch((e: unknown): ResultadoVinculo => ({ ok: false, erro: e instanceof Error ? e.message : "Falha inesperada." }));

/** Lista de sugestões com evidência e o botão que confirma cada uma. */
export function SugestoesDeVinculo({ empresaId, sugestoes, acoes, aoMudar, compacta }: {
  empresaId: string; sugestoes: SugestaoDeVinculo[]; acoes?: AcoesDeVinculo; aoMudar?: () => void; compacta?: boolean;
}) {
  const [emCurso, setEmCurso] = React.useState<string | null>(null);
  const confirmar = async (s: SugestaoDeVinculo) => {
    if (!acoes) return;
    setEmCurso(s.candidatoId);
    const r = await chamar(() => acoes.confirmar({ empresaId, candidatoId: s.candidatoId }));
    setEmCurso(null);
    if (!r.ok) { toast.error(r.erro); return; }
    toast.success(`Vínculo com ${s.nomeOrg ?? "a organização"} confirmado`);
    aoMudar?.();
  };
  return (
    <ul className="flex flex-col gap-2">
      {sugestoes.map((s, i) => (
        <li key={s.candidatoId} className={`flex flex-wrap items-center gap-3 rounded-control ${compacta ? "" : "p-3 shadow-[inset_0_0_0_1px_var(--line-hairline)]"}`}>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2 text-corpo font-semibold text-tinta">
              {s.nomeOrg ?? s.orgCallfaceId}
              {i === 0 && sugestoes.length > 1 ? <Badge variant="secondary">mais provável</Badge> : null}
              <span className="text-micro font-normal tabular-nums text-tinta-suave">{Math.round(s.score * 100)}% de semelhança</span>
            </span>
            <span className="block text-apoio text-tinta-suave">{s.razao ?? s.sinal.replace(/_/g, " ")}</span>
          </span>
          {acoes ? (
            <Button size="sm" variant={i === 0 ? "default" : "outline"} disabled={!!emCurso} loading={emCurso === s.candidatoId} onClick={() => confirmar(s)}>
              Confirmar vínculo
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/* ── Estados ───────────────────────────────────────────────────────────── */

function SemVinculo({ uso, acoes, aoMudar }: { uso: UsoDoCliente; acoes?: AcoesDeVinculo; aoMudar?: () => void }) {
  const sugestoes = uso.vinculo.sugestoes;
  const pendente = sugestoes.length > 0;
  return (
    <section aria-label={pendente ? "Vínculo pendente" : "Sem vínculo com a Callface AI"}
      className={`${CARTAO} flex flex-col items-start gap-4 p-5 ${pendente ? "shadow-[inset_0_0_0_1px_var(--onface-coral-border)]" : ""}`}>
      <div className="flex items-start gap-3">
        {pendente ? <Link2 aria-hidden className="mt-0.5 size-5 text-[var(--onface-coral-texto)]" /> : <Link2Off aria-hidden className="mt-0.5 size-5 text-tinta-suave" />}
        <div>
          <h3 className="text-item font-semibold text-tinta">
            {pendente ? `Qual organização da Callface AI é ${uso.empresaNome}?` : `${uso.empresaNome} não está vinculado a uma organização da Callface AI`}
          </h3>
          <p className="mt-1 max-w-[72ch] text-corpo text-tinta-suave">
            {pendente
              ? "O sincronizador achou organizações parecidas, mas sem evidência forte o bastante para vincular sozinho. Confirme a certa: a decisão fica registrada com seu nome e a razão. Até lá, nenhum número de uso é mostrado."
              : "Sem o vínculo, o ONFACE não sabe qual conta do SaaS é este cliente e não mostra uso, adoção nem risco. Nenhuma organização com CNPJ, domínio ou contato em comum foi encontrada."}
          </p>
        </div>
      </div>
      {pendente ? (
        <div className="w-full"><SugestoesDeVinculo empresaId={uso.empresaId} sugestoes={sugestoes} acoes={acoes} aoMudar={aoMudar} /></div>
      ) : null}
      <Button size="sm" variant="outline" asChild><Link href="/clientes/uso?aba=vinculos">Abrir fila de vínculos</Link></Button>
    </section>
  );
}

function AguardandoSync({ nomeOrg }: { nomeOrg: string | null }) {
  return (
    <section className={`${CARTAO} flex items-start gap-3 p-6`} aria-label="Aguardando sincronização">
      <RefreshCw aria-hidden className="mt-0.5 size-5 text-tinta-suave" />
      <div>
        <h3 className="text-item font-semibold text-tinta">Aguardando a primeira coleta</h3>
        <p className="mt-1 max-w-[68ch] text-corpo text-tinta-suave">
          O vínculo com {nomeOrg ?? "a organização"} existe, mas o sincronizador ainda não trouxe uso dela. Ele roda em segundo plano;
          os números aparecem aqui assim que a primeira leitura terminar.
        </p>
      </div>
    </section>
  );
}

function ErroDeUso({ mensagem, aoTentar }: { mensagem: string; aoTentar?: () => void }) {
  return (
    <section role="alert" className={`${CARTAO} flex flex-col items-start gap-3 p-6`}>
      <AlertTriangle aria-hidden className="size-5 text-[var(--onface-coral-texto)]" />
      <div>
        <h3 className="text-item font-semibold text-tinta">Não foi possível ler o uso da Callface AI</h3>
        <p className="mt-1 max-w-[68ch] text-corpo text-tinta-suave">{mensagem}</p>
      </div>
      {aoTentar ? <Button size="sm" variant="outline" onClick={aoTentar}><RefreshCw /> Tentar de novo</Button> : null}
    </section>
  );
}

export function UsoDoClienteCarregando() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Carregando uso da Callface AI">
      <Skeleton className="h-14 rounded-[var(--radius-card-lg)]" />
      <Skeleton className="h-40 rounded-[var(--radius-card-lg)]" />
      <div className="grid gap-3 desktop:grid-cols-[2fr_1fr]">
        <Skeleton className="h-72 rounded-[var(--radius-card-lg)]" />
        <Skeleton className="h-72 rounded-[var(--radius-card-lg)]" />
      </div>
    </div>
  );
}
