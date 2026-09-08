import { FilaPosVenda } from "@/components/crm/FilaPosVenda";

export default function ValidacaoManualPage() {
  return (
    <FilaPosVenda
      trilha="validacao_manual"
      titulo="Validação manual"
      subtitulo="Negócios ganhos cuja família de produto não foi identificada. Alguém precisa dizer o que é antes de virar entrega."
    />
  );
}
