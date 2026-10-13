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
import { moverEventoDeCalendario, cumprirRemocao, precisaMover, type PortaTroca, type RemocaoPendente, type ResultadoTroca } from "./troca-de-agenda";

/** Microsoft primeiro por ser o que a operação usa hoje. */
const PROVIDERS: CalendarProvider[] = [microsoftCalendar, googleCalendar];

/** Teste: troca os provedores por simulados (sem rede). Devolve a função que restaura. */
export function usarProvidersDeTeste(lista: CalendarProvider[]): () => void {
  const original = PROVIDERS.splice(0, PROVIDERS.length, ...lista);
  return () => { PROVIDERS.splice(0, PROVIDERS.length, ...original); };
}

/** Conta/provedor de agenda do usuário, ou o motivo de não ter. Fonte única para quem consulta ou cria. */
export async function agendaDoUsuario(usuarioId: string): Promise<{ provider: CalendarProvider; contaId: string } | { erro: "sem_conta" | "nao_configurado" }> {
  let algumConfigurado = false;
  for (const p of PROVIDERS) {
    if (!p.configurado()) continue;
    algumConfigurado = true;
    const contaId = await p.contaDoUsuario(usuarioId);
    if (contaId) return { provider: p, contaId };
  }
  return { erro: algumConfigurado ? "sem_conta" : "nao_configurado" };
}

export function providerPorNome(nome: string | null | undefined): CalendarProvider | null {
  return PROVIDERS.find((p) => p.nome === nome) ?? null;
}

export interface ResultadoSync {
  sincronizado: boolean;
  provider: NomeProvider | null;
  eventId?: string | null;
  /** Link da reunião online quando o provedor gerou. */
  link?: string | null;
  /** Frase pronta para a tela. Nula quando deu certo. */
  aviso?: string | null;
  /** O evento existe, mas ninguém foi convidado: não há e-mail nos participantes nem no contato. */
  semConvidado?: boolean;
}

/** Frase para quando o evento saiu na agenda do responsável, sem convite a ninguém. */
export const FRASE_SEM_CONVIDADO = "Reunião criada na agenda, mas sem convite: nenhum participante com e-mail. Inclua os participantes para o convite sair.";

interface LinhaReuniao extends Record<string, unknown> {
  id: string;
  titulo: string;
  data: Date;
  duracao: number | null;
  notas: string | null;
  responsavel_id: string | null;
  calendar_provider: string | null;
  calendar_event_id: string | null;
  calendar_conta_id: string | null;
  /** Dono (usuário) da conta vinculada: se não é o responsável, o evento está no calendário errado. */
  dono_conta: string | null;
  status: string | null;
  calendar_sync_status: string | null;
  calendar_remocao_pendente: RemocaoPendente | null;
  convidado_email: string | null;
  participantes: string[] | null;
}

/** Convidados = participantes com e-mail + o contato do processo, sem repetir. */
export function convidadosDe(r: Pick<LinhaReuniao, "participantes" | "convidado_email">): string[] {
  const todos = [...(r.participantes ?? []), r.convidado_email].map((e) => (e ?? "").trim().toLowerCase());
  return [...new Set(todos.filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))];
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
           r.calendar_conta_id::text AS calendar_conta_id,
           (SELECT ec.usuario_id::text FROM email_contas ec WHERE ec.id = r.calendar_conta_id) AS dono_conta,
           r.status, r.calendar_sync_status, r.calendar_remocao_pendente,
           -- O convidado é o contato do processo: pessoa canônica primeiro,
           -- lead legado como ponte enquanto ele existir.
           COALESCE(p.email, l.email) AS convidado_email,
           coalesce(to_jsonb(r.participantes), '[]'::jsonb) AS participantes
      FROM reunioes r
      LEFT JOIN leads l ON l.id = r.lead_id
      LEFT JOIN pessoas p ON p.lead_id_legado = r.lead_id
     WHERE r.id = ${reuniaoId}::uuid AND r.organizacao_id = ${organizacaoId}::uuid`);
  return r ?? null;
}

async function gravarEstado(
  reuniaoId: string,
  campos: { provider?: string | null; eventId?: string | null; contaId?: string | null; status: string; erro?: string | null; link?: string | null },
): Promise<void> {
  await db.execute(sql`
    UPDATE reunioes SET
      calendar_provider = COALESCE(${campos.provider ?? null}, calendar_provider),
      calendar_event_id = COALESCE(${campos.eventId ?? null}, calendar_event_id),
      calendar_conta_id = COALESCE(${campos.contaId && /^[0-9a-f-]{36}$/i.test(campos.contaId) ? campos.contaId : null}::uuid, calendar_conta_id),
      calendar_sync_status = ${campos.status},
      calendar_sync_erro = ${campos.erro ?? null},
      calendar_sync_em = now(),
      link = COALESCE(${campos.link ?? null}, link),
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
  // A conta que criou o evento é a que o atualiza: com duas contas Microsoft, "a primeira ativa" podia ser
  // outra, o PATCH dava 404 e o evento era recriado (duplicata no Outlook).
  if (jaVinculado?.configurado() && r.calendar_conta_id) return { provider: jaVinculado, contaId: r.calendar_conta_id };
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

// ─── Troca de responsável: o evento muda de calendário ──────────────────────

function portaTroca(organizacaoId: string): PortaTroca {
  return {
    providerPorNome,
    candidatos: (preferido) => {
      const ativos = PROVIDERS.filter((p) => p.configurado());
      return [...ativos.filter((p) => p.nome === preferido), ...ativos.filter((p) => p.nome !== preferido)];
    },
    async nomeDoUsuario(usuarioId) {
      const [u] = await db.execute<{ nome: string }>(sql`SELECT nome FROM usuarios WHERE id = ${usuarioId}::uuid AND organizacao_id = ${organizacaoId}::uuid`);
      return u?.nome ?? "outro usuário";
    },
    async emailDaConta(contaId) {
      const [c] = await db.execute<{ email: string }>(sql`SELECT email FROM email_contas WHERE id = ${contaId}::uuid AND organizacao_id = ${organizacaoId}::uuid`);
      return c?.email ?? null;
    },
    async reservar(reuniaoId) {
      // Mesma reserva da criação: quem não ganha não troca. Vale 2 minutos (processo que morreu no meio não trava para sempre).
      const [r] = await db.execute<{ id: string }>(sql`
        UPDATE reunioes SET calendar_sync_status = 'pendente', calendar_sync_em = now()
         WHERE id = ${reuniaoId}::uuid AND organizacao_id = ${organizacaoId}::uuid
           AND (calendar_sync_status IS DISTINCT FROM 'pendente' OR calendar_sync_em IS NULL OR calendar_sync_em < now() - interval '2 minutes')
        RETURNING id::text`);
      return Boolean(r);
    },
    async gravarTroca(reuniaoId, de, para, pendente) {
      // Compare-and-swap: só grava se o vínculo AINDA é o que a troca leu. Vínculo novo + pendência do antigo vão juntos.
      const [r] = await db.execute<{ id: string }>(sql`
        UPDATE reunioes SET
          calendar_provider = ${para.provider},
          calendar_event_id = ${para.eventId},
          calendar_conta_id = ${para.contaId}::uuid,
          outlook_event_id = ${para.provider === "microsoft" ? para.eventId : null},
          link = ${para.link},
          calendar_remocao_pendente = ${pendente ? JSON.stringify(pendente) : null}::jsonb,
          calendar_sync_status = 'ok', calendar_sync_erro = NULL, calendar_sync_em = now(), updated_at = now()
         WHERE id = ${reuniaoId}::uuid AND organizacao_id = ${organizacaoId}::uuid
           AND COALESCE(calendar_event_id, outlook_event_id) = ${de.eventId}
           AND calendar_conta_id IS NOT DISTINCT FROM ${de.contaId}::uuid
        RETURNING id::text`);
      return Boolean(r);
    },
    async falhar(reuniaoId, erro) {
      await gravarEstado(reuniaoId, { status: "falhou", erro });
    },
    async remocaoConcluida(reuniaoId) {
      await db.execute(sql`
        UPDATE reunioes SET calendar_remocao_pendente = NULL, calendar_sync_status = 'ok', calendar_sync_erro = NULL, calendar_sync_em = now(), updated_at = now()
         WHERE id = ${reuniaoId}::uuid AND organizacao_id = ${organizacaoId}::uuid`);
    },
    async remocaoFalhou(reuniaoId, erro) {
      await gravarEstado(reuniaoId, { status: "falhou", erro });
    },
  };
}

function paraTroca(r: LinhaReuniao, anteriorId: string | null): Parameters<typeof moverEventoDeCalendario>[1] {
  const inicio = new Date(r.data);
  return {
    id: r.id, titulo: r.titulo, inicioISO: inicio.toISOString(), fimISO: new Date(inicio.getTime() + (r.duracao || 30) * 60_000).toISOString(),
    notas: r.notas, convidados: convidadosDe(r), responsavelId: r.responsavel_id!, anteriorId,
    provider: r.calendar_provider, eventId: r.calendar_event_id!, contaId: r.calendar_conta_id, donoDaConta: r.dono_conta,
    remocaoPendente: r.calendar_remocao_pendente,
  };
}

/** O evento está no calendário de quem não é o responsável, ou sobrou evento antigo a retirar? */
function pedeTroca(r: LinhaReuniao, anteriorId: string | null): boolean {
  return r.status === "agendada" && Boolean(r.responsavel_id) && Boolean(r.calendar_event_id)
    && (Boolean(r.calendar_remocao_pendente) || precisaMover({ donoDaConta: r.dono_conta, anteriorId, responsavelId: r.responsavel_id! }));
}

/** Cancela, sem mover nada, o evento que ficou para trás (reunião cancelada ou já realizada). */
async function retirarEventoAntigo(organizacaoId: string, r: LinhaReuniao): Promise<{ ok: boolean; aviso: string | null }> {
  if (!r.calendar_remocao_pendente) return { ok: true, aviso: null };
  return cumprirRemocao(portaTroca(organizacaoId), r, r.calendar_remocao_pendente, "Reunião movida para outro calendário.");
}

/** Falha que escapou da sincronização: vira erro visível na reunião (peça), nunca só log. */
export async function marcarFalhaDeSync(reuniaoId: string, erro: string): Promise<void> {
  await gravarEstado(reuniaoId, { status: "falhou", erro: erro.slice(0, 300) });
}

export async function criarNaAgenda(organizacaoId: string, reuniaoId: string): Promise<ResultadoSync> {
  const r = await carregar(organizacaoId, reuniaoId);
  if (!r) return { sincronizado: false, provider: null, aviso: "Reunião não encontrada." };

  // Já tem evento: criar de novo é duplicar. Quem pede "criar" numa reunião vinculada está atualizando.
  if (r.calendar_event_id) return atualizarNaAgenda(organizacaoId, reuniaoId);

  const escolha = await escolher(r);
  if ("erro" in escolha) {
    await gravarEstado(reuniaoId, { status: escolha.erro === "sem_conta" ? "falhou" : "sem_provedor", erro: escolha.erro });
    return { sincronizado: false, provider: null, aviso: FRASE_DA_FALHA[escolha.erro] };
  }

  // Reserva a criação: duas chamadas ao mesmo tempo (POST seguido de PATCH, retry do worker) liam
  // "sem evento" e criavam dois. Quem não ganha a reserva não cria.
  // ponytail: a edição que perde a corrida não é reenviada depois; o retry só pega 'falhou'.
  const [reserva] = await db.execute<{ id: string }>(sql`
    UPDATE reunioes SET calendar_sync_status = 'pendente', calendar_sync_em = now()
     WHERE id = ${reuniaoId}::uuid AND calendar_event_id IS NULL AND outlook_event_id IS NULL
       AND (calendar_sync_status IS DISTINCT FROM 'pendente' OR calendar_sync_em IS NULL OR calendar_sync_em < now() - interval '2 minutes')
    RETURNING id::text`);
  if (!reserva) return { sincronizado: false, provider: escolha.provider.nome, aviso: "O convite desta reunião já está sendo criado na agenda." };

  const inicio = new Date(r.data);
  const fim = new Date(inicio.getTime() + (r.duracao || 30) * 60_000);
  const convidados = convidadosDe(r);
  const res = await escolha.provider.criar(escolha.contaId, {
    titulo: r.titulo, inicioISO: inicio.toISOString(), fimISO: fim.toISOString(),
    corpo: r.notas, convidadoEmail: convidados[0] ?? null, convidados, online: true,
  });

  if (!res.ok) {
    await gravarEstado(reuniaoId, { provider: escolha.provider.nome, status: "falhou", erro: res.detalhe });
    return { sincronizado: false, provider: escolha.provider.nome, aviso: FRASE_DA_FALHA[res.motivo] };
  }
  const link = ("joinUrl" in res ? res.joinUrl : null) ?? ("link" in res ? res.link : null) ?? null;
  // O evento externo JÁ existe. Se a gravação interna falhar, tenta de novo; persistindo a falha, o evento é
  // desfeito no provedor: reconcilia sem deixar convite órfão e sem duplicar no reprocessamento.
  for (let tentativa = 1; ; tentativa++) {
    try {
      await gravarEstado(reuniaoId, { provider: escolha.provider.nome, eventId: res.eventId, contaId: escolha.contaId, status: "ok", link });
      // Quem foi convidado fica na reunião: o card mostra os participantes que o convite levou.
      if (!(r.participantes ?? []).length && convidados.length) {
        await db.execute(sql`UPDATE reunioes SET participantes = ARRAY[${sql.join(convidados.map((e) => sql`${e}`), sql`, `)}]::text[] WHERE id = ${reuniaoId}::uuid`);
      }
      break;
    } catch (e) {
      if (tentativa < 3) { await new Promise((ok) => setTimeout(ok, 200 * tentativa)); continue; }
      console.error(`[calendario] evento ${res.eventId} criado mas a reunião ${reuniaoId} não gravou o vínculo; desfazendo o evento:`, e);
      if (res.eventId) await escolha.provider.cancelar(escolha.contaId, res.eventId).catch(() => undefined);
      return { sincronizado: false, provider: escolha.provider.nome, aviso: "O convite foi criado, mas não deu para registrá-lo no CRM; foi desfeito para não duplicar. Tente de novo." };
    }
  }
  return { sincronizado: true, provider: escolha.provider.nome, eventId: res.eventId, aviso: null, link, semConvidado: convidados.length === 0 };
}

/**
 * O que não existia. Reagendar, renomear ou mudar duração precisa chegar na
 * agenda de quem foi convidado.
 */
export async function atualizarNaAgenda(
  organizacaoId: string, reuniaoId: string,
  /** `convidados: true` quando os participantes mudaram: a lista do evento passa a ser a da reunião. */
  /** `anteriorResponsavelId`: quem era o responsável antes da troca (reunião sem `calendar_conta_id`, anterior à 0110). */
  opcoes: { convidados?: boolean; anteriorResponsavelId?: string | null } = {},
): Promise<ResultadoSync> {
  const r = await carregar(organizacaoId, reuniaoId);
  if (!r) return { sincronizado: false, provider: null, aviso: "Reunião não encontrada." };

  // Nunca houve evento externo: não é atualização, é criação.
  if (!r.calendar_event_id) return criarNaAgenda(organizacaoId, reuniaoId);

  // O responsável mudou: o evento vive no calendário de outra pessoa. Move (cria no novo, retira do antigo)
  // com os dados atuais da reunião. Quando não dá para mover, segue atualizando o evento onde ele está
  // e mantém o erro da troca visível em vez de marcar "ok".
  let trocaPendente: ResultadoTroca | null = null;
  if (pedeTroca(r, opcoes.anteriorResponsavelId ?? null)) {
    const troca = await moverEventoDeCalendario(portaTroca(organizacaoId), paraTroca(r, opcoes.anteriorResponsavelId ?? null));
    if (troca.estado === "movido") return { sincronizado: true, provider: troca.provider as NomeProvider, eventId: troca.eventId, link: troca.link, aviso: null, semConvidado: convidadosDe(r).length === 0 };
    if (troca.estado === "em_andamento") return { sincronizado: false, provider: (r.calendar_provider as NomeProvider | null), aviso: troca.aviso };
    if (troca.estado === "pendente" && troca.eventId) {
      // Já está no calendário novo; só falta retirar o antigo (a pendência fica gravada e o worker repete).
      return { sincronizado: true, provider: troca.provider as NomeProvider, eventId: troca.eventId, link: troca.link, aviso: troca.aviso, semConvidado: convidadosDe(r).length === 0 };
    }
    if (troca.estado === "pendente") {
      // Sem a conta que criou o evento (anterior à 0110) não dá para atualizá-lo onde está sem arriscar uma recriação no calendário errado.
      if (!r.calendar_conta_id) return { sincronizado: false, provider: (r.calendar_provider as NomeProvider | null), aviso: troca.aviso };
      trocaPendente = troca;
    }
  }

  const escolha = await escolher(r);
  if ("erro" in escolha) {
    await gravarEstado(reuniaoId, { status: escolha.erro === "sem_conta" ? "falhou" : "sem_provedor", erro: escolha.erro });
    return { sincronizado: false, provider: null, aviso: FRASE_DA_FALHA[escolha.erro] };
  }

  const inicio = new Date(r.data);
  const fim = new Date(inicio.getTime() + (r.duracao || 30) * 60_000);
  const convidados = convidadosDe(r);
  const res = await escolha.provider.atualizar(escolha.contaId, r.calendar_event_id, {
    titulo: r.titulo, inicioISO: inicio.toISOString(), fimISO: fim.toISOString(), corpo: r.notas,
    ...(opcoes.convidados ? { convidados } : {}),
  });

  if (!res.ok) {
    await gravarEstado(reuniaoId, { provider: escolha.provider.nome, status: "falhou", erro: res.detalhe });
    return { sincronizado: false, provider: escolha.provider.nome, aviso: FRASE_DA_FALHA[res.motivo] };
  }
  // Apagado do lado do provedor: recria em vez de insistir num id morto.
  if ("naoExiste" in res && res.naoExiste) {
    console.warn(`[calendario] evento ${r.calendar_event_id} da reunião ${reuniaoId} não existe mais na conta ${escolha.contaId}; recriando`);
    await db.execute(sql`UPDATE reunioes SET calendar_event_id = NULL, outlook_event_id = NULL WHERE id = ${reuniaoId}::uuid`);
    return criarNaAgenda(organizacaoId, reuniaoId);
  }
  if (trocaPendente) {
    // O evento foi atualizado onde está, mas a troca de calendário não aconteceu: não vira "ok".
    await gravarEstado(reuniaoId, { provider: escolha.provider.nome, status: "falhou", erro: trocaPendente.aviso });
    return { sincronizado: false, provider: escolha.provider.nome, eventId: r.calendar_event_id, aviso: trocaPendente.aviso, semConvidado: convidados.length === 0 };
  }
  await gravarEstado(reuniaoId, { provider: escolha.provider.nome, contaId: escolha.contaId, status: "ok" });
  return { sincronizado: true, provider: escolha.provider.nome, eventId: r.calendar_event_id, aviso: null, semConvidado: convidados.length === 0 };
}

export async function cancelarNaAgenda(organizacaoId: string, reuniaoId: string, comentario?: string | null): Promise<ResultadoSync> {
  const r = await carregar(organizacaoId, reuniaoId);
  if (!r?.calendar_event_id) return { sincronizado: true, provider: null, aviso: null };

  const escolha = await escolher(r);
  if ("erro" in escolha) return { sincronizado: false, provider: null, aviso: FRASE_DA_FALHA[escolha.erro] };

  const res = await escolha.provider.cancelar(escolha.contaId, r.calendar_event_id, comentario);
  if (!res.ok) {
    await gravarEstado(reuniaoId, { provider: escolha.provider.nome, status: "falhou", erro: res.detalhe });
    return { sincronizado: false, provider: escolha.provider.nome, aviso: FRASE_DA_FALHA[res.motivo] };
  }
  await gravarEstado(reuniaoId, { provider: escolha.provider.nome, status: "ok" });
  // Sobrou evento num calendário antigo (troca de responsável incompleta): cancelar a reunião cancela os dois.
  if (r.calendar_remocao_pendente) {
    const dren = await retirarEventoAntigo(organizacaoId, r);
    if (!dren.ok) return { sincronizado: false, provider: escolha.provider.nome, aviso: dren.aviso };
  }
  return { sincronizado: true, provider: escolha.provider.nome, aviso: null };
}

/**
 * A parte "reprocessável" do requisito. O worker chama isto; falha de rede de
 * ontem não vira convite perdido para sempre.
 */
export async function reprocessarSyncPendente(
  organizacaoId: string, limite = 50,
): Promise<{ tentadas: number; resolvidas: number }> {
  const pendentes = await db.execute<{ id: string; tem_evento: boolean; status: string | null; tem_pendencia: boolean }>(sql`
    SELECT r.id::text, (COALESCE(r.calendar_event_id, r.outlook_event_id) IS NOT NULL) AS tem_evento, r.status,
           (r.calendar_remocao_pendente IS NOT NULL) AS tem_pendencia
      FROM reunioes r
      LEFT JOIN email_contas ec ON ec.id = r.calendar_conta_id
     WHERE r.organizacao_id = ${organizacaoId}::uuid
       AND (
         (r.calendar_sync_status = 'falhou' AND r.status NOT IN ('cancelada') AND r.data > now() - interval '7 days')
         -- Troca de responsável que não terminou: evento por retirar do calendário antigo, ou evento no
         -- calendário de quem não é mais o responsável. Vale mesmo com a sincronização marcada "ok".
         OR (r.calendar_remocao_pendente IS NOT NULL AND r.data > now() - interval '7 days')
         OR (r.status = 'agendada' AND r.data > now() AND ec.usuario_id IS NOT NULL AND ec.usuario_id <> r.responsavel_id
             AND COALESCE(r.calendar_event_id, r.outlook_event_id) IS NOT NULL)
       )
     ORDER BY r.calendar_sync_em NULLS FIRST
     LIMIT ${limite}`);

  let resolvidas = 0;
  for (const p of pendentes) {
    if (p.status !== "agendada" && p.tem_pendencia) {
      // Realizada/no-show/cancelada: não se atualiza evento, só se retira o que sobrou do calendário antigo.
      const r = await carregar(organizacaoId, p.id);
      if (r && (await retirarEventoAntigo(organizacaoId, r)).ok) resolvidas++;
      continue;
    }
    const r = p.tem_evento
      ? await atualizarNaAgenda(organizacaoId, p.id)
      : await criarNaAgenda(organizacaoId, p.id);
    if (r.sincronizado) resolvidas++;
  }
  return { tentadas: pendentes.length, resolvidas };
}
