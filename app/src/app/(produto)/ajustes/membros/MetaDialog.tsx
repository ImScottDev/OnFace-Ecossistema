"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Target } from "lucide-react";
import {
  Cf2Dialog, Cf2DialogContent, Cf2DialogHeader, Cf2DialogTitle,
  Cf2DialogDescription, Cf2DialogFooter,
} from "@/components/crm2/ui/Dialog";
import { Cf2Button } from "@/components/crm2/ui/Button";
import { Cf2Input, Cf2Label } from "@/components/crm2/ui/Input";
import {
  META_TIPOS, META_LABELS, META_TIPOS_MOEDA, metaTipoPorPapel,
  PAPEIS_QUE_SOMAM_NA_META, type MetaTipo,
} from "@/lib/metas-shared";
import { ROLE_LABEL } from "./roles";
import type { Membro } from "./tipos";

type MetaRow = { id: string; tipo: string; valorAlvo: string; realizado: number };

/** Mês atual em YYYY-MM, formato do `<input type="month">`. */
function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatarValor(tipo: MetaTipo, valor: number) {
  return META_TIPOS_MOEDA.includes(tipo)
    ? `R$ ${valor.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`
    : valor.toLocaleString("pt-BR");
}

/**
 * Meta mensal de um membro. Migrado de `(crm)/admin/usuarios` (09/09/2026):
 * a meta só existia numa tela de admin cross-org sem entrada nenhuma no CRM2,
 * então a Home dizia "sem meta definida" e não havia caminho no produto novo
 * pra definir uma. Aqui ela mora ao lado da pessoa a quem pertence.
 *
 * A API (`POST /metas`, `GET /metas/usuario/:id`) é a mesma — nenhuma regra de
 * negócio mudou, só o lugar de onde se chama.
 */
export function MetaDialog({ membro, onOpenChange }: { membro: Membro | null; onOpenChange: (aberto: boolean) => void }) {
  const queryClient = useQueryClient();
  const [mes, setMes] = useState(mesAtual);
  const [tipo, setTipo] = useState<MetaTipo>("mrr_fechado");
  const [valorAlvo, setValorAlvo] = useState("");
  const [salvo, setSalvo] = useState(false);

  const periodo = `${mes}-01`;
  const sugerido = metaTipoPorPapel(membro?.role ?? "closer");

  // Ao trocar de pessoa, o tipo volta pro sugerido pelo papel dela.
  useEffect(() => {
    if (membro) { setTipo(metaTipoPorPapel(membro.role)); setMes(mesAtual()); }
  }, [membro?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: metas, isFetching } = useQuery<MetaRow[]>({
    enabled: !!membro,
    queryKey: ["metas-usuario", membro?.id, periodo],
    queryFn: async () => {
      const res = await fetch(`/api/metas/usuario/${membro!.id}?periodo=${periodo}`);
      if (!res.ok) throw new Error("Falha ao carregar metas");
      return (await res.json()).metas ?? [];
    },
  });

  const metaAtual = metas?.find((m) => m.tipo === tipo);

  // Sincroniza o campo com a meta carregada ao trocar de mês ou de tipo.
  // Não mexe em `salvo`: salvar dispara `invalidateQueries`, o refetch traz a
  // meta com id novo, este efeito rodava de novo e apagava a confirmação —
  // do ponto de vista de quem clicou, o "Meta salva" piscava e sumia, e a
  // tela ficava sem dizer se tinha gravado. Quem limpa a confirmação é a
  // próxima edição do usuário.
  useEffect(() => {
    setValorAlvo(metaAtual ? String(Number(metaAtual.valorAlvo)) : "");
  }, [metaAtual?.id, tipo, periodo]); // eslint-disable-line react-hooks/exhaustive-deps

  const salvar = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/metas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioId: membro!.id, periodo, tipo, valorAlvo: Number(valorAlvo) }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Falha ao salvar meta");
      return res.json();
    },
    onSuccess: () => {
      setSalvo(true);
      queryClient.invalidateQueries({ queryKey: ["metas-usuario", membro!.id, periodo] });
      queryClient.invalidateQueries({ queryKey: ["metas-equipe"] });
      // A Home e os relatórios leem meta: sem isso o "sem meta definida"
      // continuaria na tela depois de salvar.
      queryClient.invalidateQueries({ queryKey: ["relatorios"] });
      queryClient.invalidateQueries({ queryKey: ["metas-closer"] });
    },
  });

  // O card "Meta do mês" da Home soma só as metas de `mrr_fechado` de quem é
  // closer. Definir uma meta dessas pra um admin ou SDR salvava normalmente e
  // a Home continuava dizendo "nenhuma meta definida", sem explicação nenhuma.
  const foraDoTotalDaHome = !!membro
    && tipo === "mrr_fechado"
    && !PAPEIS_QUE_SOMAM_NA_META.includes(membro.role);

  const realizado = metaAtual?.realizado ?? 0;
  const alvoNum = Number(valorAlvo) || 0;
  const pct = alvoNum > 0 ? Math.min(100, Math.round((realizado / alvoNum) * 100)) : null;

  return (
    <Cf2Dialog open={!!membro} onOpenChange={onOpenChange}>
      <Cf2DialogContent aria-describedby="meta-desc">
        <Cf2DialogHeader>
          <Cf2DialogTitle className="flex items-center gap-2">
            <Target className="size-4" style={{ color: "var(--cf2-accent)" }} />
            Meta do mês
          </Cf2DialogTitle>
          <Cf2DialogDescription id="meta-desc">
            {membro?.nome} · {ROLE_LABEL[membro?.role ?? ""] ?? membro?.role}
          </Cf2DialogDescription>
        </Cf2DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Cf2Label htmlFor="meta-mes">Mês</Cf2Label>
              <Cf2Input id="meta-mes" type="month" value={mes} onChange={(e) => { setMes(e.target.value); setSalvo(false); }} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Cf2Label htmlFor="meta-tipo">Tipo de meta</Cf2Label>
              <select
                id="meta-tipo"
                value={tipo}
                onChange={(e) => { setTipo(e.target.value as MetaTipo); setSalvo(false); }}
                className="w-full rounded-[var(--cf2-radius-sm)] text-sm px-3 py-2 outline-none transition-colors h-[38px]"
                style={{
                  background: "var(--cf2-bg-surface)",
                  color: "var(--cf2-text-primary)",
                  border: "1px solid var(--cf2-border-default)",
                }}
              >
                {META_TIPOS.map((t) => (
                  <option key={t} value={t}>{META_LABELS[t]}</option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-[11px] -mt-2" style={{ color: "var(--cf2-text-tertiary)" }}>
            Sugerido para {ROLE_LABEL[membro?.role ?? ""] ?? "este papel"}: {META_LABELS[sugerido]}
          </p>

          <div className="flex flex-col gap-1.5">
            <Cf2Label htmlFor="meta-valor">
              Valor alvo {META_TIPOS_MOEDA.includes(tipo) && <span style={{ color: "var(--cf2-text-tertiary)" }}>(R$)</span>}
            </Cf2Label>
            <Cf2Input
              id="meta-valor" type="number" min={0} placeholder="0" value={valorAlvo}
              onChange={(e) => { setValorAlvo(e.target.value); setSalvo(false); }}
            />
            <p className="text-[11px]" style={{ color: metaAtual ? "var(--cf2-success-text)" : "var(--cf2-text-tertiary)" }}>
              {isFetching
                ? "Carregando meta atual…"
                : metaAtual
                  ? `Editando a meta já cadastrada (${formatarValor(tipo, Number(metaAtual.valorAlvo))}).`
                  : "Nenhuma meta definida para este mês e tipo — você está criando uma."}
            </p>
          </div>

          <div
            className="rounded-[var(--cf2-radius-md)] px-3 py-2.5 flex flex-col gap-2"
            style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Realizado neste mês</span>
              <span className="text-sm font-semibold" style={{ color: "var(--cf2-text-primary)" }}>
                {isFetching ? "…" : formatarValor(tipo, realizado)}
              </span>
            </div>
            {pct !== null && (
              <>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--cf2-border-default)" }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "var(--cf2-accent)" }} />
                </div>
                <span className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{pct}% do alvo digitado</span>
              </>
            )}
          </div>

          {foraDoTotalDaHome && (
            <p
              className="text-[11.5px] leading-relaxed rounded-[var(--cf2-radius-sm)] px-3 py-2"
              style={{ background: "var(--cf2-warning-bg)", color: "var(--cf2-warning-text)" }}
            >
              Esta meta vale para a pessoa, mas não entra no card “Meta do mês” do Início: aquele
              total soma apenas as metas de MRR de quem tem papel de closer.
            </p>
          )}

          {salvo && (
            <p
              role="status"
              className="rounded-[var(--cf2-radius-sm)] px-3 py-2 text-[13px] text-center font-medium"
              style={{ background: "var(--cf2-success-bg)", color: "var(--cf2-success-text)" }}
            >
              Meta salva: {META_LABELS[tipo]} · {mes} · {formatarValor(tipo, alvoNum)}
            </p>
          )}
          {salvar.error && (
            <p role="alert" className="text-[12px]" style={{ color: "var(--cf2-danger-text)" }}>
              {(salvar.error as Error).message}
            </p>
          )}
        </div>

        <Cf2DialogFooter>
          <Cf2Button variant="secondary" onClick={() => onOpenChange(false)}>Fechar</Cf2Button>
          <Cf2Button
            onClick={() => salvar.mutate()}
            loading={salvar.isPending}
            disabled={valorAlvo === "" || Number(valorAlvo) < 0}
          >
            {metaAtual ? "Atualizar meta" : "Salvar meta"}
          </Cf2Button>
        </Cf2DialogFooter>
      </Cf2DialogContent>
    </Cf2Dialog>
  );
}
