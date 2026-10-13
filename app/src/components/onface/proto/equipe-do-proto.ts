import * as React from "react";
import { AgentesDaOrgContexto } from "@/components/ui/avatar";
import { ehAgentePorNome, pessoasPrimeiro } from "@/lib/agentes/eh-agente";

/**
 * Ordem única das listas de pessoa dos desenhos (`catalogo.EQUIPE`: responsável,
 * participante, autor, closer): pessoas primeiro, agentes de IA depois. O markup
 * gerado só sabe listar nomes; o agrupamento com rótulo "Agentes de IA" só existe
 * onde o select é do produto (`OpcoesDePessoa`).
 */
export function useOrdemDaEquipe() {
  const agentes = React.useContext(AgentesDaOrgContexto);
  return React.useCallback(
    (nomes: string[]) => pessoasPrimeiro(nomes, (n) => ehAgentePorNome(n, null, agentes)),
    [agentes],
  );
}
