import { ModuloPendente } from "@/components/crm2/ModuloPendente";

export const metadata = { title: "Fluxos" };

/** Destino estrutural da árvore de navegação congelada em 16/09.
 *  O módulo ainda não foi construído: a página não simula funcionalidade. */
export default function AutomacoesFluxosPage() {
  return (
    <ModuloPendente
      titulo="Fluxos"
      resumo="Os fluxos de automação em si: o que dispara, o que executa e em que ordem."
      dependencias={[
            "Definir se o fluxo é editado aqui ou continua no n8n, com esta tela sendo leitura",
      ]}
    />
  );
}
