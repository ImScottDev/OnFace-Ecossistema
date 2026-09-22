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
            "Atribuir o dono da conta: clientes.responsavel_cs_id existe e está vazio nas 275 contas. É atribuição de gente, não campo faltando",
            "Definir o critério de segmentação da carteira",
      ]}
    />
  );
}
