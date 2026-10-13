/**
 * Trocar o responsável da reunião move o evento entre calendários (Módulo 09).
 *
 * O Outlook não move evento entre caixas: o organizador é a caixa que criou. Mover é
 * CRIAR o evento na agenda do novo responsável e RETIRAR o do antigo. A ordem é a que
 * nunca deixa o cliente sem convite:
 *
 *   1. reserva (só um processo troca por vez);
 *   2. cria no calendário novo, pela conta Microsoft/Google do novo responsável;
 *   3. grava o vínculo novo E a remoção pendente do antigo, num único UPDATE com
 *      compare-and-swap (só vale se o vínculo ainda é o antigo);
 *   4. cancela o antigo; deu certo, limpa a pendência; falhou, a pendência fica e o worker
 *      repete só o cancelamento.
 *
 * IDEMPOTÊNCIA: o gatilho não é "o responsável mudou", é o ESTADO: o evento está na conta de
 * alguém que não é o responsável de hoje. Depois de movido, o dono da conta vinculada é o
 * responsável, então repetir a troca não encontra nada a fazer. O passo 3 é o cinto de
 * segurança contra duas trocas concorrentes.
 *
 * Este arquivo não importa banco nem Graph: recebe uma `PortaTroca`. O banco entra em
 * `sincronizar.ts`; os testes entram com um calendário falso.
 */
import type { CalendarProvider } from "./provider";

export interface RemocaoPendente { provider: string; contaId: string; eventId: string; desde: string }

export interface ReuniaoParaTroca {
  id: string;
  titulo: string;
  inicioISO: string;
  fimISO: string;
  notas: string | null;
  /** Participantes + contato do processo (ver `convidadosDe`). */
  convidados: string[];
  responsavelId: string;
  /** Responsável anterior, quando quem chamou sabe (reunião antiga sem `calendar_conta_id`). */
  anteriorId: string | null;
  /** Vínculo atual com o calendário. */
  provider: string | null;
  eventId: string;
  contaId: string | null;
  /** Dono (usuário) da conta vinculada; null quando a conta sumiu ou o vínculo é anterior à 0110. */
  donoDaConta: string | null;
  remocaoPendente: RemocaoPendente | null;
}

export interface PortaTroca {
  providerPorNome(nome: string | null): CalendarProvider | null;
  /** Provedores configurados, o já vinculado primeiro. */
  candidatos(preferido: string | null): CalendarProvider[];
  nomeDoUsuario(usuarioId: string): Promise<string>;
  /** E-mail da conta de agenda (o organizador não se convida). */
  emailDaConta(contaId: string): Promise<string | null>;
  /** Exclusão mútua: false = outra troca está em andamento. */
  reservar(reuniaoId: string): Promise<boolean>;
  /**
   * Grava o vínculo novo + a remoção pendente do antigo, SE o vínculo ainda é o `de`.
   * false = o vínculo mudou no meio (não grava). Lança se o banco falhar.
   */
  gravarTroca(reuniaoId: string, de: { eventId: string; contaId: string | null }, para: { provider: string; eventId: string; contaId: string; link: string | null }, pendente: RemocaoPendente | null): Promise<boolean>;
  /** Mantém o vínculo, marca a sincronização como falha visível (peça de reunião). */
  falhar(reuniaoId: string, erro: string): Promise<void>;
  /** A pendência foi cumprida: limpa e marca a sincronização como ok. */
  remocaoConcluida(reuniaoId: string): Promise<void>;
  /** Cancelamento do antigo falhou: a pendência fica; o erro vira visível. */
  remocaoFalhou(reuniaoId: string, erro: string): Promise<void>;
  /** Não deu para registrar; segundos de espera entre as tentativas (teste zera). */
  esperar?(ms: number): Promise<void>;
}

export type EstadoTroca = "sem_troca" | "movido" | "pendente" | "em_andamento";

export interface ResultadoTroca {
  estado: EstadoTroca;
  /** Frase pronta para a tela; nula quando está tudo certo. */
  aviso: string | null;
  provider?: string | null;
  eventId?: string | null;
  link?: string | null;
  /** O evento novo já existe e a pendência de remoção do antigo foi cumprida. */
  removidoDoAntigo?: boolean;
}

/** O evento está na agenda de quem não é mais o responsável? */
export function precisaMover(r: Pick<ReuniaoParaTroca, "donoDaConta" | "anteriorId" | "responsavelId">): boolean {
  return (r.donoDaConta ?? r.anteriorId ?? r.responsavelId) !== r.responsavelId;
}

const frase = (e: unknown) => String(e instanceof Error ? e.message : e).slice(0, 250);

/** Cancela o evento que sobrou no calendário antigo. Idempotente: cancelar o que já saiu não é erro. */
export async function cumprirRemocao(porta: PortaTroca, r: Pick<ReuniaoParaTroca, "id">, p: RemocaoPendente, motivo: string): Promise<{ ok: boolean; aviso: string | null }> {
  const provider = porta.providerPorNome(p.provider);
  if (!provider) {
    const aviso = `O evento antigo (${p.provider}) continua no calendário anterior e o provedor não está disponível para retirá-lo.`;
    await porta.remocaoFalhou(r.id, aviso);
    return { ok: false, aviso };
  }
  let res;
  try { res = await provider.cancelar(p.contaId, p.eventId, motivo); }
  catch (e) { res = { ok: false as const, motivo: "erro_provedor" as const, detalhe: frase(e), tentarDeNovo: true }; }
  if (!res.ok) {
    const aviso = `A reunião já está no calendário do novo responsável, mas não consegui retirar o evento do calendário anterior (${res.detalhe}). Vou tentar de novo.`;
    await porta.remocaoFalhou(r.id, aviso);
    return { ok: false, aviso };
  }
  await porta.remocaoConcluida(r.id);
  return { ok: true, aviso: null };
}

export async function moverEventoDeCalendario(porta: PortaTroca, r: ReuniaoParaTroca): Promise<ResultadoTroca> {
  const mover = precisaMover(r);

  // Pendência de uma troca anterior: nunca começa outra por cima (a pendência é de um evento só).
  if (r.remocaoPendente) {
    const dren = await cumprirRemocao(porta, r, r.remocaoPendente, "Reunião movida para outro calendário.");
    if (!dren.ok) return { estado: "pendente", aviso: dren.aviso };
    if (!mover) return { estado: "sem_troca", aviso: null, removidoDoAntigo: true };
  }
  if (!mover) return { estado: "sem_troca", aviso: null };

  const antigoDono = r.donoDaConta ?? r.anteriorId ?? r.responsavelId;
  const [nomeNovo, nomeAntigo] = await Promise.all([porta.nomeDoUsuario(r.responsavelId), porta.nomeDoUsuario(antigoDono)]);

  // Conta do novo responsável: no provedor do evento se der, senão em qualquer um.
  let destino: { provider: CalendarProvider; contaId: string } | null = null;
  let algumConfigurado = false;
  for (const p of porta.candidatos(r.provider)) {
    if (!p.configurado()) continue;
    algumConfigurado = true;
    const contaId = await p.contaDoUsuario(r.responsavelId);
    if (contaId) { destino = { provider: p, contaId }; break; }
  }
  if (!destino) {
    // Não cancela nada: cancelar sem ter para onde mover deixaria o cliente sem convite.
    const aviso = algumConfigurado
      ? `${nomeNovo} não tem calendário conectado: o evento continua no calendário de ${nomeAntigo}. Conecte em Ajustes > Integrações e a troca se conclui sozinha.`
      : "A integração de calendário não está configurada neste ambiente: o evento continua no calendário anterior.";
    await porta.falhar(r.id, aviso);
    return { estado: "pendente", aviso };
  }

  // Onde está o evento antigo: a conta vinculada; reunião anterior à 0110 não a tem, e a do responsável anterior serve.
  const provedorAntigo = r.provider ?? destino.provider.nome;
  const contaAntiga = r.contaId ?? (await porta.providerPorNome(provedorAntigo)?.contaDoUsuario(antigoDono)) ?? null;

  if (!(await porta.reservar(r.id))) {
    return { estado: "em_andamento", aviso: "A troca de calendário desta reunião já está em andamento." };
  }

  // O novo organizador não se convida (e a volta do Outlook também o tira da lista).
  const emailNovo = (await porta.emailDaConta(destino.contaId))?.toLowerCase() ?? null;
  const convidados = r.convidados.filter((e) => e.toLowerCase() !== emailNovo);

  let criado;
  try {
    criado = await destino.provider.criar(destino.contaId, {
      titulo: r.titulo, inicioISO: r.inicioISO, fimISO: r.fimISO, corpo: r.notas,
      convidadoEmail: convidados[0] ?? null, convidados, online: true,
    });
  } catch (e) {
    criado = { ok: false as const, motivo: "erro_provedor" as const, detalhe: frase(e), tentarDeNovo: true };
  }
  if (!criado.ok) {
    // Nada mudou no calendário antigo: o evento segue em UM calendário só.
    const aviso = `Não consegui criar o evento no calendário de ${nomeNovo} (${criado.detalhe}). O evento continua no calendário de ${nomeAntigo}; a troca será tentada de novo.`;
    await porta.falhar(r.id, aviso);
    return { estado: "pendente", aviso };
  }
  const eventId = "eventId" in criado ? criado.eventId : null;
  if (!eventId) {
    const aviso = `O calendário de ${nomeNovo} não devolveu o id do evento. O evento continua no calendário de ${nomeAntigo}.`;
    await porta.falhar(r.id, aviso);
    return { estado: "pendente", aviso };
  }
  const link = ("joinUrl" in criado ? criado.joinUrl : null) ?? ("link" in criado ? criado.link : null) ?? null;

  // O evento novo JÁ existe. Grava o vínculo; se o banco falhar de vez, desfaz o novo para não deixar órfão.
  // Sem conta do antigo não há o que cancelar depois: troca mesmo assim e avisa (abaixo).
  const pendente: RemocaoPendente | null = contaAntiga
    ? { provider: provedorAntigo, contaId: contaAntiga, eventId: r.eventId, desde: new Date().toISOString() }
    : null;
  let gravou = false;
  for (let tentativa = 1; ; tentativa++) {
    try {
      gravou = await porta.gravarTroca(r.id, { eventId: r.eventId, contaId: r.contaId }, { provider: destino.provider.nome, eventId, contaId: destino.contaId, link }, pendente);
      break;
    } catch (e) {
      if (tentativa < 3) { await (porta.esperar ?? ((ms) => new Promise<void>((ok) => setTimeout(ok, ms))))(200 * tentativa); continue; }
      console.error(`[calendario] troca da reunião ${r.id}: evento ${eventId} criado mas o vínculo não gravou; desfazendo o evento novo:`, e);
      await destino.provider.cancelar(destino.contaId, eventId, "Troca de calendário desfeita.").catch(() => undefined);
      const aviso = `Não consegui registrar a troca de calendário no CRM; o evento continua no calendário de ${nomeAntigo}. Será tentado de novo.`;
      await porta.falhar(r.id, aviso).catch(() => undefined);
      return { estado: "pendente", aviso };
    }
  }
  if (!gravou) {
    // O vínculo mudou enquanto criávamos (outra troca ou cancelamento ganhou): o que criamos sobra.
    await destino.provider.cancelar(destino.contaId, eventId, "Evento duplicado removido.").catch((e) => console.error(`[calendario] evento ${eventId} sobrou na troca da reunião ${r.id}:`, e));
    return { estado: "em_andamento", aviso: "A troca de calendário desta reunião já foi feita por outra operação." };
  }

  if (!pendente) {
    const aviso = `A reunião já está no calendário de ${nomeNovo}, mas não achei a conta de ${nomeAntigo} para retirar o evento antigo. Retire-o manualmente.`;
    await porta.remocaoFalhou(r.id, aviso);
    return { estado: "pendente", aviso, provider: destino.provider.nome, eventId, link, removidoDoAntigo: false };
  }
  const dren = await cumprirRemocao(porta, r, pendente, `Reunião movida para o calendário de ${nomeNovo}. Um novo convite foi enviado.`);
  return { estado: dren.ok ? "movido" : "pendente", aviso: dren.aviso, provider: destino.provider.nome, eventId, link, removidoDoAntigo: dren.ok };
}
