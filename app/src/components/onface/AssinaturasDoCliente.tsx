"use client";

/**
 * Cliente 360 › Assinaturas — alterar a assinatura sem sair do ONFACE
 * (stripe-onface-definicao §3 e §9). Lê o espelho local, mostra a PRÉVIA do
 * Stripe antes de confirmar e grava pelas rotas auditadas de
 * `clientes-assinatura.ts`.
 *
 * É componente do Design System (shadcn de `components/ui`, por token). O
 * markup gerado do Claude Design não tem lugar para estas ações, então elas
 * entram como bloco próprio da tela, não como edição do arquivo gerado.
 */
import * as React from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { variacaoAmigavel } from "@/lib/catalogo/rotulos";

interface ItemAss { itemId: string; priceId: string | null; produto: string | null; variacao?: string | null; quantidade: number; precoUnitario: number | null; intervalo: string | null }
interface FaturaAss { id: string; valor: number; status: string; emitidaEm: string | null; vencimento: string | null; pagaEm: string | null; url: string | null }
interface Ass { faturas: FaturaAss[]; id: string; stripeSubscriptionId: string; status: string; mrr: number | null; renovaEm: string | null; cancelaNoFimDoPeriodo: boolean; itens: ItemAss[] }
interface Preco { stripePriceId: string; variacao: string; valor: string; recorrente: boolean; periodo: string | null }
interface Produto { id: string; nome: string; precos: Preco[] }
interface Previa { direcao: "upgrade" | "downgrade" | "neutra"; efeito: Efeito; efeitoPadrao: Efeito; mrrAntes: number; mrrDepois: number; previa: { totalAgora: number; linhas: { descricao: string; valor: number }[] } | null }

type Efeito = "agora" | "proximo_ciclo";
type Modo = "adicionar_item" | "alterar_quantidade" | "remover_item" | "trocar_price" | "cancelar" | "reativar";
interface Alvo { ass: Ass; modo: Modo; item?: ItemAss }

const brl = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dia = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");
const TITULO: Record<Modo, string> = {
  adicionar_item: "Adicionar produto", alterar_quantidade: "Alterar quantidade", remover_item: "Remover produto",
  trocar_price: "Trocar plano", cancelar: "Cancelar assinatura", reativar: "Reativar assinatura",
};
const ROTULO_FATURA: Record<string, string> = { paga: "Paga", aberta: "Em aberto", falhou: "Falhou", void: "Anulada", uncollectible: "Incobrável" };
const ROTULO_STATUS: Record<string, string> = { active: "Ativa", trialing: "Em teste", past_due: "Em atraso" };

export function AssinaturasDoCliente({ empresaId }: { empresaId: string }) {
  const [lista, setLista] = React.useState<Ass[] | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const [alvo, setAlvo] = React.useState<Alvo | null>(null);
  const [aberta, setAberta] = React.useState(false);
  const [catalogo, setCatalogo] = React.useState<Produto[]>([]);
  // Quando o checkout de expansão manda para cá, a venda de origem vem na URL.
  const [origem, setOrigem] = React.useState<{ negocioId?: string; propostaId?: string }>({});
  const base = `/api/clientes/${empresaId}/assinaturas-stripe`;

  const carregar = React.useCallback(async () => {
    try {
      const r = await fetch(base);
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || "Não deu para ler as assinaturas");
      setLista(d.assinaturas); setErro(null);
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha ao ler as assinaturas"); }
  }, [base]);

  React.useEffect(() => {
    carregar();
    const q = new URLSearchParams(window.location.search);
    setOrigem({ negocioId: q.get("negocio") ?? undefined, propostaId: q.get("proposta") ?? undefined });
    fetch("/api/catalogo-oficial").then((r) => r.json()).then((d) => {
      const prods: Produto[] = (d.familias ?? []).flatMap((f: any) => f.categorias.flatMap((c: any) => c.produtos));
      setCatalogo(prods.map((p) => ({ ...p, precos: p.precos.filter((x) => x.recorrente) })).filter((p) => p.precos.length));
    }).catch(() => {});
  }, [carregar]);

  React.useEffect(() => {
    if (lista?.length && new URLSearchParams(window.location.search).get("alterar-assinatura")) {
      setAberta(true);
      setAlvo((a) => a ?? { ass: lista[0], modo: "adicionar_item" });
    }
  }, [lista]);

  /* A aba abre ANTES do fetch: o navegador só aceita popup que sai direto do clique. */
  const abrirPortal = async () => {
    const aba = window.open("about:blank", "_blank");
    try {
      const r = await fetch(`/api/clientes/${empresaId}/portal-stripe`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d?.url) { aba?.close(); toast.error(d?.error || "Não deu para abrir o portal do Stripe"); return; }
      if (aba) aba.location.href = d.url; else window.open(d.url, "_blank");
    } catch { aba?.close(); toast.error("Não deu para falar com o Stripe agora."); }
  };

  /* Sem assinatura viva (ou sem permissão financeira) não há o que mostrar:
     o botão simplesmente não aparece. */
  if (!lista?.length) return null;

  return (
    <>
    <Button className="fixed right-4 bottom-4 z-40 shadow-lg" onClick={() => setAberta(true)}>Assinaturas</Button>
    <Sheet open={aberta} onOpenChange={setAberta}>
    <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
    <SheetHeader>
      <SheetTitle>Assinaturas no Stripe</SheetTitle>
      <SheetDescription>Alterações valem na assinatura que o cliente já tem; nada de checkout novo.</SheetDescription>
    </SheetHeader>
    <section aria-label="Assinaturas no Stripe" className="flex flex-col gap-3 px-4 pb-4">
      {lista.map((a) => (
        <Card key={a.id}>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              {brl(a.mrr)}<span className="text-xs font-normal text-muted-foreground">MRR</span>
              <Badge variant={a.status === "past_due" ? "danger" : "success"}>{ROTULO_STATUS[a.status] ?? a.status}</Badge>
              {a.cancelaNoFimDoPeriodo && <Badge variant="warning">cancela em {dia(a.renovaEm)}</Badge>}
            </CardTitle>
            <CardDescription>{a.stripeSubscriptionId} · renova em {dia(a.renovaEm)}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <ul className="flex flex-col divide-y">
              {a.itens.map((i) => (
                <li key={i.itemId} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{i.quantidade} × {i.produto ?? "Item sem produto no catálogo"}{i.variacao ? ` · ${i.variacao}` : ""}</span>
                  <span className="text-muted-foreground">{brl(i.precoUnitario)}{i.intervalo === "year" ? "/ano" : i.intervalo === "month" ? "/mês" : ""}</span>
                  <Button size="xs" variant="outline" onClick={() => setAlvo({ ass: a, modo: "alterar_quantidade", item: i })}>Alterar quantidade</Button>
                  <Button size="xs" variant="outline" onClick={() => setAlvo({ ass: a, modo: "trocar_price", item: i })}>Trocar plano</Button>
                  {a.itens.length > 1 && <Button size="xs" variant="subtle" onClick={() => setAlvo({ ass: a, modo: "remover_item", item: i })}>Remover</Button>}
                </li>
              ))}
            </ul>
            {a.faturas.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">Pagamentos</span>
                <ul className="flex flex-col divide-y">
                  {a.faturas.map((f) => (
                    <li key={f.id} className="flex flex-wrap items-center gap-2 py-1.5 text-sm">
                      <span className="flex-1">{dia(f.pagaEm ?? f.vencimento ?? f.emitidaEm)} · {brl(f.valor)}</span>
                      <Badge variant={f.status === "paga" ? "success" : f.status === "falhou" ? "danger" : "warning"}>{ROTULO_FATURA[f.status] ?? f.status}</Badge>
                      {f.url
                        ? <Button size="xs" variant="outline" asChild><a href={f.url} target="_blank" rel="noreferrer">Ver fatura</a></Button>
                        : <span className="text-xs text-muted-foreground">sem link</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setAlvo({ ass: a, modo: "adicionar_item" })}>Adicionar produto</Button>
              {a.cancelaNoFimDoPeriodo
                ? <Button size="sm" variant="tertiary" onClick={() => setAlvo({ ass: a, modo: "reativar" })}>Reativar</Button>
                : <Button size="sm" variant="outline" onClick={() => setAlvo({ ass: a, modo: "cancelar" })}>Cancelar</Button>}
              <Button size="sm" variant="subtle" onClick={abrirPortal}>Abrir portal</Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
    </SheetContent>
    </Sheet>
      {alvo && (
        <DialogoDeAlteracao
          alvo={alvo} base={base} catalogo={catalogo} origem={origem}
          fechar={() => setAlvo(null)} aplicado={() => { setAlvo(null); carregar(); }}
        />
      )}
    </>
  );
}

function DialogoDeAlteracao({ alvo, base, catalogo, origem, fechar, aplicado }: {
  alvo: Alvo; base: string; catalogo: Produto[]; origem: { negocioId?: string; propostaId?: string };
  fechar: () => void; aplicado: () => void;
}) {
  const { ass, modo, item } = alvo;
  const [produtoId, setProdutoId] = React.useState("");
  const [priceId, setPriceId] = React.useState("");
  const [quantidade, setQuantidade] = React.useState(item?.quantidade ?? 1);
  const [quando, setQuando] = React.useState<"fim_periodo" | "agora">("fim_periodo");
  const [efeito, setEfeito] = React.useState<"" | Efeito>(""); // "" = o que a regra manda
  const [excecao, setExcecao] = React.useState(false);
  const [motivo, setMotivo] = React.useState("");
  const [previa, setPrevia] = React.useState<Previa | null>(null);
  const [carregando, setCarregando] = React.useState(false);
  const [enviando, setEnviando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  const produto = catalogo.find((p) => p.id === produtoId);
  const precisaPreco = modo === "adicionar_item" || modo === "trocar_price";
  const sobrescrever = excecao && !!efeito;

  /* A ação que a rota entende — ou null enquanto a modal está incompleta. */
  const acao = React.useMemo(() => {
    switch (modo) {
      case "adicionar_item": return priceId && quantidade >= 1 ? { tipo: modo, priceId, quantidade } : null;
      case "alterar_quantidade": return quantidade >= 1 ? { tipo: modo, itemId: item!.itemId, quantidade } : null;
      case "remover_item": return { tipo: modo, itemId: item!.itemId };
      case "trocar_price": return priceId && quantidade >= 1 ? { tipo: modo, itemId: item!.itemId, novoPriceId: priceId, quantidade } : null;
      case "cancelar": return { tipo: modo, quando };
      case "reativar": return { tipo: modo };
    }
  }, [modo, priceId, quantidade, quando, item]);

  /* Chave estável por intenção: o mesmo pedido (clique duplo, reenvio) leva a
     mesma chave e o Stripe não altera duas vezes. Muda quando o pedido muda, e
     depois de um erro (o Stripe repete o erro para a mesma chave). */
  const chave = React.useRef<{ json: string; valor: string } | null>(null);
  const chaveDe = (json: string) => {
    if (chave.current?.json !== json) chave.current = { json, valor: crypto.randomUUID() };
    return chave.current.valor;
  };

  const corpo = React.useMemo(() => acao && ({
    acao, efeito: efeito || undefined, sobrescrever: sobrescrever || undefined, motivo: motivo.trim() || undefined, ...origem,
  }), [acao, efeito, sobrescrever, motivo, origem]);

  /* Prévia a cada mudança válida: o closer vê o valor ANTES de confirmar. */
  React.useEffect(() => {
    setPrevia(null); setErro(null);
    if (!corpo) return;
    let vivo = true;
    setCarregando(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${base}/${ass.id}/previa`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...corpo, sobrescrever: true }) });
        const d = await r.json();
        if (!vivo) return;
        if (!r.ok) setErro(d?.error || "Não deu para calcular a prévia"); else setPrevia(d);
      } catch { if (vivo) setErro("Não deu para falar com o Stripe agora."); }
      finally { if (vivo) setCarregando(false); }
    }, 350);
    return () => { vivo = false; clearTimeout(t); };
  }, [corpo, base, ass.id]);

  const foraDaRegra = !!efeito && !!previa && efeito !== previa.efeitoPadrao;
  const podeConfirmar = !!corpo && !!previa && !enviando && (!foraDaRegra || (excecao && motivo.trim().length >= 3));

  const confirmar = async () => {
    if (!corpo) return;
    setEnviando(true); setErro(null);
    const body = { ...corpo, sobrescrever: foraDaRegra || undefined, chave: chaveDe(JSON.stringify(corpo)) };
    try {
      const r = await fetch(`${base}/${ass.id}/alterar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) { chave.current = null; setErro(d?.error || "O Stripe recusou a alteração"); return; }
      toast.success(`${TITULO[modo]}: feito. MRR ${brl(d.resultado.mrrAntes)} → ${brl(d.resultado.mrrDepois)}${d.resultado.faturaId ? ` · fatura ${d.resultado.faturaId}` : ""}`);
      aplicado();
    } catch { chave.current = null; setErro("Não deu para falar com o Stripe agora."); }
    finally { setEnviando(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !enviando && fechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{TITULO[modo]}</DialogTitle>
          <DialogDescription>{ass.stripeSubscriptionId}{item ? ` · ${item.produto ?? "Item sem produto no catálogo"}${item.variacao ? ` · ${item.variacao}` : ""}` : ""}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {precisaPreco && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="as-produto">Produto</Label>
                <NativeSelect id="as-produto" className="w-full" value={produtoId} onChange={(e) => { setProdutoId(e.target.value); setPriceId(""); }}>
                  <NativeSelectOption value="">Escolha…</NativeSelectOption>
                  {catalogo.map((p) => <NativeSelectOption key={p.id} value={p.id}>{p.nome}</NativeSelectOption>)}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="as-variacao">Variação</Label>
                <NativeSelect id="as-variacao" className="w-full" disabled={!produto} value={priceId} onChange={(e) => setPriceId(e.target.value)}>
                  <NativeSelectOption value="">Escolha…</NativeSelectOption>
                  {produto?.precos.map((p) => <NativeSelectOption key={p.stripePriceId} value={p.stripePriceId}>{variacaoAmigavel(produto.nome, p.variacao) || p.variacao} · {brl(Number(p.valor))}{p.periodo === "anual" ? "/ano" : "/mês"}</NativeSelectOption>)}
                </NativeSelect>
              </div>
            </>
          )}

          {(precisaPreco || modo === "alterar_quantidade") && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="as-qtd">Quantidade</Label>
              <Input id="as-qtd" type="number" min={1} value={quantidade} onChange={(e) => setQuantidade(Math.max(0, Math.floor(Number(e.target.value) || 0)))} />
            </div>
          )}

          {modo === "cancelar" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="as-quando">Quando</Label>
              <NativeSelect id="as-quando" className="w-full" value={quando} onChange={(e) => { setQuando(e.target.value as typeof quando); setEfeito(e.target.value === "agora" ? "agora" : ""); }}>
                <NativeSelectOption value="fim_periodo">No fim do período (já pago)</NativeSelectOption>
                <NativeSelectOption value="agora">Imediato, sem reembolso (exceção)</NativeSelectOption>
              </NativeSelect>
            </div>
          )}

          {modo !== "cancelar" && modo !== "reativar" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="as-efeito">Efeito</Label>
              <NativeSelect id="as-efeito" className="w-full" value={efeito} onChange={(e) => setEfeito(e.target.value as "" | Efeito)}>
                <NativeSelectOption value="">Pela regra{previa ? ` (${previa.efeitoPadrao === "agora" ? "agora, com pró-rata" : "no próximo ciclo"})` : ""}</NativeSelectOption>
                <NativeSelectOption value="agora">Agora, com pró-rata</NativeSelectOption>
                <NativeSelectOption value="proximo_ciclo">No próximo ciclo</NativeSelectOption>
              </NativeSelect>
            </div>
          )}

          {foraDaRegra && (
            <div className="flex flex-col gap-2 rounded-md border p-3">
              <div className="flex items-center gap-2">
                <Checkbox id="as-excecao" checked={excecao} onCheckedChange={(v) => setExcecao(v === true)} />
                <Label htmlFor="as-excecao">Confirmo a exceção à regra (upgrade imediato, downgrade no próximo ciclo)</Label>
              </div>
              <Input aria-label="Motivo da exceção" placeholder="Motivo (fica no histórico)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </div>
          )}

          {carregando && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner /> Calculando no Stripe…</div>}

          {previa && (
            <Alert variant="info">
              <AlertTitle>
                {previa.direcao === "upgrade" ? "Upgrade" : previa.direcao === "downgrade" ? "Downgrade" : "Sem mudança de valor"} · {previa.efeito === "agora" ? "agora" : "no próximo ciclo"}
              </AlertTitle>
              <AlertDescription>
                <p>MRR {brl(previa.mrrAntes)} → {brl(previa.mrrDepois)}</p>
                {previa.previa
                  ? <p className="font-semibold">Cobra agora: {brl(previa.previa.totalAgora)}</p>
                  : <p>Não gera cobrança agora.</p>}
                {previa.previa?.linhas.map((l, i) => <p key={i} className="text-xs">{l.descricao}: {brl(l.valor)}</p>)}
              </AlertDescription>
            </Alert>
          )}

          {erro && <Alert variant="destructive"><AlertTitle>Não foi possível</AlertTitle><AlertDescription>{erro}</AlertDescription></Alert>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={fechar} disabled={enviando}>Voltar</Button>
          <Button variant={modo === "cancelar" || modo === "remover_item" ? "destructive" : "default"} onClick={confirmar} disabled={!podeConfirmar}>
            {enviando ? <Spinner /> : null} Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
