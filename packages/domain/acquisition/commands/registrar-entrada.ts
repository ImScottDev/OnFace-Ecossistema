/**
 * Entrada de aquisição vinda de fora (SPEC §3.2, §8, §9).
 *
 * O SPEC define um caminho único para todo dado externo:
 *
 *   provedor → adapter → evento cru → normalização/identidade
 *            → COMANDO DE DOMÍNIO → dado canônico → evento de domínio
 *
 * Este é o comando. Meta, RD, formulário do site, Apollo e importação de
 * planilha chegam todos aqui. Nenhum deles escreve no banco por conta própria.
 *
 * O que isto corrige, concretamente: hoje `rd-lead` insere direto em `leads`,
 * `status_changes` e `notas`, e cria a tarefa por fora; `site-lead` passa pelo
 * motor canônico; Apollo e prospecção escrevem direto. Três caminhos, três
 * resultados diferentes para o mesmo fato.
 *
 * Pacote de domínio: sem SDK, sem framework, sem ORM.
 */
import {
  resolverPessoa, resolverEmpresa, normalizarEmail, normalizarTelefone,
  type RepositorioIdentidade, type DadosPessoa, type DadosEmpresa,
} from "../../identity/commands/resolver-identidade";

export type TipoAquisicao = "INBOUND" | "OUTBOUND" | "REFERRAL" | "IMPORT" | "MANUAL";

export interface Atribuicao {
  utmSource?: string | null; utmMedium?: string | null; utmCampaign?: string | null;
  utmTerm?: string | null; utmContent?: string | null;
  gclid?: string | null; fbclid?: string | null; fbc?: string | null; fbp?: string | null;
  metaLeadId?: string | null; campaignId?: string | null; adsetId?: string | null; adId?: string | null;
  landingPage?: string | null; referrer?: string | null;
}

export interface EntradaAquisicao {
  organizacaoId: string;
  tipo: TipoAquisicao;
  origem?: string | null;
  provider?: string | null;
  pessoa: DadosPessoa;
  empresa?: DadosEmpresa | null;
  atribuicao?: Atribuicao | null;
  responsavelId?: string | null;
  /** Chave estável do fato externo. Reentrega do webhook não cria segunda
   *  aquisição: é o mesmo lead chegando de novo. */
  idempotencyKey?: string | null;
  ocorridoEm?: Date | null;
  /**
   * Lead legado que originou esta entrada, quando existe.
   *
   * Não é decoração de migração: a leitura canônica do board devolve este id
   * como o identificador do card, e `sincronizarAquisicaoDoLead` casa os dois
   * modelos por ele. Aquisição criada em runtime sem este vínculo nasce órfã —
   * o card não abre e nada do lead volta a propagar para ela.
   */
  leadLegadoId?: string | null;
}

export interface RepositorioAquisicao extends RepositorioIdentidade {
  criarPessoa(organizacaoId: string, dados: DadosPessoa, empresaId: string | null): Promise<string>;
  criarEmpresa(organizacaoId: string, dados: DadosEmpresa): Promise<string>;
  vincularPessoaEmpresa(organizacaoId: string, pessoaId: string, empresaId: string, cargo: string | null): Promise<void>;
  acharAquisicaoPorChave(organizacaoId: string, chave: string): Promise<{ id: string } | null>;
  /** Aquisição ABERTA da mesma PESSOA. O SPEC §8.1 permite várias ao longo do
   *  tempo, mas duas abertas ao mesmo tempo para a mesma pessoa são a mesma coisa
   *  duplicada. Outra pessoa da mesma empresa é outra aquisição. */
  acharAquisicaoAberta(organizacaoId: string, pessoaId: string | null): Promise<{ id: string } | null>;
  criarAquisicao(entrada: EntradaAquisicao & { pessoaId: string | null; empresaId: string | null }): Promise<string>;
  /**
   * Grava a chave do fato externo APONTANDO para a aquisição que o recebeu.
   * Existia só dentro de `criarAquisicao`, então quando a entrada caía numa
   * aquisição já aberta a chave nunca era registrada e a reentrega do mesmo
   * `leadgen_id` voltava a abrir ponto de contato. A Meta reentrega sempre que
   * não recebe 200 rápido.
   */
  registrarChave(aquisicaoId: string, entrada: EntradaAquisicao): Promise<void>;
  registrarTouchpoint(aquisicaoId: string, entrada: EntradaAquisicao & { pessoaId: string | null; empresaId: string | null }): Promise<void>;
  /** Política de dono da fila de inbound. Devolve null quando não configurada,
   *  e aí a aquisição nasce sem dono, o que é um fato a reportar, não um erro
   *  a esconder: era assim que todo lead novo caía em limbo. */
  donoDaFilaInbound(organizacaoId: string): Promise<string | null>;
}

export type ResultadoEntrada =
  | { ok: true; aquisicaoId: string; pessoaId: string | null; empresaId: string | null; criada: boolean; semDono: boolean }
  | { ok: false; erro: string; codigo: "SEM_IDENTIFICADOR" | "SEM_ORGANIZACAO" };

/**
 * Registra a entrada, resolvendo identidade antes de criar processo.
 *
 * A ordem importa e é a do SPEC §9: empresa e pessoa primeiro, aquisição
 * depois. Criar a aquisição antes deixaria um processo órfão se a identidade
 * falhasse no meio.
 */
export async function registrarEntrada(
  repo: RepositorioAquisicao, entrada: EntradaAquisicao,
): Promise<ResultadoEntrada> {
  if (!entrada.organizacaoId) {
    return { ok: false, erro: "organização não informada", codigo: "SEM_ORGANIZACAO" };
  }

  const email = normalizarEmail(entrada.pessoa.email);
  const telefone = normalizarTelefone(entrada.pessoa.telefone);
  if (!email && !telefone) {
    // Sem nenhum identificador não há como saber se já existe. Criar às cegas
    // é como a base ganhou duplicata durante anos.
    return { ok: false, erro: "informe e-mail ou telefone", codigo: "SEM_IDENTIFICADOR" };
  }

  // Reentrega do mesmo fato externo devolve o que já existe.
  if (entrada.idempotencyKey) {
    const ja = await repo.acharAquisicaoPorChave(entrada.organizacaoId, entrada.idempotencyKey);
    if (ja) return { ok: true, aquisicaoId: ja.id, pessoaId: null, empresaId: null, criada: false, semDono: false };
  }

  // 1. Empresa. Pode não existir: o formulário publicado nem sempre pergunta.
  let empresaId: string | null = null;
  if (entrada.empresa && (entrada.empresa.cnpj || entrada.empresa.website || entrada.empresa.dominio || entrada.empresa.nome)) {
    const r = await resolverEmpresa(repo, entrada.organizacaoId, entrada.empresa);
    empresaId = r.achou ? r.empresaId : (entrada.empresa.nome ? await repo.criarEmpresa(entrada.organizacaoId, entrada.empresa) : null);
  }

  // 2. Pessoa.
  const rp = await resolverPessoa(repo, entrada.organizacaoId, entrada.pessoa);
  const pessoaId = rp.achou ? rp.pessoaId : await repo.criarPessoa(entrada.organizacaoId, entrada.pessoa, empresaId);
  if (empresaId) {
    await repo.vincularPessoaEmpresa(entrada.organizacaoId, pessoaId, empresaId, entrada.pessoa.cargo ?? null);
  }

  // 3. Aquisição. Já existe uma aberta para esta PESSOA? Então é a mesma entrada
  //    chegando de novo, não um processo novo. Outra pessoa da mesma empresa abre a sua.
  const aberta = await repo.acharAquisicaoAberta(entrada.organizacaoId, pessoaId);
  if (aberta) {
    await repo.registrarTouchpoint(aberta.id, { ...entrada, pessoaId, empresaId });
    if (entrada.idempotencyKey) await repo.registrarChave(aberta.id, entrada);
    return { ok: true, aquisicaoId: aberta.id, pessoaId, empresaId, criada: false, semDono: false };
  }

  const responsavelId = entrada.responsavelId ?? (await repo.donoDaFilaInbound(entrada.organizacaoId));
  const aquisicaoId = await repo.criarAquisicao({ ...entrada, pessoaId, empresaId, responsavelId });
  await repo.registrarTouchpoint(aquisicaoId, { ...entrada, pessoaId, empresaId });
  if (entrada.idempotencyKey) await repo.registrarChave(aquisicaoId, entrada);

  return { ok: true, aquisicaoId, pessoaId, empresaId, criada: true, semDono: !responsavelId };
}
