/**
 * Motor de Propostas (Bloco 03).
 *
 * A criação de proposta com itens, o checkout e o contrato já existiam e
 * continuam sendo usados como estão (`lib/crm/proposta-criacao.ts`,
 * `enviar-proposta.ts`, `proposta-aceite.ts`). O que faltava e mora aqui são
 * as regras que a spec fechou:
 *
 *   - catálogo filtrado pela família da oportunidade (§2);
 *   - modo de fechamento escolhido ANTES do envio (§7);
 *   - dados jurídicos obrigatórios para proposta contratual (§17);
 *   - envio move a oportunidade para Proposta (§9);
 *   - versionamento: proposta enviada não se edita, cria-se revisão (§13);
 *   - aceite NÃO é ganho (§26).
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { registrarEvento } from "./eventos";
import { moverEtapa } from "./pipeline";
import {
  juntarEndereco, separarEndereco, comPadraoDaPolitica, ehCliente, emailValido, faltaRepresentante, normalizarSignatarios, PAPEL_CLIENTE,
} from "@/lib/crm/proposta-signatarios";
import {
  ehFamiliaValida, RegraDeNegocio, ROTULO_FAMILIA, VALIDADES_PROPOSTA, TIPOS_CONTRATUAIS_COM_BASE,
  type Ator, type Familia, type ModoFechamento, type NaturezaReceita,
  type StatusProposta, type TipoContratual,
} from "./dominio";

/* ── Catálogo filtrado pela família (Bloco 03 §2) ──────────────────────── */

export interface ItemCatalogo {
  catalogoPrecoId: string;
  servicoCatalogoId: string;
  nome: string;
  variacao: string | null;
  sku: string | null;
  valor: string;
  naturezaReceita: NaturezaReceita | "UNKNOWN";
  familia: string | null;
  exigeContrato: boolean;
}

/**
 * Catálogo comercial de uma família.
 *
 * Bloco 03 §2 e §30: mostrar o catálogo de todas as famílias ao criar proposta
 * é proibido — reduz erro comercial e mantém proposta coerente com a
 * oportunidade.
 *
 * Itens sem família no cadastro NÃO entram. É uma decisão consciente: incluir
 * o não classificado "por garantia" traria de volta exatamente a mistura que a
 * regra existe para impedir. O que falta classificar está registrado como
 * dependência em docs/produto/modulo-01-vendas-implementacao.md.
 */
export async function catalogoDaFamilia(organizacaoId: string, familia: Familia): Promise<ItemCatalogo[]> {
  const linhas = await db.execute<{
    catalogo_preco_id: string; servico_catalogo_id: string; nome: string;
    variacao: string | null; sku: string | null; valor: string;
    revenue_nature: string; service_family: string | null; exige_contrato: boolean;
  }>(sql`
    SELECT cp.id::text AS catalogo_preco_id, sc.id::text AS servico_catalogo_id,
           sc.nome, cp.variacao, cp.sku, cp.valor::text,
           cp.revenue_nature, sc.service_family, cp.exige_contrato
      FROM catalogo_precos cp
      JOIN servicos_catalogo sc ON sc.id = cp.servico_catalogo_id
     WHERE sc.organizacao_id = ${organizacaoId}::uuid
       AND sc.service_family = ${familia}
       AND COALESCE(cp.ativo, true) = true
     ORDER BY sc.nome, cp.variacao
  `);

  return linhas.map((l) => ({
    catalogoPrecoId: l.catalogo_preco_id,
    servicoCatalogoId: l.servico_catalogo_id,
    nome: l.nome,
    variacao: l.variacao,
    sku: l.sku,
    valor: l.valor,
    naturezaReceita: (l.revenue_nature as NaturezaReceita) ?? "UNKNOWN",
    familia: l.service_family,
    exigeContrato: l.exige_contrato,
  }));
}

/* ── Dados jurídicos (Bloco 03 §17) ────────────────────────────────────── */

export const CAMPOS_JURIDICOS = [
  { campo: "razaoSocial", coluna: "razao_social", rotulo: "Razão social" },
  { campo: "cnpj", coluna: "cnpj", rotulo: "CNPJ" },
  { campo: "logradouro", coluna: "logradouro", rotulo: "Rua" },
  { campo: "numero", coluna: "numero", rotulo: "Número" },
  { campo: "bairro", coluna: "bairro", rotulo: "Bairro" },
  { campo: "cidade", coluna: "cidade", rotulo: "Cidade" },
  { campo: "estado", coluna: "estado", rotulo: "Estado" },
  { campo: "cep", coluna: "cep", rotulo: "CEP" },
] as const;

export interface DadosJuridicos {
  razaoSocial?: string | null;
  cnpj?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
}

/** Devolve os campos que faltam na Empresa para uma proposta contratual. */
export async function conferirDadosJuridicos(
  organizacaoId: string, empresaId: string,
): Promise<{ completo: boolean; faltando: string[] }> {
  const [empresa] = await db.execute<Record<string, string | null>>(sql`
    SELECT razao_social, cnpj, logradouro, numero, bairro, cidade, estado, cep
      FROM empresas WHERE id = ${empresaId}::uuid AND organizacao_id = ${organizacaoId}::uuid
  `);
  if (!empresa) throw new RegraDeNegocio("empresa_nao_encontrada", "Empresa não encontrada.");

  const faltando = CAMPOS_JURIDICOS
    .filter(({ coluna }) => !empresa[coluna]?.toString().trim())
    .map(({ rotulo }) => rotulo);

  return { completo: faltando.length === 0, faltando };
}

/**
 * Grava os dados jurídicos na EMPRESA.
 *
 * Bloco 03 §17 é explícito: os dados preenchidos atualizam a Empresa, não
 * ficam dentro da proposta. É isso que os deixa disponíveis para as próximas
 * propostas e contratos, em vez de serem redigitados toda vez.
 */
export async function salvarDadosJuridicos(params: {
  organizacaoId: string;
  empresaId: string;
  dados: DadosJuridicos;
  ator: Ator;
}): Promise<void> {
  const { dados } = params;
  await db.execute(sql`
    UPDATE empresas SET
      razao_social = COALESCE(${dados.razaoSocial ?? null}, razao_social),
      cnpj = COALESCE(${dados.cnpj ?? null}, cnpj),
      logradouro = COALESCE(${dados.logradouro ?? null}, logradouro),
      numero = COALESCE(${dados.numero ?? null}, numero),
      complemento = COALESCE(${dados.complemento ?? null}, complemento),
      bairro = COALESCE(${dados.bairro ?? null}, bairro),
      cidade = COALESCE(${dados.cidade ?? null}, cidade),
      estado = COALESCE(${dados.estado ?? null}, estado),
      cep = COALESCE(${dados.cep ?? null}, cep),
      updated_at = now()
    WHERE id = ${params.empresaId}::uuid AND organizacao_id = ${params.organizacaoId}::uuid
  `);
}

export interface DadosDaPessoaNoContrato {
  cargo?: string | null;
  email?: string | null;
  telefone?: string | null;
  cpf?: string | null;
}

/**
 * Grava o signatário do cliente na PESSOA (contato), não na proposta: é o que
 * faz a próxima proposta da mesma empresa já vir preenchida. Acha a pessoa pelo
 * id ou pelo nome dentro da empresa; se ela não existe e há nome + e-mail
 * válido, cria pela porta de identidade (que reaproveita quem já tem o e-mail).
 * Sem nenhum dos dois, não grava e devolve `salvo: false`.
 */
export async function salvarDadosDaPessoa(params: {
  organizacaoId: string; empresaId: string; pessoaId?: string | null; nome: string;
  dados: DadosDaPessoaNoContrato; ator: Ator;
}): Promise<{ salvo: boolean; pessoaId: string | null }> {
  const { organizacaoId, empresaId, dados } = params;
  const nome = params.nome.trim();
  let pessoaId: string | null = null;
  if (params.pessoaId) {
    const [p] = await db.execute<{ id: string }>(sql`
      SELECT id::text FROM pessoas WHERE id = ${params.pessoaId}::uuid AND organizacao_id = ${organizacaoId}::uuid`);
    pessoaId = p?.id ?? null;
  }
  if (!pessoaId && nome) {
    const [p] = await db.execute<{ id: string }>(sql`
      SELECT id::text FROM pessoas
       WHERE organizacao_id = ${organizacaoId}::uuid AND empresa_id = ${empresaId}::uuid
         AND lower(trim(nome || ' ' || COALESCE(sobrenome, ''))) = lower(${nome})
       ORDER BY created_at LIMIT 1`);
    pessoaId = p?.id ?? null;
  }
  if (!pessoaId) {
    if (!nome || !emailValido(dados.email)) return { salvo: false, pessoaId: null };
    const { resolverPessoa } = await import("./identidade");
    pessoaId = (await resolverPessoa(organizacaoId, { nome, email: dados.email, telefone: dados.telefone, cargo: dados.cargo, empresaId }, params.ator)).pessoaId;
  }
  await db.execute(sql`
    UPDATE pessoas SET
      cargo = COALESCE(${dados.cargo ?? null}, cargo),
      email = COALESCE(${dados.email ?? null}, email),
      telefone = COALESCE(${dados.telefone ?? null}, telefone),
      metadata = CASE WHEN ${dados.cpf ?? null}::text IS NULL THEN metadata
                      ELSE COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('cpf', ${dados.cpf ?? null}::text) END,
      updated_at = now()
    WHERE id = ${pessoaId}::uuid AND organizacao_id = ${organizacaoId}::uuid
  `);
  return { salvo: true, pessoaId };
}

/**
 * A porta do modal "Dados do contrato": empresa e contato numa chamada só. O
 * endereço é UM campo na tela ("Rua, número e complemento") e se separa nas
 * colunas da empresa. Só vai o que o usuário mudou; "" limpa, ausente mantém.
 */
export async function salvarDadosDoContrato(params: {
  organizacaoId: string; empresaId: string; ator: Ator;
  empresa?: { razao?: string; cnpj?: string; rua?: string; bairro?: string; cep?: string; cidade?: string; uf?: string };
  pessoa?: { pessoaId?: string | null; nome: string; cargo?: string; email?: string; telefone?: string; cpf?: string };
}): Promise<{ pessoaSalva: boolean; pessoaId: string | null }> {
  const e = params.empresa;
  if (e) {
    const fim = e.rua !== undefined ? separarEndereco(e.rua) : null;
    await salvarDadosJuridicos({
      organizacaoId: params.organizacaoId, empresaId: params.empresaId, ator: params.ator,
      dados: {
        razaoSocial: e.razao, cnpj: e.cnpj, bairro: e.bairro, cep: e.cep, cidade: e.cidade,
        estado: e.uf !== undefined ? e.uf.trim().toUpperCase() : undefined,
        logradouro: fim?.logradouro, numero: fim?.numero, complemento: fim?.complemento,
      },
    });
  }
  let pessoa: { salvo: boolean; pessoaId: string | null } = { salvo: false, pessoaId: null };
  if (params.pessoa) {
    const p = params.pessoa;
    pessoa = await salvarDadosDaPessoa({
      organizacaoId: params.organizacaoId, empresaId: params.empresaId, pessoaId: p.pessoaId ?? null, nome: p.nome, ator: params.ator,
      dados: { cargo: p.cargo, email: p.email, telefone: p.telefone, cpf: p.cpf },
    });
  }
  return { pessoaSalva: pessoa.salvo, pessoaId: pessoa.pessoaId };
}

/**
 * O que o modal e o Builder leem ao abrir: os dados da Empresa no formato do
 * modal e o comitê (com cargo, telefone e CPF). É a MESMA consulta para a
 * primeira proposta e para qualquer outra da empresa.
 */
export async function lerDadosDoContrato(organizacaoId: string, empresaId: string | null): Promise<{
  empresaDados: Record<string, string> | undefined;
  contatos: Array<{ id: string; nome: string; cargo: string | null; email: string | null; telefone: string | null; cpf: string | null }>;
}> {
  if (!empresaId) return { empresaDados: undefined, contatos: [] };
  const [emp] = await db.execute<Record<string, string | null>>(sql`
    SELECT razao_social, nome, cnpj, logradouro, numero, complemento, bairro, cep, cidade, estado
      FROM empresas WHERE id = ${empresaId}::uuid AND organizacao_id = ${organizacaoId}::uuid
  `);
  const contatos = await db.execute<{ id: string; nome: string; cargo: string | null; email: string | null; telefone: string | null; cpf: string | null }>(sql`
    SELECT id::text, trim(COALESCE(nome, 'Sem nome') || ' ' || COALESCE(sobrenome, '')) AS nome, cargo, email, telefone,
           metadata->>'cpf' AS cpf
      FROM pessoas
     WHERE empresa_id = ${empresaId}::uuid AND organizacao_id = ${organizacaoId}::uuid
     ORDER BY nome LIMIT 50
  `);
  const empresaDados = emp ? {
    razao: emp.razao_social ?? "", fantasia: emp.nome ?? "", cnpj: emp.cnpj ?? "",
    rua: juntarEndereco({ logradouro: emp.logradouro, numero: emp.numero, complemento: emp.complemento }),
    bairro: emp.bairro ?? "", cep: emp.cep ?? "", cidadeCob: emp.cidade ?? "", uf: emp.estado ?? "",
  } : undefined;
  return { empresaDados, contatos: [...contatos] };
}

/** As propostas da oportunidade COM os itens, o editor e os signatários: o que o Builder abre. */
export async function lerPropostasDoNegocio(organizacaoId: string, negocioId: string) {
  return db.execute<{
    id: string; numero: number; versao: number; status: string; modo: string | null; validade_dias: number | null;
    observacoes: string | null; prazo: number | null; parcelas: number | null; editor: Record<string, unknown> | null; signatarios: unknown;
    itens: Array<{ id: string; preco: string | null; prod: string | null; nome: string; descricao: string | null; natureza: string | null; tipo: string;
      quantidade: string; valor_unitario: string; desconto: string; desconto_tipo: string }> | null;
  }>(sql`
    SELECT p.id::text, p.numero, p.versao, p.status, p.modo_fechamento AS modo, p.validade_dias,
           p.observacoes, p.prazo_contrato_meses AS prazo, p.parcelas, p.editor, p.signatarios,
           (SELECT json_agg(json_build_object(
                     'id', i.id, 'preco', i.catalogo_preco_id, 'prod', i.servico_catalogo_id, 'nome', i.nome,
                     'descricao', i.descricao, 'natureza', i.revenue_nature, 'tipo', i.tipo,
                     'quantidade', i.quantidade, 'valor_unitario', i.valor_unitario,
                     'desconto', i.desconto, 'desconto_tipo', i.desconto_tipo) ORDER BY i.ordem, i.created_at)
              FROM proposta_itens i WHERE i.proposta_id = p.id) AS itens
      FROM propostas p
     WHERE p.negocio_id = ${negocioId}::uuid AND p.organizacao_id = ${organizacaoId}::uuid
     ORDER BY p.numero, p.versao
  `);
}

/* ── Leitura de apoio ──────────────────────────────────────────────────── */

interface PropostaInterna extends Record<string, unknown> {
  id: string;
  organizacao_id: string;
  negocio_id: string | null;
  lead_id: string | null;
  empresa_id: string | null;
  numero: number;
  versao: number;
  status: StatusProposta;
  modo_fechamento: ModoFechamento | null;
  service_family: string | null;
  etapa_oportunidade: string | null;
  familia_oportunidade: string | null;
}

async function carregarProposta(organizacaoId: string, propostaId: string): Promise<PropostaInterna> {
  const [p] = await db.execute<PropostaInterna>(sql`
    SELECT p.id::text, p.organizacao_id::text, p.negocio_id::text, p.lead_id::text,
           n.empresa_id::text AS empresa_id, p.numero, p.versao, p.status,
           p.modo_fechamento, p.service_family,
           n.etapa AS etapa_oportunidade,
           -- A familia vem do canonico quando o legado nao tem, e aqui isso
           -- nao e cosmetico: sem familia valida, ENVIAR PROPOSTA e recusado
           -- com "Defina a familia comercial antes de enviar".
           --
           -- Medido: 526 negocios abertos sem familia no legado, e em 125 deles
           -- a oportunidade canonica sabe qual e. Ha 43 propostas em rascunho
           -- nesses negocios, paradas por um dado que o sistema tem.
           COALESCE(n.service_family, o.service_family) AS familia_oportunidade
      FROM propostas p
      LEFT JOIN negocios n ON n.id = p.negocio_id
      LEFT JOIN oportunidades o ON o.negocio_id_legado = n.id
     WHERE p.id = ${propostaId}::uuid AND p.organizacao_id = ${organizacaoId}::uuid
  `);
  if (!p) throw new RegraDeNegocio("proposta_nao_encontrada", "Proposta não encontrada.");
  return p;
}

/* ── Envio (Bloco 03 §3, §6, §7, §9) ───────────────────────────────────── */

export interface EnvioDeProposta {
  organizacaoId: string;
  propostaId: string;
  modoFechamento: ModoFechamento;
  validadeDias: number;
  tipoContratual?: TipoContratual | null;
  contratoBaseId?: string | null;
  ator: Ator;
}

/**
 * Prepara e envia a proposta.
 *
 * A validação acontece ANTES de qualquer efeito: a spec pede que o envio seja
 * bloqueado quando faltar dado, com a mensagem e a etapa de completar os
 * dados. Enviar primeiro e corrigir depois deixaria o cliente com uma proposta
 * que não pode virar contrato.
 *
 * O envio move a oportunidade para Proposta automaticamente quando ela está em
 * etapa anterior (§9) — e é o único caminho que pode furar o gate de etapa,
 * porque aqui a proposta existe de verdade.
 */
export async function enviarProposta(envio: EnvioDeProposta): Promise<{ propostaId: string }> {
  const proposta = await carregarProposta(envio.organizacaoId, envio.propostaId);

  if (proposta.status !== "rascunho") {
    throw new RegraDeNegocio(
      "proposta_ja_enviada",
      "Esta proposta já foi enviada. Para mudar a oferta, crie uma revisão.",
      { rotulo: "Criar revisão", tipo: "criar_revisao" },
    );
  }
  if (!VALIDADES_PROPOSTA.includes(envio.validadeDias as (typeof VALIDADES_PROPOSTA)[number])) {
    throw new RegraDeNegocio("validade_invalida", "Escolha uma validade entre 7, 14, 22 ou 30 dias.");
  }
  if (!proposta.negocio_id) {
    throw new RegraDeNegocio("proposta_sem_oportunidade", "Proposta precisa estar vinculada a uma oportunidade.");
  }
  if (!ehFamiliaValida(proposta.familia_oportunidade)) {
    throw new RegraDeNegocio(
      "proposta_exige_familia",
      "Defina a família comercial antes de enviar uma proposta.",
      { rotulo: "Definir família", tipo: "alterar_familia" },
    );
  }

  const [temItens] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM proposta_itens WHERE proposta_id = ${envio.propostaId}::uuid
  `);
  if ((temItens?.n ?? 0) === 0) {
    throw new RegraDeNegocio("proposta_sem_itens", "A proposta precisa de pelo menos um item.");
  }

  if (envio.modoFechamento === "CONTRACT") {
    if (!proposta.empresa_id) {
      throw new RegraDeNegocio("proposta_sem_empresa", "Proposta contratual exige uma Empresa vinculada.");
    }
    const juridicos = await conferirDadosJuridicos(envio.organizacaoId, proposta.empresa_id);
    if (!juridicos.completo) {
      throw new RegraDeNegocio(
        "dados_juridicos_incompletos",
        `Para seguir com uma proposta contratual, complete os dados jurídicos e de endereço da empresa. Falta: ${juridicos.faltando.join(", ")}.`,
        { rotulo: "Completar dados da empresa", tipo: "completar_dados_empresa" },
      );
    }
    // Os signatários vêm do que o vendedor informou na proposta (cliente e Callface).
    // Sem nenhum do cliente, o contato da proposta assina; sem e-mail dele, bloqueia
    // AGORA, antes de o cliente ver a proposta. Com o Documenso ligado, a Callface
    // também assina: o representante legal sai da proposta ou, na falta dela, do
    // padrão de Ajustes > Contratos, e sem e-mail nenhum dos dois o envio para.
    const [assina] = await db.execute<{ signatarios: unknown; nome: string | null; email: string | null }>(sql`
      SELECT p.signatarios, l.nome, l.email
        FROM propostas p LEFT JOIN leads l ON l.id = p.lead_id
       WHERE p.id = ${envio.propostaId}::uuid
    `);
    let sigs = normalizarSignatarios(assina?.signatarios);
    if (!sigs.some(ehCliente)) {
      if (!emailValido(assina?.email)) {
        throw new RegraDeNegocio(
          "proposta_sem_signatario",
          "Para uma proposta contratual, informe quem assina pelo cliente (com e-mail) em Contrato e pagamento, ou cadastre o e-mail do contato.",
        );
      }
      sigs = normalizarSignatarios([{ nome: assina!.nome || assina!.email, email: assina!.email!.trim(), papel: PAPEL_CLIENTE }, ...sigs]);
    }
    const { isDocumensoConfigured } = await import("@/lib/crm/signature/documenso-provider");
    if (isDocumensoConfigured()) {
      const { politicaContratual } = await import("@/lib/crm/contrato-politica");
      sigs = comPadraoDaPolitica(sigs, await politicaContratual(envio.organizacaoId));
      const falta = faltaRepresentante(sigs);
      if (falta) throw new RegraDeNegocio("representante_sem_email", falta);
    }
    // Congela o resultado na versão que vai ao cliente: o contrato copia daqui.
    await db.execute(sql`UPDATE propostas SET signatarios = ${JSON.stringify(sigs)}::jsonb WHERE id = ${envio.propostaId}::uuid`);
    if (envio.tipoContratual && TIPOS_CONTRATUAIS_COM_BASE.includes(envio.tipoContratual) && !envio.contratoBaseId) {
      throw new RegraDeNegocio(
        "contrato_base_obrigatorio",
        `${envio.tipoContratual} precisa referenciar o contrato existente que está sendo alterado.`,
      );
    }
  }

  const validade = new Date();
  validade.setDate(validade.getDate() + envio.validadeDias);

  await db.execute(sql`
    UPDATE propostas SET
      status = 'enviada',
      modo_fechamento = ${envio.modoFechamento},
      validade_dias = ${envio.validadeDias},
      data_validade = ${validade.toISOString().slice(0, 10)}::date,
      enviada_em = now(),
      tipo_contratual = ${envio.tipoContratual ?? null},
      contrato_base_id = ${envio.contratoBaseId ?? null}::uuid,
      service_family = COALESCE(service_family, ${proposta.familia_oportunidade ?? null}),
      updated_at = now()
     WHERE id = ${envio.propostaId}::uuid
  `);

  await registrarEvento({
    organizacaoId: envio.organizacaoId, tipo: "ProposalSent", ator: envio.ator,
    propostaId: envio.propostaId, negocioId: proposta.negocio_id, leadId: proposta.lead_id,
    empresaId: proposta.empresa_id,
    contexto: {
      modoFechamento: envio.modoFechamento, validadeDias: envio.validadeDias,
      tipoContratual: envio.tipoContratual ?? null,
      familia: proposta.familia_oportunidade,
    },
    timeline: {
      tipo: "nota", titulo: `Proposta #${proposta.numero} enviada`,
      descricao: `Validade de ${envio.validadeDias} dias · ${envio.modoFechamento === "CONTRACT" ? "Contrato" : "Pré-pago"}`,
    },
  });

  // Bloco 03 §9: se a oportunidade estiver em Entrada ou Diagnóstico, o avanço
  // é automático. Em Negociação ela fica onde está — enviar uma revisão não
  // deve puxar a negociação para trás.
  if (proposta.etapa_oportunidade === "entrada" || proposta.etapa_oportunidade === "diagnostico") {
    await moverEtapa({
      organizacaoId: envio.organizacaoId, negocioId: proposta.negocio_id,
      para: "proposta", ator: envio.ator, motivo: "Proposta enviada",
      ignorarGateDeProposta: true,
    });
  }

  return { propostaId: envio.propostaId };
}

/* ── Interação do cliente (Bloco 03 §11-12, §24-26) ────────────────────── */

/**
 * Registra a resposta do cliente na proposta pública.
 *
 * **Não decide nada.** Quem decide — se pode aceitar, se a validade venceu, se
 * forma grupo comercial, se dispara contrato ou checkout — continua sendo
 * `lib/crm/proposta-aceite.ts` e `lib/crm/proposta-publica.ts`, que já estavam
 * sólidos e são o único caminho da página pública. A spec manda reaproveitar,
 * não criar um segundo fluxo.
 *
 * O que esta função faz é o que faltava: gravar os campos novos do domínio
 * (`aceita_em`, `recusada_em`, `ajuste_solicitado_*`, status `visualizada`) e
 * pôr o evento na linha do tempo comercial. Sem isso, a resposta do cliente
 * existiria no fluxo antigo e sumiria da tela nova.
 */
export async function registrarRespostaDoCliente(params: {
  organizacaoId: string;
  propostaId: string;
  tipo: "visualizada" | "aceita" | "recusada" | "ajuste_solicitado";
  descricao?: string | null;
  contatoNome?: string | null;
  metadados?: Record<string, unknown> | null;
}): Promise<void> {
  const proposta = await carregarProposta(params.organizacaoId, params.propostaId);

  switch (params.tipo) {
    case "visualizada":
      // Só a primeira visualização muda o status; abrir o link de novo não é
      // uma resposta nova do cliente.
      await db.execute(sql`
        UPDATE propostas SET status = 'visualizada', updated_at = now()
         WHERE id = ${params.propostaId}::uuid AND status = 'enviada'
      `);
      break;
    case "aceita":
      await db.execute(sql`
        UPDATE propostas SET aceita_em = COALESCE(aceita_em, now()), updated_at = now()
         WHERE id = ${params.propostaId}::uuid
      `);
      break;
    case "recusada":
      await db.execute(sql`
        UPDATE propostas SET recusada_em = COALESCE(recusada_em, now()), updated_at = now()
         WHERE id = ${params.propostaId}::uuid
      `);
      break;
    case "ajuste_solicitado":
      await db.execute(sql`
        UPDATE propostas SET
          ajuste_solicitado_em = now(),
          ajuste_solicitado_descricao = ${params.descricao ?? null},
          updated_at = now()
         WHERE id = ${params.propostaId}::uuid
      `);
      break;
  }

  const gatePendente = proposta.modo_fechamento === "CONTRACT" ? "Contrato pendente" : "Pagamento pendente";

  const tipoEvento = params.tipo === "visualizada" ? "ProposalViewed"
    : params.tipo === "aceita" ? "ProposalAccepted"
    : params.tipo === "recusada" ? "ProposalRejected"
    : "ProposalAdjustmentRequested";

  const timeline = params.tipo === "visualizada" ? null : {
    tipo: "nota",
    titulo: params.tipo === "aceita" ? `Proposta #${proposta.numero} aceita`
      : params.tipo === "recusada" ? `Proposta #${proposta.numero} recusada`
      : `Cliente pediu ajuste na proposta #${proposta.numero}`,
    descricao: params.tipo === "aceita"
      // Bloco 03 §26: o aceite não fecha a venda. A timeline diz o que falta.
      ? `${gatePendente} — a oportunidade só fecha com a evidência.`
      : params.tipo === "recusada"
        ? `${params.descricao ? `Motivo do cliente: ${params.descricao}. ` : ""}A oportunidade continua aberta: perder exige decisão e motivo.`
        : params.descricao ?? null,
  };

  await registrarEvento({
    organizacaoId: params.organizacaoId,
    tipo: tipoEvento,
    ator: { tipo: "SYSTEM", usuarioId: null, ref: "proposta-publica" },
    propostaId: params.propostaId,
    negocioId: proposta.negocio_id,
    leadId: proposta.lead_id,
    empresaId: proposta.empresa_id,
    contexto: {
      versao: proposta.versao,
      contato: params.contatoNome ?? null,
      modoFechamento: proposta.modo_fechamento,
      ...(params.tipo === "aceita" ? { gatePendente } : {}),
      ...(params.descricao ? { descricao: params.descricao } : {}),
      ...(params.metadados ?? {}),
    },
    timeline,
  });
}

/* ── Versionamento (Bloco 03 §13, §28) ─────────────────────────────────── */

/**
 * Cria a revisão de uma proposta já enviada.
 *
 * A anterior vira `substituida` e deixa de poder ser aceita (§1 e §30); ela
 * continua no histórico, que é o ponto do versionamento. Editar em silêncio
 * uma proposta que o cliente já recebeu está entre as proibições.
 *
 * Copia itens, condições e modo de fechamento — quem revisa quase sempre muda
 * um item ou um desconto, não recomeça do zero.
 */
export async function criarRevisao(params: {
  organizacaoId: string;
  propostaId: string;
  ator: Ator;
}): Promise<{ propostaId: string; versao: number }> {
  const proposta = await carregarProposta(params.organizacaoId, params.propostaId);

  if (proposta.status === "rascunho") {
    throw new RegraDeNegocio("proposta_em_rascunho", "Esta proposta ainda é rascunho: edite-a diretamente.");
  }
  if (proposta.status === "aceita") {
    throw new RegraDeNegocio(
      "proposta_aceita",
      "A versão aceita é preservada. Uma renegociação posterior gera uma proposta nova.",
    );
  }

  const [nova] = await db.execute<{ id: string; versao: number }>(sql`
    INSERT INTO propostas (
      organizacao_id, lead_id, negocio_id, numero, versao, proposta_original_id,
      moeda, status, data_emissao, observacoes, condicoes_pagamento,
      condicao_pagamento_tipo, parcelas, vencimento_dias, prazo_contrato_meses,
      signatarios, editor, total_recorrente, total_avulso, total_geral, criado_por_id,
      modo_fechamento, validade_dias, tipo_contratual, contrato_base_id, service_family
    )
    SELECT organizacao_id, lead_id, negocio_id, numero, versao + 1,
           COALESCE(proposta_original_id, id),
           moeda, 'rascunho', CURRENT_DATE, observacoes, condicoes_pagamento,
           condicao_pagamento_tipo, parcelas, vencimento_dias, prazo_contrato_meses,
           signatarios, editor, total_recorrente, total_avulso, total_geral,
           ${params.ator.usuarioId ?? null}::uuid,
           modo_fechamento, validade_dias, tipo_contratual, contrato_base_id, service_family
      FROM propostas WHERE id = ${params.propostaId}::uuid
    RETURNING id::text, versao
  `);

  await db.execute(sql`
    INSERT INTO proposta_itens (
      proposta_id, servico_catalogo_id, nome, descricao, tipo, moeda, quantidade,
      valor_unitario, desconto, desconto_tipo, subtotal, ordem, commercial_model,
      catalogo_preco_id, stripe_product_id, stripe_price_id, sku_preco, variacao,
      valor_tabela, service_family, revenue_nature
    )
    SELECT ${nova.id}::uuid, servico_catalogo_id, nome, descricao, tipo, moeda, quantidade,
           valor_unitario, desconto, desconto_tipo, subtotal, ordem, commercial_model,
           catalogo_preco_id, stripe_product_id, stripe_price_id, sku_preco, variacao,
           valor_tabela, service_family, revenue_nature
      FROM proposta_itens WHERE proposta_id = ${params.propostaId}::uuid
  `);

  await db.execute(sql`
    UPDATE propostas SET
      status = 'substituida', substituida_em = now(), substituida_por_id = ${nova.id}::uuid, updated_at = now()
     WHERE id = ${params.propostaId}::uuid
  `);

  await registrarEvento({
    organizacaoId: params.organizacaoId, tipo: "ProposalSuperseded", ator: params.ator,
    propostaId: params.propostaId, negocioId: proposta.negocio_id,
    contexto: { novaPropostaId: nova.id, novaVersao: nova.versao },
    timeline: {
      tipo: "nota", titulo: `Proposta #${proposta.numero} revisada`,
      descricao: `v${proposta.versao} substituída pela v${nova.versao}`,
    },
  });

  await registrarEvento({
    organizacaoId: params.organizacaoId, tipo: "ProposalCreated", ator: params.ator,
    propostaId: nova.id, negocioId: proposta.negocio_id,
    contexto: { versao: nova.versao, revisaoDe: params.propostaId },
  });

  return { propostaId: nova.id, versao: nova.versao };
}

/**
 * Expira as propostas vencidas.
 *
 * Bloco 03 §6 e §14: expirar não perde a oportunidade. Só a proposta muda de
 * estado; a decisão de perder continua sendo humana e com motivo.
 */
export async function expirarPropostasVencidas(organizacaoId: string): Promise<number> {
  const vencidas = await db.execute<{ id: string; negocio_id: string | null; numero: number }>(sql`
    UPDATE propostas SET status = 'expirada', expirada_em = now(), updated_at = now()
     WHERE organizacao_id = ${organizacaoId}::uuid
       AND status IN ('enviada','visualizada','ajuste_solicitado')
       AND data_validade IS NOT NULL
       AND data_validade < CURRENT_DATE
    RETURNING id::text, negocio_id::text, numero
  `);

  for (const p of vencidas) {
    await registrarEvento({
      organizacaoId, tipo: "ProposalExpired",
      ator: { tipo: "SYSTEM", usuarioId: null, ref: "expiracao-automatica" },
      propostaId: p.id, negocioId: p.negocio_id,
      timeline: {
        tipo: "nota", titulo: `Proposta #${p.numero} expirou`,
        descricao: "A oportunidade continua aberta.",
      },
    });
  }

  return vencidas.length;
}

/* ── Composição financeira (Bloco 02 §14, Bloco 03 §5) ─────────────────── */

export interface ComposicaoFinanceira {
  recorrenteMensal: number;
  naoRecorrente: number;
  porNatureza: Array<{ natureza: string; total: number }>;
  /** Só existe quando há prazo contratual. Sem prazo, não se inventa TCV. */
  tcv: number | null;
  prazoMeses: number | null;
}

/**
 * Composição da proposta por natureza econômica.
 *
 * Bloco 03 §5 e §30: somar recorrência com setup e chamar de "valor total" é
 * proibido, porque engana. O recorrente e o não recorrente ficam separados, e
 * o TCV só aparece quando existe prazo contratual para multiplicar.
 */
export async function composicaoDaProposta(propostaId: string): Promise<ComposicaoFinanceira> {
  const itens = await db.execute<{ natureza: string | null; tipo: string; subtotal: string }>(sql`
    SELECT revenue_nature AS natureza, tipo, subtotal::text
      FROM proposta_itens WHERE proposta_id = ${propostaId}::uuid
  `);
  const [proposta] = await db.execute<{ prazo: number | null }>(sql`
    SELECT prazo_contrato_meses AS prazo FROM propostas WHERE id = ${propostaId}::uuid
  `);

  let recorrenteMensal = 0;
  let naoRecorrente = 0;
  const porNatureza = new Map<string, number>();

  for (const item of itens) {
    const valor = Number(item.subtotal) || 0;
    // A natureza do catálogo manda; `tipo` é o campo legado e só entra quando
    // a natureza não foi classificada.
    const natureza = item.natureza ?? (item.tipo === "recorrente" ? "MRR" : item.tipo === "setup" ? "SETUP" : "ONE_TIME");
    porNatureza.set(natureza, (porNatureza.get(natureza) ?? 0) + valor);
    if (natureza === "MRR") recorrenteMensal += valor;
    else naoRecorrente += valor;
  }

  const prazoMeses = proposta?.prazo ?? null;
  const tcv = prazoMeses && prazoMeses > 0 ? recorrenteMensal * prazoMeses + naoRecorrente : null;

  return {
    recorrenteMensal: Math.round(recorrenteMensal * 100) / 100,
    naoRecorrente: Math.round(naoRecorrente * 100) / 100,
    porNatureza: [...porNatureza.entries()].map(([natureza, total]) => ({
      natureza, total: Math.round(total * 100) / 100,
    })),
    tcv: tcv === null ? null : Math.round(tcv * 100) / 100,
    prazoMeses,
  };
}

/** Rótulo da família para as telas, sem cada uma reimplementar o mapa. */
export function rotuloFamilia(familia: string | null | undefined): string {
  if (!familia) return ROTULO_FAMILIA.UNKNOWN;
  return ROTULO_FAMILIA[familia as keyof typeof ROTULO_FAMILIA] ?? familia;
}

/* ── Recusa registrada pelo vendedor e exclusão de rascunho ────────────── */

/**
 * O cliente recusou por fora do link (ligação, reunião, WhatsApp) e o vendedor
 * registra. Mesmo efeito da recusa pública: status, instante da resposta, motivo
 * e o evento `ProposalRejected`, que aqui carrega QUEM registrou. A oportunidade
 * continua aberta: perder exige decisão e motivo.
 */
export async function registrarRecusaInterna(params: {
  organizacaoId: string; propostaId: string; motivo: string; ator: Ator;
}): Promise<void> {
  const p = await carregarProposta(params.organizacaoId, params.propostaId);
  if (!["enviada", "visualizada", "ajuste_solicitado"].includes(p.status)) {
    throw new RegraDeNegocio("proposta_nao_recusavel", "Só proposta enviada, visualizada ou com ajuste pedido pode ser recusada.");
  }
  await db.execute(sql`
    UPDATE propostas SET status = 'recusada', recusada_em = now(), cliente_respondeu_em = now(),
           motivo_recusa = ${params.motivo}, updated_at = now()
     WHERE id = ${params.propostaId}::uuid`);
  await registrarEvento({
    organizacaoId: params.organizacaoId, tipo: "ProposalRejected", ator: params.ator,
    propostaId: params.propostaId, negocioId: p.negocio_id, leadId: p.lead_id, empresaId: p.empresa_id,
    contexto: { versao: p.versao, motivo: params.motivo, registradaPeloVendedor: true, de: p.status, para: "recusada" },
    timeline: { tipo: "nota", titulo: `Proposta #${p.numero} recusada`, descricao: params.motivo },
  });
  if (p.negocio_id) {
    const { syncNegocioValoresFromPropostas } = await import("@/lib/crm/sync-negocio-valores");
    await syncNegocioValoresFromPropostas(p.negocio_id);
  }
}

/** Exclui um rascunho. O evento fica no negócio (o do rascunho some junto com ele). */
export async function excluirRascunho(params: { organizacaoId: string; propostaId: string; ator: Ator }): Promise<void> {
  const p = await carregarProposta(params.organizacaoId, params.propostaId);
  if (p.status !== "rascunho") {
    throw new RegraDeNegocio("proposta_nao_e_rascunho", "Só rascunho se exclui. Proposta enviada fica no histórico.");
  }
  if (p.negocio_id) {
    const { limparOportunidadeItensDeOrigemProposta } = await import("@/lib/crm/composicao-comercial");
    await limparOportunidadeItensDeOrigemProposta(p.negocio_id);
  }
  /* Rascunho de REVISÃO: a versão anterior aponta para ele (substituida_por_id) e o FK barrava o DELETE
     ("Não consegui concluir a ação"). Abandonar a revisão devolve a anterior ao estado em que estava. */
  await db.execute(sql`
    UPDATE propostas
       SET status = CASE WHEN ajuste_solicitado_em IS NOT NULL THEN 'ajuste_solicitado'
                         WHEN primeira_visualizacao_em IS NOT NULL THEN 'visualizada' ELSE 'enviada' END,
           substituida_em = NULL, substituida_por_id = NULL, updated_at = now()
     WHERE substituida_por_id = ${params.propostaId}::uuid AND status = 'substituida'`);
  await db.execute(sql`DELETE FROM propostas WHERE id = ${params.propostaId}::uuid`);
  await registrarEvento({
    organizacaoId: params.organizacaoId, tipo: "ProposalDeleted", ator: params.ator,
    negocioId: p.negocio_id, leadId: p.lead_id, empresaId: p.empresa_id,
    contexto: { numero: p.numero, versao: p.versao },
    timeline: p.negocio_id ? { tipo: "nota", titulo: `Rascunho da proposta #${p.numero} excluído` } : null,
  });
  if (p.negocio_id) {
    const { syncNegocioValoresFromPropostas } = await import("@/lib/crm/sync-negocio-valores");
    await syncNegocioValoresFromPropostas(p.negocio_id);
  }
}


/**
 * Grava o que o editor coletou: os signatários dos dois lados (fonte do
 * contrato) e o estado do editor, para a proposta reabrir como foi deixada.
 * Só rascunho: a versão enviada é a versão congelada.
 */
export async function salvarEditorDaProposta(params: {
  organizacaoId: string; propostaId: string; signatarios?: unknown; editor?: unknown;
}): Promise<void> {
  const sigs = params.signatarios === undefined ? null : normalizarSignatarios(params.signatarios);
  const editor = params.editor && typeof params.editor === "object" ? params.editor : null;
  const [r] = await db.execute<{ status: string }>(sql`
    UPDATE propostas SET
      signatarios = COALESCE(${sigs === null ? null : JSON.stringify(sigs)}::jsonb, signatarios),
      editor = COALESCE(${editor === null ? null : JSON.stringify(editor)}::jsonb, editor),
      updated_at = now()
    WHERE id = ${params.propostaId}::uuid AND organizacao_id = ${params.organizacaoId}::uuid AND status = 'rascunho'
    RETURNING status
  `);
  if (!r) throw new RegraDeNegocio("proposta_nao_e_rascunho", "Só rascunho se edita. Para mudar uma proposta enviada, crie uma revisão.");
}
