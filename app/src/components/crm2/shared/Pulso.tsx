"use client";

import { Children, createContext, useContext, type ReactNode } from "react";

/**
 * Peças de "pulso" do CRM2 — a linguagem "faixa escura dominante + satélites
 * em rail + painéis claros" que sustenta o "Revenue Control Room" do
 * DESIGN.md (chrome escuro é contexto, superfície clara é trabalho).
 *
 * Promovido de `financeiro/pecas.tsx` (10/09/2026) pra módulo compartilhado:
 * era a mesma composição que Financeiro já usava, e Propostas precisava dela
 * sem duplicar ~200 linhas ou importar de dentro do módulo Financeiro por
 * acidente de path. `financeiro/pecas.tsx` agora só re-exporta daqui com os
 * nomes antigos (`FinPulso`, `FinStat`, etc.) — nenhum call site das sete
 * abas do Financeiro mudou.
 *
 * Antes disso, a composição era a herdada do MVP: um card branco com número
 * grande, quatro cards brancos equivalentes embaixo, e uma sequência de
 * rótulos de seção soltos com caixas brancas — toda grandeza tinha o mesmo
 * peso, nada conduzia o olho.
 *
 * A faixa declara `data-cf2-superficie="escura"`: sem isso os tokens de alerta
 * (`--cf2-danger-text` #b91c1c, `--cf2-accent` seaweed-700) chegariam com os
 * valores calibrados pra fundo branco e dariam ~2,8:1 sobre #111827. O escopo
 * existe no `globals.css` justamente pra isso.
 */

export type Tom = "ok" | "atencao" | "critico" | "dinheiro" | "info" | "neutro";

const COR: Record<Tom, string> = {
  ok: "var(--cf2-success-text)",
  atencao: "var(--cf2-warning-text)",
  critico: "var(--cf2-danger-text)",
  dinheiro: "var(--cf2-accent)",
  info: "#0369a1",
  neutro: "var(--cf2-text-primary)",
};

/**
 * Dentro da faixa escura os tons de alerta já vêm reescritos pelo escopo
 * `[data-cf2-superficie="escura"]`. O que NÃO vem é `info` (hex fixo, pensado
 * pra fundo claro) e `neutro` (`--cf2-text-primary` fica de fora do escopo de
 * propósito, porque é usado em elementos claros aninhados).
 */
const COR_INVERSA: Record<Tom, string> = {
  ...COR,
  info: "#7dd3fc",
  neutro: "var(--cf2-text-on-inverse)",
};

/** Cor de PREENCHIMENTO (barra, coluna de gráfico) — não precisa passar em 4.5:1. */
export const COR_FILL: Record<Tom, string> = {
  ok: "#22c55e",
  atencao: "#f59e0b",
  critico: "#ef4444",
  dinheiro: "var(--cf2-accent)",
  info: "#0ea5e9",
  neutro: "var(--cf2-border-default)",
};

/** Apoio sobre fundo escuro. `color-mix` mantém o tom ligado ao token. */
const APOIO_INVERSO = "color-mix(in srgb, var(--cf2-text-on-inverse) 62%, transparent)";
const ROTULO_INVERSO = "color-mix(in srgb, var(--cf2-text-on-inverse) 56%, transparent)";

/**
 * Um `FinStat` renderizado dentro de `FinPulso` é célula de rail, não card.
 * O contexto evita ter que passar `escuro` em cada uma das ~20 chamadas
 * espalhadas pelas abas.
 */
const NoPulso = createContext(false);

/**
 * Quantos satélites por linha de `md` até `xl`. Classes literais porque o
 * Tailwind varre o código-fonte: `md:grid-cols-${n}` não existiria no CSS
 * gerado. Com 3 satélites numa grade de 4 sobrava uma célula vazia com fio
 * pendurado.
 */
const SATELITES_MD: Record<number, string> = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
  5: "md:grid-cols-5",
};

/**
 * Fios entre satélites, resolvidos por índice em vez de por seletor.
 *
 * A primeira tentativa desenhou isso com variantes de grupo
 * (`[&>*:nth-child(odd)]:border-l-0` mais `md:[&>*]:border-l`) e os fios
 * saíram alternados no browser: `:nth-child()` soma especificidade, então a
 * regra base vencia o override de `md:` independentemente da ordem no CSS.
 * Com o índice em mão cada célula recebe UMA classe de borda e não há cascata
 * pra perder.
 *
 * Em duas colunas (mobile) o fio à esquerda é só do satélite ímpar, e o fio
 * acima só a partir da segunda linha. De `md` pra cima tudo vira uma linha, e
 * aí todo satélite tem fio à esquerda menos o primeiro — ali seria um traço
 * solto na borda do container.
 */
function bordasSatelite(i: number): string {
  const acima = i >= 2 ? "border-t md:border-t-0" : "";
  const esquerda = i === 0 ? "" : i % 2 === 1 ? "border-l" : "md:border-l";
  return `${acima} ${esquerda}`.trim();
}

export function FinStat({
  label, valor, sub, tom = "neutro", destaque = false,
}: { label: string; valor: ReactNode; sub?: ReactNode; tom?: Tom; destaque?: boolean }) {
  const noPulso = useContext(NoPulso);

  if (noPulso) {
    return (
      <div className="min-w-0 px-4 py-4 sm:px-5">
        <p
          className="text-[10px] font-bold uppercase tracking-[0.08em]"
          style={{ color: ROTULO_INVERSO }}
          title={typeof label === "string" ? label : undefined}
        >
          {label}
        </p>
        <p
          className="mt-2 text-[20px] font-bold leading-none tabular-nums truncate"
          style={{ color: COR_INVERSA[tom], fontFamily: "var(--cf2-font-heading)" }}
        >
          {valor}
        </p>
        {sub && (
          <p className="mt-2 text-[11px] leading-snug" style={{ color: APOIO_INVERSO }}>
            {sub}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className="rounded-[var(--cf2-radius-lg)] p-3.5 flex flex-col gap-1 min-w-0"
      style={{
        background: destaque ? "var(--cf2-bg-surface-muted)" : "var(--cf2-bg-surface)",
        border: "1px solid var(--cf2-border-default)",
      }}
    >
      <span className="text-[10.5px] font-semibold uppercase truncate" style={{ color: "var(--cf2-text-tertiary)", letterSpacing: "0.5px" }} title={typeof label === "string" ? label : undefined}>
        {label}
      </span>
      <span
        className={destaque ? "text-[26px] font-bold leading-tight" : "text-lg font-semibold leading-tight"}
        style={{ color: COR[tom], fontFamily: "var(--cf2-font-heading)" }}
      >
        {valor}
      </span>
      {sub && <span className="text-[11px] leading-snug" style={{ color: "var(--cf2-text-tertiary)" }}>{sub}</span>}
    </div>
  );
}

/**
 * Faixa de pulso: um sinal dominante e os satélites num rail à direita.
 *
 * Em desktop o dominante ocupa ~1,7fr contra 1fr de cada satélite, então a
 * leitura tem ordem em vez de ser uma grade de iguais. Abaixo de `xl` os
 * satélites descem pra duas colunas e o dominante segue no topo, largura
 * cheia — em 390px isso é uma coluna de sinais, nunca um número comprimido.
 *
 * `rodape` recebe a nota longa (procedência do número, divergência de base)
 * que antes ia dentro de `sub` e engolia o valor.
 */
export function FinPulso({
  label, valor, titulo, sub, tom = "dinheiro", rodape, acoes, children,
}: {
  label: string;
  valor: ReactNode;
  titulo?: string;
  sub?: ReactNode;
  tom?: Tom;
  rodape?: ReactNode;
  acoes?: ReactNode;
  children?: ReactNode;
}) {
  const satelites = Children.toArray(children);
  return (
    <section
      aria-label={label}
      data-cf2-superficie="escura"
      className="overflow-hidden rounded-[var(--cf2-radius-lg)] shrink-0"
      style={{ background: "var(--cf2-bg-inverse)", color: "var(--cf2-text-on-inverse)" }}
    >
      <div className="grid grid-cols-2 md:grid-cols-3 xl:flex xl:items-stretch">
        <div className="col-span-2 md:col-span-3 min-w-0 px-4 py-5 sm:px-5 xl:flex-[1.7]">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: ROTULO_INVERSO }}>
            {label}
          </p>
          <p
            className="mt-2.5 text-[30px] sm:text-[36px] font-bold leading-none tabular-nums truncate"
            style={{ color: COR_INVERSA[tom], fontFamily: "var(--cf2-font-heading)", letterSpacing: "-1px" }}
            title={titulo}
          >
            {valor}
          </p>
          {sub && (
            <div className="mt-2.5 text-[12px] leading-5" style={{ color: APOIO_INVERSO }}>
              {sub}
            </div>
          )}
          {acoes && <div className="mt-3.5 flex flex-wrap items-center gap-2">{acoes}</div>}
        </div>

        {satelites.length > 0 && (
          <NoPulso.Provider value>
            <div
              className={`col-span-2 grid grid-cols-2 border-t border-white/15 md:col-span-3 md:border-t-0 xl:flex xl:flex-[2.4] xl:border-t-0 ${SATELITES_MD[satelites.length] ?? "md:grid-cols-4"}`}
            >
              {satelites.map((satelite, i) => (
                <div
                  key={i}
                  className={`min-w-0 border-white/15 xl:flex-1 ${bordasSatelite(i)}`}
                >
                  {satelite}
                </div>
              ))}
            </div>
          </NoPulso.Provider>
        )}
      </div>

      {rodape && (
        <div className="border-t border-white/15 px-4 py-3 sm:px-5 text-[11.5px] leading-5" style={{ color: APOIO_INVERSO }}>
          {rodape}
        </div>
      )}
    </section>
  );
}

/**
 * Compatibilidade: as abas Churn e Cobrança chamam `FinHero`. É a faixa de
 * pulso — o nome antigo continua válido pra não reescrever call sites que já
 * estão corretos.
 */
export const FinHero = FinPulso;

export function FinSecao({ children, dica }: { children: ReactNode; dica?: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mt-1">
      <h3 className="text-[11px] font-bold uppercase" style={{ color: "var(--cf2-text-secondary)", letterSpacing: "0.6px" }}>
        {children}
      </h3>
      {dica && <span className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{dica}</span>}
    </div>
  );
}

/**
 * Painel: título, dica e conteúdo num só objeto.
 *
 * Substitui o par `FinSecao` + `FinCaixa`, em que o rótulo flutuava fora da
 * caixa e a relação entre os dois era só proximidade. Com cabeçalho dentro da
 * borda, a seção passa a ter limite visível — o que importa quando a página
 * tem seis blocos de dinheiro empilhados.
 */
export function FinPainel({
  titulo, dica, acao, children, className = "", corpoClassName = "",
}: {
  titulo: string;
  dica?: string;
  acao?: ReactNode;
  children: ReactNode;
  className?: string;
  corpoClassName?: string;
}) {
  return (
    <section
      className={`flex flex-col min-w-0 overflow-hidden rounded-[var(--cf2-radius-lg)] ${className}`}
      style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}
    >
      <header
        className="flex items-start justify-between gap-3 px-4 py-3 shrink-0"
        style={{ borderBottom: "1px solid var(--cf2-border-default)" }}
      >
        <div className="min-w-0">
          <h3 className="text-[13px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{titulo}</h3>
          {dica && <p className="mt-0.5 text-[11px] leading-snug" style={{ color: "var(--cf2-text-tertiary)" }}>{dica}</p>}
        </div>
        {acao && <div className="shrink-0">{acao}</div>}
      </header>
      <div className={`min-w-0 ${corpoClassName}`}>{children}</div>
    </section>
  );
}

export function FinBarra({
  label, valor, max, direita, extra, tom = "neutro",
}: { label: string; valor: number; max: number; direita: ReactNode; extra?: ReactNode; tom?: Tom }) {
  const pct = max > 0 ? Math.max(valor > 0 ? 2 : 0, (valor / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="text-[12px] w-28 shrink-0 truncate" style={{ color: "var(--cf2-text-secondary)" }}>{label}</span>
      <div className="flex-1 h-2 rounded-full overflow-hidden min-w-0" style={{ background: "var(--cf2-bg-surface-muted)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: COR_FILL[tom] }} />
      </div>
      {extra != null && (
        <span className="text-[11px] tabular-nums w-8 text-right shrink-0" style={{ color: "var(--cf2-text-tertiary)" }}>{extra}</span>
      )}
      <span className="text-[12px] tabular-nums font-medium w-28 text-right shrink-0" style={{ color: "var(--cf2-text-primary)" }}>
        {direita}
      </span>
    </div>
  );
}

/**
 * Barra empilhada de composição.
 *
 * Quatro faixas de aging desenhadas como quatro barras independentes obrigam a
 * pessoa a somar de cabeça pra saber quanto do total é recuperável. Uma barra
 * única segmentada responde isso de relance, e a legenda embaixo mantém o
 * valor exato de cada faixa. Fatia com valor zero não entra: um segmento de 0%
 * é ruído de layout.
 */
export function FinBarraEmpilhada({
  fatias, total,
}: { fatias: { chave: string; label: string; valor: number; tom: Tom; nota?: string }[]; total: number }) {
  const visiveis = fatias.filter((f) => f.valor > 0);
  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex h-3 w-full overflow-hidden rounded-full"
        style={{ background: "var(--cf2-bg-surface-muted)" }}
        role="img"
        aria-label={visiveis
          .map((f) => `${f.label}: ${total > 0 ? Math.round((f.valor / total) * 100) : 0}%`)
          .join("; ") || "Sem valores a distribuir"}
      >
        {visiveis.map((f) => (
          <div
            key={f.chave}
            className="h-full transition-all"
            style={{ width: `${total > 0 ? (f.valor / total) * 100 : 0}%`, background: COR_FILL[f.tom] }}
          />
        ))}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-4">
        {fatias.map((f) => (
          <div key={f.chave} className="min-w-0">
            <dt className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--cf2-text-secondary)" }}>
              <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: COR_FILL[f.tom] }} />
              <span className="truncate">{f.label}</span>
            </dt>
            <dd className="mt-1 text-[13.5px] font-semibold tabular-nums truncate" style={{ color: "var(--cf2-text-primary)" }}>
              {f.nota ?? f.valor}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * Par rótulo/valor pra leitura de indicador em lista, no lugar de um card por
 * número. Unit economics são quatro grandezas relacionadas: em lista elas se
 * comparam; em quatro cards iguais, não.
 */
export function FinIndicador({
  label, valor, sub, tom = "neutro",
}: { label: string; valor: ReactNode; sub?: ReactNode; tom?: Tom }) {
  return (
    <div
      className="flex items-baseline justify-between gap-3 border-b px-4 py-3 last:border-b-0"
      style={{ borderColor: "var(--cf2-border-default)" }}
    >
      <div className="min-w-0">
        <p className="text-[12.5px] font-medium" style={{ color: "var(--cf2-text-primary)" }}>{label}</p>
        {sub && <p className="mt-0.5 text-[11px] leading-snug" style={{ color: "var(--cf2-text-tertiary)" }}>{sub}</p>}
      </div>
      <p
        className="text-[16px] font-bold tabular-nums whitespace-nowrap shrink-0"
        style={{ color: COR[tom], fontFamily: "var(--cf2-font-heading)" }}
      >
        {valor}
      </p>
    </div>
  );
}

/** Container branco padrão das listas e tabelas do módulo. */
export function FinCaixa({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[var(--cf2-radius-lg)] overflow-hidden ${className}`}
      style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}
    >
      {children}
    </div>
  );
}

/**
 * Aliases genéricos: mesmas peças, nome sem prefixo de módulo, pra quem
 * consome este arquivo diretamente (Propostas é o primeiro) em vez de por
 * `financeiro/pecas.tsx`. `FinPulso`/`FinStat`/etc. continuam válidos.
 */
export const Cf2Pulso = FinPulso;
export const Cf2PulsoStat = FinStat;
export const Cf2Painel = FinPainel;
export const Cf2Caixa = FinCaixa;
export const Cf2Indicador = FinIndicador;
export const Cf2Barra = FinBarra;
export const Cf2BarraEmpilhada = FinBarraEmpilhada;
export const Cf2Secao = FinSecao;
