/**
 * Roteamento comercial: família/campanha -> closer.
 *
 * As regras vivem em `roteamento_comercial_regras` (administráveis na tela) e o
 * destino é ID de usuário, nunca nome. A regra de campanha prevalece sobre a de
 * família porque tem prioridade maior; empate desempata por especificidade.
 * Responsável inativo ou pausado NUNCA é trocado em silêncio: o resultado diz
 * `fila_humana` (ou rodízio, se a regra pedir) e o motivo.
 */
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { closerDisponibilidade, leads, roteamentoComercialRegras, usuarios } from "@/lib/db/schema";
import { pickNextCloser } from "./agenda-closers";

export type FamiliaComercial = "CALLFACE_AI" | "WHITE_LABEL" | "PABX";
export type Regra = typeof roteamentoComercialRegras.$inferSelect;

const sem = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Família a partir do texto livre de produto/campanha/origem. Ordem importa: White Label é mais específico que "AI". */
export function familiaDoTexto(...textos: (string | null | undefined | string[])[]): FamiliaComercial | null {
  const t = sem(textos.flat().filter(Boolean).join(" | "));
  if (!t) return null;
  if (/white ?label|\bwl\b|revenda|marca propria/.test(t)) return "WHITE_LABEL";
  if (/pabx|ramal|central telefonica|telefonia (ip|voip)/.test(t)) return "PABX";
  if (/callface ?ai|callpilot|analise de ligac|transcric|discador|\bia\b|inteligencia artificial/.test(t)) return "CALLFACE_AI";
  return null;
}

export type ResultadoRoteamento =
  | { tipo: "usuario"; usuarioId: string; nome: string; regra: { id: string; nome: string } }
  | { tipo: "rodizio"; usuarioId: string; nome: string; regra: { id: string; nome: string } | null }
  | { tipo: "fila_humana"; motivo: string; regra: { id: string; nome: string } | null };

export interface EntradaRoteamento {
  organizacaoId: string;
  familia?: FamiliaComercial | null;
  campanha?: string | null;
  agora?: Date;
}

const vigente = (r: Regra, agora: Date) => (!r.vigenteDe || r.vigenteDe <= agora) && (!r.vigenteAte || r.vigenteAte >= agora);

export function regraQueCasa(regras: Regra[], e: { familia?: FamiliaComercial | null; campanha?: string | null }, agora: Date): Regra | null {
  const camp = sem(e.campanha ?? "");
  const casam = regras.filter((r) => r.ativa && vigente(r, agora)
    && (!r.familia || r.familia === e.familia)
    && (!r.campanha || (camp && camp.includes(sem(r.campanha)))));
  // maior prioridade; empate: a que especifica mais coisas (campanha + família > só família > curinga)
  const espec = (r: Regra) => (r.campanha ? 2 : 0) + (r.familia ? 1 : 0);
  return casam.sort((a, b) => b.prioridade - a.prioridade || espec(b) - espec(a))[0] ?? null;
}

/**
 * Por que este usuário NÃO pode receber a reunião (null quando pode).
 *
 * Mesma régua da fila de closers (`getActiveClosers`/`getFilaClosers`), inclusive
 * o `role`: a disponibilidade da equipe só monta a agenda de quem está na fila, e
 * quem não está devolvia lista vazia — o agente recebia "Outlook indisponível"
 * para um usuário que nem é closer (caso real: Scott Ferraz, `super_admin` com
 * `closer_disponibilidade` ativa).
 */
export function motivoIndisponivel(
  u: { nome: string; ativo: boolean | null; tipo: string | null; role: string | null },
  d: { ativo: boolean | null; pausado: boolean | null } | null,
): string | null {
  if (!u.ativo) return `${u.nome} está inativo(a)`;
  if (u.tipo === "agente") return "o destino da regra é um agente, não uma pessoa";
  if (u.role !== "closer") return `${u.nome} não está na fila de closers (perfil ${u.role ?? "sem perfil"}): a agenda comercial não oferece horário dela`;
  if (!d || !d.ativo) return `${u.nome} não configurou a agenda de disponibilidade`;
  if (d.pausado) return `${u.nome} está com a agenda pausada`;
  return null;
}

async function closerDisponivel(organizacaoId: string, usuarioId: string): Promise<{ nome: string } | { motivo: string }> {
  const [u] = await db.select({ nome: usuarios.nome, ativo: usuarios.ativo, tipo: usuarios.tipo, role: usuarios.role }).from(usuarios)
    .where(and(eq(usuarios.id, usuarioId), eq(usuarios.organizacaoId, organizacaoId))).limit(1);
  if (!u) return { motivo: "o responsável da regra não existe mais nesta organização" };
  const [d] = await db.select({ ativo: closerDisponibilidade.ativo, pausado: closerDisponibilidade.pausadoRodizio }).from(closerDisponibilidade).where(eq(closerDisponibilidade.usuarioId, usuarioId)).limit(1);
  const motivo = motivoIndisponivel(u, d ?? null);
  return motivo ? { motivo } : { nome: u.nome };
}

export async function resolverCloser(e: EntradaRoteamento): Promise<ResultadoRoteamento> {
  const agora = e.agora ?? new Date();
  const regras = await db.select().from(roteamentoComercialRegras).where(eq(roteamentoComercialRegras.organizacaoId, e.organizacaoId)).orderBy(desc(roteamentoComercialRegras.prioridade));
  const regra = regraQueCasa(regras, e, agora);
  /* Sem regra que cubra a família/campanha, o destino é o RODÍZIO, não a fila
     humana: as regras existem para FIXAR o destino de uma origem específica, e
     lead sem regra é o caso comum (em 21/10/2026, 2.905 dos 4.559 leads da
     Callface — as duas regras vigentes só casam por campanha). Antes disso o
     agente recebia "nenhuma regra de roteamento cobre esta família/campanha" e
     não tinha horário nenhum para oferecer: o lead qualificado ficava esperando
     uma pessoa. Fila humana só quando não há closer ativo no rodízio. */
  if (!regra) {
    const prox = await pickNextCloser(db, e.organizacaoId);
    return prox
      ? { tipo: "rodizio", usuarioId: prox.id, nome: prox.nome, regra: null }
      : { tipo: "fila_humana", motivo: "nenhuma regra cobre esta família/campanha e não há closer ativo no rodízio", regra: null };
  }
  const ref = { id: regra.id, nome: regra.nome };
  if (regra.destinoUsuarioId) {
    const ok = await closerDisponivel(e.organizacaoId, regra.destinoUsuarioId);
    if ("nome" in ok) return { tipo: "usuario", usuarioId: regra.destinoUsuarioId, nome: ok.nome, regra: ref };
    if (regra.fallback === "rodizio") {
      const prox = await pickNextCloser(db, e.organizacaoId);
      if (prox) return { tipo: "rodizio", usuarioId: prox.id, nome: prox.nome, regra: ref };
    }
    return { tipo: "fila_humana", motivo: `Regra "${regra.nome}": ${ok.motivo}`, regra: ref };
  }
  const prox = await pickNextCloser(db, e.organizacaoId);
  return prox ? { tipo: "rodizio", usuarioId: prox.id, nome: prox.nome, regra: ref } : { tipo: "fila_humana", motivo: "sem closer ativo para o rodízio", regra: ref };
}

/** Família e campanha do lead (campos do cadastro + negócio mais recente). */
export async function sinaisDoLead(organizacaoId: string, leadId: string): Promise<{ familia: FamiliaComercial | null; campanha: string | null }> {
  const [l] = await db.select({ servicos: leads.servicosInteresse, origem: leads.origem, campanha: leads.utmCampaign, meta: leads.metaCampaignId, empresaSetor: leads.empresaSetor })
    .from(leads).where(and(eq(leads.id, leadId), eq(leads.organizacaoId, organizacaoId))).limit(1);
  if (!l) return { familia: null, campanha: null };
  const [n] = await db.execute<{ f: string | null }>(sql`SELECT service_family AS f FROM negocios WHERE lead_id = ${leadId}::uuid AND organizacao_id = ${organizacaoId}::uuid AND service_family IS NOT NULL ORDER BY updated_at DESC LIMIT 1`);
  const campanha = l.campanha ?? l.origem ?? null;
  const familia = (n?.f && ["CALLFACE_AI", "WHITE_LABEL", "PABX"].includes(n.f) ? n.f as FamiliaComercial : null)
    ?? familiaDoTexto(l.servicos ?? [], l.campanha, l.origem);
  return { familia, campanha };
}

export async function listarRegras(organizacaoId: string) {
  return db.select({ r: roteamentoComercialRegras, destino: usuarios.nome }).from(roteamentoComercialRegras)
    .leftJoin(usuarios, eq(usuarios.id, roteamentoComercialRegras.destinoUsuarioId))
    .where(eq(roteamentoComercialRegras.organizacaoId, organizacaoId)).orderBy(desc(roteamentoComercialRegras.prioridade));
}
