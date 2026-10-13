"use client";

/**
 * Clientes › Uso da Callface AI — a carteira lida pelo uso do produto.
 *
 * Duas filas, uma tela:
 *  - CARTEIRA: cada cliente vinculado com minutos de 30 dias, tendência,
 *    usuários e última atividade. Os flags no topo (inativo, queda, perto do
 *    limite, sem uso) são o recorte, no padrão de `PaginaResumo` do Risco: o
 *    número que acusa é o filtro que resolve. Risco vem antes de expansão na
 *    ordem padrão porque perder a conta custa mais que adiar o upgrade.
 *  - VÍNCULOS PENDENTES: a fila para uma pessoa dizer "este cliente é esta
 *    organização", com a evidência ao lado, confirmando ou recusando em lote.
 *    Sem essa fila a carteira acima fica incompleta em silêncio.
 *
 * A linha abre o Cliente 360 direto na aba de uso.
 */

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, Check, Link2, Search } from "lucide-react";
import { toast } from "sonner";
import { PaginaResumo } from "@/components/onface/shell/Pagina";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { haQuanto, inteiro, pct } from "./formato";
import type { AcoesDeVinculo, FlagUso, ItemCarteiraDeUso, ResultadoVinculo, SeriesDaCarteira, VinculoPendente } from "./tipos";

type FlagDeUso = FlagUso["codigo"];
type LinhaCarteiraDeUso = ItemCarteiraDeUso;
import "@/components/onface/vendas/vendas.css";

const FLAG: Record<FlagDeUso, { rotulo: string; curto: string; badge: "danger" | "warning" | "info"; porque: string; peso: number }> = {
  sem_uso_desde_a_contratacao: { rotulo: "Sem uso desde a contratação", curto: "Sem uso", badge: "danger", peso: 4, porque: "Contratou e nunca ligou. Onboarding travado ou venda que não pegou." },
  inativo_14d: { rotulo: "Inativos há mais de 14 dias", curto: "Inativo", badge: "danger", peso: 3, porque: "Sem nenhuma atividade há mais de 14 dias. Ligar antes de virar cancelamento." },
  queda_40: { rotulo: "Queda acima de 40%", curto: "Queda", badge: "warning", peso: 2, porque: "Minutos dos últimos 30 dias mais de 40% abaixo dos 30 anteriores." },
  perto_do_limite: { rotulo: "Perto do limite do plano", curto: "Perto do limite", badge: "info", peso: 1, porque: "Usaram 85% ou mais dos minutos ou das licenças contratadas. Conversa de upgrade." },
};
const ORDEM_FLAGS: FlagDeUso[] = ["inativo_14d", "queda_40", "perto_do_limite", "sem_uso_desde_a_contratacao"];

type Coluna = "risco" | "nome" | "minutos" | "tendencia" | "usuarios" | "ultima";
const ROTULO_COLUNA: Record<Coluna, string> = {
  risco: "Risco primeiro", nome: "Nome", minutos: "Minutos 30d", tendencia: "Tendência", usuarios: "Usuários ativos", ultima: "Última atividade",
};
const PASSO = 50;

const temFlag = (l: LinhaCarteiraDeUso, f: FlagDeUso) => l.flags.some((x) => x.codigo === f);
const pesoDeRisco = (l: LinhaCarteiraDeUso) => l.flags.reduce((a, f) => a + FLAG[f.codigo].peso * 10 + (f.gravidade === "risco" ? 5 : 0), 0) - (l.tendenciaPct ?? 0) / 100;

export type PropsUsoCarteira = {
  carteira: LinhaCarteiraDeUso[];
  pendentes: VinculoPendente[];
  series?: SeriesDaCarteira;
  acoes?: AcoesDeVinculo;
  erro?: string | null;
  abaInicial?: string;
  agora?: Date;
};

export function UsoCarteiraWorkspace({ carteira, pendentes, series, acoes, erro, abaInicial, agora }: PropsUsoCarteira) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [aba, setAba] = React.useState<"carteira" | "vinculos">(abaInicial === "vinculos" ? "vinculos" : "carteira");
  const trocarAba = (a: typeof aba) => {
    setAba(a);
    const q = new URLSearchParams(params?.toString());
    if (a === "vinculos") q.set("aba", "vinculos"); else q.delete("aba");
    router.replace(`${pathname}${q.size ? "?" + q : ""}`, { scroll: false });
  };

  const contagem = React.useMemo(() => {
    const c: Record<FlagDeUso, number> = { inativo_14d: 0, queda_40: 0, perto_do_limite: 0, sem_uso_desde_a_contratacao: 0 };
    for (const l of carteira) for (const f of l.flags) c[f.codigo]++;
    return c;
  }, [carteira]);

  return (
    <>
      <div className="ov-controles">
        <div className="ov-abas" role="tablist" aria-label="Fila">
          <button type="button" role="tab" aria-selected={aba === "carteira"} data-ativa={aba === "carteira"} onClick={() => trocarAba("carteira")}>
            Carteira · {carteira.length}
          </button>
          <button type="button" role="tab" aria-selected={aba === "vinculos"} data-ativa={aba === "vinculos"} onClick={() => trocarAba("vinculos")}>
            Vínculos pendentes · {pendentes.length}
          </button>
        </div>
      </div>
      {aba === "carteira"
        ? erro ? <ErroDaCarteira mensagem={erro} /> : <Carteira carteira={carteira} series={series} contagem={contagem} pendentes={pendentes.length} irParaVinculos={() => trocarAba("vinculos")} agora={agora} />
        : <FilaDeVinculos pendentes={pendentes} acoes={acoes} aoMudar={() => router.refresh()} />}
    </>
  );
}

/* ── Carteira ──────────────────────────────────────────────────────────── */

function Carteira({ carteira, series, contagem, pendentes, irParaVinculos, agora }: {
  carteira: LinhaCarteiraDeUso[]; series?: SeriesDaCarteira; contagem: Record<FlagDeUso, number>; pendentes: number; irParaVinculos: () => void; agora?: Date;
}) {
  const [flag, setFlag] = React.useState<FlagDeUso | null>(null);
  const [busca, setBusca] = React.useState("");
  const [ordem, setOrdem] = React.useState<{ col: Coluna; desc: boolean }>({ col: "risco", desc: true });
  const [limite, setLimite] = React.useState(PASSO);

  const linhas = React.useMemo(() => {
    const q = busca.trim().toLowerCase();
    const f = carteira.filter((l) => (!flag || temFlag(l, flag)) &&
      (!q || l.empresaNome.toLowerCase().includes(q) || (l.plano ?? "").toLowerCase().includes(q)));
    const chave: Record<Coluna, (l: LinhaCarteiraDeUso) => number | string> = {
      risco: pesoDeRisco, nome: (l) => l.empresaNome.toLowerCase(), minutos: (l) => l.minutos30d,
      tendencia: (l) => l.tendenciaPct ?? -Infinity, usuarios: (l) => l.usuariosAtivos30d,
      ultima: (l) => (l.ultimaAtividadeEm ? new Date(l.ultimaAtividadeEm).getTime() : 0),
    };
    const k = chave[ordem.col];
    return [...f].sort((a, b) => {
      const x = k(a), y = k(b);
      const r = x < y ? -1 : x > y ? 1 : 0;
      return ordem.desc ? -r : r;
    });
  }, [carteira, flag, busca, ordem]);

  const minutosTotal = carteira.reduce((a, l) => a + l.minutos30d, 0);
  const alternar = (f: FlagDeUso) => { setFlag(flag === f ? null : f); setLimite(PASSO); };
  const ordenar = (col: Coluna) => setOrdem((o) => ({ col, desc: o.col === col ? !o.desc : col !== "nome" }));

  if (carteira.length === 0) {
    return (
      <section className="flex flex-col items-start gap-3 rounded-card bg-superficie p-6 shadow-[inset_0_0_0_1px_var(--line-hairline)]">
        <p className="text-corpo font-semibold text-tinta">Nenhum cliente vinculado a uma organização da Callface AI ainda.</p>
        <p className="max-w-[68ch] text-apoio text-tinta-suave">
          O uso aparece aqui quando o cliente do ONFACE está ligado à organização dele no SaaS. Vínculos com evidência forte entram
          sozinhos; os outros esperam uma pessoa confirmar.
        </p>
        {pendentes > 0 ? <Button size="sm" onClick={irParaVinculos}><Link2 /> Revisar {pendentes} {pendentes === 1 ? "vínculo pendente" : "vínculos pendentes"}</Button> : null}
      </section>
    );
  }

  return (
    <>
      <PaginaResumo
        itens={[
          { rotulo: "Clientes vinculados", valor: inteiro(carteira.length), detalhe: `${inteiro(minutosTotal)} min em 30 dias`,
            aoSelecionar: () => { setFlag(null); setLimite(PASSO); }, ativo: flag === null },
          ...ORDEM_FLAGS.map((f, i) => ({
            rotulo: FLAG[f].curto, valor: contagem[f], detalhe: FLAG[f].rotulo.toLowerCase(),
            destaque: i === 0, sinal: f !== "perto_do_limite", aoSelecionar: () => alternar(f), ativo: flag === f,
          })),
        ]}
      />
      {flag ? <p className="onface-pagina-descricao" style={{ margin: "-6px 0 14px" }}>{FLAG[flag].porque}</p> : null}

      <section aria-label="Carteira por uso" className="overflow-hidden rounded-card bg-superficie shadow-[inset_0_0_0_1px_var(--line-hairline)]">
        <header className="flex flex-wrap items-center gap-3 border-b border-linha px-4 py-3">
          <p className="text-apoio font-semibold text-tinta" aria-live="polite">
            {linhas.length} {linhas.length === 1 ? "cliente" : "clientes"}
          </p>
          {flag || busca ? (
            <button type="button" className="text-apoio text-tinta-suave underline-offset-2 hover:underline"
              onClick={() => { setFlag(null); setBusca(""); setLimite(PASSO); }}>Limpar recorte</button>
          ) : null}
          <label className="ov-busca ml-auto" style={{ maxWidth: 260 }}>
            <Search aria-hidden />
            <input type="search" placeholder="Buscar cliente ou plano" aria-label="Buscar cliente ou plano"
              value={busca} onChange={(e) => { setBusca(e.target.value); setLimite(PASSO); }} />
          </label>
          <div className="desktop:hidden">
            <NativeSelect size="sm" aria-label="Ordenar por" value={ordem.col}
              onChange={(e) => setOrdem({ col: e.target.value as Coluna, desc: e.target.value !== "nome" })}>
              {(Object.keys(ROTULO_COLUNA) as Coluna[]).map((c) => <NativeSelectOption key={c} value={c}>{ROTULO_COLUNA[c]}</NativeSelectOption>)}
            </NativeSelect>
          </div>
        </header>

        <div role="table" aria-label="Clientes por uso">
          <div role="row" className="hidden grid-cols-[minmax(0,1.6fr)_96px_110px_90px_96px_120px_minmax(0,1fr)] items-center gap-3 border-b border-linha px-4 py-2 desktop:grid">
            <Cabeca col="nome" ordem={ordem} aoOrdenar={ordenar}>Cliente</Cabeca>
            <span role="columnheader" className="text-micro font-semibold text-tinta-suave">30 dias</span>
            <Cabeca col="minutos" ordem={ordem} aoOrdenar={ordenar} direita>Minutos</Cabeca>
            <Cabeca col="tendencia" ordem={ordem} aoOrdenar={ordenar} direita>Tendência</Cabeca>
            <Cabeca col="usuarios" ordem={ordem} aoOrdenar={ordenar} direita>Usuários</Cabeca>
            <Cabeca col="ultima" ordem={ordem} aoOrdenar={ordenar}>Última atividade</Cabeca>
            <Cabeca col="risco" ordem={ordem} aoOrdenar={ordenar}>Sinais</Cabeca>
          </div>
          {linhas.length === 0 ? (
            <div className="px-4 py-8">
              <p className="text-corpo font-semibold text-tinta">Nenhum cliente neste recorte.</p>
              <p className="mt-1 text-apoio text-tinta-suave">{flag ? "Boa notícia para este sinal. " : ""}Troque o filtro ou limpe o recorte.</p>
            </div>
          ) : linhas.slice(0, limite).map((l) => <LinhaDeUso key={l.empresaId} l={l} serie={series?.[l.empresaId]} agora={agora} />)}
        </div>

        {linhas.length > limite ? (
          <div className="border-t border-linha px-4 py-3">
            <Button size="sm" variant="outline" onClick={() => setLimite((n) => n + PASSO)}>
              Mostrar mais {Math.min(PASSO, linhas.length - limite)} de {linhas.length - limite}
            </Button>
          </div>
        ) : null}
      </section>
    </>
  );
}

function Cabeca({ col, ordem, aoOrdenar, direita, children }: {
  col: Coluna; ordem: { col: Coluna; desc: boolean }; aoOrdenar: (c: Coluna) => void; direita?: boolean; children: React.ReactNode;
}) {
  const ativa = ordem.col === col;
  const Seta = ordem.desc ? ArrowDown : ArrowUp;
  return (
    <span role="columnheader" aria-sort={ativa ? (ordem.desc ? "descending" : "ascending") : "none"} className={direita ? "text-right" : ""}>
      <button type="button" onClick={() => aoOrdenar(col)}
        className={`inline-flex items-center gap-1 text-micro font-semibold hover:text-tinta ${ativa ? "text-tinta" : "text-tinta-suave"}`}>
        {children}{ativa ? <Seta aria-hidden className="size-3" /> : null}
      </button>
    </span>
  );
}

function LinhaDeUso({ l, serie, agora }: { l: LinhaCarteiraDeUso; serie?: number[]; agora?: Date }) {
  const queda = l.tendenciaPct != null && l.tendenciaPct <= -40;
  const velho = l.idadeDadoHoras != null && l.idadeDadoHoras > 24;
  return (
    <Link role="row" href={`/clientes/${l.empresaId}?aba=uso`}
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-linha px-4 py-3 transition-colors last:border-b-0 hover:bg-superficie-alt focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--ring)] desktop:grid-cols-[minmax(0,1.6fr)_96px_110px_90px_96px_120px_minmax(0,1fr)]">
      <span role="cell" className="min-w-0">
        <span className="block truncate text-corpo font-semibold text-tinta">{l.empresaNome}</span>
        <span className="block truncate text-apoio text-tinta-suave">
          {l.plano ? `Plano ${l.plano}` : "plano não informado"}
          {l.percentualMinutos != null ? ` · ${inteiro(l.percentualMinutos)}% dos minutos` : ""}
          {velho ? ` · dado de ${haQuanto(new Date(Date.now() - l.idadeDadoHoras! * 3600e3).toISOString())}` : ""}
        </span>
      </span>
      <span role="cell" className="hidden desktop:block"><MiniSerie serie={serie} rotulo={`Minutos por dia de ${l.empresaNome}, últimos 30 dias`} /></span>
      <span role="cell" className="text-right text-corpo font-semibold tabular-nums text-tinta">
        {inteiro(l.minutos30d)}<span className="font-normal text-tinta-suave"> min</span>
      </span>
      <span role="cell" className={`hidden text-right text-apoio font-semibold tabular-nums desktop:block ${queda ? "text-[var(--onface-coral-texto)]" : "text-tinta-suave"}`}>
        {l.tendenciaPct == null ? "sem base" : pct(l.tendenciaPct)}
      </span>
      <span role="cell" className="hidden text-right text-apoio tabular-nums text-tinta-suave desktop:block">
        <strong className="text-tinta">{l.usuariosAtivos30d}</strong>{l.licencasContratadas ? `/${l.licencasContratadas}` : ""}
      </span>
      <span role="cell" className="text-apoio text-tinta-suave desktop:col-auto" suppressHydrationWarning>
        {haQuanto(l.ultimaAtividadeEm, agora)}
        <span className="desktop:hidden">{l.tendenciaPct != null ? ` · ${pct(l.tendenciaPct)}` : ""}</span>
      </span>
      <span role="cell" className="col-span-2 flex flex-wrap gap-1 desktop:col-span-1">
        {l.flags.length === 0
          ? <span className="text-micro text-tinta-suave">—</span>
          : [...l.flags].sort((a, b) => FLAG[b.codigo].peso - FLAG[a.codigo].peso).map((f) => (
            <Badge key={f.codigo} variant={FLAG[f.codigo].badge} title={f.detalhe}>{FLAG[f.codigo].curto}</Badge>
          ))}
      </span>
    </Link>
  );
}

/** Minissérie: forma do uso em 30 dias, sem eixo — o número está ao lado. */
function MiniSerie({ serie, rotulo }: { serie?: number[]; rotulo: string }) {
  if (!serie || serie.length < 2) return <span className="text-micro text-tinta-suave">—</span>;
  const max = Math.max(1, ...serie);
  const w = 88, h = 24;
  const pts = serie.map((v, i) => `${(i / (serie.length - 1)) * w},${h - 2 - (v / max) * (h - 4)}`).join(" ");
  return (
    <svg role="img" aria-label={rotulo} viewBox={`0 0 ${w} ${h}`} className="h-6 w-22 overflow-visible">
      <polyline points={pts} fill="none" stroke="var(--cf2-serie-1)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* ── Fila de vínculos pendentes ────────────────────────────────────────── */

/**
 * Clientes com Callface AI contratada e sem vínculo. Os que têm sugestão vêm
 * primeiro, com a razão e a semelhança ao lado; confirmar em lote aplica a
 * sugestão escolhida de cada linha. Os sem sugestão ficam visíveis — esconder
 * seria fingir que a carteira está completa.
 */
function FilaDeVinculos({ pendentes, acoes, aoMudar }: { pendentes: VinculoPendente[]; acoes?: AcoesDeVinculo; aoMudar: () => void }) {
  const [sel, setSel] = React.useState<Record<string, boolean>>({});
  const [escolha, setEscolha] = React.useState<Record<string, string>>({});
  const [ocupado, setOcupado] = React.useState(false);
  const comSugestao = pendentes.filter((p) => p.sugestoes.length > 0);
  const semSugestao = pendentes.filter((p) => p.sugestoes.length === 0);
  const candidatoDe = (p: VinculoPendente) => escolha[p.empresaId] ?? p.sugestoes[0]?.candidatoId ?? "";
  const marcados = comSugestao.filter((p) => sel[p.empresaId]);
  const todos = comSugestao.length > 0 && marcados.length === comSugestao.length;

  const confirmar = async (itens: VinculoPendente[]) => {
    if (!acoes) return;
    setOcupado(true);
    let ok = 0;
    const erros: string[] = [];
    // Sequencial de propósito: cada confirmação é uma transação auditada.
    for (const p of itens) {
      const r: ResultadoVinculo = await acoes.confirmar({ empresaId: p.empresaId, candidatoId: candidatoDe(p) })
        .catch((e: unknown) => ({ ok: false as const, erro: e instanceof Error ? e.message : "falha" }));
      if (r.ok) ok++; else erros.push(`${p.empresaNome}: ${r.erro}`);
    }
    setOcupado(false);
    setSel({});
    if (ok) toast.success(`${ok} ${ok === 1 ? "vínculo confirmado" : "vínculos confirmados"}`);
    if (erros.length) toast.error(erros.slice(0, 3).join(" · ") + (erros.length > 3 ? ` e mais ${erros.length - 3}` : ""));
    aoMudar();
  };

  if (pendentes.length === 0) {
    return (
      <section className="rounded-card bg-superficie p-6 shadow-[inset_0_0_0_1px_var(--line-hairline)]">
        <p className="text-corpo font-semibold text-tinta">Todo cliente com Callface AI está vinculado.</p>
        <p className="mt-1 max-w-[68ch] text-apoio text-tinta-suave">
          Quando entrar um cliente novo, ou o sincronizador achar uma organização parecida sem evidência forte o bastante
          para vincular sozinho, ele aparece aqui com a razão.
        </p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {comSugestao.length ? (
        <section aria-label="Vínculos com sugestão" className="overflow-hidden rounded-card bg-superficie shadow-[inset_0_0_0_1px_var(--line-hairline)]">
          <header className="flex flex-wrap items-center gap-3 border-b border-linha px-4 py-3">
            {acoes ? (
              <Checkbox checked={todos ? true : marcados.length ? "indeterminate" : false} aria-label="Selecionar todos"
                onCheckedChange={(v) => setSel(v ? Object.fromEntries(comSugestao.map((p) => [p.empresaId, true])) : {})} />
            ) : null}
            <p className="text-apoio font-semibold text-tinta" aria-live="polite">
              {marcados.length ? `${marcados.length} de ${comSugestao.length} selecionados` : `${comSugestao.length} ${comSugestao.length === 1 ? "cliente com sugestão" : "clientes com sugestão"}`}
            </p>
            {marcados.length && acoes ? (
              <Button size="sm" className="ml-auto" loading={ocupado} onClick={() => confirmar(marcados)}><Check /> Confirmar {marcados.length}</Button>
            ) : (
              <span className="ml-auto text-micro text-tinta-suave">Cada confirmação fica registrada com seu nome e a razão.</span>
            )}
          </header>
          <ul>
            {comSugestao.map((p) => {
              const cand = candidatoDe(p);
              const sug = p.sugestoes.find((s) => s.candidatoId === cand) ?? p.sugestoes[0];
              return (
                <li key={p.empresaId} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 border-b border-linha px-4 py-3 last:border-b-0 desktop:grid-cols-[auto_minmax(0,1fr)_minmax(0,1.5fr)_auto]">
                  {acoes ? (
                    <Checkbox className="mt-1" checked={!!sel[p.empresaId]} aria-label={`Selecionar ${p.empresaNome}`}
                      onCheckedChange={(v) => setSel((s) => ({ ...s, [p.empresaId]: !!v }))} />
                  ) : <span />}
                  <div className="min-w-0">
                    <Link href={`/clientes/${p.empresaId}?aba=uso`} className="block truncate text-corpo font-semibold text-tinta hover:underline">{p.empresaNome}</Link>
                    <span className="block text-micro tabular-nums text-tinta-suave">{p.cnpj ? `CNPJ ${p.cnpj}` : "sem CNPJ no ONFACE"}</span>
                  </div>
                  <div className="col-start-2 min-w-0 desktop:col-start-auto">
                    {p.sugestoes.length > 1 ? (
                      <NativeSelect size="sm" aria-label={`Organização sugerida para ${p.empresaNome}`} value={cand}
                        onChange={(e) => setEscolha((s) => ({ ...s, [p.empresaId]: e.target.value }))}>
                        {p.sugestoes.map((s) => <NativeSelectOption key={s.candidatoId} value={s.candidatoId}>{s.nomeOrg ?? s.orgCallfaceId} · {Math.round(s.score * 100)}%</NativeSelectOption>)}
                      </NativeSelect>
                    ) : <span className="block truncate text-corpo font-semibold text-tinta">{sug.nomeOrg ?? sug.orgCallfaceId}</span>}
                    <span className="mt-0.5 block text-apoio text-tinta-suave">
                      {sug.razao ?? sug.sinal.replace(/_/g, " ")}
                      <span className="tabular-nums"> · {Math.round(sug.score * 100)}% de semelhança</span>
                    </span>
                  </div>
                  {acoes ? (
                    <Button size="sm" variant="outline" className="col-start-2 justify-self-start desktop:col-start-auto" disabled={ocupado}
                      onClick={() => confirmar([p])}>Confirmar</Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {semSugestao.length ? (
        <section aria-label="Sem sugestão" className="overflow-hidden rounded-card bg-superficie shadow-[inset_0_0_0_1px_var(--line-hairline)]">
          <header className="border-b border-linha px-4 py-3">
            <p className="text-apoio font-semibold text-tinta">{semSugestao.length} sem organização parecida</p>
            <p className="text-micro text-tinta-suave">
              Contrataram Callface AI e nada no SaaS bate por CNPJ, domínio ou contato. Confira o CNPJ e os e-mails da empresa no ONFACE;
              a sugestão aparece no próximo sync.
            </p>
          </header>
          <ul className="grid tablet:grid-cols-2 amplo:grid-cols-3">
            {semSugestao.map((p) => (
              <li key={p.empresaId} className="border-b border-linha px-4 py-2.5">
                <Link href={`/clientes/${p.empresaId}`} className="block truncate text-corpo text-tinta hover:underline">{p.empresaNome}</Link>
                <span className="block text-micro tabular-nums text-tinta-suave">{p.cnpj ? `CNPJ ${p.cnpj}` : "sem CNPJ"}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function ErroDaCarteira({ mensagem }: { mensagem: string }) {
  return (
    <section role="alert" className="flex flex-col items-start gap-2 rounded-card bg-superficie p-6 shadow-[inset_0_0_0_1px_var(--line-hairline)]">
      <p className="text-corpo font-semibold text-tinta">Não foi possível ler a carteira de uso.</p>
      <p className="max-w-[68ch] text-apoio text-tinta-suave">{mensagem}</p>
    </section>
  );
}
