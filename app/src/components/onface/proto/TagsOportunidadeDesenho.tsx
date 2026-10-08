"use client";

/* GERADO por scripts/dc-para-tsx.mjs a partir de:
 *   OnFace Tags Oportunidade.dc.html
 *
 * O markup é conversão MECÂNICA do desenho — não foi transcrito à mão, então
 * não há divergência de transcrição para procurar. Reveja a ligação com o
 * dado, não o estilo.
 *
 * Para regerar depois de um desenho novo, rode o conversor de novo e refaça só
 * a ligação. NÃO edite o markup aqui à mão: a próxima geração sobrescreve.
 */

import { Fragment } from "react";
import { Check, ChevronsUpDown, Plus, X, Zap } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { estilo, foco, hover } from "./proto-runtime";


/**
 * O que o desenho consome.
 *
 * Esta é a FRONTEIRA entre o desenho e o produto: o markup acima é intocável
 * (regenerado a cada desenho novo), e tudo que ele precisa entra por aqui.
 * Ligar a tela é preencher este objeto com dado real — e é só isso que há
 * para revisar, porque o resto não foi escrito à mão.
 */
export interface ValoresDeTagsOportunidadeDesenho {
  aberto: any;
  alcance: any;
  aplicar: any;
  auto: any;
  busca: any;
  buscaLimpa: any;
  comEmp: any;
  comPes: any;
  criar: any;
  empCaixa: any;
  empStyle: any;
  empresa: any;
  fechar: any;
  nada: any;
  chipsSel: any;
  opcoes: any;
  dropAberto: any;
  abrirDrop: any;
  fecharDrop: any;
  org: any;
  parar: any;
  pesBox: any;
  pesCaixa: any;
  pesRotulo: any;
  pessoa: any;
  pessoas: any;
  podeCriar: any;
  resumo: any;
  setBusca: any;
  setPessoa: any;
  sub: any;
  tecla: any;
  temAuto: any;
  temEmp: any;
  temOrg: any;
  temPes: any;
  tiposNova: any;
  titulo: any;
  togEmp: any;
  togPes: any;
}

export function TagsOportunidadeDesenho(vals: ValoresDeTagsOportunidadeDesenho) {
  const { abrirDrop, chipsSel, dropAberto, fecharDrop, opcoes, aberto, alcance, aplicar, auto, busca, buscaLimpa, comEmp, comPes, criar, empCaixa, empStyle, empresa, fechar, nada, org, parar, pesBox, pesCaixa, pesRotulo, pessoa, pessoas, podeCriar, resumo, setBusca, setPessoa, sub, tecla, temAuto, temEmp, temOrg, temPes, tiposNova, titulo, togEmp, togPes } = vals;
  return (
    <>
{(aberto) ? (<>
<div data-r="modal-fundo" data-in="fade" onClick={fechar} style={{ position: "fixed", inset: "0", zIndex: "66", background: "rgba(18,23,29,.42)", display: "grid", placeItems: "center", padding: "20px" }}>
<div data-in="pop" onClick={parar} style={{ width: "min(600px,100%)", maxHeight: "calc(100vh - 40px)", display: "flex", flexDirection: "column", background: "#fff", borderRadius: "16px", boxShadow: "0 30px 70px -20px rgba(18,23,29,.5)", overflow: "hidden" }}>
<div style={{ flex: "0 0 auto", padding: "20px 22px 14px", display: "flex", alignItems: "flex-start", gap: "12px" }}>
<span style={{ flex: "0 0 auto", width: "40px", height: "40px", borderRadius: "11px", background: "#fff6f4", color: "#c2330f", display: "grid", placeItems: "center" }}>
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01" />
</svg>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "18px", fontWeight: "700", letterSpacing: "-.02em", color: "#12171d" }}>
{titulo}
</span>
<span style={{ display: "block", marginTop: "2px", fontSize: "13px", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{sub}
</span>
</span>
<button onClick={fechar} title="Fechar" style={{ flex: "0 0 auto", width: "32px", height: "32px", borderRadius: "8px", border: "0", background: "transparent", color: "#67787c", display: "grid", placeItems: "center", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
<path d="M18 6 6 18M6 6l12 12" />
</svg>
</button>
</div>
<div style={{ flex: "1 1 auto", minHeight: "0", overflowY: "auto", padding: "0 22px 18px", display: "flex", flexDirection: "column", gap: "18px" }}>
<div>
<span style={{ display: "block", marginBottom: "8px", fontSize: "11.5px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: "#4a5560" }}>
Aplicar também em
</span>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "8px" }}>
{(temEmp) ? (<>
<button onClick={togEmp} style={estilo(empStyle)}>
<span style={estilo(empCaixa)}>
{(comEmp) ? (<>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 6 9 17l-5-5" />
</svg>
</>) : null}
</span>
<span style={{ flex: "1", minWidth: "0", textAlign: "left" }}>
<span style={{ display: "block", fontSize: "11px", color: "#8b949e" }}>
Empresa
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{empresa}
</span>
</span>
</button>
</>) : null}
{(temPes) ? (<>
<div style={estilo(pesBox)}>
<button onClick={togPes} style={{ flex: "0 0 auto", border: "0", background: "transparent", padding: "0", cursor: "pointer", display: "grid", placeItems: "center" }}>
<span style={estilo(pesCaixa)}>
{(comPes) ? (<>
<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 6 9 17l-5-5" />
</svg>
</>) : null}
</span>
</button>
<label style={{ position: "relative", flex: "1", minWidth: "0", cursor: "pointer" }}>
<span style={{ display: "block", fontSize: "11px", color: "#8b949e" }}>
{pesRotulo}
</span>
<span style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "1px" }}>
<span style={{ flex: "1", minWidth: "0", fontSize: "13px", fontWeight: "600", color: "#12171d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{pessoa}
</span>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="m6 9 6 6 6-6" />
</svg>
</span>
<select value={pessoa} onChange={setPessoa} style={{ position: "absolute", inset: "0", width: "100%", height: "100%", opacity: "0", cursor: "pointer", border: "0" }}>
{(pessoas ?? []).map((op: any, i1: number) => (
<Fragment key={op?.id ?? op?.chave ?? i1}>
<option value={op.v}>
{op.l}
</option>
</Fragment>
))}
</select>
</label>
</div>
</>) : null}
</div>
<span style={{ display: "block", marginTop: "8px", fontSize: "12px", color: "#67787c", lineHeight: "1.5", textWrap: "pretty" }}>
{alcance}
</span>
</div>
<Popover open={!!dropAberto} onOpenChange={(v: boolean) => (v ? abrirDrop() : fecharDrop())}>
<PopoverTrigger asChild>
<div role="combobox" aria-expanded={!!dropAberto} aria-label="Escolher tags" tabIndex={0} className="flex min-h-11 w-full cursor-pointer flex-wrap items-center gap-1.5 rounded-xl bg-background px-2.5 py-2 text-left shadow-[inset_0_0_0_1px_var(--border)] outline-none transition-shadow hover:shadow-[inset_0_0_0_1px_var(--ring)] focus-visible:shadow-[inset_0_0_0_2px_var(--ring)]">
{(chipsSel ?? []).map((c: any, i1: number) => (
<span key={c?.nome ?? i1} className={"inline-flex h-7 items-center gap-1.5 rounded-full pl-2.5 pr-1 text-[12.5px] font-semibold " + (c.auto ? "bg-primary/10 text-primary" : "bg-secondary text-secondary-foreground")}>
{c.auto ? <Zap className="size-3" /> : null}
{c.nome}
<button type="button" aria-label={"Tirar " + c.nome} onClick={(e) => { e.stopPropagation(); c.remover(); }} className="grid size-5 place-items-center rounded-full opacity-70 hover:bg-foreground/10 hover:opacity-100">
<X className="size-3" />
</button>
</span>
))}
{((chipsSel ?? []).length === 0) ? <span className="px-1 text-[13px] text-muted-foreground">Escolher tags…</span> : null}
<ChevronsUpDown className="ml-auto size-4 shrink-0 text-muted-foreground" />
</div>
</PopoverTrigger>
<PopoverContent align="start" sideOffset={6} collisionPadding={16} className="w-(--radix-popover-trigger-width) min-w-72 overflow-hidden p-0">
<Command shouldFilter={false}>
<CommandInput value={busca} onValueChange={(v: string) => setBusca({ target: { value: v } })} placeholder="Buscar ou criar tag" style={{ outline: "none", boxShadow: "none" }} />
<CommandList className="max-h-64">
{(opcoes ?? []).some((o: any) => o.auto) ? (
<CommandGroup heading="Disparam automação">
{(opcoes ?? []).filter((o: any) => o.auto).map((o: any) => (
<CommandItem key={o.nome} value={o.nome} onSelect={o.onClick} className="gap-2.5 py-2">
<span className={"grid size-4 shrink-0 place-items-center rounded-[5px] " + (o.on ? "bg-foreground text-background" : "bg-background shadow-[inset_0_0_0_1.5px_var(--border)]")}>{o.on ? <Check className="size-3" strokeWidth={3.4} /> : null}</span>
<span className="flex-1 truncate font-semibold">{o.nome}</span>
<span className="inline-flex max-w-[55%] items-center gap-1 truncate rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary"><Zap className="size-3 shrink-0" />{o.agente}</span>
</CommandItem>
))}
</CommandGroup>
) : null}
{(opcoes ?? []).some((o: any) => !o.auto) ? (
<CommandGroup heading="Organização">
{(opcoes ?? []).filter((o: any) => !o.auto).map((o: any) => (
<CommandItem key={o.nome} value={o.nome} onSelect={o.onClick} className="gap-2.5 py-2">
<span className={"grid size-4 shrink-0 place-items-center rounded-[5px] " + (o.on ? "bg-foreground text-background" : "bg-background shadow-[inset_0_0_0_1.5px_var(--border)]")}>{o.on ? <Check className="size-3" strokeWidth={3.4} /> : null}</span>
<span className="flex-1 truncate font-semibold">{o.nome}</span>
</CommandItem>
))}
</CommandGroup>
) : null}
{((opcoes ?? []).length === 0 && !podeCriar) ? <CommandEmpty>Nenhuma tag encontrada.</CommandEmpty> : null}
{podeCriar ? (
<CommandGroup>
<CommandItem value={"criar-" + buscaLimpa} onSelect={criar} className="gap-2.5 py-2">
<Plus className="size-4 shrink-0" />
<span className="flex-1 truncate">Criar tag <strong>“{buscaLimpa}”</strong></span>
</CommandItem>
</CommandGroup>
) : null}
</CommandList>
</Command>
</PopoverContent>
</Popover>

</div>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", padding: "14px 22px", borderTop: "1px solid #eef1f1", background: "#fafafa" }}>
<span style={{ flex: "1 1 200px", minWidth: "0", fontSize: "12.5px", color: "#4a5560", lineHeight: "1.45", textWrap: "pretty" }}>
{resumo}
</span>
<button onClick={fechar} style={{ flex: "0 0 auto", height: "40px", padding: "0 16px", borderRadius: "10px", border: "0", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "13px", fontWeight: "600", color: "#1f252c", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
Cancelar
</button>
<button onClick={aplicar} style={{ flex: "0 0 auto", whiteSpace: "nowrap", height: "40px", padding: "0 18px", borderRadius: "10px", border: "0", background: "#d93c1a", color: "#fff", fontSize: "13px", fontWeight: "700", cursor: "pointer" }} className={[hover("background:#c2330f")].filter(Boolean).join(" ")}>
Aplicar tags
</button>
</div>
</div>
</div>
</>) : null}
    </>
  );
}
