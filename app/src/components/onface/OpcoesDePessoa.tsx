import { agruparPessoas, ehAgenteUsuario, ROTULO_GRUPO_AGENTES } from "@/lib/agentes/eh-agente";

export interface PessoaDoSeletor {
  id: string;
  nome: string;
  /** Marca explícita do dado (consultas) ... */
  ehAgente?: boolean | null;
  /** ... ou o `tipo` do usuário (`/api/usuarios`). */
  tipo?: string | null;
}

/**
 * As `<option>` de qualquer `<select>` de pessoa (responsável, participante, autor):
 * pessoas primeiro, agentes de IA num grupo separado. Um lugar só para essa regra;
 * sem agentes na lista, sai a lista plana de sempre.
 */
export function OpcoesDePessoa({ itens, rotulo }: { itens: readonly PessoaDoSeletor[]; rotulo?: (p: PessoaDoSeletor) => string }) {
  const { pessoas, agentes } = agruparPessoas(itens, (p) => p.ehAgente ?? ehAgenteUsuario(p));
  const op = (p: PessoaDoSeletor) => <option key={p.id} value={p.id}>{rotulo ? rotulo(p) : p.nome}</option>;
  return (
    <>
      {pessoas.map(op)}
      {agentes.length > 0 && <optgroup label={ROTULO_GRUPO_AGENTES}>{agentes.map(op)}</optgroup>}
    </>
  );
}
