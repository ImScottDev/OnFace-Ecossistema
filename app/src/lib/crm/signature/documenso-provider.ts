import { garantirDestinoPermitido } from "@/lib/email/trava-destino";
import { db } from "@/lib/db";
import { contratos, leads } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { contratoPdfHtml, renderContratoPdf, localizarAncoras } from "@/lib/crm/contrato-pdf";
import { politicaContratual } from "@/lib/crm/contrato-politica";
import { fetchComPrazo } from "@/lib/rede/fetch-com-prazo";
import {
  ANCORA_DO_PAPEL, comPadraoDaPolitica, ehCliente, ehPapelCallface, emailValido, faltaRepresentante, normalizarSignatarios, PAPEL_TESTEMUNHA_2, type Signatario,
} from "@/lib/crm/proposta-signatarios";
import type {
  ConfirmarAssinaturaResult,
  EnviarParaAssinaturaOpts,
  EnviarParaAssinaturaResult,
  SignatureProvider,
  SignatureRecipient,
  SignatureStatus,
} from "@/lib/crm/signature/provider";

type DocumensoResponse = Record<string, unknown>;

function baseUrl(): string {
  return (process.env.DOCUMENSO_API_URL || "https://app.documenso.com/api/v2").replace(/\/$/, "");
}

function apiKey(): string {
  return process.env.DOCUMENSO_API_TOKEN || "";
}

/** URL da app web do Documenso (onde o signatário assina), não da API.
 *  O link de assinatura é `${webAppUrl}/sign/${token}`. Deriva de
 *  DOCUMENSO_PUBLIC_URL quando existe; senão tira o sufixo `/api/vN` da
 *  DOCUMENSO_API_URL (ex.: https://sign.callface.io/api/v2 -> .../). */
function webAppUrl(): string {
  const explicit = process.env.DOCUMENSO_PUBLIC_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  return baseUrl().replace(/\/api\/v\d+$/, "");
}

/** Monta a signingUrl do destinatário a partir do que o Documenso devolve.
 *  O `/envelope/distribute` do v2 pode trazer a URL pronta (`signingUrl`) OU
 *  só o `token`/`signingToken` — neste caso montamos `${webApp}/sign/${token}`.
 *  Sem nenhum dos dois, fica null (e a página pública trata como "link ainda
 *  não disponível", nunca cai no formulário simples que daria erro). */
function signingUrlDe(item: Record<string, unknown>): string | null {
  if (item.signingUrl) return String(item.signingUrl);
  const token = item.token || item.signingToken;
  if (token) return `${webAppUrl()}/sign/${encodeURIComponent(String(token))}`;
  return null;
}

function recipientsFrom(value: unknown): SignatureRecipient[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item, index) => ({
      nome: String(item.nome || item.name || "").trim(),
      email: String(item.email || "").trim(),
      papel: item.papel ? String(item.papel) : null,
      ordem: typeof item.ordem === "number" ? item.ordem : index + 1,
      signingUrl: signingUrlDe(item),
    }))
    .filter((item) => item.nome && item.email);
}

type Campo = Record<string, unknown>;
type Area = { pagina: number; x: number; y: number; largura: number; altura: number };

/**
 * Destinatários do envelope e o campo de assinatura de cada um, no bloco certo do PDF:
 * quem representa o cliente assina em `cf-sig-contratante`; o representante legal da Callface
 * em `cf-sig-contratada`; as testemunhas em `cf-sig-testemunha-1` (vendedor) e `-2`. Só assina
 * quem tem e-mail; a testemunha só com nome continua impressa no documento (variável do modelo).
 *
 * Quem o cliente acrescenta além do primeiro é TESTEMUNHA, e assina no bloco
 * de testemunhas — não espremido na linha do CONTRATANTE. Antes, todos os
 * signatários do cliente repartiam a largura de `cf-sig-contratante`: duas
 * pessoas viravam duas caixas lado a lado em cima do nome da empresa, como se
 * ambas a representassem. A segunda coluna de testemunhas existe justamente
 * para o lado do cliente (a primeira é do vendedor da Callface).
 */
export function montarDestinatarios(todos: Signatario[], ancoras: Record<string, Area>): Record<string, unknown>[] {
  const clientes = todos.filter(ehCliente);
  if (clientes.length === 0) throw new Error("Contrato sem signatários válidos para o Documenso");
  const faltaRep = faltaRepresentante(todos);
  if (faltaRep) throw new Error(faltaRep);
  const alvo = ancoras["cf-sig-contratante"];
  if (!alvo) throw new Error("O modelo do contrato não tem o bloco de assinatura do CONTRATANTE (âncora cf-sig-contratante); corrija em Ajustes > Contratos");

  /* O bloco das testemunhas do cliente, quando existe no modelo e a Callface
     não o está usando com uma segunda testemunha própria. Sem ele, o
     comportamento antigo continua valendo: melhor dividir a caixa do que
     deixar alguém sem lugar para assinar. */
  const callfaceUsaTestemunha2 = todos.some((s) => String(s.papel) === PAPEL_TESTEMUNHA_2 && emailValido(s.email));
  const blocoTestemunhaDoCliente = callfaceUsaTestemunha2 ? undefined : ancoras["cf-sig-testemunha-2"];
  const noContratante = blocoTestemunhaDoCliente ? clientes.slice(0, 1) : clientes;
  const testemunhasDoCliente = blocoTestemunhaDoCliente ? clientes.slice(1) : [];
  const fatia = alvo.largura / Math.max(noContratante.length, 1);
  const campo = (a: Area, x = a.x, largura = a.largura): Campo => ({
    identifier: 0, type: "SIGNATURE", page: a.pagina, positionX: x, positionY: a.y, width: largura, height: a.altura,
  });
  // Uma pessoa = um campo. `normalizarSignatarios` já tira o e-mail repetido; aqui é a última barreira.
  const porEmail = new Map<string, Record<string, unknown>>();
  const adiciona = (s: Signatario, ordem: number, f: Campo) => {
    const chave = s.email.toLowerCase();
    const ja = porEmail.get(chave);
    if (ja) return;
    porEmail.set(chave, { email: s.email, name: s.nome, role: "SIGNER", signingOrder: ordem, fields: [f] });
  };
  todos.filter((s) => emailValido(s.email) && (ehCliente(s) || ehPapelCallface(s.papel))).forEach((s, index) => {
    const ordem = index + 1;
    if (ehCliente(s)) {
      const comoTestemunha = testemunhasDoCliente.indexOf(s);
      if (comoTestemunha >= 0 && blocoTestemunhaDoCliente) {
        const t = blocoTestemunhaDoCliente;
        const parte = t.largura / testemunhasDoCliente.length;
        adiciona(s, ordem, campo(t, t.x + comoTestemunha * parte, Math.max(parte - 1, 8)));
        return;
      }
      adiciona(s, ordem, campo(alvo, alvo.x + noContratante.indexOf(s) * fatia, Math.max(fatia - 1, 8)));
      return;
    }
    const nomeAncora = ANCORA_DO_PAPEL[String(s.papel)];
    const a = ancoras[nomeAncora];
    if (!a) throw new Error(`O modelo do contrato não tem o bloco de assinatura de ${s.nome} (âncora ${nomeAncora}); corrija em Ajustes > Contratos`);
    adiciona(s, ordem, campo(a));
  });
  return [...porEmail.values()];
}

/**
 * Adapter real para Documenso V2. Ele só é selecionado quando as credenciais
 * estão configuradas; sem elas, o CRM continua com o provider simples local.
 * O domínio continua falando apenas SignatureProvider.
 */
export class DocumensoSignatureProvider implements SignatureProvider {
  readonly nome = "documenso";

  private async request(path: string, init: RequestInit): Promise<DocumensoResponse> {
    const response = await fetchComPrazo(`${baseUrl()}${path}`, {
      ...init,
      headers: { Authorization: apiKey(), ...(init.headers || {}) },
    });
    const body = await response.json().catch(() => ({})) as DocumensoResponse;
    if (!response.ok) throw new Error(`Documenso ${response.status}: ${String(body.message || body.error || "erro na API")}`);
    return body;
  }

  async enviarParaAssinatura(contratoId: string, opts?: EnviarParaAssinaturaOpts): Promise<EnviarParaAssinaturaResult> {
    const [row] = await db
      .select({ id: contratos.id, organizacaoId: contratos.organizacaoId, descricao: contratos.descricao, corpoGerado: contratos.corpoGerado, variaveis: contratos.variaveisPreenchidas, signatarios: contratos.signatarios })
      .from(contratos)
      .where(eq(contratos.id, contratoId))
      .limit(1);
    if (!row) throw new Error("Contrato não encontrado para envio ao Documenso");

    // A fonte é o que a PROPOSTA coletou (contratos.signatarios). Os Parâmetros de
    // Ajustes > Contratos só entram como padrão do representante legal.
    const politica = await politicaContratual(row.organizacaoId);
    const todos = comPadraoDaPolitica(normalizarSignatarios(opts?.signatarios || row.signatarios), politica);
    // O PDF vai pronto: cabeçalho com Nº em toda folha, rodapé paginado, sem selo.
    const numero = String((row.variaveis as Record<string, unknown> | null)?.contrato_numero ?? "") || null;
    const pdf = await renderContratoPdf(contratoPdfHtml({ corpoGerado: row.corpoGerado, numero }), numero);
    // Os campos de assinatura caem sobre o bloco de assinaturas do próprio
    // documento (âncoras `cf-sig-*`), na página em que a quebra o colocou.
    const recipients = montarDestinatarios(todos, localizarAncoras(pdf));
    garantirDestinoPermitido(recipients.map((r) => String(r.email)));
    const titulo = opts?.titulo || row.descricao || `Contrato Callface ${numero ?? contratoId.slice(0, 8)}`;
    const payload = {
      type: "DOCUMENT",
      title: titulo,
      externalId: `callface-contrato-${contratoId}`,
      visibility: "EVERYONE",
      recipients,
      meta: {
        subject: `Assine: ${titulo}`,
        message: "Revise o documento e assine com segurança. Você receberá uma cópia após a conclusão.",
      },
    };
    const form = new FormData();
    form.append("payload", JSON.stringify(payload));
    form.append("files", new Blob([new Uint8Array(pdf)], { type: "application/pdf" }), `${titulo.replace(/[\\/:*?"<>|]+/g, "").trim()}.pdf`);
    const created = await this.request("/envelope/create", { method: "POST", body: form });
    const providerRef = String(created.envelopeId || created.id || "");
    if (!providerRef) throw new Error("Documenso não devolveu envelopeId");

    // O envelope nasce em DRAFT. Sem esta segunda chamada o cliente nunca
    // recebe o convite e o CRM ficaria com um status enganoso de enviado.
    const distributed = await this.request("/envelope/distribute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ envelopeId: providerRef, meta: { language: "pt-BR" } }),
    });
    const distributedRecipients = recipientsFrom(distributed.recipients);
    // O papel e a ordem são nossos (o Documenso devolve papel vazio); o link é dele.
    const recipientsPersistidos = todos.map((recipient, index) => ({
      ...recipient,
      ...(emailValido(recipient.email) ? distributedRecipients.find((item) => item.email.toLowerCase() === recipient.email.toLowerCase()) || {} : {}),
      papel: recipient.papel ?? null,
      ordem: recipient.ordem || index + 1,
    }));

    await db.update(contratos).set({
      signatureProviderRef: providerRef,
      signatureStatus: "sent_for_signature",
      assinaturaStatus: "pendente",
      signatarios: recipientsPersistidos,
      updatedAt: new Date(),
    }).where(eq(contratos.id, contratoId));
    return { providerRef, status: "sent_for_signature" };
  }

  async registrarAbertura(providerRef: string): Promise<SignatureStatus> {
    const [contract] = await db.select({ id: contratos.id, signatureStatus: contratos.signatureStatus }).from(contratos).where(eq(contratos.signatureProviderRef, providerRef)).limit(1);
    if (contract && contract.signatureStatus === "sent_for_signature") await db.update(contratos).set({ signatureStatus: "opened", updatedAt: new Date() }).where(eq(contratos.id, contract.id));
    return "opened";
  }

  async confirmarAssinatura(): Promise<ConfirmarAssinaturaResult> {
    throw new Error("Documenso confirma assinaturas pelo webhook DOCUMENT_SIGNED/DOCUMENT_COMPLETED");
  }
}

export function isDocumensoConfigured(): boolean {
  // A Callface usa somente a instância self-hosted. Exigir a URL explícita
  // evita que um token seja enviado por engano para o Documenso Cloud.
  return Boolean(apiKey() && process.env.DOCUMENSO_API_URL);
}

/** Baixa o PDF assinado somente depois que o envelope foi concluído. */
export async function baixarDocumentoAssinado(providerRef: string): Promise<{ buffer: ArrayBuffer; filename: string }> {
  if (!isDocumensoConfigured()) throw new Error("Documenso não configurado");
  const response = await fetchComPrazo(`${baseUrl()}/envelope/${encodeURIComponent(providerRef)}`, {
    headers: { Authorization: apiKey() },
  });
  const envelope = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(`Documenso ${response.status}: envelope não encontrado`);
  if (envelope.status !== "COMPLETED") throw new Error("O contrato ainda não foi concluído no Documenso");
  const items = Array.isArray(envelope.envelopeItems) ? envelope.envelopeItems : [];
  const item = items.find((value): value is Record<string, unknown> => !!value && typeof value === "object");
  const itemId = item?.id;
  if (!itemId) throw new Error("Documenso não devolveu o item PDF do envelope");
  const pdfResponse = await fetchComPrazo(`${baseUrl()}/envelope/item/${encodeURIComponent(String(itemId))}/download?version=signed`, {
    headers: { Authorization: apiKey() },
  });
  if (!pdfResponse.ok) throw new Error(`Documenso ${pdfResponse.status}: PDF assinado indisponível`);
  const filename = typeof envelope.title === "string" && envelope.title.trim()
    ? `${envelope.title.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 100)}-assinado.pdf`
    : `contrato-${providerRef.slice(0, 12)}-assinado.pdf`;
  return { buffer: await pdfResponse.arrayBuffer(), filename };
}
