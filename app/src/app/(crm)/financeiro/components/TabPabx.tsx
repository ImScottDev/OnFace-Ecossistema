"use client";

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { Stat, Secao } from "../../relatorios/components/kit";
import { fmt } from "./fin";
import { TabClientes } from "./TabClientes";

/**
 * PABX (Wevy) — F16. Linha de receita separada, alimentada pela planilha
 * mensal da Wevy via upload de CSV padronizado. A data da última carga fica
 * SEMPRE visível: dado sem data de carga é dado que engana.
 */
export function TabPabx({ busca, onOpenLead }: { busca: string; onOpenLead: (leadId: string) => void }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  const { data: carga } = useQuery({
    queryKey: ["fin-pabx-carga"],
    queryFn: () => fetch("/api/financeiro/pabx-import").then((r) => r.json()),
  });

  const diasDesdeCarga = carga?.ultimaCarga
    ? Math.floor((Date.now() - new Date(carga.ultimaCarga).getTime()) / 86400000)
    : null;

  const upload = async (file: File) => {
    setEnviando(true);
    setResultado(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await fetch("/api/financeiro/pabx-import", { method: "POST", body: form });
      const j = await r.json();
      if (!r.ok) {
        setResultado(`Erro: ${j.error || "falha no upload"}${j.erros?.length ? ` — ${j.erros.slice(0, 3).join("; ")}` : ""}`);
      } else {
        setResultado(
          `Carga ok: ${j.processadas} faturas processadas, ${j.leadsCriados} clientes novos, ${j.contratosCriados} contratos novos.` +
          (j.errosDeLinha?.length ? ` ${j.errosDeLinha.length} linhas ignoradas.` : ""),
        );
        qc.invalidateQueries({ queryKey: ["fin-pabx-carga"] });
        qc.invalidateQueries({ queryKey: ["fin-inadimplencia", "pabx"] });
      }
    } catch (e) {
      setResultado(`Erro: ${String(e)}`);
    } finally {
      setEnviando(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat
          label="Última planilha importada"
          value={carga?.ultimaCarga ? new Date(carga.ultimaCarga).toLocaleDateString("pt-BR") : "NUNCA"}
          sub={diasDesdeCarga == null ? "a receita PABX ainda não está no CRM" : diasDesdeCarga > 35 ? `${diasDesdeCarga} dias atrás — DESATUALIZADA` : `${diasDesdeCarga} dias atrás`}
          cor={diasDesdeCarga == null || diasDesdeCarga > 35 ? "critico" : "ganho"}
          destaque
        />
        <Stat label="Faturas PABX" value={carga?.faturas ?? 0} sub={`${carga?.clientes ?? 0} clientes`} cor="funil" />
        <Stat label="Em aberto (PABX)" value={fmt(carga?.emAberto)} cor={Number(carga?.emAberto) > 0 ? "atencao" : "neutro"} />
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 flex flex-col justify-between">
          <p className="text-[10px] uppercase tracking-[0.12em] text-white/40 font-medium">Importar planilha do mês</p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={enviando}
            className="mt-2 flex items-center justify-center gap-2 text-xs px-3 py-2 rounded-lg bg-[#8e27ef]/20 text-[#a855f7] border border-[#8e27ef]/40 hover:bg-[#8e27ef]/30 transition-colors disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            {enviando ? "Enviando..." : "Subir CSV"}
          </button>
        </div>
      </div>

      {resultado && (
        <p className={`text-[11px] px-4 py-2 rounded-lg ${resultado.startsWith("Erro") ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"}`}>
          {resultado}
        </p>
      )}

      <details className="rounded-xl bg-white/[0.02] border border-white/[0.05] px-4 py-3">
        <summary className="text-[11px] text-white/40 cursor-pointer select-none">Modelo do CSV (clique pra ver)</summary>
        <pre className="text-[11px] text-white/50 mt-2 overflow-x-auto">
{`empresa,email,mensalidade,competencia,valor,status,paga_em
ACME Ltda,fin@acme.com,450.00,2026-07,450.00,paga,2026-07-05
Beta Corp,adm@beta.com,780.00,2026-07,780.00,aberta,`}
        </pre>
        <p className="text-[10px] text-white/30 mt-2">
          competencia = YYYY-MM · status = paga ou aberta · paga_em vazio se aberta.
          Subir a mesma planilha duas vezes não duplica (chave = email + competência).
        </p>
      </details>

      <Secao cor="funil" hint="contratos e faturas da linha PABX">Carteira PABX</Secao>
      <TabClientes busca={busca} onOpenLead={onOpenLead} produto="pabx" />
    </div>
  );
}
