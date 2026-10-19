"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Nota — a peça ÚNICA de anotar, para lead e para oportunidade.
 *
 * Não existe desenho gerado para ela: o handoff nunca desenhou uma nota, e
 * inventar uma tela paralela ao Design System seria pior. Então ela é escrita
 * à mão com os componentes de `components/ui` (shadcn) e os tokens de cor —
 * nenhum hex, nenhum componente novo fora do catálogo.
 *
 * Abre com `E.abrir("nota", { leadId })` ou `{ negocioId }`. Grava pela porta
 * única `lib/vendas/notas.ts`, a mesma do drawer do Pipeline: a nota aparece
 * na linha do tempo da ficha, da oportunidade e do Cliente 360 sem ninguém
 * escrever uma segunda vez.
 *
 * De propósito NÃO é tarefa: tarefa fica pendente para sempre no Foco de hoje
 * de alguém, e nota não tem o que concluir.
 * ───────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import { toast } from "sonner";

import type { PecaProps } from "./pecas-host";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { acaoRegistrarNotaDoLead } from "@/app/(produto)/pre-vendas/actions";
import { acaoRegistrarNota } from "@/app/(produto)/pipeline/actions";

export default function NotaPecaProto({ id, contexto, fechar, gravou }: PecaProps) {
  const negocioId = (contexto?.negocioId as string | undefined) ?? null;
  const leadId = (contexto?.leadId as string | undefined) ?? (negocioId ? null : id);
  const sobre = (contexto?.sobre as string | undefined) ?? null;

  const [texto, setTexto] = React.useState("");
  const [salvando, setSalvando] = React.useState(false);

  async function salvar() {
    const limpo = texto.trim();
    if (!limpo || salvando) return;
    setSalvando(true);
    const r = negocioId
      ? await acaoRegistrarNota(negocioId, limpo)
      : leadId
        ? await acaoRegistrarNotaDoLead(leadId, limpo)
        : { ok: false as const, erro: "Sem lead nem oportunidade: a nota não teria onde aparecer." };
    setSalvando(false);
    if (!r.ok) return toast.error(r.erro);
    toast.success("Nota salva na linha do tempo.");
    gravou?.();
    fechar();
  }

  return (
    <Dialog open onOpenChange={(aberto) => { if (!aberto) fechar(); }}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Anotar</DialogTitle>
          <DialogDescription>
            {sobre ? `Sobre ${sobre}. ` : ""}
            A nota entra na linha do tempo — e aparece na ficha, na oportunidade e no Cliente 360.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          autoFocus
          rows={6}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ex.: ligou, pediu para retomar depois do dia 10"
          /* Ctrl/Cmd+Enter salva: quem anota depois da ligação não quer tirar a
             mão do teclado para procurar o botão. */
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void salvar(); }}
        />

        <DialogFooter>
          <Button variant="ghost" onClick={fechar} disabled={salvando}>Cancelar</Button>
          <Button onClick={() => void salvar()} disabled={salvando || !texto.trim()}>
            {salvando ? "Salvando..." : "Salvar nota"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
