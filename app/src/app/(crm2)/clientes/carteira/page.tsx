import { ModuloPendente } from "@/components/crm2/ModuloPendente";

/** Destino estrutural da árvore de navegação congelada em 16/09.
 *  O módulo ainda não foi construído: a página não simula funcionalidade. */
export default function ClientesCarteiraPage() {
  return (
    <ModuloPendente
      titulo="Carteira"
      area="Clientes"
      resumo="A base ativa vista como carteira: quem atende cada conta, quanto ela pesa e desde quando é cliente."
      dependencias={[
            "Definir o dono da conta (hoje não existe responsável de carteira no banco)",
            "Definir o critério de segmentação da carteira",
      ]}
    />
  );
}
