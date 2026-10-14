/**
 * A POLÍTICA de acesso a conversa de WhatsApp, por papel, sem banco.
 *
 * Contexto: o dono do produto conectou o WhatsApp PESSOAL dele ao ONFACE e a regra dava
 * a organização inteira a admin/director/operations só pelo CARGO. Estes testes são os
 * critérios dele: quem abre o quê, por id direto, por "ver como", por cargo.
 *
 * Todos os dados são sintéticos (ids inventados, nenhuma mensagem, nenhum número real).
 * Roda em milissegundos e sem DATABASE_URL: a decisão é uma função pura sobre fatos; os
 * fatos vêm das mesmas peças de SQL das listas, que o último bloco confere pela forma.
 *
 *   node --import tsx --test src/lib/whatsapp/acesso-politica.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { PgDialect } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  decidirAcesso, podeAdministrarNumero, superAdminAgindo, escopoDeGestao,
  condicaoEquipe, condicaoMinhasConversas, condicaoConversa, sessaoVisivel, sessaoSupervisionada, sessaoPrivada,
  type AtorWhatsApp, type FatosConversa,
} from "./acesso";

const ORG = "00000000-0000-4000-8000-000000000001";
const ator = (userId: string, role: string, extra: Partial<AtorWhatsApp> = {}): AtorWhatsApp & { organizacaoId: string } =>
  ({ userId, userRole: role, realRole: role, realUserId: userId, isViewingAs: false, organizacaoId: ORG, ...extra });

const DONO = ator("dono-produto", "super_admin"); // o dono do número pessoal
const ADMIN = ator("admin-1", "admin");
const DIRETOR = ator("diretor-1", "director");
const OPERACOES = ator("operacoes-1", "operations");
const GERENTE = ator("gerente-1", "gerente");
const COORD = ator("coord-1", "coordinator");
const CLOSER = ator("closer-1", "closer");
const SDR = ator("sdr-1", "sdr");
const OUTRO_SUPER = ator("super-2", "super_admin");

/** Conversa que chegou pelo número PESSOAL do dono, sem responsável. */
const CONVERSA_PESSOAL: FatosConversa = { responsavelId: null, sessaoId: "sessao-pessoal", minha: false, supervisionada: false };
/** O mesmo, do ponto de vista de quem é dono do número. */
const CONVERSA_PESSOAL_DO_DONO: FatosConversa = { ...CONVERSA_PESSOAL, minha: true };

test("o dono abre as próprias conversas; ninguém mais, por cargo nenhum", () => {
  assert.equal(decidirAcesso(DONO, CONVERSA_PESSOAL_DO_DONO).ok, true);
  for (const quem of [ADMIN, DIRETOR, OPERACOES, GERENTE, COORD, CLOSER, SDR]) {
    assert.equal(decidirAcesso(quem, CONVERSA_PESSOAL).ok, false, `${quem.userRole} abriu a conversa pessoal do dono`);
  }
});

test("acesso por id direto: a decisão não depende de a tela mostrar o botão Equipe", () => {
  // O servidor decide só com ator + fatos. Admin com o id certo na URL recebe a mesma recusa que um closer.
  const doAdmin = decidirAcesso(ADMIN, CONVERSA_PESSOAL);
  const doCloser = decidirAcesso(CLOSER, CONVERSA_PESSOAL);
  assert.deepEqual(doAdmin, doCloser);
  assert.equal(doAdmin.ok, false);
});

test("o cargo não concede supervisão: sem permissão explícita admin e gerente são iguais a um closer", () => {
  const conversaDeCloser: FatosConversa = { responsavelId: "closer-2", sessaoId: "sessao-closer-2", minha: false, supervisionada: false };
  for (const quem of [ADMIN, DIRETOR, OPERACOES, GERENTE, COORD]) {
    assert.equal(decidirAcesso(quem, conversaDeCloser).ok, false, `${quem.userRole} leu conversa de closer sem supervisão`);
  }
  assert.equal(escopoDeGestao(ADMIN), "organizacao"); // gerir NÚMEROS ainda existe...
  assert.equal(decidirAcesso(ADMIN, conversaDeCloser).ok, false); // ...mas não abre conversa.
});

test("supervisão explícita abre a conversa do alvo, e só ela", () => {
  const supervisionada: FatosConversa = { responsavelId: "closer-2", sessaoId: "sessao-closer-2", minha: false, supervisionada: true };
  const d = decidirAcesso(GERENTE, supervisionada);
  assert.equal(d.ok, true);
  assert.equal(d.ok && d.via, "supervisao");
  // O fato "supervisionada" nunca é verdadeiro para número privado (ver bloco de SQL): sem ele a recusa vale.
  assert.equal(decidirAcesso(GERENTE, { ...supervisionada, supervisionada: false }).ok, false);
});

test("transferência autorizada dá acesso àquela conversa (e a nenhuma outra)", () => {
  const transferida: FatosConversa = { responsavelId: CLOSER.userId, sessaoId: "sessao-pessoal", minha: true, supervisionada: false };
  assert.equal(decidirAcesso(CLOSER, transferida).ok, true);
  assert.equal(decidirAcesso(CLOSER, CONVERSA_PESSOAL).ok, false);
  assert.equal(decidirAcesso(SDR, transferida.minha ? { ...transferida, minha: false } : transferida).ok, false);
});

test("fila aberta (sem dono e sem número) é de quem pegar primeiro; sem dono num número alheio não é", () => {
  const fila: FatosConversa = { responsavelId: null, sessaoId: null, minha: false, supervisionada: false };
  assert.equal(decidirAcesso(CLOSER, fila).ok, true);
  assert.equal(decidirAcesso(CLOSER, CONVERSA_PESSOAL).ok, false);
});

test("número compartilhado: só quem está autorizado nele", () => {
  const compartilhada = (autorizado: boolean): FatosConversa => ({ responsavelId: null, sessaoId: "sessao-compartilhada", minha: autorizado, supervisionada: false });
  assert.equal(decidirAcesso(CLOSER, compartilhada(true)).ok, true);
  assert.equal(decidirAcesso(SDR, compartilhada(false)).ok, false);
  assert.equal(decidirAcesso(ADMIN, compartilhada(false)).ok, false);
});

test("super admin: acesso excepcional, e TODO uso manda auditar", () => {
  const d = decidirAcesso(OUTRO_SUPER, CONVERSA_PESSOAL);
  assert.equal(d.ok, true);
  assert.equal(d.ok && d.via, "super_admin");
  assert.equal(d.ok && d.auditar, "super_admin");
  // Quando a conversa é dele mesmo, não há exceção a auditar.
  const propria = decidirAcesso(DONO, CONVERSA_PESSOAL_DO_DONO);
  assert.equal(propria.ok && propria.auditar, null);
});

test("'ver como': vale como a pessoa observada, sem poder de super admin, e a exposição é auditada", () => {
  // Super admin real vendo como um closer.
  const comoCloser = ator(CLOSER.userId, "closer", { realRole: "super_admin", realUserId: OUTRO_SUPER.userId, isViewingAs: true });
  assert.equal(superAdminAgindo(comoCloser), false);
  // Não herda o poder de abrir a conversa pessoal do dono...
  assert.equal(decidirAcesso(comoCloser, CONVERSA_PESSOAL).ok, false);
  // ...e o que o closer vê, ele vê com rastro.
  const doCloser = decidirAcesso(comoCloser, { responsavelId: CLOSER.userId, sessaoId: "sessao-closer-1", minha: true, supervisionada: false });
  assert.equal(doCloser.ok, true);
  assert.equal(doCloser.ok && doCloser.auditar, "ver_como");
});

test("ver como um admin não dá o que o admin não tem", () => {
  const comoAdmin = ator(ADMIN.userId, "admin", { realRole: "super_admin", realUserId: OUTRO_SUPER.userId, isViewingAs: true });
  assert.equal(decidirAcesso(comoAdmin, CONVERSA_PESSOAL).ok, false);
});

test("papel falsificado no corpo/parâmetro não existe: só realRole e isViewingAs do servidor contam", () => {
  // Um closer que mandasse "role=super_admin" num parâmetro continua closer: o ator vem da sessão.
  assert.equal(superAdminAgindo(ator("x", "closer")), false);
  // userRole de super_admin SEM realRole (contexto manual: NEXO, worker) não é super admin agindo.
  assert.equal(superAdminAgindo({ userId: "x", userRole: "super_admin" }), false);
  assert.equal(decidirAcesso({ userId: "x", userRole: "super_admin" }, CONVERSA_PESSOAL).ok, false);
});

test("administrar NÚMERO: o cargo não mexe no número pessoal de outra pessoa", () => {
  const pessoalDoDono = { usuarioId: DONO.userId, donoEhHumano: true };
  const semDono = { usuarioId: null, donoEhHumano: false };
  const deAgente = { usuarioId: "agente-1", donoEhHumano: false };
  assert.equal(podeAdministrarNumero(DONO, pessoalDoDono), true);
  for (const quem of [ADMIN, DIRETOR, OPERACOES, GERENTE, COORD, CLOSER]) {
    assert.equal(podeAdministrarNumero(quem, pessoalDoDono), false, `${quem.userRole} administrou o número pessoal do dono`);
  }
  assert.equal(podeAdministrarNumero(OUTRO_SUPER, pessoalDoDono), true); // excepcional (a rota audita)
  // Número sem dono humano (compartilhado, de agente de IA) é da gestão.
  assert.equal(podeAdministrarNumero(ADMIN, semDono), true);
  assert.equal(podeAdministrarNumero(ADMIN, deAgente), true);
  assert.equal(podeAdministrarNumero(CLOSER, semDono), false);
  // "Ver como" é leitura.
  assert.equal(podeAdministrarNumero(ator(DONO.userId, "super_admin", { isViewingAs: true }), pessoalDoDono), false);
});

// ─── A forma do SQL: as listas usam as MESMAS peças que alimentam a decisão ───

const dialect = new PgDialect();
const texto = (q: ReturnType<typeof sql>) => dialect.sqlToQuery(q).sql.replace(/\s+/g, " ");

test("lista 'equipe' de admin: supervisão explícita, nunca TRUE por cargo", () => {
  const q = texto(condicaoEquipe(ADMIN, sql`c.responsavel_id`, sql`c.sessao_id`));
  assert.match(q, /whatsapp_supervisao/);
  assert.doesNotMatch(q, /\bTRUE\b/i, "o admin voltou a ver a organização inteira por cargo");
  // E é igual à do closer: o cargo não aparece no SQL.
  assert.equal(q, texto(condicaoEquipe(CLOSER, sql`c.responsavel_id`, sql`c.sessao_id`)));
});

test("supervisão nunca alcança número privado", () => {
  const q = texto(sessaoSupervisionada("u", sql`s.id`, sql`s.usuario_id`));
  assert.match(q, /sp\.privado/);
  const conv = texto(condicaoEquipe(GERENTE, sql`c.responsavel_id`, sql`c.sessao_id`));
  assert.match(conv, /NOT ws_s\.privado/);
  assert.match(conv, /NOT EXISTS \(SELECT 1 FROM whatsapp_sessao sp WHERE sp\.id = c\.sessao_id AND sp\.privado\)/);
});

test("super admin em lista: vê a equipe SEM os números privados", () => {
  const q = texto(condicaoEquipe(OUTRO_SUPER, sql`c.responsavel_id`, sql`c.sessao_id`));
  assert.match(q, /NOT EXISTS \(SELECT 1 FROM whatsapp_sessao sp WHERE sp\.id = c\.sessao_id AND sp\.privado\)/);
  // O "ver como" não ganha o atalho do super admin.
  const verComo = ator("closer-1", "closer", { realRole: "super_admin", isViewingAs: true });
  assert.equal(texto(condicaoEquipe(verComo, sql`c.responsavel_id`, sql`c.sessao_id`)), texto(condicaoEquipe(CLOSER, sql`c.responsavel_id`, sql`c.sessao_id`)));
});

test("'minhas' não depende de papel nenhum", () => {
  assert.equal(
    texto(condicaoConversa(ADMIN, "minhas", sql`c.responsavel_id`, sql`c.sessao_id`)),
    texto(condicaoMinhasConversas(CLOSER.userId, sql`c.responsavel_id`, sql`c.sessao_id`)),
  );
});

test("lista de números: privado de outra pessoa não aparece para admin; aparece para o dono por ser dele", () => {
  const admin = texto(sessaoVisivel(ADMIN, sql`s.id`, sql`s.usuario_id`));
  assert.doesNotMatch(admin, /\bTRUE\b/i);
  assert.match(admin, /whatsapp_sessao_acesso/);
  assert.match(texto(sessaoPrivada(sql`s.id`)), /sp\.privado/);
});
