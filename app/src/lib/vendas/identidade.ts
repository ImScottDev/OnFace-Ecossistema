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
import { chaveTelefone, normalizarE164 } from "@/lib/telefone";



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

/**
 * Chave de comparação de telefone no BANCO, igual a `chaveTelefone` (lib/telefone):
 * "(11) 99999-0001", "11999990001" e "+55 11 99999-0001" dão a mesma chave. A base
 * tem formatos misturados, então comparar coluna crua com texto cru nunca casa.
 */
export function telefoneChaveSql(coluna: "telefone" | "whatsapp" | "p.telefone" | "p.whatsapp") {
  const d = sql.raw(`regexp_replace(COALESCE(${coluna}, ''), '\\D', '', 'g')`);
  return sql`(CASE WHEN ${d} ~ '^55[1-9][0-9]{9,10}$' THEN ${d}
                   WHEN ${d} ~ '^[1-9][0-9]{9,10}$' THEN '55' || ${d}
                   ELSE ${d} END)`;
}

/** O que se grava: E.164 quando dá, senão o texto como veio (webhook/legado não perde dado). */
export const telefoneParaGravar = (v: string | null | undefined): string | null =>
  normalizarE164(v) ?? (v?.trim() || null);

/**
 * LEGADO: só dígitos locais, 55 removido. Não é mais usado para resolver
 * identidade (isso é `chaveTelefone`); fica porque o contrato de teste o cobre.
 */
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

  /* Corrida: dois pedidos simultâneos com a mesma empresa (duplo clique, lote
     com o mesmo nome) liam "não existe" ao mesmo tempo e criavam as duas.
     A busca e o INSERT agora rodam sob um lock de transação por organização.
     Sem transação do chamador abrimos uma aqui, senão o lock soltaria na hora.
     ponytail: lock por organização serializa toda criação de empresa da org;
     troque por lock por chave (cnpj/domínio/nome) se o volume de criação crescer. */
  if (tx === db) return db.transaction((t) => resolverEmpresa(organizacaoId, dados, ator, t));
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${"empresa:" + organizacaoId}, 0))`);

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
      ${dados.cidade ?? null}, ${dados.estado ?? null}, ${telefoneParaGravar(dados.telefone)},
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
      telefone = COALESCE(telefone, ${telefoneParaGravar(dados.telefone)}),
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
  /** Papel e principalidade do vínculo com `empresaId`. Sem `principal`: a empresa
   *  vira a principal só se a pessoa ainda não tem nenhuma. */
  papel?: PapelPessoa;
  principal?: boolean;
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
  const chave = chaveTelefone(dados.telefone) ?? chaveTelefone(dados.whatsapp);
  const dadosGravaveis: DadosPessoa = {
    ...dados, email, telefone: telefoneParaGravar(dados.telefone), whatsapp: telefoneParaGravar(dados.whatsapp),
  };

  const existente = async (): Promise<ResultadoPessoa | null> => {
    if (email) {
      const [porEmail] = await tx.execute<{ id: string }>(sql`
        SELECT id::text FROM pessoas
         WHERE organizacao_id = ${organizacaoId}::uuid AND lower(email) = ${email}
         LIMIT 1
      `);
      if (porEmail) return { pessoaId: porEmail.id, criada: false, resolvidaPor: "email" };
    }
    if (chave) {
      const [porTelefone] = await tx.execute<{ id: string }>(sql`
        SELECT id::text FROM pessoas
         WHERE organizacao_id = ${organizacaoId}::uuid
           AND (${telefoneChaveSql("telefone")} = ${chave} OR ${telefoneChaveSql("whatsapp")} = ${chave})
         LIMIT 1
      `);
      if (porTelefone) return { pessoaId: porTelefone.id, criada: false, resolvidaPor: "telefone" };
    }
    return null;
  };

  const achada = await existente();
  if (achada) {
    await completarPessoa(achada.pessoaId, dadosGravaveis, tx);
    if (dados.empresaId) await garantirVinculoDaResolucao(organizacaoId, achada.pessoaId, dados, ator, tx);
    return achada;
  }

  const [criada] = await tx.execute<{ id: string }>(sql`
    INSERT INTO pessoas (organizacao_id, empresa_id, nome, sobrenome, email, telefone, whatsapp, cargo)
    VALUES (
      ${organizacaoId}::uuid, NULL, ${nome},
      ${dados.sobrenome ?? null}, ${dadosGravaveis.email ?? null}, ${dadosGravaveis.telefone ?? null},
      ${dadosGravaveis.whatsapp ?? null}, ${dados.cargo ?? null}
    )
    RETURNING id::text
  `);

  await registrarEvento({
    organizacaoId, tipo: "PersonCreated", ator, pessoaId: criada.id,
    empresaId: dados.empresaId ?? null, contexto: { nome, email },
  }, tx);

  // `pessoas.empresa_id` NÃO é gravado no INSERT: quem o mantém é o vínculo
  // principal (vincularPessoaEmpresa), para as duas fontes nunca divergirem.
  if (dados.empresaId) await garantirVinculoDaResolucao(organizacaoId, criada.id, { ...dados, principal: dados.principal ?? true }, ator, tx);

  return { pessoaId: criada.id, criada: true, resolvidaPor: null };
}

/** Pessoa resolvida com empresa: garante o vínculo ATIVO com ela, sem derrubar a principal que já existe. */
async function garantirVinculoDaResolucao(
  organizacaoId: string, pessoaId: string, dados: DadosPessoa, ator: Ator, tx: ExecutorDb,
): Promise<void> {
  let principal = dados.principal;
  if (principal === undefined) {
    // Principal existente = vínculo principal ativo OU `pessoas.empresa_id` legado ainda sem vínculo.
    const [tem] = await tx.execute<{ n: number }>(sql`
      SELECT (SELECT count(*) FROM pessoa_empresa_vinculos
               WHERE pessoa_id = ${pessoaId}::uuid AND principal AND encerrado_em IS NULL
                 AND empresa_id <> ${dados.empresaId!}::uuid)::int
           + (SELECT count(*) FROM pessoas
               WHERE id = ${pessoaId}::uuid AND empresa_id IS NOT NULL
                 AND empresa_id <> ${dados.empresaId!}::uuid)::int AS n`);
    principal = (tem?.n ?? 0) === 0;
  }
  await vincularPessoaEmpresa({
    organizacaoId, pessoaId, empresaId: dados.empresaId!, papel: dados.papel ?? "contato_principal", principal, ator,
  }, tx);
}

async function completarPessoa(pessoaId: string, dados: DadosPessoa, tx: ExecutorDb): Promise<void> {
  await tx.execute(sql`
    UPDATE pessoas SET
      sobrenome = COALESCE(sobrenome, ${dados.sobrenome ?? null}),
      email = COALESCE(email, ${dados.email ?? null}),
      telefone = COALESCE(telefone, ${dados.telefone ?? null}),
      whatsapp = COALESCE(whatsapp, ${dados.whatsapp ?? null}),
      cargo = COALESCE(cargo, ${dados.cargo ?? null}),
      updated_at = now()
    WHERE id = ${pessoaId}::uuid
  `);
}

/**
 * Toda pessoa precisa de um registro de contato (`leads`, tipo "contato") para ter
 * ficha: a ficha base, as notas, as tags e as atividades são chaveadas por ele.
 * Contato avulso NÃO é processo comercial: o registro nasce sem etapa de
 * Pré-vendas, sem aquisição, sem SDR e sem responsável, então não aparece no
 * board e a lista o classifica como "Contato". Idempotente: devolve o existente.
 */
export async function garantirRegistroDeContato(organizacaoId: string, pessoaId: string, tx: ExecutorDb = db): Promise<string> {
  const [p] = await tx.execute<{ lead: string | null; nome: string; sobrenome: string | null; email: string | null;
    telefone: string | null; whatsapp: string | null; cargo: string | null; empresa_id: string | null; empresa: string | null }>(sql`
    SELECT p.lead_id_legado::text AS lead, p.nome, p.sobrenome, p.email, p.telefone, p.whatsapp, p.cargo,
           p.empresa_id::text, e.nome AS empresa
      FROM pessoas p LEFT JOIN empresas e ON e.id = p.empresa_id
     WHERE p.id = ${pessoaId}::uuid AND p.organizacao_id = ${organizacaoId}::uuid`);
  if (!p) throw new Error("pessoa não encontrada");
  if (p.lead) return p.lead;
  const [l] = await tx.execute<{ id: string }>(sql`
    INSERT INTO leads (organizacao_id, nome, sobrenome, email, telefone, whatsapp, cargo, empresa_id, empresa,
                       tipo, status, sdr_status, estagio_pre_vendas)
    VALUES (${organizacaoId}::uuid, ${p.nome}, ${p.sobrenome}, ${p.email}, ${p.telefone}, ${p.whatsapp}, ${p.cargo},
            ${p.empresa_id}::uuid, ${p.empresa}, 'contato', 'novo', NULL, NULL)
    RETURNING id::text`);
  await tx.execute(sql`UPDATE pessoas SET lead_id_legado = ${l.id}::uuid, updated_at = now() WHERE id = ${pessoaId}::uuid`);
  return l.id;
}

/** Lead em aberto em Pré-vendas para quem tem este e-mail ou telefone (comparação normalizada). */
export async function aquisicaoAbertaPorContato(
  organizacaoId: string, email: string | null, telefone: string | null, tx: ExecutorDb = db,
): Promise<string | null> {
  const em = email?.trim().toLowerCase() || null;
  const chave = chaveTelefone(telefone);
  if (!em && !chave) return null;
  const [a] = await tx.execute<{ lead: string }>(sql`
    SELECT a.lead_legado_id::text AS lead FROM aquisicoes a
      JOIN pessoas p ON p.id = a.pessoa_id
     WHERE a.organizacao_id = ${organizacaoId}::uuid AND a.closed_at IS NULL AND a.lead_legado_id IS NOT NULL
       AND ((${em}::text IS NOT NULL AND lower(p.email) = ${em})
         OR (${chave}::text IS NOT NULL AND (${telefoneChaveSql("p.telefone")} = ${chave} OR ${telefoneChaveSql("p.whatsapp")} = ${chave})))
     LIMIT 1`);
  return a?.lead ?? null;
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
  const principal = params.principal ?? false;

  /* Um único vínculo principal por pessoa. Promover uma empresa a principal
     ENCERRA (com data, não apaga) o principal anterior. `encerrarAnteriores`
     vai além e encerra também os secundários (troca de emprego). */
  if (params.encerrarAnteriores || principal) {
    await tx.execute(sql`
      UPDATE pessoa_empresa_vinculos SET encerrado_em = now(), updated_at = now()
       WHERE pessoa_id = ${params.pessoaId}::uuid
         AND empresa_id <> ${params.empresaId}::uuid
         AND encerrado_em IS NULL
         ${params.encerrarAnteriores ? sql`` : sql`AND principal`}
    `);
  }

  /* O índice único vale para (pessoa, empresa) mesmo com vínculo encerrado, então
     voltar para uma empresa antiga REABRE a linha em vez de colidir. Vínculo já
     principal não é rebaixado por um "adicionar" repetido. */
  await tx.execute(sql`
    INSERT INTO pessoa_empresa_vinculos (organizacao_id, pessoa_id, empresa_id, papel, principal)
    VALUES (${params.organizacaoId}::uuid, ${params.pessoaId}::uuid, ${params.empresaId}::uuid,
            ${papel}, ${principal})
    ON CONFLICT (pessoa_id, empresa_id)
    DO UPDATE SET
      papel = EXCLUDED.papel,
      principal = CASE WHEN pessoa_empresa_vinculos.encerrado_em IS NULL
                       THEN pessoa_empresa_vinculos.principal OR EXCLUDED.principal
                       ELSE EXCLUDED.principal END,
      iniciado_em = CASE WHEN pessoa_empresa_vinculos.encerrado_em IS NULL
                         THEN pessoa_empresa_vinculos.iniciado_em ELSE now() END,
      encerrado_em = NULL,
      updated_at = now()
  `);

  // `pessoas.empresa_id` continua sendo o vínculo atual porque é o que as
  // consultas existentes leem; o vínculo principal é quem manda nele.
  if (principal) {
    await tx.execute(sql`
      UPDATE pessoas SET empresa_id = ${params.empresaId}::uuid, updated_at = now()
       WHERE id = ${params.pessoaId}::uuid
    `);
  }

  await registrarEvento({
    organizacaoId: params.organizacaoId, tipo: "PersonLinkedToCompany",
    ator: params.ator, pessoaId: params.pessoaId, empresaId: params.empresaId,
    contexto: { papel, principal },
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
          AND l.estagio_pre_vendas IN ('novo','em_contato','qualificacao','qualificado')
          AND NOT EXISTS (SELECT 1 FROM aquisicoes aq WHERE aq.lead_legado_id = l.id AND aq.closed_at IS NOT NULL)) AS leads_ativos
  `);

  if ((f?.servicos_ativos ?? 0) > 0) return "cliente";
  if ((f?.oportunidades_abertas ?? 0) > 0) return "em_oportunidade";
  if ((f?.leads_ativos ?? 0) > 0) return "em_pre_vendas";
  if ((f?.servicos_historicos ?? 0) > 0) return "ex_cliente";
  return "cadastrada";
}
