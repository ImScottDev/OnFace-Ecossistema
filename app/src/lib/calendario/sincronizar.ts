/**
 * A porta única entre a Reunião do ONFACE e a agenda externa (Módulo 09).
 *
 * Rota, automação e NEXO entram por aqui. Nenhum deles escolhe provedor nem
 * conhece Graph ou Google — isso é do adapter.
 *
 * TRÊS REGRAS QUE O MÓDULO 09 EXIGE E QUE ESTÃO AQUI:
 *
 *   "Create/Update/Cancel sincronizam provider" — as três operações existem.
 *   Antes só havia create e cancel: reagendar mudava a data no ONFACE e
 *   deixava o convite antigo de pé na agenda do cliente.
 *
 *   "Falha de sync é visível e reprocessável" — falha não derruba a ação do
 *   usuário e não some. Ela vira `calendar_sync_status = 'falhou'` com o erro,
 *   e `reprocessarSyncPendente` tenta de novo.
 *
 *   "Nunca falhar silenciosamente" — toda operação devolve um aviso em
 *   português quando o convite externo não aconteceu.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { microsoftCalendar } from "./microsoft";
import { googleCalendar } from "./google";
import { FRASE_DA_FALHA, type CalendarProvider, type NomeProvider } from "./provider";

/** Microsoft primeiro por ser o que a operação usa hoje. */
const PROVIDERS: CalendarProvider[] = [microsoftCalendar, googleCalendar];

export function providerPorNome(nome: string | null | undefined): CalendarProvider | null {
  return PROVIDERS.find((p) => p.nome === nome) ?? null;
}

export interface ResultadoSync {
  sincronizado: boolean;
  provider: NomeProvider | null;
  eventId?: string | null;
  /** Frase pronta para a tela. Nula quando deu certo. */
  aviso?: string | null;
}

interface LinhaReuniao extends Record<string, unknown> {
  id: string;
  titulo: string;
  data: Date;
  duracao: number | null;
  notas: string | null;
  responsavel_id: string | null;
  calendar_provider: string | null;
  calendar_event_id: string | null;
  convidado_email: string | null;
}

async function carregar(organizacaoId: string, reuniaoId: string): Promise<LinhaReuniao | null> {
  const [r] = await db.execute<LinhaReuniao>(sql`
    SELECT r.id::text, r.titulo, r.data, r.duracao, r.notas,
           r.responsavel_id::text,
           -- PONTE com os caminhos de criação antigos, que chamam o Graph
           -- direto e gravam só outlook_event_id (rotas de reunião e de
           -- lead). Sem este COALESCE, reagendar uma reunião criada por eles
           -- acharia que nunca houve evento externo e criaria um SEGUNDO
           -- convite em vez de atualizar o primeiro.
           --
           -- A ponte sai quando aqueles caminhos passarem pelo provider; até
           -- lá ela é o que impede duplicata na agenda do cliente.
           COALESCE(r.calendar_provider, CASE WHEN r.outlook_event_id IS NOT NULL THEN 'microsoft' END) AS calendar_provider,
           COALESCE(r.calendar_event_id, r.outlook_event_id) AS calendar_event_id,
           -- O convidado é o contato do processo: pessoa canônica primeiro,
           -- lead legado como ponte enquanto ele existir.
           COALESCE(p.email, l.email) AS convidado_email
      FROM reunioes r
      LEFT JOIN leads l ON l.id = r.lead_id
      LEFT JOIN pessoas p ON p.lead_id_legado = r.lead_id
     WHERE r.id = ${reuniaoId}::uuid AND r.organizacao_id = ${organizacaoId}::uuid`);
  return r ?? null;
}

async function gravarEstado(
  reuniaoId: string,
  campos: { provider?: string | null; eventId?: string | null; status: string; erro?: string | null },
): Promise<void> {
  await db.execute(sql`
    UPDATE reunioes SET
      calendar_provider = COALESCE(${campos.provider ?? null}, calendar_provider),
      calendar_event_id = COALESCE(${campos.eventId ?? null}, calendar_event_id),
      calendar_sync_status = ${campos.status},
      calendar_sync_erro = ${campos.erro ?? null},
      calendar_sync_em = now(),
      -- Ponte: o sync antigo lê por outlook_event_id, e ele continua até a
      -- substituição. Escrever só a coluna nova quebraria syncOutlookReunioes.
      outlook_event_id = CASE WHEN ${campos.provider ?? null} = 'microsoft'
                              THEN COALESCE(${campos.eventId ?? null}, outlook_event_id)
                              ELSE outlook_event_id END,
      updated_at = now()
     WHERE id = ${reuniaoId}::uuid`);
}

/** O provedor do usuário: o já vinculado à reunião, senão o primeiro conectado. */
async function escolher(
  r: LinhaReuniao,
): Promise<{ provider: CalendarProvider; contaId: string } | { erro: "sem_conta" | "nao_configurado" }> {
  const jaVinculado = providerPorNome(r.calendar_provider);
  const candidatos = jaVinculado ? [jaVinculado] : PROVIDERS;

  let algumConfigurado = false;
  for (const p of candidatos) {
    if (!p.configurado()) continue;
    algumConfigurado = true;
    if (!r.responsavel_id) continue;
    const contaId = await p.contaDoUsuario(r.responsavel_id);
    if (contaId) return { provider: p, contaId };
  }
  return { erro: algumConfigurado ? "sem_conta" : "nao_configurado" };
}

export async function criarNaAgenda(organizacaoId: string, reuniaoId: string): Promise<ResultadoSync> {
  const r = await carregar(organizacaoId, reuniaoId);
  if (!r) return { sincronizado: false, provider: null, aviso: "Reunião não encontrada." };

  const escolha = await escolher(r);
  if ("erro" in escolha) {
    await gravarEstado(reuniaoId, { status: escolha.erro === "sem_conta" ? "falhou" : "sem_provedor", erro: escolha.erro });
    return { sincronizado: false, provider: null, aviso: FRASE_DA_FALHA[escolha.erro] };
  }

  const inicio = new Date(r.data);
  const fim = new Date(inicio.getTime() + (r.duracao || 30) * 60_000);
  const res = await escolha.provider.criar(escolha.contaId, {
    titulo: r.titulo, inicioISO: inicio.toISOString(), fimISO: fim.toISOString(),
    corpo: r.notas, convidadoEmail: r.convidado_email, online: true,
  });

  if (!res.ok) {
    await gravarEstado(reuniaoId, { provider: escolha.provider.nome, status: "falhou", erro: res.detalhe });
    return { sincronizado: false, provider: escolha.provider.nome, aviso: FRASE_DA_FALHA[res.motivo] };
  }
  await gravarEstado(reuniaoId, { provider: escolha.provider.nome, eventId: res.eventId, status: "ok" });
  return { sincronizado: true, provider: escolha.provider.nome, eventId: res.eventId, aviso: null };
}

/**
 * O que não existia. Reagendar, renomear ou mudar duração precisa chegar na
 * agenda de quem foi convidado.
 */
export async function atualizarNaAgenda(
  organizacaoId: string, reuniaoId: string,
): Promise<ResultadoSync> {
  const r = await carregar(organizacaoId, reuniaoId);
  if (!r) return { sincronizado: false, provider: null, aviso: "Reunião não encontrada." };

  // Nunca houve evento externo: não é atualização, é criação.
  if (!r.calendar_event_id) return criarNaAgenda(organizacaoId, reuniaoId);

  const escolha = await escolher(r);
  if ("erro" in escolha) {
    await gravarEstado(reuniaoId, { status: escolha.erro === "sem_conta" ? "falhou" : "sem_provedor", erro: escolha.erro });
    return { sincronizado: false, provider: null, aviso: FRASE_DA_FALHA[escolha.erro] };
  }

  const inicio = new Date(r.data);
  const fim = new Date(inicio.getTime() + (r.duracao || 30) * 60_000);
  const res = await escolha.provider.atualizar(escolha.contaId, r.calendar_event_id, {
    titulo: r.titulo, inicioISO: inicio.toISOString(), fimISO: fim.toISOString(), corpo: r.notas,
  });

  if (!res.ok) {
    await gravarEstado(reuniaoId, { provider: escolha.provider.nome, status: "falhou", erro: res.detalhe });
    return { sincronizado: false, provider: escolha.provider.nome, aviso: FRASE_DA_FALHA[res.motivo] };
  }
  // Apagado do lado do provedor: recria em vez de insistir num id morto.
  if ("naoExiste" in res && res.naoExiste) {
    await db.execute(sql`UPDATE reunioes SET calendar_event_id = NULL WHERE id = ${reuniaoId}::uuid`);
    return criarNaAgenda(organizacaoId, reuniaoId);
  }
  await gravarEstado(reuniaoId, { provider: escolha.provider.nome, status: "ok" });
  return { sincronizado: true, provider: escolha.provider.nome, eventId: r.calendar_event_id, aviso: null };
}

export async function cancelarNaAgenda(organizacaoId: string, reuniaoId: string): Promise<ResultadoSync> {
  const r = await carregar(organizacaoId, reuniaoId);
  if (!r?.calendar_event_id) return { sincronizado: true, provider: null, aviso: null };

  const escolha = await escolher(r);
  if ("erro" in escolha) return { sincronizado: false, provider: null, aviso: FRASE_DA_FALHA[escolha.erro] };

  const res = await escolha.provider.cancelar(escolha.contaId, r.calendar_event_id);
  if (!res.ok) {
    await gravarEstado(reuniaoId, { provider: escolha.provider.nome, status: "falhou", erro: res.detalhe });
    return { sincronizado: false, provider: escolha.provider.nome, aviso: FRASE_DA_FALHA[res.motivo] };
  }
  await gravarEstado(reuniaoId, { provider: escolha.provider.nome, status: "ok" });
  return { sincronizado: true, provider: escolha.provider.nome, aviso: null };
}

/**
 * A parte "reprocessável" do requisito. O worker chama isto; falha de rede de
 * ontem não vira convite perdido para sempre.
 */
export async function reprocessarSyncPendente(
  organizacaoId: string, limite = 50,
): Promise<{ tentadas: number; resolvidas: number }> {
  const pendentes = await db.execute<{ id: string; tem_evento: boolean }>(sql`
    SELECT id::text, (calendar_event_id IS NOT NULL) AS tem_evento
      FROM reunioes
     WHERE organizacao_id = ${organizacaoId}::uuid
       AND calendar_sync_status = 'falhou'
       AND status NOT IN ('cancelada')
       AND data > now() - interval '7 days'
     ORDER BY calendar_sync_em NULLS FIRST
     LIMIT ${limite}`);

  let resolvidas = 0;
  for (const p of pendentes) {
    const r = p.tem_evento
      ? await atualizarNaAgenda(organizacaoId, p.id)
      : await criarNaAgenda(organizacaoId, p.id);
    if (r.sincronizado) resolvidas++;
  }
  return { tentadas: pendentes.length, resolvidas };
}
