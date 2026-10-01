"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PeriodSelector from "@/components/crm2/relatorios/PeriodSelector";
import TabComercial from "@/components/crm2/relatorios/TabComercial";
import TabComercialCloser from "@/components/crm2/relatorios/TabComercialCloser";
import TabSdr from "@/components/crm2/relatorios/TabSdr";
import TabPosVenda from "@/components/crm2/relatorios/TabPosVenda";
import TabAtividadeTime from "@/components/crm2/relatorios/TabAtividadeTime";
import TabGrowth from "@/components/crm2/relatorios/TabGrowth";
import TabMarketing from "@/components/crm2/relatorios/TabMarketing";
import TabMidiaPaga from "@/components/crm2/relatorios/TabMidiaPaga";

/**
 * Uma aba de Insights com endereço próprio.
 *
 * Reusa os componentes de `components/crm2/relatorios` sem reescrever nada:
 * as consultas e regras de cálculo deles já foram auditadas, e a biblioteca só
 * dá a cada um uma URL que dá para colar e recarregar. O período vai para a
 * querystring pelo mesmo motivo — antes ele morria no reload.
 *
 * Pós-venda e Atividade do time não recebem período porque os próprios
 * componentes não usam (snapshot e janela fixa de 14 dias); mostrar um seletor
 * que não muda nada seria controle mentiroso.
 */
const SEM_PERIODO = new Set(["pos-venda", "atividade-time"]);

export function InsightsRelatorio({
  aba,
  pessoal,
  periodoInicial,
}: {
  aba: string;
  pessoal: boolean;
  periodoInicial: string;
}) {
  const router = useRouter();
  const [periodo, setPeriodo] = useState(periodoInicial);

  const trocar = (v: string) => {
    setPeriodo(v);
    router.replace(`?periodo=${encodeURIComponent(v)}`, { scroll: false });
  };

  return (
    <div className="flex flex-col gap-4">
      {SEM_PERIODO.has(aba) ? null : (
        <div className="flex justify-end">
          <PeriodSelector value={periodo} onChange={trocar} />
        </div>
      )}
      {aba === "comercial" && (pessoal ? <TabComercialCloser periodo={periodo} /> : <TabComercial periodo={periodo} />)}
      {aba === "sdr" && <TabSdr periodo={periodo} />}
      {aba === "pos-venda" && <TabPosVenda />}
      {aba === "atividade-time" && <TabAtividadeTime />}
      {aba === "growth" && <TabGrowth periodo={periodo} />}
      {aba === "marketing" && <TabMarketing periodo={periodo} />}
      {aba === "midia-paga" && <TabMidiaPaga periodo={periodo} />}
    </div>
  );
}
