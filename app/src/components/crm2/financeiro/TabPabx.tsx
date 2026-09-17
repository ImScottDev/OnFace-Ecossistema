"use client";

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { Cf2Button } from "@/components/crm2/ui/Button";
import { FinPulso, FinStat } from "./pecas";
import { fmt } from "./fmt";
import { TabAssinaturas } from "./TabAssinaturas";

/**
 * PABX (Wevy) — portada de `(crm)/financeiro/components/TabPabx` (09/09/2026).
 * Linha de receita separada, alimentada pela planilha mensal via CSV. A data
 * da última carga fica SEMPRE visível: dado sem data de carga é dado que
 * engana. Mesma rota (`GET`/`POST /api/financeiro/pabx-import`).
 *
 * 10/09/2026 — recomposição de UI/UX. A composição antiga dizia a coisa certa
 * com o peso errado: a data da carga era um card entre quatro, do mesmo tamanho
 * das contagens que ela própria condiciona, e o botão de subir a planilha era um
 * quarto card fingindo ser KPI. Nesta aba o número que decide se qualquer outro
 * número vale é o frescor da planilha — então ele é o sinal dominante da faixa,
 * com a ação de importar dentro dela e o resultado da carga no rodapé, no lugar
 * onde a pessoa acabou de clicar. As contagens viram satélites, e a carteira
 * entra sem pulso próprio pra não criar um segundo dominante na tela.
 */
export function TabPabx({ busca, onAbrirLead }: { busca: string; onAbrirLead: (leadId: string) => void }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ erro: boolean; texto: string } | null>(null);

  const { data: carga } = useQuery({
    queryKey: ["fin-pabx-carga"],
    queryFn: () => fetch("/api/financeiro/pabx-import").then((r) => r.json()),
  });

  const diasDesdeCarga = carga?.ultimaCarga
    ? Math.floor((Date.now() - new Date(carga.ultimaCarga).getTime()) / 86400000)
    : null;
  const desatualizada = diasDesdeCarga == null || diasDesdeCarga > 35;

  async function enviar(file: File) {
    setEnviando(true);
    setResultado(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await fetch("/api/financeiro/pabx-import", { method: "POST", body: form });
      const j = await r.json();
      if (!r.ok) {
        setResultado({
          erro: true,
          texto: `${j.error || "Falha no envio"}${j.erros?.length ? ` — ${j.erros.slice(0, 3).join("; ")}` : ""}`,
        });
      } else {
        setResultado({
          erro: false,
          texto: `Carga concluída: ${j.processadas} faturas processadas, ${j.leadsCriados} clientes novos, `
            + `${j.contratosCriados} contratos novos.`
            + (j.errosDeLinha?.length ? ` ${j.errosDeLinha.length} linhas ignoradas.` : ""),
        });
        queryClient.invalidateQueries({ queryKey: ["fin-pabx-carga"] });
        queryClient.invalidateQueries({ queryKey: ["fin-inadimplencia", "pabx"] });
      }
    } catch (e) {
      setResultado({ erro: true, texto: String(e) });
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        ref={inputRef} type="file" accept=".csv,text/csv" className="hidden"
        aria-label="Arquivo CSV da planilha mensal de PABX"
        onChange={(e) => e.target.files?.[0] && enviar(e.target.files[0])}
      />

      <FinPulso
        label="Última planilha importada"
        valor={carga?.ultimaCarga ? new Date(carga.ultimaCarga).toLocaleDateString("pt-BR") : "Nunca"}
        tom={desatualizada ? "critico" : "ok"}
        sub={diasDesdeCarga == null
          ? "A receita de PABX ainda não está no CRM. Nenhum número desta aba é confiável até a primeira carga."
          : desatualizada
            ? `${diasDesdeCarga} dias atrás — desatualizada. As contagens abaixo refletem a planilha antiga, não o mês corrente.`
            : `${diasDesdeCarga} dias atrás. Os números abaixo estão dentro do ciclo de fechamento da Wevy.`}
        acoes={
          <Cf2Button onClick={() => inputRef.current?.click()} loading={enviando}>
            {!enviando && <Upload className="size-3.5" />}
            {enviando ? "Enviando…" : "Subir CSV do mês"}
          </Cf2Button>
        }
        rodape={resultado ? (
          <span
            role="status"
            style={{ color: resultado.erro ? "var(--cf2-danger-text)" : "var(--cf2-success-text)" }}
          >
            {resultado.texto}
          </span>
        ) : undefined}
      >
        <FinStat label="Faturas de PABX" valor={carga?.faturas ?? 0} sub="na base importada" tom="info" />
        <FinStat label="Clientes" valor={carga?.clientes ?? 0} sub="com fatura de PABX" />
        <FinStat label="Em aberto (PABX)" valor={fmt(carga?.emAberto)} tom={Number(carga?.emAberto) > 0 ? "atencao" : "neutro"} sub="não pago na planilha" />
      </FinPulso>

      <details
        className="rounded-[var(--cf2-radius-lg)] px-4 py-3"
        style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}
      >
        <summary className="text-[12px] cursor-pointer select-none rounded-[var(--cf2-radius-sm)]" style={{ color: "var(--cf2-text-secondary)" }}>
          Modelo do CSV
        </summary>
        <pre
          className="text-[11.5px] mt-2 overflow-x-auto p-2 rounded-[var(--cf2-radius-sm)]"
          style={{ color: "var(--cf2-text-secondary)", background: "var(--cf2-bg-surface-muted)" }}
        >
{`empresa,email,mensalidade,competencia,valor,status,paga_em
ACME Ltda,fin@acme.com,450.00,2026-07,450.00,paga,2026-07-05
Beta Corp,adm@beta.com,780.00,2026-07,780.00,aberta,`}
        </pre>
        <p className="text-[11px] mt-2" style={{ color: "var(--cf2-text-tertiary)" }}>
          competencia no formato AAAA-MM · status <em>paga</em> ou <em>aberta</em> · paga_em vazio quando aberta.
          Subir a mesma planilha duas vezes não duplica: a chave é e-mail mais competência.
        </p>
      </details>

      <TabAssinaturas busca={busca} onAbrirLead={onAbrirLead} produto="pabx" pulso={false} />
    </div>
  );
}
