export interface VinculoDoRegistro {
  id: string;
  empresaId: string;
  pessoaId: string | null;
  leadId: string | null;
  k: "cliente" | "aquisicao" | "opp" | "proposta";
  titulo: string;
  sub: string;
  status: string;
}

export interface RelacaoDoRegistro extends VinculoDoRegistro {
  tipo: string;
  href: string;
  tom: "verde" | "coral";
}

export function relacoesDoRegistro(
  _vinculos: VinculoDoRegistro[],
  _alvo: { empresaId: string; leadId?: string | null; pessoaId?: string | null },
): RelacaoDoRegistro[] {
  return [];
}
