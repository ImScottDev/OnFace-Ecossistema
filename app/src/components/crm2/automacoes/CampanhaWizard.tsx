"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Cf2Button } from "@/components/crm2/ui/Button";
import { Cf2Input, Cf2Label, Cf2Textarea } from "@/components/crm2/ui/Input";

const PASSOS = ["Conteúdo", "Audiência", "Remetente", "Revisão"] as const;

/**
 * Wizard de campanha — portado de `(crm)/campanhas/nova` (09/09/2026).
 * Mesmo `POST /api/campanhas`, mesmos 4 passos e mesmo payload.
 *
 * Duas coisas que não funcionavam e agora funcionam:
 * - O passo só validava o nome, no passo 0. Dava pra chegar na revisão com
 *   e-mail sem assunto e sem corpo e criar assim mesmo.
 * - O stepper era decorativo: não dava pra voltar clicando num passo já feito.
 */
export function Cf2CampanhaWizard() {
  const router = useRouter();
  const params = useSearchParams();

  const [passo, setPasso] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [canal, setCanal] = useState(params.get("canal") === "whatsapp" ? "whatsapp" : "email");
  const [nome, setNome] = useState("");
  const [assunto, setAssunto] = useState("");
  const [corpoHtml, setCorpoHtml] = useState("<p>Olá {{nome}},</p>\n<p>Seu conteúdo aqui…</p>");
  const [audiencia, setAudiencia] = useState("");
  const [remetente, setRemetente] = useState("");

  const passoValido = [
    nome.trim().length >= 2 && corpoHtml.trim().length > 0 && (canal !== "email" || assunto.trim().length > 0),
    audiencia.trim().length > 0,
    remetente.trim().length > 0,
    true,
  ][passo];

  async function criar() {
    setSalvando(true);
    const res = await fetch("/api/campanhas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: nome.trim(), canal, assunto: assunto.trim() || null, corpoHtml, remetente: remetente.trim(),
        audiencia: { listas: audiencia.split(",").map((s) => s.trim()).filter(Boolean) },
        status: "rascunho",
      }),
    }).catch(() => null);
    setSalvando(false);
    if (res?.ok) {
      toast.success("Campanha salva como rascunho");
      router.push("/automacoes/campanhas");
    } else {
      toast.error("Não foi possível criar a campanha");
    }
  }

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold" style={{ color: "var(--cf2-text-primary)" }}>Nova campanha</h2>
        <p className="text-[12.5px]" style={{ color: "var(--cf2-text-tertiary)" }}>
          {canal === "whatsapp" ? "Disparo de WhatsApp" : "Cold e-mail"} — salva como rascunho, o envio ainda não existe.
        </p>
      </div>

      <ol className="flex items-center gap-2">
        {PASSOS.map((p, i) => {
          const feito = i < passo;
          const atual = i === passo;
          return (
            <li key={p} className="flex items-center gap-2 flex-1 min-w-0">
              <button
                onClick={() => i < passo && setPasso(i)}
                disabled={i > passo}
                aria-current={atual ? "step" : undefined}
                className="flex items-center gap-2 min-w-0 rounded-[var(--cf2-radius-sm)] disabled:cursor-default"
                title={feito ? `Voltar para ${p}` : undefined}
              >
                <span
                  aria-hidden
                  className="size-7 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0"
                  style={feito
                    ? { background: "var(--cf2-success-fill)", color: "#fff" }
                    : atual
                      ? { background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }
                      : { background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-tertiary)" }}
                >
                  {feito ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span
                  className="text-[12px] truncate hidden sm:inline"
                  style={{ color: atual ? "var(--cf2-text-primary)" : "var(--cf2-text-tertiary)", fontWeight: atual ? 600 : 400 }}
                >
                  {p}
                </span>
              </button>
              {i < PASSOS.length - 1 && <span aria-hidden className="flex-1 h-px" style={{ background: "var(--cf2-border-default)" }} />}
            </li>
          );
        })}
      </ol>

      <div
        className="rounded-[var(--cf2-radius-lg)] p-5 flex flex-col gap-4 min-h-[280px]"
        style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}
      >
        {passo === 0 && (
          <>
            <div className="flex flex-col gap-1.5">
              <Cf2Label htmlFor="camp-nome">Nome da campanha</Cf2Label>
              <Cf2Input
                id="camp-nome" value={nome} onChange={(e) => setNome(e.target.value)}
                placeholder="Outbound decisores de TI, junho"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium" style={{ color: "var(--cf2-text-secondary)" }}>Canal</span>
              <div className="flex gap-2" role="group" aria-label="Canal da campanha">
                {[{ v: "email", l: "E-mail" }, { v: "whatsapp", l: "WhatsApp" }].map((o) => {
                  const ativo = canal === o.v;
                  return (
                    <button
                      key={o.v} onClick={() => setCanal(o.v)} aria-pressed={ativo}
                      className="px-3 py-1.5 rounded-full text-[12.5px] font-medium transition-colors"
                      style={ativo
                        ? { background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)", border: "1px solid var(--cf2-accent-border)" }
                        : { background: "var(--cf2-bg-surface)", color: "var(--cf2-text-secondary)", border: "1px solid var(--cf2-border-default)" }}
                    >
                      {o.l}
                    </button>
                  );
                })}
              </div>
            </div>
            {canal === "email" && (
              <div className="flex flex-col gap-1.5">
                <Cf2Label htmlFor="camp-assunto">Assunto do e-mail</Cf2Label>
                <Cf2Input
                  id="camp-assunto" value={assunto} onChange={(e) => setAssunto(e.target.value)}
                  placeholder="Uma ideia para a {{empresa}}"
                />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Cf2Label htmlFor="camp-corpo">Corpo</Cf2Label>
              <Cf2Textarea
                id="camp-corpo" rows={7} className="font-mono text-[12px]"
                value={corpoHtml} onChange={(e) => setCorpoHtml(e.target.value)}
              />
              <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>
                HTML. Use {"{{nome}}"} e {"{{empresa}}"} para personalizar.
              </p>
            </div>
          </>
        )}

        {passo === 1 && (
          <div className="flex flex-col gap-1.5">
            <Cf2Label htmlFor="camp-audiencia">Listas de contatos</Cf2Label>
            <Cf2Input
              id="camp-audiencia" value={audiencia} onChange={(e) => setAudiencia(e.target.value)}
              placeholder="Conselho KOKO, Decisores TI"
            />
            <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>
              Separe por vírgula. As listas vêm de Contatos.
            </p>
          </div>
        )}

        {passo === 2 && (
          <div className="flex flex-col gap-1.5">
            <Cf2Label htmlFor="camp-remetente">Remetente</Cf2Label>
            <Cf2Input
              id="camp-remetente" value={remetente} onChange={(e) => setRemetente(e.target.value)}
              placeholder={canal === "whatsapp" ? "Sessão de WhatsApp" : "contato@callface.ai"}
            />
            <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>
              {canal === "whatsapp" ? "Qual sessão conectada assina o disparo." : "Conta de envio."}
            </p>
          </div>
        )}

        {passo === 3 && (
          <dl className="flex flex-col gap-2 text-[13px]">
            {[
              ["Nome", nome],
              ["Canal", canal === "whatsapp" ? "WhatsApp" : "E-mail"],
              ...(canal === "email" ? [["Assunto", assunto]] : []),
              ["Audiência", audiencia],
              ["Remetente", remetente],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-1" style={{ borderBottom: "1px solid var(--cf2-border-default)" }}>
                <dt style={{ color: "var(--cf2-text-tertiary)" }}>{k}</dt>
                <dd className="text-right min-w-0 truncate" style={{ color: "var(--cf2-text-primary)" }}>{v || "—"}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <div className="flex justify-between gap-3">
        <Cf2Button
          variant="ghost"
          onClick={() => (passo === 0 ? router.push("/automacoes/campanhas") : setPasso(passo - 1))}
        >
          <ChevronLeft className="size-3.5" /> {passo === 0 ? "Cancelar" : "Voltar"}
        </Cf2Button>
        {passo < PASSOS.length - 1 ? (
          <Cf2Button onClick={() => setPasso(passo + 1)} disabled={!passoValido}>
            Próximo <ChevronRight className="size-3.5" />
          </Cf2Button>
        ) : (
          <Cf2Button onClick={criar} loading={salvando}>Salvar rascunho</Cf2Button>
        )}
      </div>
    </div>
  );
}
