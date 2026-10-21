import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { outreachCampanhas, outreachCampanhaDestinatarios, whatsappSessao } from "@/lib/db/schema";
import { sendText, sessionToConfig } from "@/lib/whatsapp/client";
import { NumeroNoLimite } from "@/lib/whatsapp/marcapasso";
import { sendResendEmail } from "@/lib/email/resend";
import { htmlParaTexto, personalizar, classificarErroEnvio } from "./campanhas-texto";
import { destinosEmOptOut } from "@/lib/ai-platform/operacao/politica-canal";

/**
 * Disparo de campanhas de outreach — consumido pelo worker no job
 * `campanha-sweep` (a cada minuto, fila scheduled-jobs).
 *
 * Ciclo de uma campanha:
 *   rascunho → agendada (ação na tela) → enviando (este sweep reivindica e
 *   materializa os destinatários) → concluida. `pausada` congela o envio.
 *
 * Cada destinatário tem status próprio em `outreach_campanha_destinatarios`:
 *   pendente → enviando → enviado | bloqueado | falhou
 * O "enviando" por linha é a reserva: duas execuções do sweep nunca pegam a
 * mesma linha (FOR UPDATE SKIP LOCKED), e linha presa em "enviando" por queda
 * do worker vira falha explícita em vez de reenvio — mandar duas vezes a mesma
 * mensagem para um lead é pior que admitir que não sabemos se saiu.
 *
 * WhatsApp sai SÓ por `sendText` (lib/whatsapp/client.ts → wuzapiFetch), que é
 * onde mora a WHATSAPP_ALLOWLIST: destino fora dela lança antes de sair da
 * aplicação e aqui vira status "bloqueado". E-mail sai pelo Resend do sistema
 * (remetente da campanha vai como reply-to).
 */

// ponytail: lote fixo por campanha e por ciclo; a vazão real é a do marcapasso.
// Se precisar de mais vazão, ler isso da sessão/organização.
const LOTE = 20;
const PRESO_APOS_MIN = 10;

type Campanha = typeof outreachCampanhas.$inferSelect;
type Destinatario = typeof outreachCampanhaDestinatarios.$inferSelect;

export type ResumoSweep = { iniciadas: number; enviados: number; bloqueados: number; falhas: number; concluidas: number };

function listasDe(audiencia: unknown): string[] {
  const l = (audiencia as { listas?: unknown } | null)?.listas;
  return Array.isArray(l) ? l.filter((x): x is string => typeof x === "string") : [];
}

/** Agendada e vencida → enviando, com a lista de destinatários congelada no momento do disparo. */
async function iniciarDevidas(): Promise<number> {
  let iniciadas = 0;
  for (;;) {
    const iniciada = await db.transaction(async (tx) => {
      const [c] = (await tx.execute(sql`
        SELECT * FROM outreach_campanhas
         WHERE status = 'agendada' AND (agendada_para IS NULL OR agendada_para <= now())
         ORDER BY agendada_para NULLS FIRST
         LIMIT 1 FOR UPDATE SKIP LOCKED
      `)) as unknown as Array<{ id: string; organizacao_id: string; canal: string; audiencia: unknown }>;
      if (!c) return false;
      const listas = listasDe(c.audiencia);
      const destino = c.canal === "whatsapp"
        ? sql`regexp_replace(coalesce(l.telefone, ''), '[^0-9]', '', 'g')`
        : sql`lower(trim(coalesce(l.email, '')))`;
      if (listas.length > 0) {
        // Mesmo critério de contarDestinatarios (lib/automacoes/campanhas.ts):
        // leads da org nas etiquetas escolhidas, com o canal preenchido. O
        // índice único (campanha, destino) tira o telefone repetido.
        await tx.execute(sql`
          INSERT INTO outreach_campanha_destinatarios (organizacao_id, campanha_id, lead_id, nome, destino)
          SELECT DISTINCT ON (${destino}) ${c.organizacao_id}::uuid, ${c.id}::uuid, l.id, l.nome, ${destino}
            FROM labels lb
            JOIN lead_labels ll ON ll.label_id = lb.id
            JOIN leads l ON l.id = ll.lead_id AND l.organizacao_id = lb.organizacao_id
           WHERE lb.organizacao_id = ${c.organizacao_id}::uuid
             AND lb.nome IN (${sql.join(listas.map((x) => sql`${x}`), sql`, `)})
             AND ${destino} <> ''
           ORDER BY ${destino}, l.created_at
          ON CONFLICT (campanha_id, destino) DO NOTHING
        `);
      }
      await tx.execute(sql`
        UPDATE outreach_campanhas
           SET status = 'enviando', iniciada_em = now(), updated_at = now(),
               total_destinatarios = (SELECT count(*) FROM outreach_campanha_destinatarios WHERE campanha_id = ${c.id}::uuid)
         WHERE id = ${c.id}::uuid
      `);
      return true;
    });
    if (!iniciada) return iniciadas;
    iniciadas++;
  }
}

async function reservarLote(campanhaId: string): Promise<Destinatario[]> {
  const rows = (await db.execute(sql`
    UPDATE outreach_campanha_destinatarios SET status = 'enviando', updated_at = now()
     WHERE id IN (
       SELECT id FROM outreach_campanha_destinatarios
        WHERE campanha_id = ${campanhaId}::uuid AND status = 'pendente'
        ORDER BY created_at, id
        LIMIT ${LOTE} FOR UPDATE SKIP LOCKED)
    RETURNING id, nome, destino
  `)) as unknown as Array<{ id: string; nome: string | null; destino: string }>;
  return rows.map((r) => ({ id: r.id, nome: r.nome, destino: r.destino }) as Destinatario);
}

type Vars = { nome?: string | null; empresa?: string | null };
type Envio = (destino: string, vars: Vars) => Promise<{ mensagemId?: string }>;

/** Monta a função de envio da campanha, ou devolve o motivo de não dar para enviar nada. */
async function preparar(c: Campanha): Promise<Envio | { erro: string }> {
  if (c.canal === "whatsapp") {
    const [sessao] = await db.select().from(whatsappSessao)
      .where(and(eq(whatsappSessao.organizacaoId, c.organizacaoId), eq(whatsappSessao.id, String(c.remetente ?? "00000000-0000-0000-0000-000000000000"))))
      .limit(1)
      .catch(() => []);
    if (!sessao) return { erro: "Sessão de WhatsApp da campanha não existe mais." };
    if (sessao.privado) return { erro: "O número da campanha é privado: disparo em massa não sai por número pessoal." };
    const config = sessionToConfig(sessao);
    const texto = htmlParaTexto(c.corpoHtml ?? "");
    /* Sem pausa própria aqui: o espaço entre envios é do marcapasso do número
       (lib/whatsapp/marcapasso.ts), que sorteia 8–25s e vale para o chip todo,
       não só para esta campanha. Pausa fixa de 1,5s era pior que nenhuma —
       cadência de metrônomo é assinatura de robô. */
    return async (destino, vars) => {
      const r = await sendText(destino, personalizar(texto, vars), config);
      return { mensagemId: r.messageId };
    };
  }
  return async (destino, vars) => {
    const r = await sendResendEmail({
      to: destino,
      subject: personalizar(c.assunto ?? "", vars),
      html: personalizar(c.corpoHtml ?? "", vars),
      replyTo: c.remetente || undefined,
    });
    if (r.skipped) throw new Error("E-mail do sistema (Resend) não está configurado neste ambiente.");
    if (!r.sent) throw new Error(r.error || "Resend recusou o envio.");
    return { mensagemId: r.id };
  };
}

async function marcar(id: string, status: string, extra: { erro?: string | null; mensagemId?: string | null } = {}) {
  await db.update(outreachCampanhaDestinatarios).set({
    status,
    erro: extra.erro ?? null,
    mensagemId: extra.mensagemId ?? null,
    enviadoEm: status === "enviado" ? new Date() : null,
    updatedAt: new Date(),
  }).where(eq(outreachCampanhaDestinatarios.id, id));
}

/**
 * `{{empresa}}` precisa da empresa do lead; o nome já vem na linha. Buscar a
 * empresa só quando o corpo usa a variável evita join à toa.
 */
async function empresasDe(ids: string[], corpo: string): Promise<Map<string, string>> {
  if (!corpo.includes("{{empresa}}") || ids.length === 0) return new Map();
  const rows = (await db.execute(sql`
    SELECT d.id, coalesce(e.nome, l.empresa, '') AS empresa
      FROM outreach_campanha_destinatarios d
      LEFT JOIN leads l ON l.id = d.lead_id
      LEFT JOIN empresas e ON e.id = l.empresa_id
     WHERE d.id IN (${sql.join(ids.map((x) => sql`${x}::uuid`), sql`, `)})
  `)) as unknown as Array<{ id: string; empresa: string }>;
  return new Map(rows.map((r) => [r.id, r.empresa]));
}

export async function sweepCampanhas(): Promise<ResumoSweep> {
  const resumo: ResumoSweep = { iniciadas: 0, enviados: 0, bloqueados: 0, falhas: 0, concluidas: 0 };

  // Linha presa em "enviando" = worker caiu no meio do envio. Não reenvia.
  await db.execute(sql`
    UPDATE outreach_campanha_destinatarios
       SET status = 'falhou', erro = 'Envio interrompido: não dá para saber se a mensagem saiu, por isso não foi reenviada.', updated_at = now()
     WHERE status = 'enviando' AND updated_at < now() - make_interval(mins => ${PRESO_APOS_MIN})
  `);

  resumo.iniciadas = await iniciarDevidas();

  const ativas = await db.select().from(outreachCampanhas).where(eq(outreachCampanhas.status, "enviando"));
  for (const c of ativas) {
    const lote = await reservarLote(c.id);
    if (lote.length > 0) {
      const envio = await preparar(c);
      const empresas = await empresasDe(lote.map((d) => d.id), `${c.corpoHtml ?? ""}${c.assunto ?? ""}`);
      /* Quem pediu para parar não recebe, mesmo que estivesse na lista no
         disparo: a lista congela, o pedido de descadastro não. Consultado no
         envio, uma vez por lote. */
      const optOut = await destinosEmOptOut(c.organizacaoId, c.canal, lote.map((d) => d.destino));
      let enviadosAqui = 0;
      for (const d of lote) {
        if ("erro" in envio) { await marcar(d.id, "falhou", { erro: envio.erro }); resumo.falhas++; continue; }
        if (optOut.has(d.destino)) {
          await marcar(d.id, "bloqueado", { erro: "O contato pediu para não receber mensagens." });
          resumo.bloqueados++; continue;
        }
        try {
          const r = await envio(d.destino, { nome: d.nome, empresa: empresas.get(d.id) });
          await marcar(d.id, "enviado", { mensagemId: r.mensagemId || null });
          enviadosAqui++; resumo.enviados++;
        } catch (e) {
          /* Teto do chip estourado interrompe o LOTE, não a campanha: devolve
             este e os que faltam para `pendente` e o próximo sweep continua.
             Insistir aqui seria bater na parede 20 vezes seguidas. */
          if (e instanceof NumeroNoLimite) {
            const restantes = lote.slice(lote.indexOf(d)).map((x) => x.id);
            await db.update(outreachCampanhaDestinatarios).set({ status: "pendente", updatedAt: new Date() })
              .where(inArray(outreachCampanhaDestinatarios.id, restantes));
            console.warn(`[Campanha ${c.id}] ${e.message} — ${restantes.length} destinatários adiados`);
            break;
          }
          const { status, erro } = classificarErroEnvio(e);
          await marcar(d.id, status, { erro });
          if (status === "bloqueado") resumo.bloqueados++; else resumo.falhas++;
        }
      }
      if (enviadosAqui > 0) {
        await db.update(outreachCampanhas)
          .set({ totalEnviados: sql`coalesce(${outreachCampanhas.totalEnviados}, 0) + ${enviadosAqui}`, updatedAt: new Date() })
          .where(eq(outreachCampanhas.id, c.id));
      }
    }

    // Nada pendente nem em voo: a campanha terminou (mesmo com bloqueios/falhas,
    // que ficam visíveis por destinatário no detalhe).
    const [resto] = (await db.execute(sql`
      SELECT count(*)::int AS n FROM outreach_campanha_destinatarios
       WHERE campanha_id = ${c.id}::uuid AND status IN ('pendente', 'enviando')
    `)) as unknown as Array<{ n: number }>;
    if (Number(resto?.n ?? 0) === 0) {
      await db.update(outreachCampanhas)
        .set({ status: "concluida", concluidaEm: new Date(), updatedAt: new Date() })
        .where(and(eq(outreachCampanhas.id, c.id), eq(outreachCampanhas.status, "enviando")));
      resumo.concluidas++;
    }
  }
  return resumo;
}

