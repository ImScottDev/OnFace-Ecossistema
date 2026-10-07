/**
 * Identidade: resolver Empresa e Pessoa sem duplicar.
 *
 * Bloco 01 §4, Bloco 04 §6 e Bloco 05 §18 dizem a mesma coisa de três lugares
 * diferentes: antes de criar, tentar resolver. Empresa por CNPJ, depois
 * domínio, depois nome como último recurso; Pessoa por e-mail, depois telefone
 * ou WhatsApp.
 *
 * Uma decisão que a spec deixa explícita e é fácil errar: a mesma Empresa pode
 * ter VÁRIOS Leads históricos (Bloco 01 §4). Resolver a empresa não significa
 * reaproveitar o processo comercial antigo — significa não criar a empresa de
 * novo. São coisas diferentes e o código as trata separadamente.
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { ExecutorDb } from "./executor";
import { registrarEvento } from "./eventos";
import { type Ator, type RelacionamentoEmpresa, type PapelPessoa } from "./dominio";



/* ── Normalização ──────────────────────────────────────────────────────── */

export function normalizarCnpj(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const digitos = valor.replace(/\D/g, "");
  return digitos.length === 14 ? digitos : null;
}

/**
 * Host minúsculo, sem protocolo, sem `www` e sem caminho.
 *
 * É a forma que serve para COMPARAR duas empresas. Guardar a URL inteira faz
 * `https://novatech.com.br/` e `novatech.com.br` parecerem empresas
 * diferentes, que foi como duplicata entrou na base antes.
 */
export function normalizarDominio(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const limpo = valor.trim().toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split("?")[0]
    .trim();
  return limpo && limpo.includes(".") ? limpo : null;
}

export function dominioDoEmail(email: string | null | undefined): string | null {
  if (!email || !email.includes("@")) return null;
  const dominio = email.split("@")[1]?.trim().toLowerCase();
  if (!dominio) return null;
  // Provedor pessoal não identifica empresa nenhuma. Sem esta lista, um
  // formulário preenchido com gmail casaria todas as empresas entre si.
  const pessoais = new Set([
    "gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "yahoo.com.br",
    "live.com", "icloud.com", "bol.com.br", "uol.com.br", "terra.com.br",
    "globo.com", "me.com", "msn.com", "protonmail.com", "proton.me",
  ]);
  return pessoais.has(dominio) ? null : dominio;
}

/** Só dígitos, com o 55 do país removido quando presente. */
export function normalizarTelefone(valor: string | null | undefined): string | null {
  if (!valor) return null;
  let digitos = valor.replace(/\D/g, "");
  if (digitos.startsWith("55") && digitos.length > 11) digitos = digitos.slice(2);
  return digitos.length >= 10 ? digitos : null;
}


/* ── Empresa ───────────────────────────────────────────────────────────── */

export interface DadosEmpresa {
  nome: string;
  cnpj?: string | null;
  dominio?: string | null;
  website?: string | null;
  email?: string | null;
  setor?: string | null;
  porte?: string | null;
  cidade?: string | null;
  estado?: string | null;
  telefone?: string | null;
  razaoSocial?: string | null;
}

export interface ResultadoResolucao {
  empresaId: string;
  criada: boolean;
  /** Por qual identificador a empresa foi reconhecida. Vale para auditoria:
   *  resolução por nome é a mais frágil e precisa ser rastreável. */
  resolvidaPor: "cnpj" | "dominio" | "nome" | null;
}

/**
 * Encontra a empresa; cria só se não existir.
 *
 * A ordem dos identificadores não é estética: CNPJ é único por definição,
 * domínio é quase sempre confiável, e nome é o fallback que a spec chama de
 * "controlado" — por isso ele compara a forma normalizada e nunca o texto cru.
 */
export async function resolverEmpresa(
  organizacaoId: string,
  dados: DadosEmpresa,
  ator: Ator,
  tx: ExecutorDb = db,
): Promise<ResultadoResolucao> {
  const nome = dados.nome.trim();
  if (!nome) throw new Error("Empresa precisa de nome");

  const cnpj = normalizarCnpj(dados.cnpj);
  const dominio = normalizarDominio(dados.dominio ?? dados.website) ?? dominioDoEmail(dados.email);

  if (cnpj) {
    const [porCnpj] = await tx.execute<{ id: string }>(sql`
      SELECT id::text FROM empresas
       WHERE organizacao_id = ${organizacaoId}::uuid
         AND regexp_replace(COALESCE(cnpj, ''), '\\D', '', 'g') = ${cnpj}
       LIMIT 1
    `);
    if (porCnpj) {
      await completarEmpresa(porCnpj.id, dados, tx);
      return { empresaId: porCnpj.id, criada: false, resolvidaPor: "cnpj" };
    }
  }

  if (dominio) {
    const [porDominio] = await tx.execute<{ id: string }>(sql`
      SELECT id::text FROM empresas
       WHERE organizacao_id = ${organizacaoId}::uuid AND dominio = ${dominio}
       LIMIT 1
    `);
    if (porDominio) {
      await completarEmpresa(porDominio.id, dados, tx);
      return { empresaId: porDominio.id, criada: false, resolvidaPor: "dominio" };
    }
  }

  /* Regra do Scott (06/10): sem CNPJ e sem domínio, casa pelo NOME IGUAL,
     ignorando só caixa, acento, espaço e pontuação. Antes o lado JS tirava
     "ltda/me/comercio..." e o lado SQL não, então "Acme Ltda" nunca casava
     com "Acme Ltda" já gravada e a prospecção criava empresa duplicada.
     Os dois lados agora usam a mesma normalização, sem cortar sufixo. */
  const nomeNormalizado = nome.toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "");
  if (nomeNormalizado.length >= 3) {
    const [porNome] = await tx.execute<{ id: string }>(sql`
      SELECT id::text FROM empresas
       WHERE organizacao_id = ${organizacaoId}::uuid
         AND regexp_replace(
               translate(lower(nome), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
               '[^a-z0-9]+', '', 'g'
             ) = ${nomeNormalizado}
       LIMIT 1
    `);
    if (porNome) {
      await completarEmpresa(porNome.id, dados, tx);
      return { empresaId: porNome.id, criada: false, resolvidaPor: "nome" };
    }
  }

  const [criada] = await tx.execute<{ id: string }>(sql`
    INSERT INTO empresas (organizacao_id, nome, cnpj, dominio, website, setor, porte, cidade, estado, telefone, razao_social)
    VALUES (
      ${organizacaoId}::uuid, ${nome}, ${dados.cnpj ?? null}, ${dominio},
      ${dados.website ?? null}, ${dados.setor ?? null}, ${dados.porte ?? null},
      ${dados.cidade ?? null}, ${dados.estado ?? null}, ${dados.telefone ?? null},
      ${dados.razaoSocial ?? null}
    )
    RETURNING id::text
  `);

  await registrarEvento({
    organizacaoId, tipo: "CompanyCreated", ator, empresaId: criada.id,
    contexto: { nome, cnpj, dominio },
  }, tx);

  return { empresaId: criada.id, criada: true, resolvidaPor: null };
}

/** Preenche o que estava faltando, sem sobrescrever o que já existe.
 *  Dado vindo de formulário é menos confiável que dado já curado. */
async function completarEmpresa(empresaId: string, dados: DadosEmpresa, tx: ExecutorDb): Promise<void> {
  const dominio = normalizarDominio(dados.dominio ?? dados.website) ?? dominioDoEmail(dados.email);
  await tx.execute(sql`
    UPDATE empresas SET
      cnpj = COALESCE(cnpj, ${dados.cnpj ?? null}),
      dominio = COALESCE(dominio, ${dominio}),
      website = COALESCE(website, ${dados.website ?? null}),
      setor = COALESCE(setor, ${dados.setor ?? null}),
      porte = COALESCE(porte, ${dados.porte ?? null}),
      cidade = COALESCE(cidade, ${dados.cidade ?? null}),
      estado = COALESCE(estado, ${dados.estado ?? null}),
      telefone = COALESCE(telefone, ${dados.telefone ?? null}),
      razao_social = COALESCE(razao_social, ${dados.razaoSocial ?? null}),
      updated_at = now()
    WHERE id = ${empresaId}::uuid
  `);
}

/* ── Pessoa ────────────────────────────────────────────────────────────── */

export interface DadosPessoa {
  nome: string;
  sobrenome?: string | null;
  email?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  cargo?: string | null;
  empresaId?: string | null;
}

export interface ResultadoPessoa {
  pessoaId: string;
  criada: boolean;
  resolvidaPor: "email" | "telefone" | null;
}

/**
 * Encontra a pessoa; cria só se não existir.
 *
 * `pessoas` é o modelo novo e hoje tem poucas linhas — a identidade das
 * pessoas ainda mora majoritariamente em `leads`. Isto aqui resolve contra
 * `pessoas`, que é o domínio novo; quem precisa da compatibilidade de leitura
 * com o legado usa `diretorio.ts`, que lê os dois lados.
 */
export async function resolverPessoa(
  organizacaoId: string,
  dados: DadosPessoa,
  ator: Ator,
  tx: ExecutorDb = db,
): Promise<ResultadoPessoa> {
  const nome = dados.nome.trim();
  if (!nome) throw new Error("Pessoa precisa de nome");

  const email = dados.email?.trim().toLowerCase() || null;
  const telefone = normalizarTelefone(dados.telefone ?? dados.whatsapp);

  if (email) {
    const [porEmail] = await tx.execute<{ id: string }>(sql`
      SELECT id::text FROM pessoas
       WHERE organizacao_id = ${organizacaoId}::uuid AND lower(email) = ${email}
       LIMIT 1
    `);
    if (porEmail) {
      await completarPessoa(porEmail.id, dados, tx);
      return { pessoaId: porEmail.id, criada: false, resolvidaPor: "email" };
    }
  }

  if (telefone) {
    const [porTelefone] = await tx.execute<{ id: string }>(sql`
      SELECT id::text FROM pessoas
       WHERE organizacao_id = ${organizacaoId}::uuid
         AND (regexp_replace(COALESCE(telefone, ''), '\\D', '', 'g') LIKE ${"%" + telefone}
           OR regexp_replace(COALESCE(whatsapp, ''), '\\D', '', 'g') LIKE ${"%" + telefone})
       LIMIT 1
    `);
    if (porTelefone) {
      await completarPessoa(porTelefone.id, dados, tx);
      return { pessoaId: porTelefone.id, criada: false, resolvidaPor: "telefone" };
    }
  }

  const [criada] = await tx.execute<{ id: string }>(sql`
    INSERT INTO pessoas (organizacao_id, empresa_id, nome, sobrenome, email, telefone, whatsapp, cargo)
    VALUES (
      ${organizacaoId}::uuid, ${dados.empresaId ?? null}::uuid, ${nome},
      ${dados.sobrenome ?? null}, ${dados.email ?? null}, ${dados.telefone ?? null},
      ${dados.whatsapp ?? null}, ${dados.cargo ?? null}
    )
    RETURNING id::text
  `);

  await registrarEvento({
    organizacaoId, tipo: "PersonCreated", ator, pessoaId: criada.id,
    empresaId: dados.empresaId ?? null, contexto: { nome, email },
  }, tx);

  if (dados.empresaId) {
    await vincularPessoaEmpresa({
      organizacaoId, pessoaId: criada.id, empresaId: dados.empresaId,
      papel: "contato_principal", principal: true, ator,
    }, tx);
  }

  return { pessoaId: criada.id, criada: true, resolvidaPor: null };
}

async function completarPessoa(pessoaId: string, dados: DadosPessoa, tx: ExecutorDb): Promise<void> {
  await tx.execute(sql`
    UPDATE pessoas SET
      sobrenome = COALESCE(sobrenome, ${dados.sobrenome ?? null}),
      email = COALESCE(email, ${dados.email ?? null}),
      telefone = COALESCE(telefone, ${dados.telefone ?? null}),
      whatsapp = COALESCE(whatsapp, ${dados.whatsapp ?? null}),
      cargo = COALESCE(cargo, ${dados.cargo ?? null}),
      empresa_id = COALESCE(empresa_id, ${dados.empresaId ?? null}::uuid),
      updated_at = now()
    WHERE id = ${pessoaId}::uuid
  `);
}

/* ── Vínculo Pessoa ↔ Empresa ──────────────────────────────────────────── */

/**
 * Bloco 05 §11-12: o vínculo tem papel e histórico, e a pessoa pode mudar de
 * empresa sem que o passado seja apagado.
 *
 * Trocar de empresa ENCERRA o vínculo anterior em vez de apagá-lo. A spec é
 * explícita: "a modelagem não deve apagar o passado ao trocar a associação
 * principal".
 */
export async function vincularPessoaEmpresa(params: {
  organizacaoId: string;
  pessoaId: string;
  empresaId: string;
  papel?: PapelPessoa;
  principal?: boolean;
  /** Encerra o vínculo aberto com outra empresa (troca de emprego). */
  encerrarAnteriores?: boolean;
  ator: Ator;
}, tx: ExecutorDb = db): Promise<void> {
  const papel = params.papel ?? "contato_principal";

  if (params.encerrarAnteriores) {
    await tx.execute(sql`
      UPDATE pessoa_empresa_vinculos SET encerrado_em = now()
       WHERE pessoa_id = ${params.pessoaId}::uuid
         AND empresa_id <> ${params.empresaId}::uuid
         AND encerrado_em IS NULL
    `);
  }

  await tx.execute(sql`
    INSERT INTO pessoa_empresa_vinculos (organizacao_id, pessoa_id, empresa_id, papel, principal)
    VALUES (${params.organizacaoId}::uuid, ${params.pessoaId}::uuid, ${params.empresaId}::uuid,
            ${papel}, ${params.principal ?? false})
    ON CONFLICT (pessoa_id, empresa_id) WHERE encerrado_em IS NULL
    DO UPDATE SET papel = EXCLUDED.papel, principal = EXCLUDED.principal
  `);

  // `pessoas.empresa_id` continua sendo o vínculo atual porque é o que as
  // consultas existentes leem; o vínculo principal é quem manda nele.
  if (params.principal ?? false) {
    await tx.execute(sql`
      UPDATE pessoas SET empresa_id = ${params.empresaId}::uuid, updated_at = now()
       WHERE id = ${params.pessoaId}::uuid
    `);
  }

  await registrarEvento({
    organizacaoId: params.organizacaoId, tipo: "PersonLinkedToCompany",
    ator: params.ator, pessoaId: params.pessoaId, empresaId: params.empresaId,
    contexto: { papel, principal: params.principal ?? false },
  }, tx);
}

/* ── Atribuição (Bloco 01 §16, Bloco 05 §21) ───────────────────────────── */

export interface Touchpoint {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  term?: string | null;
  content?: string | null;
  landingPage?: string | null;
  referrer?: string | null;
  campaignId?: string | null;
  sourceId?: string | null;
  tipoOrigem: string;
  raw?: Record<string, unknown> | null;
}

/**
 * Registra o ponto de contato na Empresa/Pessoa.
 *
 * A spec insiste nisso em três blocos (Bloco 01 §16, Bloco 02 §23, Bloco 05
 * §21) pelo mesmo motivo: a origem precisa sobreviver à conversão comercial.
 * Se ela vivesse no Lead, sumiria quando o Lead virasse Oportunidade.
 *
 * O primeiro touchpoint da entidade é marcado como `first`; o novo sempre vira
 * o `last`, e o anterior perde a marca.
 */
export async function registrarTouchpoint(params: {
  organizacaoId: string;
  pessoaId?: string | null;
  empresaId?: string | null;
  leadIdLegado?: string | null;
  /** Quando o chamador já tem a aquisição em mãos; senão é resolvida aqui. */
  aquisicaoId?: string | null;
  touchpoint: Touchpoint;
}, tx: ExecutorDb = db): Promise<void> {
  const { organizacaoId, pessoaId, empresaId, touchpoint } = params;
  if (!pessoaId && !empresaId) return;

  const [existente] = await tx.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM pontos_contato
     WHERE organizacao_id = ${organizacaoId}::uuid
       AND (
         (${pessoaId ?? null}::uuid IS NOT NULL AND pessoa_id = ${pessoaId ?? null}::uuid)
         OR (${empresaId ?? null}::uuid IS NOT NULL AND empresa_id = ${empresaId ?? null}::uuid)
       )
  `);
  const ehPrimeiro = (existente?.n ?? 0) === 0;

  await tx.execute(sql`
    UPDATE pontos_contato SET is_last_touch = false
     WHERE organizacao_id = ${organizacaoId}::uuid AND is_last_touch = true
       AND (
         (${pessoaId ?? null}::uuid IS NOT NULL AND pessoa_id = ${pessoaId ?? null}::uuid)
         OR (${empresaId ?? null}::uuid IS NOT NULL AND empresa_id = ${empresaId ?? null}::uuid)
       )
  `);

  // O vínculo com a AQUISIÇÃO é o que a SPEC §8.3 pede, e faltava: o ponto de
  // contato nascia com pessoa, empresa e lead legado, e sem aquisicao_id.
  //
  // O backfill tinha preenchido os 1.583 existentes, então medir o banco não
  // acusava nada — só criar um lead pela tela e reler a atribuição mostrava o
  // buraco. É o mesmo padrão que já apareceu três vezes nesta refatoração.
  //
  // Resolvido aqui dentro, a partir do lead legado, para valer em todo chamador
  // em vez de virar um parâmetro que cada um lembra (ou esquece) de passar.
  await tx.execute(sql`
    INSERT INTO pontos_contato (
      organizacao_id, pessoa_id, empresa_id, source, medium, campaign, term, content,
      landing_page, referrer, campaign_id, source_id, tipo_origem,
      is_first_touch, is_last_touch, raw, lead_id_legado, aquisicao_id
    ) VALUES (
      ${organizacaoId}::uuid, ${pessoaId ?? null}::uuid, ${empresaId ?? null}::uuid,
      ${touchpoint.source ?? null}, ${touchpoint.medium ?? null}, ${touchpoint.campaign ?? null},
      ${touchpoint.term ?? null}, ${touchpoint.content ?? null}, ${touchpoint.landingPage ?? null},
      ${touchpoint.referrer ?? null}, ${touchpoint.campaignId ?? null}, ${touchpoint.sourceId ?? null},
      ${touchpoint.tipoOrigem}, ${ehPrimeiro}, true,
      ${touchpoint.raw ? JSON.stringify(touchpoint.raw) : null}::jsonb,
      ${params.leadIdLegado ?? null}::uuid,
      COALESCE(
        ${params.aquisicaoId ?? null}::uuid,
        (SELECT a.id FROM aquisicoes a
          WHERE a.organizacao_id = ${organizacaoId}::uuid
            AND ${params.leadIdLegado ?? null}::uuid IS NOT NULL
            AND a.lead_legado_id = ${params.leadIdLegado ?? null}::uuid
          LIMIT 1),
        (SELECT a.id FROM aquisicoes a
          WHERE a.organizacao_id = ${organizacaoId}::uuid AND a.closed_at IS NULL
            AND (${pessoaId ?? null}::uuid IS NOT NULL AND a.pessoa_id = ${pessoaId ?? null}::uuid
                 OR ${empresaId ?? null}::uuid IS NOT NULL AND a.empresa_id = ${empresaId ?? null}::uuid)
          ORDER BY a.created_at DESC LIMIT 1)
      )
    )
  `);
}

/* ── Relacionamento derivado (Bloco 05 §7) ─────────────────────────────── */

/**
 * O relacionamento da Empresa é consequência dos processos reais, nunca um
 * status que alguém troca à mão. A spec proíbe explicitamente "Empresa =
 * Cliente" como campo editável.
 *
 * A ordem da avaliação é a hierarquia da spec: serviço ativo ganha de tudo,
 * depois oportunidade aberta, depois lead ativo, e ex-cliente é quem teve
 * serviço e não tem mais.
 */
export async function derivarRelacionamento(
  organizacaoId: string,
  empresaId: string,
  tx: ExecutorDb = db,
): Promise<RelacionamentoEmpresa> {
  const [f] = await tx.execute<{
    servicos_ativos: number; servicos_historicos: number;
    oportunidades_abertas: number; leads_ativos: number;
  }>(sql`
    SELECT
      (SELECT count(*)::int FROM servicos_canonicos s
        WHERE s.organizacao_id = ${organizacaoId}::uuid AND s.empresa_id = ${empresaId}::uuid
          AND s.commercial_lifecycle = 'ACTIVE') AS servicos_ativos,
      (SELECT count(*)::int FROM servicos_canonicos s
        WHERE s.organizacao_id = ${organizacaoId}::uuid AND s.empresa_id = ${empresaId}::uuid) AS servicos_historicos,
      (SELECT count(*)::int FROM negocios n
        WHERE n.organizacao_id = ${organizacaoId}::uuid AND n.empresa_id = ${empresaId}::uuid
          AND n.etapa IN ('entrada','diagnostico','proposta','negociacao')) AS oportunidades_abertas,
      (SELECT count(*)::int FROM leads l
        WHERE l.organizacao_id = ${organizacaoId}::uuid AND l.empresa_id = ${empresaId}::uuid
          AND l.estagio_pre_vendas IN ('novo','em_contato','qualificacao','qualificado')) AS leads_ativos
  `);

  if ((f?.servicos_ativos ?? 0) > 0) return "cliente";
  if ((f?.oportunidades_abertas ?? 0) > 0) return "em_oportunidade";
  if ((f?.leads_ativos ?? 0) > 0) return "em_pre_vendas";
  if ((f?.servicos_historicos ?? 0) > 0) return "ex_cliente";
  return "cadastrada";
}
