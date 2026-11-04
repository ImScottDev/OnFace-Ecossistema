import ExcelJS from "exceljs";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { empresas, leads, negocios } from "@/lib/db/schema";

/**
 * Disparo do AGENTE DE VOZ da Callface com o contexto do lead.
 *
 * Diferente de `enviarParaDiscagem` (webhook de entrada), que só manda
 * `{nome, telefone}` e perde o controle do roteiro: aqui o ONFACE cria uma
 * campanha do agente com uma planilha de uma linha, e cada variável do agente
 * vira uma coluna. É assim, e só assim, que o agente atende sabendo o nome, o
 * e-mail já cadastrado, a empresa e a origem do lead.
 *
 * Contrato levantado na própria plataforma em 04/11/2026 (a UI é o único lugar
 * que documentava isto; as duas rotas abaixo não aparecem no pacote do app):
 *   POST /auth/sign-in                      -> { accessToken }
 *   POST /agents/{id}/upload-campaign       -> multipart `file` (.xlsx) + `name`
 *   POST /agents/{id}/start-campaign        -> começa a discar
 *
 * Limites reais, não contornáveis daqui:
 * - CSV é recusado ("Please upload an Excel file"), só .xlsx/.xls.
 * - `start-campaign` é por AGENTE, não por campanha: inicia o que está
 *   pendente naquele agente. Por isso uma campanha por lead, criada e iniciada
 *   em seguida.
 * - As tentativas e a janela de discagem são da campanha (padrão da
 *   plataforma: 2 tentativas, 120 min, seg a sex, 9h às 18h, America/Sao_Paulo).
 */

const BASE = process.env.CALLFACE_API_URL || "https://api.callface.io";
const AGENTE_ID = process.env.CALLFACE_AGENTE_VOZ_ID || "";

export interface ContextoDaLigacao {
  nome: string;
  telefone: string;
  email?: string | null;
  empresa?: string | null;
  origem?: string | null;
}

export interface ResultadoDisparo {
  ok: boolean;
  detalhe: string;
  campanha?: string;
}

let tokenEmCache: { valor: string; em: number } | null = null;

/** Login na API da Callface. O token é curto; guardamos por 20 min e refazemos no 401. */
async function token(forcar = false): Promise<string | null> {
  const email = process.env.CALLFACE_API_EMAIL;
  const senha = process.env.CALLFACE_API_PASSWORD;
  if (!email || !senha) return null;
  if (!forcar && tokenEmCache && Date.now() - tokenEmCache.em < 20 * 60 * 1000) return tokenEmCache.valor;
  const res = await fetch(`${BASE}/auth/sign-in`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: senha }),
  });
  if (!res.ok) return null;
  const corpo = (await res.json().catch(() => null)) as { accessToken?: unknown } | null;
  const valor = typeof corpo?.accessToken === "string" ? corpo.accessToken : null;
  if (!valor) return null;
  tokenEmCache = { valor, em: Date.now() };
  return valor;
}

/**
 * A Callface prefixa o 55 sozinha e a planilha espera DDD + número puro.
 * Mandar "+55" de novo já discou para o número errado uma vez (DDD 19 virando
 * outro), então o 55 sai aqui, não na borda.
 */
export function telefoneParaPlanilha(bruto: unknown): string | null {
  let n = String(bruto ?? "").replace(/\D/g, "");
  if (n.length > 11 && n.startsWith("55")) n = n.slice(2);
  return n.length >= 10 && n.length <= 11 ? n : null;
}

/**
 * Valor de variável que o agente recebe. Vazio vira "nao informado" de
 * propósito: o roteiro sabe tratar esse texto como desconhecido e perguntar,
 * enquanto uma célula vazia corre o risco de a engine falar o `{{...}}` cru.
 */
function celula(v: unknown): string {
  const s = String(v ?? "").trim();
  return s || "nao informado";
}

/**
 * O agente não sabe que dia é hoje, e sem isso "quarta" virou a quarta da
 * semana seguinte numa ligação real. A data vai como variável e o roteiro
 * calcula tudo a partir dela.
 */
export function hojePorExtenso(agora = new Date()): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo",
  }).format(agora);
}

async function planilhaDoLead(ctx: ContextoDaLigacao, telefone: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("contatos");
  // Os títulos são o contrato: Telefone é obrigatório e cada variável do agente
  // precisa de uma coluna com o nome dela.
  ws.addRow(["Telefone", "Nome", "E-mail", "Empresa", "origem", "hoje"]);
  ws.addRow([telefone, celula(ctx.nome), celula(ctx.email), celula(ctx.empresa), celula(ctx.origem), hojePorExtenso()]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

async function postar(caminho: string, corpo: FormData | string, jwt: string): Promise<Response> {
  const headers: Record<string, string> = { Authorization: `Bearer ${jwt}` };
  if (typeof corpo === "string") headers["Content-Type"] = "application/json";
  return fetch(`${BASE}${caminho}`, { method: "POST", headers, body: corpo });
}

/**
 * Cria a campanha do lead no agente de voz e manda discar.
 *
 * Best-effort como todo adapter: devolve o motivo em vez de lançar, para a
 * automação registrar a falha e seguir (o fallback de WhatsApp/e-mail da
 * cadência é quem assume quando a ligação não acontece).
 */
export async function dispararAgenteDeVoz(ctx: ContextoDaLigacao): Promise<ResultadoDisparo> {
  if (!AGENTE_ID) return { ok: false, detalhe: "CALLFACE_AGENTE_VOZ_ID não configurado" };
  const telefone = telefoneParaPlanilha(ctx.telefone);
  if (!telefone) return { ok: false, detalhe: `telefone inválido: ${ctx.telefone}` };

  let jwt = await token();
  if (!jwt) return { ok: false, detalhe: "CALLFACE_API_EMAIL/CALLFACE_API_PASSWORD não configurados ou login recusado" };

  const nomeCampanha = `OnFace ${celula(ctx.nome).slice(0, 40)} ${new Date().toISOString().slice(0, 16)}`;
  const arquivo = await planilhaDoLead(ctx, telefone);

  const montarForm = () => {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(arquivo)], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }), "lead.xlsx");
    form.append("name", nomeCampanha);
    return form;
  };

  let res = await postar(`/agents/${AGENTE_ID}/upload-campaign`, montarForm(), jwt);
  if (res.status === 401) {
    jwt = (await token(true)) ?? jwt;
    res = await postar(`/agents/${AGENTE_ID}/upload-campaign`, montarForm(), jwt);
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return { ok: false, detalhe: `campanha não criada (${res.status}): ${txt.slice(0, 200)}` };
  }

  const inicio = await postar(`/agents/${AGENTE_ID}/start-campaign`, "{}", jwt);
  if (!inicio.ok) {
    const txt = await inicio.text().catch(() => "");
    // A campanha existe e fica pendente: dá para iniciar pela tela sem refazer.
    return { ok: false, detalhe: `campanha criada mas não iniciou (${inicio.status}): ${txt.slice(0, 200)}`, campanha: nomeCampanha };
  }
  return { ok: true, detalhe: "agente de voz acionado", campanha: nomeCampanha };
}

/** Contexto que o agente recebe, lido do registro que disparou a automação. */
export async function contextoDaEntidade(
  entityType: string,
  entityId: string,
  organizacaoId: string,
): Promise<ContextoDaLigacao | null> {
  // `leads.empresa` é o campo de texto legado; quando a empresa já está
  // vinculada, o nome dela é o que vale.
  const colunas = {
    nome: leads.nome, telefone: leads.telefone, email: leads.email,
    empresa: sql<string | null>`COALESCE(${empresas.nome}, ${leads.empresa})`,
    origem: leads.origem,
  };
  let row:
    | { nome: string | null; telefone: string | null; email: string | null; empresa: string | null; origem: string | null }
    | undefined;

  if (entityType === "lead") {
    [row] = await db.select(colunas).from(leads)
      .leftJoin(empresas, eq(empresas.id, leads.empresaId))
      .where(and(eq(leads.id, entityId), eq(leads.organizacaoId, organizacaoId))).limit(1);
  } else if (entityType === "negocio" || entityType === "oportunidade") {
    [row] = await db.select(colunas).from(negocios)
      .innerJoin(leads, eq(leads.id, negocios.leadId))
      .leftJoin(empresas, eq(empresas.id, leads.empresaId))
      .where(and(eq(negocios.id, entityId), eq(negocios.organizacaoId, organizacaoId))).limit(1);
  }
  if (!row || !row.telefone) return null;
  return {
    nome: row.nome || "Contato",
    telefone: row.telefone,
    email: row.email,
    empresa: row.empresa,
    origem: row.origem,
  };
}

/**
 * Busca o que o webhook não manda: os campos coletados, a qualificação e os
 * próximos passos da ligação. Devolve o `insights` cru (quem interpreta é
 * `callface-insights`), ou null quando não há conversa analisada.
 */
export async function buscarInsightsDaLigacao(callId: string): Promise<unknown | null> {
  let jwt = await token();
  if (!jwt) return null;
  let res = await fetch(`${BASE}/calls/${encodeURIComponent(callId)}`, { headers: { Authorization: `Bearer ${jwt}` } });
  if (res.status === 401) {
    jwt = (await token(true)) ?? jwt;
    res = await fetch(`${BASE}/calls/${encodeURIComponent(callId)}`, { headers: { Authorization: `Bearer ${jwt}` } });
  }
  if (!res.ok) return null;
  const corpo = (await res.json().catch(() => null)) as { Transcriptions?: { insights?: unknown }[] } | null;
  const t = corpo?.Transcriptions;
  if (!Array.isArray(t)) return null;
  return t.find((x) => x?.insights)?.insights ?? null;
}
