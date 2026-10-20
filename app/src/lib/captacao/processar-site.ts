/**
 * Formulário do site (site.callface.io): leitura do corpo e processamento de
 * UMA submissão, depois que a entrega já foi aberta na caixa de entrada.
 *
 * Extraído de `app/api/webhooks/site-lead/route.ts` sem mudar o que faz: o
 * webhook valida com `lerFormularioSite` e processa com
 * `processarFormularioSite`; o reprocessamento manual de uma entrega que
 * falhou (`reprocessar.ts`) chama as MESMAS funções com o corpo guardado.
 */
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { syncPessoaFromLead } from "@/lib/crm/sync-domain-model";
import { criarLead, garantirAtividadePrimeiroContato } from "@/lib/vendas/pre-vendas";
import { ATOR_SISTEMA } from "@/lib/vendas/dominio";
import { dominioDoEmail } from "@/lib/vendas/identidade";
import { telefoneUsavel } from "@/lib/whatsapp/phone-utils";
import { garantirEntradaCanonica, travarEntrada, acharLeadPorContato } from "@/lib/vendas/ponte-canonica";
import { resolverEmpresaId, dominioCorporativo } from "@/lib/crm/resolver-empresa";
import { respostasDoFormularioDoSite } from "@/lib/vendas/respostas-formulario";
import { fecharEntrega } from "./entregas";

export function clean(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t.slice(0, 300) : null;
}

/** Mescla as respostas no `campos_custom` do lead sem apagar o que já está lá
 *  (qualificação, custom de Ajustes): a resposta do formulário manda no conflito. */
async function guardarRespostas(leadId: string, respostas: Record<string, string>) {
  if (Object.keys(respostas).length === 0) return;
  await db
    .update(leads)
    .set({
      camposCustom: sql`COALESCE(${leads.camposCustom}, '{}'::jsonb) || ${JSON.stringify(respostas)}::jsonb`,
      updatedAt: new Date(),
    })
    .where(eq(leads.id, leadId));
}

export type RespostaSite = { status: number; corpo: Record<string, unknown> };
export type CamposSite = {
  nome: string; primeiro: string; sobrenome: string | null; email: string | null; telefone: string | null;
  cargo: string | null; empresa: string | null; respostas: Record<string, string>;
};

/** Honeypot, validação e nome/sobrenome. `ok: false` traz a resposta que o webhook devolve. */
export function lerFormularioSite(body: Record<string, unknown>): { ok: true; campos: CamposSite } | { ok: false; resposta: RespostaSite } {
  // Honeypot: bots preenchem o campo oculto "website" → finge sucesso e ignora
  if (clean(body.website)) {
    return { ok: false, resposta: { status: 200, corpo: { ok: true, skipped: "honeypot" } } };
  }

  const nome = clean(body.nome);
  const email = clean(body.email)?.toLowerCase() ?? null;
  // Mesmo lixo do RD pode chegar por aqui (bug de template no form manda "undefined").
  const telefone = telefoneUsavel(clean(body.telefone));
  const cargo = clean(body.cargo);
  const empresa = clean(body.empresa);
  const respostas = respostasDoFormularioDoSite(body);

  if (!nome) {
    return { ok: false, resposta: { status: 422, corpo: { ok: false, error: "nome é obrigatório" } } };
  }
  if (!email && !telefone) {
    return { ok: false, resposta: { status: 422, corpo: { ok: false, error: "informe email ou telefone" } } };
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, resposta: { status: 422, corpo: { ok: false, error: "email inválido" } } };
  }

  // Bloqueia o feed de "descoberta"/scraping: essas fontes mandam o e-mail como
  // se fosse o nome (nome = "fulano@dominio.com"), sem nome real de pessoa. O
  // formulário legítimo do site sempre tem nome. Finge sucesso (não retenta) e ignora.
  if (/^[^\s]+@[^\s]+\.[^\s]+$/.test(nome) || (email && nome.trim().toLowerCase() === email)) {
    return { ok: false, resposta: { status: 200, corpo: { ok: true, skipped: "sem-nome-real" } } };
  }

  // separa nome / sobrenome
  const partes = nome.split(/\s+/);
  const primeiro = partes.shift() || nome;
  const sobrenome = partes.length ? partes.join(" ") : null;
  return { ok: true, campos: { nome, primeiro, sobrenome, email, telefone, cargo, empresa, respostas } };
}

export async function processarFormularioSite(entrada: {
  organizacaoId: string; body: Record<string, unknown>; campos: CamposSite; entregaId: string | null;
  responsavelInboundId: string | null; ipAddress: string | null; userAgent: string | null; landingPage: string | null;
}): Promise<RespostaSite> {
  const { organizacaoId, body, entregaId, responsavelInboundId, ipAddress, userAgent, landingPage } = entrada;
  const { primeiro, sobrenome, email, telefone, cargo, empresa, respostas } = entrada.campos;
  const soltarEntrada = await travarEntrada(organizacaoId, email, telefone);
  try {
  const achado = await acharLeadPorContato(organizacaoId, email, telefone);
  const existing = achado && {
    id: achado.id, tipo: achado.tipo,
    responsavelId: achado.responsavelId, empresaId: achado.empresaId,
  };

  // Empresa como entidade, não só texto (senão o lead entra sem vínculo no drawer).
  const empresaIdResolvida = await resolverEmpresaId({
    organizacaoId,
    nome: empresa,
    website: dominioCorporativo(email),
  });

  if (existing) {
    await fecharEntrega(entregaId, { status: "duplicada", leadId: existing.id });
    if (existing.tipo === "cliente") {
      return { status: 200, corpo: { ok: true, status: "already-client", leadId: existing.id } };
    }
    await db
      .update(leads)
      .set({
        empresa: empresa ?? undefined,
        // Não sobrescreve vínculo já existente.
        ...(empresaIdResolvida
          ? { empresaId: sql`COALESCE(${leads.empresaId}, ${empresaIdResolvida}::uuid)` }
          : {}),
        cargo: cargo ?? undefined,
        telefone: telefone ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, existing.id));
    await guardarRespostas(existing.id, respostas);
    await syncPessoaFromLead(existing.id); // F1/dual-write, best-effort
    await garantirAtividadePrimeiroContato({
      organizacaoId,
      leadId: existing.id,
      empresaId: existing.empresaId,
      responsavelId: existing.responsavelId ?? responsavelInboundId,
    });
    return { status: 200, corpo: { ok: true, status: "updated", leadId: existing.id } };
  }

  // O formulário publicado ainda não pergunta a empresa. Quando ela não vem, o
  // domínio corporativo do e-mail é o único identificador confiável disponível;
  // e-mail pessoal não identifica empresa nenhuma, então o lead entra sem ela e
  // a tela pede a associação antes de qualquer passo que exija Empresa.
  // Registrado como dependência em docs/produto/modulo-01-vendas-implementacao.md.
  const dominio = dominioDoEmail(email);
  const nomeEmpresa = empresa ?? (dominio ? dominio.split(".")[0] : null);

  const criado = await criarLead({
    organizacaoId,
    empresa: nomeEmpresa ? { nome: nomeEmpresa, dominio, email } : null,
    pessoa: { nome: primeiro, sobrenome, email, telefone, cargo },
    touchpoint: {
      tipoOrigem: "organica",
      source: clean(body.utmSource) ?? "site",
      medium: clean(body.utmMedium),
      campaign: clean(body.utmCampaign),
      term: clean(body.utmTerm),
      content: clean(body.utmContent),
      landingPage,
      raw: { ipAddress, userAgent },
    },
    origem: "Site",
    // A política é resolvida dentro do motor, que também cria a atividade de
    // primeiro contato ligada ao responsável escolhido.
    responsavelId: null,
    // Regra de distribuição por campanha/formulário (0131).
    atribuicao: {
      origem: "Site",
      utmSource: clean(body.utmSource) ?? "site",
      utmCampaign: clean(body.utmCampaign),
      formulario: clean(body.formulario) ?? clean(body.formId),
    },
  }, ATOR_SISTEMA);
  await fecharEntrega(entregaId, {
    status: criado.reaproveitado ? "duplicada" : "processada",
    leadId: criado.leadId, regraId: criado.distribuicaoRegraId ?? null,
  });

  // As respostas vão para o lead depois de criado: `criarLead` não grava
  // `campos_custom` (e pode devolver um lead já aberto, que também recebe).
  await guardarRespostas(criado.leadId, respostas);

  // CUTOVER (fase 16): o mesmo fato no modelo canônico. `criarLead` acima já é
  // o motor canônico do CRM atual; esta chamada acrescenta aquisição, touchpoint
  // e evento de domínio, que ele não produz. Sai na fase 25.
  await garantirEntradaCanonica({
    organizacaoId,
    tipo: "INBOUND",
    origem: "Site",
    provider: "site",
    pessoa: { nome: primeiro, sobrenome, email, telefone, cargo },
    empresa: nomeEmpresa ? { nome: nomeEmpresa, dominio } : null,
    atribuicao: {
      utmSource: clean(body.utmSource), utmMedium: clean(body.utmMedium),
      utmCampaign: clean(body.utmCampaign), utmTerm: clean(body.utmTerm),
      utmContent: clean(body.utmContent), landingPage,
    },
    idempotencyKey: email ? `site:${organizacaoId}:${email}` : null,
  }, criado.leadId);

  return { status: 201, corpo: { ok: true, status: "created", leadId: criado.leadId, empresaId: criado.empresaId } };
  } catch (e) {
    await fecharEntrega(entregaId, { status: "falhou", erro: e });
    throw e;
  } finally {
    soltarEntrada();
  }
}
