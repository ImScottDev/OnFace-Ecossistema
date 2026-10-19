import crypto from "crypto";
import { eq, and, or, sql, desc } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import {
  organizacoes,
  leads,
  usuarios,
  ligacoes,
  atividades,
  notificacoes,
  emailContas,
  reunioes,
  tarefas,
  negocios,
  pessoas,
  communications,
  aiAnalysis,
} from "@/lib/db/schema";
import { normalizePhone, phoneLastDigits, formatPhoneDisplay } from "@/lib/whatsapp/phone-utils";
import { pickNextCloserLocked, closerTemConflito } from "@/lib/crm/agenda-closers";
import { converterLeadEmOportunidade } from "@/lib/crm/converter-oportunidade";
import { sincronizarDomainModelDaConversao } from "@/lib/crm/sync-domain-model";
import { getBusyTimes } from "@/lib/email/microsoft";

/**
 * Integração Callface (telefonia/IA) ↔ CRM.
 *
 * SAÍDA (Callface → CRM): `processCallfaceCallEvent` — chamado pelo worker a partir
 * da fila `callface-call-events` (alimentada por /api/webhooks/callface). Persiste a
 * ligação em `ligacoes` (série histórica do deal_closure_percentage), espelha na
 * timeline (`atividades` tipo='ligacao') e notifica quando a IA detectou reunião
 * combinada ("Combinado" no scheduling).
 *
 * ENTRADA (CRM → Callface): `enviarParaDiscagem` — POST no webhook de entrada da
 * Callface; o contato cai na campanha "Funil <organização>" do discador.
 *
 * Config no painel Callface: Configurações → Integração → Webhooks.
 * Secrets: CALLFACE_WEBHOOK_SECRET (header X-Callface-Signature, saída) e
 * CALLFACE_INBOUND_TOKEN (header x-callface-webhook-token, entrada). Nunca logar.
 */

const ORG_SLUG = "scott-studio"; // slug interno da org Callface (mesmo do rd-lead)

export interface CallfaceSchedulingItem {
  category?: string;
  communication_type?: string;
  date?: string;
  status?: string; // ex: "Combinado"
}

export interface CallfaceCallPayload {
  deal_id?: string;
  contact_id?: string;
  call_date?: string; // ISO 8601
  summarization?: string; // markdown
  transcription?: unknown; // array no exemplo do painel
  call_link?: string; // https://app.callface.ai/calls/<call_id>
  call_duration?: number; // segundos
  call_audio_url?: string;
  user_email?: string;
  /** Nome do agente de IA que discou — é ele que identifica de quem é a campanha. */
  agent_name?: string;
  user_name?: string;
  destination_number?: string;
  credentials?: unknown[];
  call_status?: string; // ex: FINISHED
  deal_closure_percentage?: number; // 0-100
  scheduling?: { has_scheduling?: boolean; items?: CallfaceSchedulingItem[] };
  [k: string]: unknown;
}

/** Extrai o call_id do call_link (https://app.callface.ai/calls/<call_id>). */
export function extractCallfaceCallId(callLink: string | undefined | null): string | null {
  if (!callLink) return null;
  const m = String(callLink).match(/\/calls\/([^/?#]+)/);
  return m ? m[1] : null;
}

/** Chave de idempotência: call_id quando existir; senão hash estável do evento. */
export function callfaceIdempotencyKey(p: CallfaceCallPayload): string {
  const callId = extractCallfaceCallId(p.call_link);
  if (callId) return `cf_${callId}`;
  const base = `${p.destination_number || ""}|${p.call_date || ""}|${p.user_email || ""}|${p.call_duration ?? ""}`;
  return `cfh_${crypto.createHash("sha256").update(base).digest("hex")}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = PostgresJsDatabase<any>;

async function getOrgId(db: Db): Promise<string | null> {
  const [org] = await db
    .select({ id: organizacoes.id })
    .from(organizacoes)
    .where(eq(organizacoes.slug, ORG_SLUG))
    .limit(1);
  return org?.id ?? null;
}

/**
 * Casa o número discado com um lead da org: comparação pelos ÚLTIMOS 9 DÍGITOS
 * (DDD + número), normalizando os DOIS lados por dígitos — telefone no banco pode
 * estar formatado ("(19) 98818-6207"). Preferência: lead atualizado mais recente.
 */
async function matchLeadByPhone(db: Db, orgId: string, destinationNumber: string) {
  const last9 = phoneLastDigits(normalizePhone(destinationNumber));
  if (!last9 || last9.length < 8) return null;
  const pattern = `%${last9}`;
  const [lead] = await db
    .select({
      id: leads.id,
      nome: leads.nome,
      empresa: leads.empresa,
      email: leads.email,
      tipo: leads.tipo,
      responsavelId: leads.responsavelId,
      negocioAtivoId: leads.negocioAtivoId,
      agendaCloserId: leads.agendaCloserId,
    })
    .from(leads)
    .where(
      and(
        eq(leads.organizacaoId, orgId),
        sql`(regexp_replace(coalesce(${leads.telefone}, ''), '\\D', '', 'g') LIKE ${pattern}
          OR regexp_replace(coalesce(${leads.whatsapp}, ''), '\\D', '', 'g') LIKE ${pattern})`,
      ),
    )
    .orderBy(desc(leads.updatedAt))
    .limit(1);
  return lead ?? null;
}

async function getAdminIds(db: Db): Promise<string[]> {
  const admins = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(and(eq(usuarios.role, "admin"), eq(usuarios.ativo, true)));
  return admins.map((a) => a.id);
}

function mapComunicacaoParaTipoReuniao(communicationType: string | undefined): "call" | "presencial" | "video" {
  const t = String(communicationType || "").toLowerCase();
  if (t.includes("presencial")) return "presencial";
  if (t.includes("video") || t.includes("meet") || t.includes("online")) return "video";
  return "call";
}

interface AutoAgendarResultado {
  /** true só quando um negócio/reunião NOVO foi criado agora nesta chamada */
  criado: boolean;
  jaExistia?: boolean;
  negocioId?: string;
  closerId?: string | null;
  closerNome?: string | null;
  outlookCriado?: boolean;
  motivoFalha?: string;
}

/**
 * Quando a IA confirma reunião combinada ("Combinado"), tenta qualificar o
 * lead e agendar DE VERDADE com o próximo closer da fila — mesmo caminho que
 * o fluxo manual usa (converterLeadEmOportunidade + round-robin + evento real
 * no Outlook, ver api-server/routes/leads.ts POST /converter-oportunidade).
 * Só roda pra lead.tipo === 'lead' (não mexe em cliente/contato existente) e
 * só com data válida e não muito antiga (webhook atrasado é sinal de dado
 * ruim — melhor deixar humano decidir do que criar reunião no passado).
 * Qualquer falha aqui (closer sem Outlook, token expirado, sem closer ativo)
 * NUNCA quebra o processamento do evento — o caller cai pro aviso manual.
 */
async function tentarAutoAgendar(
  db: Db,
  orgId: string,
  lead: { id: string; nome: string; empresa: string | null; email: string | null; tipo: string; agendaCloserId?: string | null; responsavelId?: string | null },
  combinado: CallfaceSchedulingItem,
  contexto: { quemLigou: string; numeroFmt: string; resumo?: string | null; donoDaCampanha?: string | null },
): Promise<AutoAgendarResultado> {
  if (lead.tipo !== "lead") {
    return { criado: false, motivoFalha: `lead.tipo='${lead.tipo}' não é pré-vendas, não auto-agenda` };
  }
  if (!combinado.date) {
    return { criado: false, motivoFalha: "scheduling sem data" };
  }
  const dataReuniao = new Date(combinado.date);
  if (Number.isNaN(dataReuniao.getTime())) {
    return { criado: false, motivoFalha: `data inválida: ${combinado.date}` };
  }
  const HORAS_24_MS = 24 * 60 * 60 * 1000;
  if (dataReuniao.getTime() < Date.now() - HORAS_24_MS) {
    return { criado: false, motivoFalha: `data muito antiga (${combinado.date}) — webhook atrasado ou dado suspeito` };
  }
  const fimReuniao = new Date(dataReuniao.getTime() + 30 * 60000);

  // Pick do closer + checagem de conflito real (CRM e Outlook) + o insert que
  // reserva a vaga, tudo dentro do MESMO lock — sem isso, dois auto-
  // agendamentos concorrentes podiam escolher o mesmo closer antes de
  // qualquer um confirmar se o horário bate com a agenda de verdade. A IA
  // "confirmou" esse horário só falando com o lead por telefone, sem
  // visibilidade nenhuma da agenda real — nunca criar reunião em cima de
  // outra só porque a ligação terminou com "combinado".
  const locked = await pickNextCloserLocked(db, orgId, async (tx, closer) => {
    if (closer) {
      const conflitoCrm = await closerTemConflito(tx, closer.id, dataReuniao, fimReuniao);
      if (conflitoCrm) {
        return {
          skip: true as const,
          motivoFalha: `${closer.nome} já tem compromisso nesse horário (conflito real no CRM) — a IA confirmou um horário que não bate com a agenda de verdade`,
        };
      }
      // Outlook é best-effort: sem conta conectada ou Graph fora do ar, segue só com o check do CRM.
      try {
        const [conta] = await tx
          .select({ id: emailContas.id })
          .from(emailContas)
          .where(and(eq(emailContas.usuarioId, closer.id), eq(emailContas.tipo, "microsoft"), eq(emailContas.syncStatus, "active")))
          .limit(1);
        if (conta) {
          const busy = await getBusyTimes(conta.id, dataReuniao.toISOString(), fimReuniao.toISOString());
          const conflitoOutlook = busy.some((b) => dataReuniao < b.fim && fimReuniao > b.inicio);
          if (conflitoOutlook) {
            return {
              skip: true as const,
              motivoFalha: `${closer.nome} tem compromisso no Outlook nesse horário — a IA confirmou um horário que não bate com a agenda de verdade`,
            };
          }
        }
      } catch (e) {
        console.error("[Callface] auto-agendamento: falha ao checar Outlook (seguindo só com o check do CRM):", e);
      }
    }

    const result = await converterLeadEmOportunidade(tx, {
      organizacaoId: orgId,
      leadId: lead.id,
      // ator é a automação, mas o status_change precisa ficar atribuído à SDR
      // dona do lead — senão getRealizadoMeta('reunioes_agendadas') nunca credita
      // a meta dela (exige statusChanges.usuarioId = leads.responsavelId = usuarioId).
      usuarioId: lead.responsavelId ?? null,
      closerId: closer?.id ?? null,
      titulo: `${lead.empresa || lead.nome} - via Callface`,
      reuniao: {
        data: dataReuniao,
        tipo: mapComunicacaoParaTipoReuniao(combinado.communication_type),
        duracao: 30,
        titulo: `Reunião — ${lead.empresa || lead.nome} x Callface`,
        notas: `Agendada automaticamente: IA detectou confirmação de reunião na ligação de ${contexto.quemLigou} com ${contexto.numeroFmt}.`,
      },
    });
    return { skip: false as const, result, closerNome: closer?.nome ?? null };
    /* Quem já é dono do lead fica com a reunião. O rodízio existe para repartir
       o que NÃO tem dono; quando a closer exporta a carteira dela e manda o
       agente ligar, devolver o resultado para outra pessoa é tirar dela o
       trabalho que ela fez — e foi o que aconteceu com todo lead órfão
       (relatado em 15/10/2026).

       Ordem: closer já oferecido a este lead > responsável do lead > rodízio.
       `pickNextCloserLocked` ignora o fixado que não for closer ativo, então um
       responsável de outro papel cai no rodízio sozinho, sem exceção aqui. */
  }, lead.agendaCloserId ?? contexto.donoDaCampanha ?? lead.responsavelId ?? null);

  if (locked.skip) {
    return { criado: false, motivoFalha: locked.motivoFalha };
  }
  const { result, closerNome } = locked;

  if ("error" in result) {
    return { criado: false, motivoFalha: `converterLeadEmOportunidade falhou: ${result.error}` };
  }

  /* A transação do rodízio acabou de fechar. O dual-write que roda DENTRO da
     conversão lê pelo db global e, ali, o negócio ainda não existia para ele —
     saía calado e a oportunidade canônica (a tabela que o Pipeline lê) nunca
     nascia: o lead sumia de Pré-vendas pelo handoff e não aparecia no Pipeline.
     Aqui o negócio já está commitado. Idempotente, inclusive para o negócio que
     já existia: repara o que ficou para trás quando uma nova ligação chega. */
  if (result.negocioId) {
    await sincronizarDomainModelDaConversao({ leadId: lead.id, negocioId: result.negocioId })
      .catch((e) => console.error("[Callface] dual-write pós-commit falhou (best-effort):", e));
  }
  if (result.recovered || result.alreadyConverted) {
    return { criado: false, jaExistia: true, negocioId: result.negocioId, motivoFalha: "negócio já existia pra esse lead (idempotente)" };
  }

  let outlookCriado = false;
  if (result.reuniaoId && result.closerId) {
    try {
      // Porta única de calendário: o lead entra como participante e o convite sai pelo provedor do closer.
      if (lead.email) {
        await db.execute(sql`UPDATE reunioes SET participantes = ARRAY[${lead.email}]::text[] WHERE id = ${result.reuniaoId}::uuid AND coalesce(cardinality(participantes), 0) = 0`);
      }
      const { criarNaAgenda } = await import("@/lib/calendario/sincronizar");
      const sync = await criarNaAgenda(orgId, result.reuniaoId);
      outlookCriado = sync.sincronizado;
      if (!sync.sincronizado) console.warn(`[Callface] auto-agendamento: evento não entrou na agenda: ${sync.aviso}`);
    } catch (e) {
      console.error("[Callface] auto-agendamento: falha ao criar evento na agenda:", e);
    }
  }

  return { criado: true, negocioId: result.negocioId, closerId: result.closerId, closerNome, outlookCriado };
}

function labelStatus(status: string | undefined): string {
  const map: Record<string, string> = {
    FINISHED: "finalizada",
    ANSWERED: "atendida",
    MISSED: "perdida",
    NOT_ANSWERED: "não atendida",
    NOT_COMPLETED: "não completada",
  };
  return map[String(status || "").toUpperCase()] || String(status || "finalizada").toLowerCase();
}

/** A chamada completou? Só então existe trabalho concluído para fechar tarefa.
 *  Perdida e não atendida deixam a tarefa de pé: ninguém falou com ninguém. */
function ehAtendida(status: string | undefined): boolean {
  return ["FINISHED", "ANSWERED"].includes(String(status || "").toUpperCase());
}

/**
 * Processa UM evento de ligação finalizada. Idempotente: o retry da Callface (ou da
 * fila) com o mesmo call_id não duplica nada — o insert em `ligacoes` tem
 * onConflictDoNothing na chave de idempotência e TODOS os efeitos colaterais
 * (atividade, notificação) só rodam quando o insert de fato aconteceu.
 */
export async function processCallfaceCallEvent(db: Db, payload: CallfaceCallPayload): Promise<string> {
  const orgId = await getOrgId(db);
  if (!orgId) throw new Error(`organização '${ORG_SLUG}' não encontrada`);

  const idempotencyKey = callfaceIdempotencyKey(payload);
  const callId = extractCallfaceCallId(payload.call_link);

  // Vendedor que ligou (match por e-mail).
  let usuarioId: string | null = null;
  if (payload.user_email) {
    const [u] = await db
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(eq(usuarios.email, String(payload.user_email).toLowerCase().trim()))
      .limit(1);
    usuarioId = u?.id ?? null;
  }

  /* Ligação do AGENTE vem sem `user_email`: quem discou foi o robô. Mas o
     payload traz `agent_name` ("Agente Mayra"), e é ele que diz de quem é a
     campanha. Sem ler isso, o resultado do que a closer mandou ligar voltava
     repartido no rodízio — 432 ligações em 7 dias sem dono, 226 delas de um
     agente com nome de gente (15/10/2026). */
  const agentName = typeof payload.agent_name === "string" ? payload.agent_name : null;
  if (!usuarioId && agentName) {
    const { donoDoAgente } = await import("./dono-da-ligacao");
    const equipe = await db
      .select({ id: usuarios.id, nome: usuarios.nome })
      .from(usuarios)
      .where(and(eq(usuarios.organizacaoId, orgId), eq(usuarios.ativo, true)));
    usuarioId = donoDoAgente(agentName, equipe);
  }

  // Lead pelo número discado (órfã fica com leadId null — nunca descartar evento).
  const lead = payload.destination_number
    ? await matchLeadByPhone(db, orgId, String(payload.destination_number))
    : null;

  const callDate = payload.call_date ? new Date(payload.call_date) : null;
  const closure =
    typeof payload.deal_closure_percentage === "number" && Number.isFinite(payload.deal_closure_percentage)
      ? Math.max(0, Math.min(100, Math.round(payload.deal_closure_percentage)))
      : null;

  const [inserted] = await db
    .insert(ligacoes)
    .values({
      organizacaoId: orgId,
      leadId: lead?.id ?? null,
      negocioId: lead?.negocioAtivoId ?? null,
      usuarioId,
      idempotencyKey,
      callfaceCallId: callId,
      callfaceContactId: payload.contact_id ? String(payload.contact_id) : null,
      callfaceDealId: payload.deal_id ? String(payload.deal_id) : null,
      userEmail: payload.user_email ? String(payload.user_email) : null,
      userName: payload.user_name ? String(payload.user_name) : null,
      destinationNumber: payload.destination_number ? String(payload.destination_number) : null,
      callDate: callDate && !Number.isNaN(callDate.getTime()) ? callDate : null,
      duracaoSegundos: typeof payload.call_duration === "number" ? Math.round(payload.call_duration) : null,
      callStatus: payload.call_status ? String(payload.call_status) : null,
      resumo: payload.summarization ? String(payload.summarization) : null,
      transcricao: payload.transcription ?? null,
      callLink: payload.call_link ? String(payload.call_link) : null,
      audioUrl: payload.call_audio_url ? String(payload.call_audio_url) : null,
      closurePercentage: closure,
      scheduling: payload.scheduling ?? null,
      payloadRaw: payload,
    })
    .onConflictDoNothing({ target: ligacoes.idempotencyKey })
    .returning({ id: ligacoes.id });

  if (!inserted) return `duplicada (${idempotencyKey}), ignorando`;

  // F2/dual-write (Communication Intelligence): mesma idempotência real que
  // já existe pra `ligacoes`, aplicada em `communications` — best-effort,
  // nunca bloqueia o processamento real do evento de ligação.
  try {
    let pessoaId: string | null = null;
    if (lead) {
      const [pessoa] = await db.select({ id: pessoas.id }).from(pessoas).where(eq(pessoas.leadIdLegado, lead.id)).limit(1);
      pessoaId = pessoa?.id ?? null;
    }
    const [comm] = await db
      .insert(communications)
      .values({
        organizacaoId: orgId,
        pessoaId,
        canal: "ligacao",
        conteudo: payload.summarization ? String(payload.summarization) : null,
        duracaoSegundos: typeof payload.call_duration === "number" ? Math.round(payload.call_duration) : null,
        status: payload.call_status ? String(payload.call_status) : null,
        externalId: idempotencyKey,
        usuarioId,
        ocorridoEm: callDate && !Number.isNaN(callDate.getTime()) ? callDate : new Date(),
        origemLegadoId: inserted.id,
        raw: payload,
      })
      .onConflictDoNothing({ target: [communications.canal, communications.externalId] })
      .returning({ id: communications.id });

    if (comm && (payload.summarization || payload.transcription)) {
      await db.insert(aiAnalysis).values({
        organizacaoId: orgId,
        entityType: "communication",
        entityId: comm.id,
        resumo: payload.summarization ? String(payload.summarization) : null,
        raw: { transcricao: payload.transcription ?? null, closurePercentage: closure },
      });
    }
  } catch (err) {
    console.error("[F2/dual-write] falha ao sincronizar communications da ligação (best-effort):", err);
  }

  // SLA: ligação feita para um lead de Pré-vendas ainda não contatado é o
  // primeiro contato (porta única: registra FirstContactMade com a data da ligação).
  if (lead) {
    const { registrarContatoSaindo } = await import("@/lib/vendas/pre-vendas");
    await registrarContatoSaindo({
      organizacaoId: orgId, leadId: lead.id, canal: "ligacao",
      ator: { tipo: "HUMAN", usuarioId, ref: null },
      ocorridoEm: callDate && !Number.isNaN(callDate.getTime()) ? callDate : undefined,
    });
  }

  const numeroFmt = payload.destination_number ? formatPhoneDisplay(String(payload.destination_number)) : "número desconhecido";
  const quemLigou = payload.user_name || payload.user_email || "vendedor";

  if (lead) {
    // Espelho na timeline: a LeadTimeline já renderiza tipo='ligacao' com ícone.
    const duracao = typeof payload.call_duration === "number" ? payload.call_duration : null;
    const durFmt = duracao != null ? `${Math.floor(duracao / 60)}m${String(duracao % 60).padStart(2, "0")}s` : null;
    await db.insert(atividades).values({
      organizacaoId: orgId,
      leadId: lead.id,
      negocioId: lead.negocioAtivoId ?? null,
      usuarioId,
      tipo: "ligacao",
      titulo: `Ligação ${labelStatus(payload.call_status)} — ${quemLigou}${durFmt ? ` (${durFmt})` : ""}`,
      descricao: payload.summarization ? String(payload.summarization) : null,
      dados: {
        origem: "callface",
        ligacaoId: inserted.id,
        callLink: payload.call_link ?? null,
        audioUrl: payload.call_audio_url ?? null,
        closurePercentage: closure,
      },
      duracaoSegundos: typeof payload.call_duration === "number" ? Math.round(payload.call_duration) : null,
    });

    /* A tarefa de LIGAR que motivou a chamada se fecha sozinha.
     *
     * Antes não fechava: quem ligava pela tarefa via a ligação entrar na
     * timeline e a tarefa continuar aberta e atrasada, cobrando um trabalho
     * que já tinha sido feito. Fechar à mão também não dava, porque a lista
     * não tinha o botão (corrigido no mesmo commit).
     *
     * Fecha só o que é inequívoco: tarefa de ligação ABERTA do mesmo lead (ou
     * do negócio dele). Tarefa de outro tipo não se presume feita por uma
     * ligação, e tarefa já concluída não se reescreve. Se a chamada não foi
     * atendida, não há trabalho concluído — a tarefa fica de pé.
     */
    if (ehAtendida(payload.call_status)) {
      await db.update(tarefas)
        .set({ concluida: true, concluidaEm: new Date() })
        .where(and(
          eq(tarefas.organizacaoId, orgId),
          eq(tarefas.concluida, false),
          sql`lower(coalesce(${tarefas.tipo}, '')) IN ('ligacao', 'ligação', 'call')`,
          lead.negocioAtivoId
            ? or(eq(tarefas.leadId, lead.id), eq(tarefas.negocioId, lead.negocioAtivoId))
            : eq(tarefas.leadId, lead.id),
        ))
        .catch((e) => console.error("[Callface] falha ao concluir a tarefa de ligação:", e));
    }

    // Ligação é atividade real: reseta o relógio do badge de tempo no board de pré-vendas
    // e, se o lead tiver negócio ativo, no Pipeline também (mesmo negócio já usado acima em `negocioId`).
    await db.update(leads).set({ updatedAt: new Date() })
      .where(and(eq(leads.id, lead.id), eq(leads.organizacaoId, orgId)));
    if (lead.negocioAtivoId) {
      await db.update(negocios).set({ updatedAt: new Date() })
        .where(and(eq(negocios.id, lead.negocioAtivoId), eq(negocios.organizacaoId, orgId)));
    }

    // Reunião combinada detectada pela IA: tenta qualificar + agendar DE VERDADE
    // com o próximo closer (auto-agendamento). Se não der (lead não é
    // pré-vendas, data ruim, sem closer disponível), cai pro aviso manual de
    // sempre — nunca fica silencioso.
    const items = payload.scheduling?.items || [];
    const combinado = items.find((i) => String(i?.status || "").toLowerCase() === "combinado");
    let agendamentoInfo = "";
    if (payload.scheduling?.has_scheduling && combinado) {
      const quem = lead.empresa || lead.nome;
      const quando = combinado.date ? ` para ${combinado.date}` : "";

      const auto = await tentarAutoAgendar(db, orgId, lead, combinado, {
        quemLigou,
        numeroFmt,
        resumo: payload.summarization,
        /* Quem discou — a pessoa, ou a dona do agente que discou por ela.
           É o que impede o rodízio de entregar a outra closer a reunião que
           saiu da campanha desta. */
        donoDaCampanha: usuarioId,
      }).catch((e): AutoAgendarResultado => {
        console.error("[Callface] auto-agendamento explodiu, caindo pro aviso manual:", e);
        return { criado: false, motivoFalha: String(e) };
      });

      if (auto.criado) {
        const destinatarios = lead.responsavelId ? [lead.responsavelId] : await getAdminIds(db);
        const closerTxt = auto.closerNome
          ? `com ${auto.closerNome}`
          : "SEM closer disponível na fila — atribua manualmente";
        for (const uid of destinatarios) {
          await db
            .insert(notificacoes)
            .values({
              usuarioId: uid,
              tipo: "callface_reuniao_agendada",
              titulo: `Reunião AGENDADA automaticamente — ${quem}`,
              mensagem:
                `A IA da Callface confirmou reunião${quando} na ligação de ${quemLigou} com ${quem} (${numeroFmt}). ` +
                `Agendado automaticamente ${closerTxt}` +
                (auto.outlookCriado ? ", convite enviado por e-mail (Outlook)." : " (sem convite Outlook — confirme manualmente)."),
              link: auto.negocioId ? `/negocios/${auto.negocioId}` : `/leads/${lead.id}`,
            })
            .catch((e) => console.error("[Callface] falha ao notificar auto-agendamento:", e));
        }

        // Sem convite Outlook (closer sem conta conectada, ou criação falhou):
        // não pode ficar só numa frase dentro da notificação, que some da tela
        // assim que lida. Cria uma TAREFA em destaque (prioridade "urgente" já
        // renderiza badge vermelho no LeadDrawer/ContatoInfoSidebar) pro closer
        // resolver manualmente — nunca fica silencioso (pedido Kauã, 23/07).
        if (!auto.outlookCriado) {
          await db
            .insert(tarefas)
            .values({
              organizacaoId: orgId,
              leadId: lead.id,
              negocioId: auto.negocioId || null,
              usuarioId: auto.closerId || lead.responsavelId || null,
              titulo: `Confirmar reunião no Outlook — ${quem}`,
              descricao:
                `Reunião${quando} agendada automaticamente pela IA da Callface, mas sem evento real no Outlook ` +
                `(closer sem conta conectada, ou falha ao criar o evento). Confirme manualmente ou conecte o Outlook em Configurações → Perfil → E-mail.`,
              tipo: "confirmar_reuniao_outlook",
              prioridade: "urgente",
              dataVencimento: (() => {
                const d = combinado.date ? new Date(combinado.date) : null;
                return d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
              })(),
            })
            .catch((e) => console.error("[Callface] falha ao criar tarefa de confirmação Outlook:", e));
        }

        agendamentoInfo = " (reunião AUTO-agendada)";
      } else if (auto.jaExistia) {
        // Retry do webhook ou lead que já tinha negócio ativo — nada de novo, sem spam de notificação.
        agendamentoInfo = " (negócio já existia pra esse lead, sem nova ação)";
      } else {
        const destinatarios = lead.responsavelId ? [lead.responsavelId] : await getAdminIds(db);
        for (const uid of destinatarios) {
          await db
            .insert(notificacoes)
            .values({
              usuarioId: uid,
              tipo: "callface_reuniao_detectada",
              titulo: `IA detectou reunião combinada — ${quem}`,
              mensagem:
                `Na ligação de ${quemLigou} com ${quem} (${numeroFmt}), a IA da Callface detectou reunião combinada${quando} ` +
                `(${combinado.category || "agendamento"}). Confirme e formalize o agendamento no CRM pra reunião entrar na agenda real.`,
              link: `/leads/${lead.id}`,
            })
            .catch((e) => console.error("[Callface] falha ao notificar reunião detectada:", e));
        }
        agendamentoInfo = ` (reunião detectada, sem auto-agendamento: ${auto.motivoFalha || "motivo desconhecido"})`;
      }
    }
    return `ligação ${idempotencyKey} registrada no lead ${lead.id}${agendamentoInfo}`;
  }

  // Órfã: sempre registrada em `ligacoes`. Notificação só quando a ligação teve
  // substância (atendida/duração razoável) — o time disca dezenas de números que
  // não existem no CRM (campanhas do discador) e FAILED/curtíssima em cada uma
  // viraria spam de notificação pros admins.
  const duracaoSeg = typeof payload.call_duration === "number" ? payload.call_duration : 0;
  const statusUp = String(payload.call_status || "").toUpperCase();
  const semSubstancia = ["FAILED", "NOT_COMPLETED", "BUSY", "MISSED", "NOT_ANSWERED"].includes(statusUp) || duracaoSeg < 15;
  if (semSubstancia) {
    return `ligação ${idempotencyKey} sem lead correspondente (órfã registrada, sem notificação — ${statusUp || "sem status"}/${duracaoSeg}s)`;
  }
  const admins = await getAdminIds(db);
  for (const uid of admins) {
    await db
      .insert(notificacoes)
      .values({
        usuarioId: uid,
        tipo: "callface_ligacao_sem_lead",
        titulo: `Ligação sem lead no CRM — ${numeroFmt}`,
        mensagem:
          `${quemLigou} ligou para ${numeroFmt} (${labelStatus(payload.call_status)}), mas nenhum lead tem esse telefone. ` +
          `A ligação foi guardada e pode ser vinculada depois.${payload.call_link ? ` Detalhes: ${payload.call_link}` : ""}`,
        link: `/leads`,
      })
      .catch((e) => console.error("[Callface] falha ao notificar ligação órfã:", e));
  }
  return `ligação ${idempotencyKey} sem lead correspondente (órfã registrada)`;
}

// ─── ENTRADA: CRM → fila de discagem da Callface ─────────────────────────────

const CALLFACE_CREATE_CONTACT_URL =
  process.env.CALLFACE_CREATE_CONTACT_URL || "https://api.callface.io/webhooks/events/create-contact";

/**
 * Empurra um contato pra fila de discagem da Callface (campanha "Funil <org>").
 * Payload aceito pela Callface: apenas {name, phone}. Fail-closed sem token.
 */
export async function enviarParaDiscagem(input: { nome: string; telefone: string }): Promise<{ ok: boolean; detalhe: string }> {
  const token = process.env.CALLFACE_INBOUND_TOKEN;
  if (!token) return { ok: false, detalhe: "CALLFACE_INBOUND_TOKEN não configurado" };
  const phone = normalizePhone(input.telefone);
  if (!phone || phone.length < 10) return { ok: false, detalhe: `telefone inválido: ${input.telefone}` };

  const res = await fetch(CALLFACE_CREATE_CONTACT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-callface-webhook-token": token,
    },
    body: JSON.stringify({ name: input.nome, phone: `+${phone}` }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // Nunca logar o token; o corpo de erro da Callface é seguro.
    return { ok: false, detalhe: `Callface respondeu ${res.status}: ${body.slice(0, 300)}` };
  }
  return { ok: true, detalhe: "contato enviado pra fila de discagem" };
}
