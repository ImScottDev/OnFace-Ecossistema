/**
 * A volta Outlook -> ONFACE (Módulo 09).
 *
 * Duas portas levam o mesmo evento até `refletirEvento`:
 *   - change notification do Graph (rota /api/webhooks/microsoft-calendar),
 *   - delta query periódica (job do worker, rede de segurança).
 * Por isso `refletirEvento` é idempotente: reaplicar o mesmo estado não grava nada.
 *
 * Não há eco: a volta grava só no banco e nunca chama o provedor, então uma
 * mudança vinda do Outlook não volta ao Outlook.
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/app-url";
import { registrarEvento } from "@/lib/vendas/eventos";
import { ATOR_SISTEMA } from "@/lib/vendas/dominio";
import {
  criarAssinatura, renovarAssinatura, deltaCalendario, lerEvento, instanteUTC, type EventoGraph,
} from "./graph-calendario";

export interface ContaVolta { id: string; usuarioId: string; organizacaoId: string; email: string }
export type ResultadoReflexo = "sem_reuniao" | "ignorada" | "igual" | "atualizada" | "cancelada";

interface ReuniaoLinha extends Record<string, unknown> {
  id: string; organizacao_id: string; negocio_id: string | null; lead_id: string | null;
  titulo: string; data: Date; duracao: number | null; link: string | null; status: string;
  participantes: string[] | null; respostas: Record<string, string> | null;
  pendente_no_onface: boolean;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_HTTP = /^https?:\/\//i;

/** Reunião do ONFACE que mora neste evento, na agenda DESTE usuário e desta organização. */
export async function reuniaoDoEvento(conta: ContaVolta, eventId: string): Promise<ReuniaoLinha | null> {
  const [r] = await db.execute<ReuniaoLinha>(sql`
    SELECT id::text, organizacao_id::text, negocio_id::text, lead_id::text, titulo, data, duracao, link, status,
           to_jsonb(participantes) AS participantes, participantes_respostas AS respostas,
           -- alteração feita no ONFACE ainda não enviada ao Outlook: a volta não pode desfazê-la com o estado antigo de lá
           COALESCE(calendar_sync_status = 'falhou'
             OR (updated_at > calendar_sync_em + interval '2 seconds' AND updated_at > now() - interval '2 minutes'), false) AS pendente_no_onface
      FROM reunioes
     WHERE organizacao_id = ${conta.organizacaoId}::uuid
       AND responsavel_id = ${conta.usuarioId}::uuid
       AND (calendar_event_id = ${eventId} OR outlook_event_id = ${eventId})
     LIMIT 1`);
  return r ?? null;
}

const rotulo = (d: Date) => d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

const mesmoMapa = (a: Record<string, string>, b: Record<string, string>) =>
  Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([k, v]) => b[k] === v);

export async function refletirEvento(conta: ContaVolta, eventId: string, ev: EventoGraph | null): Promise<ResultadoReflexo> {
  const r = await reuniaoDoEvento(conta, eventId);
  if (!r) return "sem_reuniao";
  if (r.status !== "agendada" || r.pendente_no_onface) return "ignorada";

  // Apagado (404/@removed) ou cancelado pelo organizador.
  if (!ev || ev["@removed"] || ev.isCancelled) {
    const [c] = await db.execute<{ id: string }>(sql`
      UPDATE reunioes SET status = 'cancelada', calendar_sync_status = 'ok', calendar_sync_erro = NULL, calendar_sync_em = now(), updated_at = now()
       WHERE id = ${r.id}::uuid AND status = 'agendada' RETURNING id::text`);
    if (!c) return "ignorada";
    if (r.negocio_id || r.lead_id) await registrarEvento({
      organizacaoId: r.organizacao_id, tipo: "MeetingCancelled", ator: { ...ATOR_SISTEMA, ref: "outlook" },
      negocioId: r.negocio_id, leadId: r.lead_id, reuniaoId: r.id,
      contexto: { data: new Date(r.data).toISOString(), origem: "outlook" },
      timeline: { tipo: "reuniao", titulo: "Reunião cancelada no Outlook", descricao: rotulo(new Date(r.data)) },
    }).catch((e) => console.error(`[calendario] evento MeetingCancelled da reunião ${r.id} não gravado:`, e));
    return "cancelada";
  }

  let titulo: string | null = null, data: Date | null = null, duracao: number | null = null, link: string | null = null;
  let participantes: string[] | null = null, respostas: Record<string, string> | null = null;

  if (ev.subject && ev.subject !== r.titulo) titulo = ev.subject;

  if (ev.start?.dateTime && ev.end?.dateTime) {
    const ini = instanteUTC(ev.start.dateTime);
    const dur = Math.round((instanteUTC(ev.end.dateTime).getTime() - ini.getTime()) / 60_000);
    if (Math.abs(ini.getTime() - new Date(r.data).getTime()) > 60_000) data = ini;
    if (dur > 0 && dur !== r.duracao) duracao = dur;
  }

  const novoLink = ev.onlineMeeting?.joinUrl || (URL_HTTP.test(ev.location?.displayName ?? "") ? ev.location!.displayName! : null);
  if (novoLink && novoLink !== r.link) link = novoLink;

  // Convidados: e-mails do Outlook (sem o dono da agenda); o que não é e-mail (nome livre) fica como estava.
  const dono = conta.email.toLowerCase();
  const doOutlook = (ev.attendees ?? [])
    .map((a) => ({ email: (a.emailAddress?.address ?? "").trim().toLowerCase(), resp: a.status?.response ?? "none" }))
    .filter((a) => EMAIL.test(a.email) && a.email !== dono);
  const emails = [...new Set(doOutlook.map((a) => a.email))];
  const atuais = r.participantes ?? [];
  const emailsAtuais = new Set(atuais.filter((p) => EMAIL.test(p.trim())).map((p) => p.trim().toLowerCase()));
  if (emails.length !== emailsAtuais.size || emails.some((e) => !emailsAtuais.has(e))) {
    participantes = [...atuais.filter((p) => !EMAIL.test(p.trim())), ...emails];
  }
  const mapa: Record<string, string> = Object.fromEntries(doOutlook.map((a) => [a.email, a.resp === "notResponded" ? "none" : a.resp]));
  if (!mesmoMapa(mapa, r.respostas ?? {})) respostas = mapa;

  if (!titulo && !data && duracao == null && !link && !participantes && !respostas) return "igual";

  await db.execute(sql`
    UPDATE reunioes SET
      titulo = COALESCE(${titulo}, titulo),
      data = COALESCE(${data ? data.toISOString() : null}::timestamptz, data),
      duracao = COALESCE(${duracao}::int, duracao),
      link = COALESCE(${link}, link),
      participantes = ${participantes ? sql`ARRAY[${sql.join(participantes.map((e) => sql`${e}`), sql`, `)}]::text[]` : sql`participantes`},
      participantes_respostas = COALESCE(${respostas ? JSON.stringify(respostas) : null}::jsonb, participantes_respostas),
      calendar_sync_status = 'ok', calendar_sync_erro = NULL, calendar_sync_em = now(), updated_at = now()
     WHERE id = ${r.id}::uuid AND status = 'agendada'`);

  if (data && (r.negocio_id || r.lead_id)) {
    await registrarEvento({
      organizacaoId: r.organizacao_id, tipo: "MeetingRescheduled", ator: { ...ATOR_SISTEMA, ref: "outlook" },
      negocioId: r.negocio_id, leadId: r.lead_id, reuniaoId: r.id,
      contexto: { data: data.toISOString(), anterior: new Date(r.data).toISOString(), origem: "outlook" },
      timeline: { tipo: "reuniao", titulo: "Reunião reagendada no Outlook", descricao: rotulo(data) },
    }).catch((e) => console.error(`[calendario] evento MeetingRescheduled da reunião ${r.id} não gravado:`, e));
  }
  return "atualizada";
}

// ─── Change notifications ───────────────────────────────────────────────────

export interface NotificacaoGraph {
  subscriptionId?: string; clientState?: string; changeType?: string;
  resourceData?: { id?: string }; resource?: string;
}

/** Processa o lote de uma chamada do Graph. clientState errado é descartado sem tocar em nada. */
export async function processarNotificacoes(lote: NotificacaoGraph[], clientState: string): Promise<{ processadas: number; descartadas: number }> {
  let processadas = 0, descartadas = 0;
  const vistos = new Set<string>();
  for (const n of lote) {
    const id = n.resourceData?.id ?? n.resource?.split("/").pop();
    if (n.clientState !== clientState || !n.subscriptionId || !id) { descartadas++; continue; }
    const chave = `${n.subscriptionId}:${id}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    const conta = await contaDaAssinatura(n.subscriptionId);
    if (!conta) { descartadas++; continue; }
    try {
      if (!(await reuniaoDoEvento(conta, id))) continue;
      const ev = n.changeType === "deleted" ? null : await lerEvento(conta.id, id);
      await refletirEvento(conta, id, ev);
      processadas++;
    } catch (e) {
      await registrarErroVolta(conta, e);
    }
  }
  return { processadas, descartadas };
}

async function contaDaAssinatura(subscriptionId: string): Promise<ContaVolta | null> {
  const [c] = await db.execute<{ id: string; usuario_id: string; organizacao_id: string; email: string }>(sql`
    SELECT ec.id::text, ec.usuario_id::text, ec.organizacao_id::text, ec.email
      FROM calendario_assinaturas a JOIN email_contas ec ON ec.id = a.conta_id
     WHERE a.subscription_id = ${subscriptionId}`);
  return c ? { id: c.id, usuarioId: c.usuario_id, organizacaoId: c.organizacao_id, email: c.email } : null;
}

// ─── Job: assinatura + delta ────────────────────────────────────────────────

/** Erro visível: no cursor da conta e no card das próximas reuniões dela (calendar_sync_erro), sem mexer no status do push. */
async function registrarErroVolta(conta: ContaVolta, e: unknown) {
  const msg = `volta do Outlook: ${String(e instanceof Error ? e.message : e).slice(0, 250)}`;
  console.error(`[calendario] ${msg} (conta ${conta.id})`);
  await db.execute(sql`UPDATE calendario_assinaturas SET ultimo_erro = ${msg}, updated_at = now() WHERE conta_id = ${conta.id}::uuid`);
  await db.execute(sql`
    UPDATE reunioes SET calendar_sync_erro = ${msg}
     WHERE organizacao_id = ${conta.organizacaoId}::uuid AND responsavel_id = ${conta.usuarioId}::uuid
       AND status = 'agendada' AND data > now() AND calendar_sync_status = 'ok'`);
}

async function limparErroVolta(conta: ContaVolta) {
  await db.execute(sql`
    UPDATE reunioes SET calendar_sync_erro = NULL
     WHERE organizacao_id = ${conta.organizacaoId}::uuid AND responsavel_id = ${conta.usuarioId}::uuid
       AND calendar_sync_erro LIKE 'volta do Outlook:%'`);
}

export async function garantirAssinatura(conta: ContaVolta): Promise<void> {
  const clientState = process.env.MICROSOFT_CALENDAR_CLIENT_STATE;
  if (!clientState) return; // sem segredo a rota recusa (fail-closed); a delta cobre sozinha
  const [a] = await db.execute<{ subscription_id: string | null; expira_em: Date | null }>(sql`
    SELECT subscription_id, expira_em FROM calendario_assinaturas WHERE conta_id = ${conta.id}::uuid`);
  const faltam24h = !a?.expira_em || new Date(a.expira_em).getTime() < Date.now() + 24 * 3_600_000;
  if (a?.subscription_id && !faltam24h) return;

  let nova = a?.subscription_id ? await renovarAssinatura(conta.id, a.subscription_id) : null;
  nova ??= await criarAssinatura(conta.id, `${appUrl()}/api/webhooks/microsoft-calendar`, clientState);
  await db.execute(sql`
    INSERT INTO calendario_assinaturas (conta_id, organizacao_id, subscription_id, expira_em)
    VALUES (${conta.id}::uuid, ${conta.organizacaoId}::uuid, ${nova.id}, ${nova.expiraEm.toISOString()}::timestamptz)
    ON CONFLICT (conta_id) DO UPDATE SET subscription_id = EXCLUDED.subscription_id, expira_em = EXCLUDED.expira_em, updated_at = now()`);
}

export async function rodarDelta(conta: ContaVolta): Promise<{ eventos: number; reunioes: number }> {
  await db.execute(sql`INSERT INTO calendario_assinaturas (conta_id, organizacao_id) VALUES (${conta.id}::uuid, ${conta.organizacaoId}::uuid) ON CONFLICT (conta_id) DO NOTHING`);
  const [est] = await db.execute<{ delta_link: string | null; delta_iniciado_em: Date | null }>(sql`SELECT delta_link, delta_iniciado_em FROM calendario_assinaturas WHERE conta_id = ${conta.id}::uuid`);
  // A janela do delta é fixa no deltaLink; recomeça a cada 14 dias para ela continuar à frente de hoje.
  const velho = !est?.delta_link || !est.delta_iniciado_em || new Date(est.delta_iniciado_em).getTime() < Date.now() - 14 * 86_400_000;
  let reinicio = velho;
  let delta = await deltaCalendario(conta.id, velho ? null : est.delta_link);
  if (delta === "expirado") { reinicio = true; delta = await deltaCalendario(conta.id, null); }
  if (delta === "expirado") throw new Error("delta expirou duas vezes seguidas");

  let reunioes = 0;
  for (const ev of delta.eventos) {
    if (!ev.id || !(await reuniaoDoEvento(conta, ev.id))) continue;
    const res = await refletirEvento(conta, ev.id, ev);
    if (res === "atualizada" || res === "cancelada") reunioes++;
  }
  await db.execute(sql`
    UPDATE calendario_assinaturas SET delta_link = ${delta.deltaLink},
      delta_iniciado_em = ${reinicio ? sql`now()` : sql`delta_iniciado_em`}, ultimo_delta_em = now(), ultimo_erro = NULL, updated_at = now()
     WHERE conta_id = ${conta.id}::uuid`);
  await limparErroVolta(conta);
  return { eventos: delta.eventos.length, reunioes };
}

/** Contas Microsoft ativas que têm reunião viva vinculada a evento. */
async function contasComReuniao(): Promise<ContaVolta[]> {
  const rows = await db.execute<{ id: string; usuario_id: string; organizacao_id: string; email: string }>(sql`
    SELECT ec.id::text, ec.usuario_id::text, ec.organizacao_id::text, ec.email
      FROM email_contas ec
     WHERE ec.tipo = 'microsoft' AND ec.sync_status = 'active'
       AND EXISTS (SELECT 1 FROM reunioes r WHERE r.responsavel_id = ec.usuario_id AND r.status = 'agendada'
                      AND COALESCE(r.calendar_event_id, r.outlook_event_id) IS NOT NULL AND r.data > now() - interval '1 day')`);
  return rows.map((c) => ({ id: c.id, usuarioId: c.usuario_id, organizacaoId: c.organizacao_id, email: c.email }));
}

/** Job do worker (a cada 5 min): renova assinatura e passa a delta. Erro de uma conta não trava as outras. */
export async function sincronizarVoltaMicrosoft(): Promise<{ contas: number; reunioes: number; erros: number }> {
  const contas = await contasComReuniao();
  let reunioes = 0, erros = 0;
  for (const conta of contas) {
    try { await garantirAssinatura(conta); }
    catch (e) { console.warn(`[calendario] assinatura da conta ${conta.id} falhou (a delta cobre):`, String(e).slice(0, 200)); }
    try { reunioes += (await rodarDelta(conta)).reunioes; }
    catch (e) { erros++; await registrarErroVolta(conta, e); }
  }
  return { contas: contas.length, reunioes, erros };
}
