"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";

const PASSOS = ["Conteúdo", "Audiência", "Remetente", "Revisão"];

export default function NovaCampanhaPage() {
  const router = useRouter();
  const params = useSearchParams();
  const canalInicial = params.get("canal") || "email";

  const [passo, setPasso] = useState(0);
  const [saving, setSaving] = useState(false);
  const [canal, setCanal] = useState(canalInicial);
  const [nome, setNome] = useState("");
  const [assunto, setAssunto] = useState("");
  const [corpoHtml, setCorpoHtml] = useState("<p>Olá {{nome}},</p>\n<p>Seu conteúdo aqui...</p>");
  const [audiencia, setAudiencia] = useState("");
  const [remetente, setRemetente] = useState("");

  const criar = async () => {
    setSaving(true);
    const res = await fetch("/api/campanhas", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, canal, assunto, corpoHtml, remetente, audiencia: { listas: audiencia.split(",").map(s => s.trim()).filter(Boolean) }, status: "rascunho" }),
    });
    setSaving(false);
    if (res.ok) { toast.success("Campanha criada"); router.push("/campanhas"); }
    else toast.error("Erro ao criar campanha");
  };

  return (
    <div className="page-scroll max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-1">Nova Campanha</h1>
      <p className="text-sm text-white/40 mb-6">{canal === "whatsapp" ? "Disparo de WhatsApp (não oficial)" : "Cold email"}</p>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-8">
        {PASSOS.map((p, i) => (
          <div key={p} className="flex items-center gap-2 flex-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i < passo ? "bg-emerald-500 text-white" : i === passo ? "bg-[#e23752] text-white" : "bg-white/[0.08] text-white/40"}`}>
              {i < passo ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`text-xs ${i === passo ? "text-white" : "text-white/40"}`}>{p}</span>
            {i < PASSOS.length - 1 && <div className="flex-1 h-px bg-white/[0.08]" />}
          </div>
        ))}
      </div>

      <div className="card-solid p-5 space-y-4 min-h-[260px]">
        {passo === 0 && (
          <>
            <h3 className="text-sm font-medium text-white/70">Conteúdo da Campanha</h3>
            <div className="space-y-2">
              <label className="text-xs text-white/50">Nome da campanha</label>
              <input className="dark-input w-full" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Outbound Decisores TI Junho" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setCanal("email")} className={`px-3 py-1.5 rounded-lg text-xs ${canal === "email" ? "bg-[#e23752]/20 text-[#e23752]" : "bg-white/[0.04] text-white/50"}`}>Email</button>
              <button onClick={() => setCanal("whatsapp")} className={`px-3 py-1.5 rounded-lg text-xs ${canal === "whatsapp" ? "bg-[#e23752]/20 text-[#e23752]" : "bg-white/[0.04] text-white/50"}`}>WhatsApp</button>
            </div>
            {canal === "email" && (
              <div className="space-y-2">
                <label className="text-xs text-white/50">Assunto do email</label>
                <input className="dark-input w-full" value={assunto} onChange={e => setAssunto(e.target.value)} placeholder="Ex: Uma ideia para a {{empresa}}" />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-xs text-white/50">Corpo (HTML, use {"{{nome}}"} para personalizar)</label>
              <textarea className="dark-input w-full font-mono text-xs" rows={6} value={corpoHtml} onChange={e => setCorpoHtml(e.target.value)} />
            </div>
          </>
        )}
        {passo === 1 && (
          <>
            <h3 className="text-sm font-medium text-white/70">Audiência</h3>
            <p className="text-xs text-white/40">Selecione as listas de contatos (separadas por vírgula). As listas vêm de Contatos.</p>
            <input className="dark-input w-full" value={audiencia} onChange={e => setAudiencia(e.target.value)} placeholder="Ex: Conselho KOKO, Decisores TI" />
          </>
        )}
        {passo === 2 && (
          <>
            <h3 className="text-sm font-medium text-white/70">Remetente</h3>
            <p className="text-xs text-white/40">Conta de envio.</p>
            <input className="dark-input w-full" value={remetente} onChange={e => setRemetente(e.target.value)} placeholder={canal === "whatsapp" ? "Sessão WhatsApp" : "contato@callface.ai"} />
          </>
        )}
        {passo === 3 && (
          <>
            <h3 className="text-sm font-medium text-white/70">Revisão</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-white/40">Nome</span><span className="text-white/80">{nome || "—"}</span></div>
              <div className="flex justify-between"><span className="text-white/40">Canal</span><span className="text-white/80">{canal}</span></div>
              {canal === "email" && <div className="flex justify-between"><span className="text-white/40">Assunto</span><span className="text-white/80">{assunto || "—"}</span></div>}
              <div className="flex justify-between"><span className="text-white/40">Audiência</span><span className="text-white/80">{audiencia || "—"}</span></div>
              <div className="flex justify-between"><span className="text-white/40">Remetente</span><span className="text-white/80">{remetente || "—"}</span></div>
            </div>
          </>
        )}
      </div>

      <div className="flex justify-between mt-5">
        <button onClick={() => passo === 0 ? router.push("/campanhas") : setPasso(passo - 1)} className="flex items-center gap-1 px-3 py-2 text-sm text-white/60 hover:text-white">
          <ChevronLeft className="w-4 h-4" /> {passo === 0 ? "Cancelar" : "Voltar"}
        </button>
        {passo < PASSOS.length - 1 ? (
          <button onClick={() => setPasso(passo + 1)} disabled={passo === 0 && !nome} className="btn-primary flex items-center gap-1 px-4 py-2 text-sm disabled:opacity-40">
            Próximo <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={criar} disabled={saving} className="btn-primary px-5 py-2 text-sm">{saving ? "Criando..." : "Criar campanha"}</button>
        )}
      </div>
    </div>
  );
}
