/**
 * Resolução canônica de identidade (SPEC §6, §40).
 *
 * Esta é a porta única por onde empresa e pessoa nascem ou são reencontradas.
 * Hoje existem 45 lugares escrevendo em `leads` e só 3 passando pela regra: é
 * essa dispersão que produziu 2.378 leads sem estágio e 1.442 negócios sem
 * família. Cada porta preenchia o que sabia e ignorava o resto.
 *
 * Regras que valem para qualquer origem — UI, API, webhook, worker, agente:
 *
 *   - pessoa se identifica por e-mail normalizado, depois telefone;
 *   - empresa se identifica por CNPJ, depois domínio. NUNCA por nome parecido;
 *   - quando a identidade é ambígua, devolve-se o caso em vez de escolher.
 *
 * Pacote de domínio: sem SDK, sem framework, sem ORM. Recebe um repositório
 * com as buscas de que precisa e devolve a decisão.
 */

export interface DadosPessoa {
  nome?: string | null;
  sobrenome?: string | null;
  email?: string | null;
  telefone?: string | null;
  cargo?: string | null;
}

export interface DadosEmpresa {
  nome?: string | null;
  cnpj?: string | null;
  dominio?: string | null;
  website?: string | null;
}

/** E-mail comparável. Não remove subendereço (+tag): pode ser conta distinta. */
export function normalizarEmail(v?: string | null): string | null {
  const e = (v ?? "").trim().toLowerCase();
  return e.includes("@") && e.length >= 5 ? e : null;
}

/** Só dígitos, sem o 55. Abaixo de 10 dígitos não identifica ninguém no Brasil. */
export function normalizarTelefone(v?: string | null): string | null {
  const d = (v ?? "").replace(/\D/g, "");
  const semPais = d.startsWith("55") && d.length > 11 ? d.slice(2) : d;
  return semPais.length >= 10 ? semPais : null;
}

/** CNPJ só dígitos. 14 posições ou não serve como chave. */
export function normalizarCnpj(v?: string | null): string | null {
  const d = (v ?? "").replace(/\D/g, "");
  return d.length === 14 ? d : null;
}

/** Domínio corporativo do e-mail. Provedor pessoal não identifica empresa:
 *  `joao@gmail.com` não significa que a empresa é o Gmail. */
const PROVEDOR_PESSOAL = new Set([
  "gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "yahoo.com.br",
  "live.com", "icloud.com", "bol.com.br", "uol.com.br", "terra.com.br",
  "globo.com", "me.com", "msn.com", "protonmail.com",
]);

export function dominioCorporativo(email?: string | null, website?: string | null): string | null {
  if (website) {
    const d = website.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].trim().toLowerCase();
    if (d && d.includes(".")) return d;
  }
  const e = normalizarEmail(email);
  if (!e) return null;
  const d = e.split("@")[1];
  return d && !PROVEDOR_PESSOAL.has(d) ? d : null;
}

/** O que o domínio precisa perguntar ao mundo. A implementação vive em
 *  platform/database; aqui só existe o contrato. */
export interface RepositorioIdentidade {
  acharPessoaPorEmail(organizacaoId: string, email: string): Promise<{ id: string } | null>;
  acharPessoaPorTelefone(organizacaoId: string, telefone: string): Promise<{ id: string } | null>;
  acharEmpresaPorCnpj(organizacaoId: string, cnpj: string): Promise<{ id: string } | null>;
  acharEmpresaPorDominio(organizacaoId: string, dominio: string): Promise<{ id: string } | null>;
}

export type ResolucaoPessoa =
  | { achou: true; pessoaId: string; por: "EMAIL" | "TELEFONE" }
  | { achou: false; motivo: "SEM_IDENTIFICADOR" | "NAO_ENCONTRADA"; chaves: { email: string | null; telefone: string | null } };

export type ResolucaoEmpresa =
  | { achou: true; empresaId: string; por: "CNPJ" | "DOMINIO" }
  | { achou: false; motivo: "SEM_IDENTIFICADOR" | "NAO_ENCONTRADA"; chaves: { cnpj: string | null; dominio: string | null } };

/**
 * Encontra a pessoa pelos sinais determinísticos, em ordem de confiança.
 * Não cria nada: quem decide criar é o comando que chamou, porque só ele sabe
 * se faz sentido criar naquele contexto.
 */
export async function resolverPessoa(
  repo: RepositorioIdentidade, organizacaoId: string, dados: DadosPessoa,
): Promise<ResolucaoPessoa> {
  const email = normalizarEmail(dados.email);
  const telefone = normalizarTelefone(dados.telefone);
  if (!email && !telefone) {
    return { achou: false, motivo: "SEM_IDENTIFICADOR", chaves: { email: null, telefone: null } };
  }
  if (email) {
    const p = await repo.acharPessoaPorEmail(organizacaoId, email);
    if (p) return { achou: true, pessoaId: p.id, por: "EMAIL" };
  }
  if (telefone) {
    const p = await repo.acharPessoaPorTelefone(organizacaoId, telefone);
    if (p) return { achou: true, pessoaId: p.id, por: "TELEFONE" };
  }
  return { achou: false, motivo: "NAO_ENCONTRADA", chaves: { email, telefone } };
}

/**
 * Encontra a empresa por CNPJ ou domínio.
 *
 * O SPEC §40 é explícito: "Do not merge companies only by fuzzy name." Nome é
 * usado só para CRIAR, nunca para casar com uma existente — duas empresas
 * chamadas "Silva Ltda" não são a mesma.
 */
export async function resolverEmpresa(
  repo: RepositorioIdentidade, organizacaoId: string, dados: DadosEmpresa,
): Promise<ResolucaoEmpresa> {
  const cnpj = normalizarCnpj(dados.cnpj);
  const dominio = dominioCorporativo(null, dados.website ?? dados.dominio);
  if (!cnpj && !dominio) {
    return { achou: false, motivo: "SEM_IDENTIFICADOR", chaves: { cnpj: null, dominio: null } };
  }
  if (cnpj) {
    const e = await repo.acharEmpresaPorCnpj(organizacaoId, cnpj);
    if (e) return { achou: true, empresaId: e.id, por: "CNPJ" };
  }
  if (dominio) {
    const e = await repo.acharEmpresaPorDominio(organizacaoId, dominio);
    if (e) return { achou: true, empresaId: e.id, por: "DOMINIO" };
  }
  return { achou: false, motivo: "NAO_ENCONTRADA", chaves: { cnpj, dominio } };
}
