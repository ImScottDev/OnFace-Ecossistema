"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Seletor do catálogo do editor de proposta: produto em sanfona, variação dentro.
 *
 * Antes, clicar no produto já criava a linha numa variação qualquer e o
 * vendedor corrigia depois no item. Aqui o produto abre ali mesmo e mostra as
 * variações (nome, valor e recorrência); a escolhida entra com quantidade 1,
 * ajustável no item. Produto de uma variação só entra direto.
 *
 * Componente do Design System (Command + Badge de `components/ui`, por token).
 * O markup gerado da Proposta recebe este bloco pronto em `f1.seletorCatalogo`.
 * Teclado: setas andam, Enter abre o produto ou adiciona a variação, Esc fecha
 * o produto aberto e, depois, limpa a busca.
 * ───────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import { CheckIcon, ChevronDownIcon, PlusIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils/cn";
import { catalogoDoSeletor, type OfertaDoPreco, type PrecoDoDesenho, type ProdutoDoDesenho } from "./catalogo-do-desenho";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: v < 1 ? 4 : 2 });
const sufixo = (pr: PrecoDoDesenho) => (pr.int === "mes" ? "/mês" : pr.int === "ano" ? "/ano" : "");

/**
 * Uma oferta de campanha como escolha ao lado do preço de tabela.
 *
 * Mostra o "de" riscado, o preço da campanha e a condição (ex.: "contrato de
 * 12 meses"), porque é a condição que distingue duas ofertas do mesmo price.
 * O bônus aparece aqui porque é parte do que o vendedor está prometendo.
 */
function LinhaDeOferta({ pr, oferta, onEscolher }: { pr: PrecoDoDesenho; oferta: OfertaDoPreco; onEscolher: () => void }) {
  return (
    <CommandItem
      value={`o:${oferta.id}`}
      onSelect={onEscolher}
      className="group/of ml-3 min-h-11 cursor-pointer flex-wrap gap-x-3 gap-y-1 rounded-md border-l-2 border-border px-2.5 py-2 pl-2.5"
    >
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge variant="destructive">{oferta.campanhaNome}</Badge>
          {oferta.condicao ? <span className="text-xs font-medium text-foreground">{oferta.condicao}</span> : null}
        </span>
        {oferta.bonusDescricao ? (
          <span className="mt-1 block text-xs leading-snug text-muted-foreground">Inclui: {oferta.bonusDescricao}</span>
        ) : null}
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-xs tabular-nums text-muted-foreground line-through">{brl(oferta.de)}</span>
        <span className="block text-sm font-semibold tabular-nums text-foreground">
          {brl(oferta.valor)}{sufixo(pr)}
        </span>
      </span>
      <span className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-border px-2 text-xs font-semibold text-foreground group-data-[selected=true]/of:border-foreground">
        <PlusIcon className="size-3.5" aria-hidden />
        Adicionar
      </span>
    </CommandItem>
  );
}

function Recorrencia({ p, pr }: { p: ProdutoDoDesenho; pr: PrecoDoDesenho }) {
  if (pr.int !== "avulso") return <Badge variant="success">{pr.int === "ano" ? "Recorrente · anual" : "Recorrente · mensal"}</Badge>;
  return <Badge variant="outline">{p.tipo === "setup" ? "Setup · cobrança única" : "Avulso · cobrança única"}</Badge>;
}

export function SeletorCatalogo({ familia, produtos, noProposta, onAdicionar }: {
  /** "PABX", "Callface AI"…: a proposta só vende a família da oportunidade. */
  familia: string;
  produtos: ProdutoDoDesenho[];
  /** Quantas linhas da proposta já usam cada Price (id do preço → linhas). */
  noProposta: Record<string, number>;
  /** `ofertaId` presente = a linha nasce sob uma campanha promocional. */
  onAdicionar: (produtoId: string, precoId: string, ofertaId?: string | null) => void;
}) {
  const [busca, setBusca] = React.useState("");
  const [abertoId, setAbertoId] = React.useState<string | null>(null);
  const [selecionado, setSelecionado] = React.useState("");
  const grupos = React.useMemo(() => catalogoDoSeletor(produtos, busca, abertoId), [produtos, busca, abertoId]);

  const alternar = (p: ProdutoDoDesenho) => {
    /* Preço único SEM oferta entra direto, como sempre. Com oferta, abre: há
       uma escolha real a fazer (tabela ou campanha) e adicionar por tabela em
       silêncio durante a Black é o erro caro aqui. */
    if (p.precos.length === 1 && !(p.precos[0].ofertas?.length)) return onAdicionar(p.id, p.precos[0].id);
    if (busca.trim()) return;
    setAbertoId((a) => (a === p.id ? null : p.id));
    setSelecionado(`p:${p.id}`);
  };

  const teclas = (e: React.KeyboardEvent) => {
    if (e.key !== "Escape") return;
    if (abertoId && !busca.trim()) { e.preventDefault(); e.stopPropagation(); setSelecionado(`p:${abertoId}`); setAbertoId(null); }
    else if (busca) { e.preventDefault(); e.stopPropagation(); setBusca(""); }
  };

  if (!produtos.length) {
    return (
      <p className="border-t border-border px-4 py-6 text-center text-sm text-muted-foreground">
        Nenhum produto de {familia} disponível no catálogo agora. Quando o catálogo do Stripe sincronizar, eles aparecem aqui.
      </p>
    );
  }

  return (
    <Command
      shouldFilter={false}
      loop
      value={selecionado}
      onValueChange={setSelecionado}
      onKeyDown={teclas}
      label={`Catálogo de ${familia}`}
      className="rounded-none border-t border-border bg-card text-foreground"
    >
      <CommandInput
        value={busca}
        onValueChange={setBusca}
        placeholder={`Buscar produto ou variação de ${familia}`}
        aria-label={`Buscar no catálogo de ${familia}`}
      />
      <CommandList className="max-h-[min(480px,60vh)] overscroll-contain">
        <CommandEmpty className="px-4 py-6 text-center text-sm text-muted-foreground">
          Nada encontrado para “{busca.trim()}”. Tente o nome do produto ou parte da variação.
        </CommandEmpty>
        {grupos.map((g) => (
          <CommandGroup key={g.titulo} heading={g.titulo} className="p-1.5">
            {g.produtos.map(({ produto: p, precos, aberto }) => {
              const unico = p.precos.length === 1 && !p.precos.some((x) => x.ofertas?.length);
              const linhas = p.precos.reduce((s, x) => s + (noProposta[x.id] ?? 0), 0);
              const menor = p.precos.reduce((a, x) => (x.v < a.v ? x : a), p.precos[0]);
              return (
                <React.Fragment key={p.id}>
                  <CommandItem
                    value={`p:${p.id}`}
                    onSelect={() => alternar(p)}
                    aria-expanded={unico ? undefined : aberto}
                    className="min-h-14 cursor-pointer items-start gap-3 rounded-md px-2.5 py-2.5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">{p.nome}</span>
                      {p.desc ? <span className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">{p.desc}</span> : null}
                      {linhas > 0 ? (
                        <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[var(--cf2-success-text)]">
                          <CheckIcon className="size-3" aria-hidden />
                          {linhas === 1 ? "1 item na proposta" : `${linhas} itens na proposta`}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1 text-right">
                      {unico ? (
                        <>
                          <span className="text-sm font-semibold tabular-nums text-foreground">{brl(menor.v)}{sufixo(menor)}</span>
                          <Recorrencia p={p} pr={menor} />
                        </>
                      ) : (
                        <>
                          <span className="text-xs font-medium text-foreground">{p.precos.length} variações</span>
                          <span className="text-xs tabular-nums text-muted-foreground">a partir de {brl(menor.v)}</span>
                        </>
                      )}
                    </span>
                    {unico ? (
                      <PlusIcon className="mt-0.5 size-4" aria-hidden />
                    ) : (
                      <ChevronDownIcon className={cn("mt-0.5 size-4 transition-transform motion-reduce:transition-none", aberto && "rotate-180")} aria-hidden />
                    )}
                    <span className="sr-only">{unico ? "Adicionar à proposta" : aberto ? "Fechar variações" : "Ver variações"}</span>
                  </CommandItem>

                  {aberto && !unico ? (
                    <div role="presentation" className="mb-1 ml-3 border-l border-border pl-2">
                      {precos.map((pr) => {
                        const n = noProposta[pr.id] ?? 0;
                        const ofertas = pr.ofertas ?? [];
                        return (
                          <React.Fragment key={pr.id}>
                            <CommandItem
                              value={`v:${pr.id}`}
                              onSelect={() => onAdicionar(p.id, pr.id)}
                              className="group/var min-h-11 cursor-pointer flex-wrap gap-x-3 gap-y-1 rounded-md px-2.5 py-2"
                            >
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-medium text-foreground [overflow-wrap:anywhere]">{pr.variacao || pr.d}</span>
                                <span className="mt-1 flex flex-wrap items-center gap-1.5">
                                  <Recorrencia p={p} pr={pr} />
                                  {n > 0 ? <span className="text-xs text-muted-foreground">{n === 1 ? "1 na proposta" : `${n} na proposta`}</span> : null}
                                </span>
                              </span>
                              <span className="shrink-0 text-right">
                                {ofertas.length ? (
                                  <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Tabela</span>
                                ) : null}
                                <span className="block text-sm font-semibold tabular-nums text-foreground">{brl(pr.v)}{sufixo(pr)}</span>
                              </span>
                              <span className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-border px-2 text-xs font-semibold text-foreground group-data-[selected=true]/var:border-foreground">
                                <PlusIcon className="size-3.5" aria-hidden />
                                Adicionar
                              </span>
                            </CommandItem>
                            {/* As ofertas desta variação vêm logo abaixo dela, recuadas:
                                o vendedor compara tabela e campanha sem procurar na lista.
                                Antes elas caíam todas no fim, soltas do preço de origem. */}
                            {ofertas.map((of) => (
                              <LinhaDeOferta key={of.id} pr={pr} oferta={of} onEscolher={() => onAdicionar(p.id, pr.id, of.id)} />
                            ))}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  ) : null}
                </React.Fragment>
              );
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </Command>
  );
}
