/**
 * Onde moram as fichas base de Pessoa e de Empresa. Fonte ÚNICA para todo
 * "abrir contato" / "abrir empresa": lista, drawer, toast pós-criação, busca
 * global e `rotaDoDesenho` apontam para cá.
 *
 * A ficha da pessoa (PessoaProto) é chaveada pelo id do LEAD; a da empresa
 * (EmpresaProto), pelo id da empresa. `/contatos/pessoas/:id` NÃO é ficha: é
 * só a porta que traduz id de pessoa canônica no id de lead e redireciona.
 */
export const rotaDaPessoa = (leadId: string) => `/pessoas/${encodeURIComponent(leadId)}`;
export const rotaDaEmpresa = (empresaId: string) => `/empresas/${encodeURIComponent(empresaId)}`;
/** Só se conhece o id da pessoa canônica: a porta resolve o lead e redireciona para a ficha. */
export const rotaDaPessoaCanonica = (pessoaId: string) => `/contatos/pessoas/${encodeURIComponent(pessoaId)}`;
