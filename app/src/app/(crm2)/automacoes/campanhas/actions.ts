"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth/tenant";
import { executar, type Resultado } from "@/lib/vendas/resultado";
import {
  agendarCampanha, atualizarRascunho, contarDestinatarios, criarRascunho, excluirRascunho, podeGerirCampanhas,
  SEM_PERMISSAO_CAMPANHAS, sessoesWhatsapp, transicionarCampanha, validarCampanha,
  type EntradaCampanha, type Transicao,
} from "@/lib/automacoes/campanhas";
import { isResendConfigured } from "@/lib/email/resend";

const ROTA = "/automacoes/campanhas";

/**
 * Ações de campanha. Antes a tela chamava `POST /api/campanhas` (rota Next,
 * fora do Hono pelo rewrite/Traefik). Server Action resolve o mesmo com o
 * tenant da sessão e devolve `Resultado`, que é o contrato das telas ONFACE.
 * A rota `/api/campanhas` continua existindo para quem ainda a consome.
 */

function normalizar(e: EntradaCampanha): EntradaCampanha {
  return {
    nome: String(e.nome ?? ""),
    canal: e.canal === "whatsapp" ? "whatsapp" : "email",
    assunto: e.assunto ? String(e.assunto) : null,
    corpoHtml: String(e.corpoHtml ?? ""),
    listas: Array.isArray(e.listas) ? [...new Set(e.listas.map(String).map((s) => s.trim()).filter(Boolean))] : [],
    remetente: String(e.remetente ?? ""),
  };
}

export async function acaoSalvarCampanha(id: string | null, entrada: EntradaCampanha): Promise<Resultado<{ id: string }>> {
  const ctx = await getTenantContext();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  // Trava real: Server Action é endpoint público para qualquer sessão; o
  // botão desabilitado na página é só cortesia.
  if (!(await podeGerirCampanhas(ctx))) return { ok: false, erro: SEM_PERMISSAO_CAMPANHAS };
  const e = normalizar(entrada);
  const invalido = validarCampanha(e);
  if (invalido) return { ok: false, erro: invalido };

  const r = await executar("salvar campanha", async () => {
    const salvo = id
      ? ((await atualizarRascunho(ctx.organizacaoId, id, e)) ? id : null)
      : await criarRascunho(ctx.organizacaoId, ctx.userId, e);
    revalidatePath(ROTA);
    return { id: salvo };
  });
  if (!r.ok) return r;
  // Update que não casou = id de outra org ou campanha que já não é rascunho.
  if (!r.dados?.id) return { ok: false, erro: "Rascunho não encontrado — talvez tenha sido excluído." };
  return { ok: true, dados: { id: r.dados.id } };
}

export async function acaoExcluirCampanha(id: string): Promise<Resultado> {
  const ctx = await getTenantContext();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  // Trava real: Server Action é endpoint público para qualquer sessão; o
  // botão desabilitado na página é só cortesia.
  if (!(await podeGerirCampanhas(ctx))) return { ok: false, erro: SEM_PERMISSAO_CAMPANHAS };
  const ok = await excluirRascunho(ctx.organizacaoId, id);
  if (!ok) return { ok: false, erro: "Rascunho não encontrado — talvez já tenha sido excluído." };
  revalidatePath(ROTA);
  return { ok: true };
}

/**
 * Salvar + agendar num passo só: o que vai para a fila é exatamente o que
 * está na tela. `quandoIso` nulo = enviar agora (o worker passa a cada minuto).
 * As travas aqui são as que o worker não conseguiria resolver sozinho: sem
 * sessão, sem e-mail do sistema ou sem ninguém na lista, a campanha inteira
 * viraria falha.
 */
export async function acaoAgendarCampanha(
  id: string | null, entrada: EntradaCampanha, quandoIso: string | null,
): Promise<Resultado<{ id: string }>> {
  const ctx = await getTenantContext();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  if (!(await podeGerirCampanhas(ctx))) return { ok: false, erro: SEM_PERMISSAO_CAMPANHAS };
  const e = normalizar(entrada);
  const invalido = validarCampanha(e);
  if (invalido) return { ok: false, erro: invalido };

  let quando: Date | null = null;
  if (quandoIso) {
    quando = new Date(quandoIso);
    if (Number.isNaN(quando.getTime())) return { ok: false, erro: "Data de agendamento inválida." };
    if (quando.getTime() < Date.now() - 60_000) return { ok: false, erro: "Escolha um horário no futuro, ou use Enviar agora." };
  }
  if (e.canal === "whatsapp") {
    const sessoes = await sessoesWhatsapp(ctx.organizacaoId);
    if (!sessoes.some((s) => s.id === e.remetente)) return { ok: false, erro: "Escolha a sessão de WhatsApp que assina o disparo." };
  } else if (!isResendConfigured()) {
    return { ok: false, erro: "O e-mail do sistema (Resend) não está configurado neste ambiente: nenhum e-mail sairia. Salve como rascunho." };
  }
  if ((await contarDestinatarios(ctx.organizacaoId, e.listas, e.canal)) === 0) {
    return { ok: false, erro: `Ninguém nas listas escolhidas tem ${e.canal === "whatsapp" ? "telefone" : "e-mail"}.` };
  }

  const r = await executar("agendar campanha", async () => {
    const salvo = id
      ? ((await atualizarRascunho(ctx.organizacaoId, id, e)) ? id : null)
      : await criarRascunho(ctx.organizacaoId, ctx.userId, e);
    if (!salvo) return { id: null };
    const ok = await agendarCampanha(ctx.organizacaoId, salvo, quando);
    revalidatePath(ROTA);
    return { id: ok ? salvo : null };
  });
  if (!r.ok) return r;
  if (!r.dados?.id) return { ok: false, erro: "Rascunho não encontrado ou já agendado." };
  return { ok: true, dados: { id: r.dados.id } };
}

const ERRO_TRANSICAO: Record<Transicao, string> = {
  cancelar: "Só dá para cancelar campanha agendada que ainda não começou.",
  pausar: "Só dá para pausar campanha em envio.",
  retomar: "Só dá para retomar campanha pausada.",
};

export async function acaoTransicionarCampanha(id: string, t: Transicao): Promise<Resultado> {
  const ctx = await getTenantContext();
  if (!ctx) return { ok: false, erro: "Sessão expirada." };
  if (!(await podeGerirCampanhas(ctx))) return { ok: false, erro: SEM_PERMISSAO_CAMPANHAS };
  if (!(t in ERRO_TRANSICAO)) return { ok: false, erro: "Ação desconhecida." };
  const ok = await transicionarCampanha(ctx.organizacaoId, id, t);
  if (!ok) return { ok: false, erro: ERRO_TRANSICAO[t] };
  revalidatePath(ROTA);
  revalidatePath(`${ROTA}/${id}`);
  return { ok: true };
}
