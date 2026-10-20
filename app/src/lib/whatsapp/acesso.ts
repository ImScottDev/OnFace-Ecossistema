import { db } from "@/lib/db";
import { contatos } from "@/lib/db/schema";
import { sql, SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

/**
 * Autorização de número e de conversa de WhatsApp. Regra ÚNICA: tela de
 * Atendimento, badge da casca, Início, NEXO, agentes de IA e todas as rotas
 * leem daqui. Há uma trava de arquitetura (arquitetura/conversa-so-pela-porta)
 * que reprova qualquer leitura de conversa que não passe por este arquivo.
 *
 * POLÍTICA (decisão do dono do produto, 13/10/2026, depois de achar que qualquer
 * admin abria o WhatsApp PESSOAL dele só pelo cargo):
 *  1. cada pessoa vê as PRÓPRIAS conversas: as que chegaram por um número seu,
 *     por um número compartilhado com ela, ou que lhe foram atribuídas;
 *  2. TRANSFERÊNCIA autorizada dá acesso àquela conversa (responsavel_id = eu);
 *  3. SUPERVISÃO de equipe exige permissão EXPLÍCITA (whatsapp_supervisao). O
 *     cargo não concede nada: admin, director, operations, gerente e coordinator
 *     entram em pé de igualdade com um closer;
 *  4. número PRIVADO (whatsapp_sessao.privado) não é alcançado nem pela
 *     supervisão: só dono, quem ele compartilhou (whatsapp_sessao_acesso) e o
 *     super admin;
 *  5. SUPER ADMIN tem acesso excepcional, e todo uso dele deixa rastro em
 *     audit_log (quem, quando, qual conversa). Em lista, o super admin vê a
 *     equipe SEM os números privados; conversa privada só abre por id, e abre
 *     auditada;
 *  6. "VER COMO" (cookie do super admin) vale como a pessoa observada: nada de
 *     poderes de super admin, só leitura, e a exposição é auditada;
 *  7. quem não tem acesso recebe 404, igual a conversa que não existe: não dá
 *     para descobrir conversa ou mensagem por id, busca, parâmetro ou link.
 *
 * Papéis que não se confundem:
 *  - dono do número ......... whatsapp_sessao.usuario_id (pessoa OU agente de IA,
 *                             que é usuário tipo 'agente'); nulo = compartilhado;
 *  - autorizado a usar ...... whatsapp_sessao_acesso (número compartilhado com ele);
 *  - responsável da conversa  contatos.responsavel_id;
 *  - agente que conduz ...... ai_agent_versions.channel_session_id + opt-in por conversa;
 *  - sessão técnica ......... whatsapp_sessao.session_name (wuzapi);
 *  - contato externo ........ contatos.telefone.
 *
 * ATENÇÃO: não passe o papel por `normalizeRole()` — ela colapsa "super_admin"
 * em "admin" e derruba a regra inteira.
 */

/** Quem está agindo. `TenantContext` já tem todos os campos; contextos manuais (NEXO, worker) só os básicos. */
export type AtorWhatsApp = {
  userId: string;
  organizacaoId?: string;
  userRole?: string | null;
  /** Papel de quem está LOGADO de fato (no "ver como", `userRole` é o do observado). */
  realRole?: string | null;
  realUserId?: string | null;
  isViewingAs?: boolean;
};

/** Super admin AGINDO como ele mesmo. No "ver como" vale o observado, sem poder nenhum. */
export function superAdminAgindo(ator: AtorWhatsApp): boolean {
  return ator.realRole === "super_admin" && !ator.isViewingAs;
}

/** Quem executou de verdade (no "ver como", o super admin real, não o observado). */
const autorReal = (ator: AtorWhatsApp) => ator.realUserId ?? ator.userId;

// ─── Gestão de NÚMEROS (Ajustes > WhatsApp). Não concede leitura de conversa. ───

export type EscopoGestao = "organizacao" | "time" | null;

/**
 * Até onde o cargo permite ADMINISTRAR números (criar, atribuir dono de número sem
 * dono humano, definir padrão). É administração, NÃO leitura: conversa alheia
 * continua exigindo a regra deste arquivo. Sempre o papel REAL.
 */
export function escopoDeGestao(ator: Pick<AtorWhatsApp, "userRole" | "realRole">): EscopoGestao {
  const r = ator.realRole ?? ator.userRole ?? null;
  if (r === "super_admin" || r === "admin" || r === "director" || r === "operations") return "organizacao";
  if (r === "gerente" || r === "coordinator") return "time";
  return null;
}

/** Ids dos usuários do MEU time (eu, quem divide meu team_id e os times que gerencio). Só para escolher destinatários de números, nunca para ler conversa. */
export function usuariosDoTime(userId: string): SQL {
  return sql`(SELECT u.id FROM usuarios u
               WHERE u.id = ${userId}
                  OR u.team_id IN (SELECT t.id FROM teams t WHERE t.manager_id = ${userId})
                  OR (u.team_id IS NOT NULL AND u.team_id = (SELECT me.team_id FROM usuarios me WHERE me.id = ${userId})))`;
}

// ─── Peças de SQL ───

/** Coluna do Drizzle ou fragmento de SQL (alias de SQL cru). */
type Col = SQL | AnyPgColumn;

/** Alvos que o supervisor recebeu EXPLICITAMENTE. */
const alvosDeSupervisao = (userId: string): SQL =>
  sql`(SELECT sv.alvo_usuario_id FROM whatsapp_supervisao sv WHERE sv.supervisor_id = ${userId})`;

/** O número é privado. Sessão nula (conversa sem número) nunca é privada. */
export function sessaoPrivada(sessao: Col): SQL {
  return sql`EXISTS (SELECT 1 FROM whatsapp_sessao sp WHERE sp.id = ${sessao} AND sp.privado)`;
}

/** Número que o usuário pode USAR (ver e enviar): é dono ou está autorizado. `id`/`dono` são colunas de whatsapp_sessao. */
export function sessaoMinha(userId: string, id: SQL, dono: SQL): SQL {
  return sql`(${dono} = ${userId}
    OR EXISTS (SELECT 1 FROM whatsapp_sessao_acesso wsa WHERE wsa.sessao_id = ${id} AND wsa.usuario_id = ${userId}))`;
}

/** Número que o usuário SUPERVISIONA por permissão explícita. Número privado nunca entra. */
export function sessaoSupervisionada(userId: string, id: SQL, dono: SQL): SQL {
  return sql`(${dono} IN ${alvosDeSupervisao(userId)} AND NOT ${sessaoPrivada(id)})`;
}

/**
 * Número que o ator pode VER em lista (Ajustes, seletor): o seu, o compartilhado com ele, o que
 * supervisiona por permissão e, para o super admin, os não privados. Nunca por cargo.
 */
export function sessaoVisivel(ator: AtorWhatsApp, id: SQL, dono: SQL): SQL {
  const base = sql`(${sessaoMinha(ator.userId, id, dono)} OR ${sessaoSupervisionada(ator.userId, id, dono)})`;
  return superAdminAgindo(ator) ? sql`(${base} OR NOT ${sessaoPrivada(id)})` : base;
}


const numeroMeu = (userId: string, sessao: Col): SQL =>
  sql`EXISTS (SELECT 1 FROM whatsapp_sessao ws_m WHERE ws_m.id = ${sessao} AND ${sessaoMinha(userId, sql`ws_m.id`, sql`ws_m.usuario_id`)})`;

/** Sem dono e sem número: fila aberta da organização, de quem pegar primeiro. */
const filaAberta = (resp: Col, sessao: Col): SQL => sql`(${resp} IS NULL AND ${sessao} IS NULL)`;

/** Conversa que o usuário supervisiona por permissão explícita: números não privados do alvo e conversas atribuídas ao alvo. */
function conversaSupervisionada(userId: string, resp: Col, sessao: Col): SQL {
  const alvos = alvosDeSupervisao(userId);
  return sql`((${resp} IN ${alvos} AND NOT ${sessaoPrivada(sessao)})
    OR EXISTS (SELECT 1 FROM whatsapp_sessao ws_s WHERE ws_s.id = ${sessao} AND NOT ws_s.privado AND ws_s.usuario_id IN ${alvos}))`;
}

/**
 * "Minhas conversas": é minha a conversa que (1) chegou por um número meu ou
 * compartilhado comigo, (2) está atribuída a mim (inclusive por transferência),
 * ou (3) está sem dono e sem número, a fila aberta da organização. Conversa sem
 * dono num número de OUTRA pessoa não é minha.
 *
 * `resp` e `sessao` são as colunas de `contatos`: no Drizzle passe
 * `contatos.responsavelId`/`contatos.sessaoId`; em SQL cru com alias, `sql`c.responsavel_id``.
 */
export function condicaoMinhasConversas(
  userId: string,
  resp: Col = contatos.responsavelId,
  sessao: Col = contatos.sessaoId,
): SQL {
  return sql`(${resp} = ${userId} OR ${numeroMeu(userId, sessao)} OR ${filaAberta(resp, sessao)})`;
}

/**
 * "Equipe": as minhas mais as que supervisiono por permissão explícita. Para o super
 * admin agindo, também as de números não privados (conversa privada só por id, auditada).
 * Sem permissão nenhuma, é igual a "Minhas": o cargo não acrescenta uma linha.
 */
export function condicaoEquipe(ator: AtorWhatsApp, resp: Col = contatos.responsavelId, sessao: Col = contatos.sessaoId): SQL {
  const base = sql`(${condicaoMinhasConversas(ator.userId, resp, sessao)} OR ${conversaSupervisionada(ator.userId, resp, sessao)})`;
  return superAdminAgindo(ator) ? sql`(${base} OR NOT ${sessaoPrivada(sessao)})` : base;
}

export type EscopoConversas = "minhas" | "equipe";

/** A única condição de lista: "minhas" ou "equipe". */
export function condicaoConversa(ator: AtorWhatsApp, escopo: EscopoConversas = "minhas", resp: Col = contatos.responsavelId, sessao: Col = contatos.sessaoId): SQL {
  return escopo === "equipe" ? condicaoEquipe(ator, resp, sessao) : condicaoMinhasConversas(ator.userId, resp, sessao);
}

/** Pode alternar para "Equipe": tem supervisão concedida, ou é super admin. O cargo não basta. */
export async function podeVerEquipe(ator: AtorWhatsApp): Promise<boolean> {
  if (superAdminAgindo(ator)) return true;
  const [r] = await db.execute<{ ok: boolean }>(sql`
    SELECT EXISTS (SELECT 1 FROM whatsapp_supervisao WHERE supervisor_id = ${ator.userId}) AS ok`);
  return r?.ok === true;
}

// ─── Decisão pura (testável sem banco) ───

/** Fatos de UMA conversa, calculados no banco pelas mesmas peças de SQL das listas. */
export type FatosConversa = {
  responsavelId: string | null;
  sessaoId: string | null;
  /** Atribuída a mim, ou chegou por número meu/compartilhado comigo. */
  minha: boolean;
  /** Supervisiono por permissão explícita e o número não é privado. */
  supervisionada: boolean;
};

export type DecisaoAcesso =
  | { ok: true; via: "minha" | "fila" | "supervisao" | "super_admin"; auditar: null | "super_admin" | "ver_como" }
  | { ok: false };

/** A decisão em si. Não lê banco: o que muda o resultado é o ator e os fatos. */
export function decidirAcesso(ator: AtorWhatsApp, f: FatosConversa): DecisaoAcesso {
  const verComo = ator.isViewingAs === true;
  if (f.minha) return { ok: true, via: "minha", auditar: verComo ? "ver_como" : null };
  if (f.responsavelId === null && f.sessaoId === null) return { ok: true, via: "fila", auditar: verComo ? "ver_como" : null };
  if (f.supervisionada) return { ok: true, via: "supervisao", auditar: verComo ? "ver_como" : null };
  if (superAdminAgindo(ator)) return { ok: true, via: "super_admin", auditar: "super_admin" };
  return { ok: false };
}

// ─── Rastro de auditoria do acesso excepcional ───

const JANELA_MIN = 10;

/**
 * Registra que o super admin (ou o "ver como") abriu uma conversa/lista que não é dele.
 * Grava QUEM, QUANDO e QUAL conversa; nunca o conteúdo. A tela atualiza a conversa a cada
 * poucos segundos, então a mesma tripla (autor, ação, alvo) dentro de {JANELA_MIN} minutos
 * vira uma linha só. Se não conseguir gravar, o erro sobe e o acesso NÃO acontece.
 */
export async function registrarAcessoExcepcional(
  ator: AtorWhatsApp & { organizacaoId: string },
  via: "super_admin" | "ver_como",
  alvo: { tipo: "contato" | "whatsapp_sessao" | "lista"; id?: string | null; detalhe?: Record<string, unknown> },
): Promise<void> {
  const acao = via === "super_admin" ? "whatsapp.acesso_excepcional" : "whatsapp.ver_como";
  const autor = autorReal(ator);
  const id = alvo.id ?? null;
  const [recente] = await db.execute<{ id: string }>(sql`
    SELECT id::text FROM audit_log
     WHERE organizacao_id = ${ator.organizacaoId}::uuid AND actor_id = ${autor}::uuid AND action = ${acao}
       AND entity_type = ${alvo.tipo} AND entity_id IS NOT DISTINCT FROM ${id}::uuid
       AND created_at > now() - make_interval(mins => ${JANELA_MIN}::int)
     LIMIT 1`);
  if (recente) return;
  await db.execute(sql`
    INSERT INTO audit_log (organizacao_id, actor_id, action, entity_type, entity_id, after, source)
    VALUES (${ator.organizacaoId}::uuid, ${autor}::uuid, ${acao}, ${alvo.tipo}, ${id}::uuid,
            ${JSON.stringify({ via, comoUsuarioId: ator.isViewingAs ? ator.userId : null, ...(alvo.detalhe ?? {}) })}::jsonb, 'api')`);
}

export type AcessoConversa =
  | { ok: true; contato: { id: string; telefone: string | null; leadId: string | null; responsavelId: string | null; sessaoId: string | null } }
  | { ok: false; motivo: "nao_encontrado" | "sem_permissao" };

/**
 * Checa se o usuário pode abrir UM contato. Usa sempre isto antes de devolver
 * mensagem, enviar, reagir, apagar, etiquetar ou atribuir — o filtro de organização
 * sozinho não separa nada: todo o time vive na mesma org.
 */
export async function checarAcessoContato(
  ator: AtorWhatsApp & { organizacaoId: string },
  contatoId: string,
): Promise<AcessoConversa> {
  const resp = sql`c.responsavel_id`;
  const sessao = sql`c.sessao_id`;
  const [linha] = await db.execute<{
    id: string; telefone: string | null; lead_id: string | null; responsavel_id: string | null; sessao_id: string | null;
    minha: boolean; supervisionada: boolean;
  }>(sql`
    SELECT c.id::text, c.telefone, c.lead_id::text, c.responsavel_id::text, c.sessao_id::text,
           (${resp} = ${ator.userId} OR ${numeroMeu(ator.userId, sessao)}) AS minha,
           ${conversaSupervisionada(ator.userId, resp, sessao)} AS supervisionada
      FROM contatos c
     WHERE c.id = ${contatoId}::uuid AND c.organizacao_id = ${ator.organizacaoId}::uuid`);

  if (!linha) return { ok: false, motivo: "nao_encontrado" };
  const dados = { id: linha.id, telefone: linha.telefone, leadId: linha.lead_id, responsavelId: linha.responsavel_id, sessaoId: linha.sessao_id };
  const d = decidirAcesso(ator, { responsavelId: dados.responsavelId, sessaoId: dados.sessaoId, minha: linha.minha === true, supervisionada: linha.supervisionada === true });
  if (!d.ok) return { ok: false, motivo: "sem_permissao" };
  if (d.auditar) await registrarAcessoExcepcional(ator, d.auditar, { tipo: "contato", id: dados.id });
  return { ok: true, contato: dados };
}

/**
 * Registra o uso de uma LISTA excepcional (aba "Equipe" do super admin; qualquer lista no "ver
 * como"). Sem alvo individual: o rastro é o escopo que foi aberto.
 */
export async function registrarListaExcepcional(ator: AtorWhatsApp & { organizacaoId: string }, escopo: EscopoConversas, onde: string): Promise<void> {
  if (ator.isViewingAs) return registrarAcessoExcepcional(ator, "ver_como", { tipo: "lista", detalhe: { onde, escopo } });
  if (escopo === "equipe" && superAdminAgindo(ator)) return registrarAcessoExcepcional(ator, "super_admin", { tipo: "lista", detalhe: { onde, escopo } });
}

/**
 * Condição de LEITURA agregada de conversas que não pertencem a ninguém em particular
 * (feed, métricas): conversas de número privado ficam de fora.
 */
export function condicaoConversaNaoPrivada(sessao: Col = contatos.sessaoId): SQL {
  return sql`NOT ${sessaoPrivada(sessao)}`;
}

/**
 * `communications` guarda uma CÓPIA de cada mensagem de WhatsApp (conteúdo e resumo), com
 * `origem_legado_id` = a mensagem. Quem lê `communications` fora da conversa (API pública, timeline)
 * deixa de fora a cópia de mensagem de número privado. `alias` é o apelido da tabela no SQL.
 */
export function condicaoComunicacaoNaoPrivada(alias: "c" | "cm" = "cm"): SQL {
  const a = sql.raw(alias);
  return sql`NOT (${a}.canal = 'whatsapp' AND EXISTS (
    SELECT 1 FROM whatsapp_mensagens wm JOIN whatsapp_sessao ws ON ws.id = wm.sessao_id
     WHERE wm.id = ${a}.origem_legado_id AND ws.privado))`;
}

/**
 * Enviar é FALAR PELO WHATSAPP de alguém: só por número que é do ator (dono ou
 * compartilhado com ele, inclusive o agente de IA). Supervisão e cargo não enviam,
 * super admin não envia por número alheio, e o "ver como" é só leitura.
 */
export async function sessaoAutorizadaParaEnvio(
  ator: AtorWhatsApp & { organizacaoId: string },
  sessaoId: string,
): Promise<boolean> {
  if (ator.isViewingAs) return false;
  const [r] = await db.execute<{ ok: boolean }>(sql`
    SELECT ${sessaoMinha(ator.userId, sql`s.id`, sql`s.usuario_id`)} AS ok
      FROM whatsapp_sessao s
     WHERE s.id = ${sessaoId}::uuid AND s.organizacao_id = ${ator.organizacaoId}::uuid`);
  return r?.ok === true;
}

/**
 * Quem pode ALTERAR o número (dono, privacidade, acessos, apagar): o dono, o super admin
 * (auditado pela rota) ou, quando o número não tem dono humano (compartilhado ou de agente
 * de IA), a gestão. Cargo nenhum mexe no número pessoal de outra pessoa.
 */
export function podeAdministrarNumero(
  ator: Pick<AtorWhatsApp, "userId" | "userRole" | "realRole" | "isViewingAs">,
  sessao: { usuarioId: string | null; donoEhHumano: boolean },
): boolean {
  if (ator.isViewingAs) return false;
  if (ator.realRole === "super_admin") return true;
  if (sessao.usuarioId === ator.userId) return true;
  if (sessao.usuarioId === null || !sessao.donoEhHumano) return escopoDeGestao(ator) !== null;
  return false;
}

/**
 * Quem pode ATENDER por um número, para o rodízio/carga de número compartilhado.
 *
 * Regra pura (os fatos vêm do banco em `atendentesDoNumero`): pessoa ATIVA — e
 * pessoa mesmo, nunca agente de IA (`usuarios.tipo = 'agente'`, que não abre
 * tela e não atende) — que é dona do número ou recebeu acesso a ele
 * (`whatsapp_sessao_acesso`). É o mesmo par de papéis de `sessaoMinha`, do lado
 * de quem RECEBE a conversa.
 */
export function podeAtenderPeloNumero(
  usuario: { ativo?: boolean | null; tipo?: string | null },
  vinculo: { ehDono: boolean; temAcesso: boolean },
): boolean {
  return usuario.ativo !== false && usuario.tipo !== "agente" && (vinculo.ehDono || vinculo.temAcesso);
}

/**
 * Ids de quem pode atender por este número, na ordem de criação (estável).
 * Lista vazia = número compartilhado sem nenhum acesso concedido; quem chama
 * decide o fallback (ver o rodízio no worker).
 */
export async function atendentesDoNumero(organizacaoId: string, sessaoId: string): Promise<string[]> {
  const linhas = await db.execute<{ id: string; ativo: boolean; tipo: string; dono: boolean; acesso: boolean }>(sql`
    SELECT u.id::text, u.ativo, u.tipo,
           (s.usuario_id = u.id) AS dono,
           EXISTS (SELECT 1 FROM whatsapp_sessao_acesso a WHERE a.sessao_id = s.id AND a.usuario_id = u.id) AS acesso
      FROM usuarios u
      JOIN whatsapp_sessao s ON s.id = ${sessaoId}::uuid AND s.organizacao_id = ${organizacaoId}::uuid
     WHERE u.organizacao_id = ${organizacaoId}::uuid
     ORDER BY u.created_at`);
  return linhas
    .filter((l) => podeAtenderPeloNumero(l, { ehDono: l.dono === true, temAcesso: l.acesso === true }))
    .map((l) => l.id);
}

/** Resposta padrão — 404 pra não confirmar a existência de conversa alheia. */
export function respostaSemAcesso() {
  return Response.json({ error: "Conversa nao encontrada" }, { status: 404 });
}

/** Mídia de WhatsApp só sai para quem pode abrir a conversa da mensagem. Ver `autorizarMidiaWhatsapp`. */
export async function autorizarMidiaWhatsapp(
  ator: AtorWhatsApp & { organizacaoId: string },
  urlsDaMidia: string[],
): Promise<boolean> {
  const lista = urlsDaMidia.map((u) => sql`${u}`);
  const donas = await db.execute<{ contato_id: string | null }>(sql`
    SELECT DISTINCT m.contato_id::text
      FROM whatsapp_mensagens m
     WHERE m.media_url IN (${sql.join(lista, sql`, `)})
       AND (m.contato_id IS NULL OR EXISTS (SELECT 1 FROM contatos c WHERE c.id = m.contato_id AND c.organizacao_id = ${ator.organizacaoId}::uuid))`);
  const contatosDaMidia = donas.map((d) => d.contato_id).filter((id): id is string => !!id);
  // Nenhuma conversa aponta para este arquivo: não é mídia de conversa, quem decide é o módulo dono dele.
  if (contatosDaMidia.length === 0) return true;
  for (const id of contatosDaMidia) {
    if ((await checarAcessoContato(ator, id)).ok) return true;
  }
  return false;
}
