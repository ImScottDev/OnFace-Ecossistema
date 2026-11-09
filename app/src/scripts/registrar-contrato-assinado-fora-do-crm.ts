/**
 * O time fez o contrato na mão, direto no Documenso, e o CRM não sabe que ele existe.
 *
 * Quando o contrato nasce no CRM, o envelope leva `externalId` e o webhook
 * `DOCUMENT_COMPLETED` acha a linha em `contratos` por `signature_provider_ref`,
 * marca assinado e dispara o fechamento. Um envelope criado à mão no Documenso não
 * tem dono do lado do CRM: o webhook chega, não acha contrato, responde 202
 * `unresolved` e vai embora. A venda fica em Negociação com o contrato assinado por
 * todas as partes, não entra no faturamento do mês, não vira cliente e aparece sem
 * comprovante no Relatório de Fechamento.
 *
 * Isto registra o contrato que falta e fecha a venda pelo MESMO caminho da tela
 * (`tentarGanhar` -> `marcarNegocioGanhoSeAindaNao`). Nenhuma regra de ganho mora
 * aqui: quem decide é a política da oferta, lendo o contrato que este script grava.
 *
 * O que ele recusa, em vez de adivinhar:
 *   - envelope que não está COMPLETED no Documenso (não houve assinatura);
 *   - negócio que já está ganho, ou que já tem contrato com aquele envelope;
 *   - mensalidade/setup informados que não batem com o que o negócio estimou
 *     (a divergência é entre o PDF assinado e o CRM, e isso é decisão humana).
 *
 * Não manda e-mail para o cliente: quem coletou as assinaturas foi o time, no
 * Documenso, e o cliente já recebeu o documento por lá.
 *
 *   npx tsx --env-file=.env src/scripts/registrar-contrato-assinado-fora-do-crm.ts \
 *     --negocio <uuid> --envelope envelope_xxx --mrr 2540 --setup 2540 --prazo 36 [--aplicar]
 */
import crypto from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { contratos } from "@/lib/db/schema";
import { isDocumensoConfigured } from "@/lib/crm/signature/documenso-provider";
import { registrarEvidencia } from "@/lib/crm/won-evidence";
import { tentarGanhar } from "@/lib/vendas/pipeline";
import { atorHumano } from "@/lib/vendas/dominio";

function arg(nome: string): string | undefined {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const dinheiro = (v: unknown) => Number.parseFloat(String(v ?? "0"));
const centavos = (v: number) => Math.round(v * 100);

type Recipient = { email?: string; name?: string; role?: string; signingStatus?: string; signedAt?: string | null };

async function lerEnvelope(ref: string) {
  const base = String(process.env.DOCUMENSO_API_URL ?? "").replace(/\/+$/, "");
  const chave = String(process.env.DOCUMENSO_API_TOKEN ?? "");
  const r = await fetch(`${base}/envelope/${encodeURIComponent(ref)}`, { headers: { Authorization: chave } });
  const envelope = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) throw new Error(`Documenso ${r.status}: envelope ${ref} não encontrado`);
  if (envelope.status !== "COMPLETED") throw new Error(`envelope ${ref} está ${String(envelope.status)}, não COMPLETED`);
  const todos = (Array.isArray(envelope.recipients) ? envelope.recipients : []) as Recipient[];
  const assinantes = todos.filter((d) => d.role !== "CC" && d.role !== "VIEWER");
  const faltam = assinantes.filter((d) => d.signingStatus !== "SIGNED" && !d.signedAt);
  if (faltam.length > 0) throw new Error(`envelope ${ref}: ${faltam.length} signatário(s) sem assinar`);
  return {
    titulo: String(envelope.title ?? ref),
    concluidoEm: envelope.completedAt ? new Date(String(envelope.completedAt)) : new Date(),
    assinantes,
  };
}

async function main() {
  const negocioId = arg("negocio");
  const envelopeRef = arg("envelope");
  const mrr = dinheiro(arg("mrr"));
  const setup = dinheiro(arg("setup"));
  const prazo = arg("prazo") ? Number.parseInt(arg("prazo")!, 10) : null;
  const aplicar = process.argv.includes("--aplicar");
  if (!negocioId || !envelopeRef) throw new Error("uso: --negocio <uuid> --envelope <envelope_xxx> --mrr <n> --setup <n> [--prazo <meses>] [--aplicar]");
  if (!isDocumensoConfigured()) throw new Error("Documenso não configurado neste ambiente (DOCUMENSO_API_URL/API_TOKEN)");

  const [negocio] = (await db.execute(sql`
    SELECT n.id::text, n.titulo, n.status, n.etapa, n.organizacao_id::text AS organizacao_id,
           n.lead_id::text AS lead_id, n.empresa_id::text AS empresa_id, n.responsavel_id::text AS responsavel_id,
           n.service_family, n.mrr_estimado, n.valor_projeto,
           o.id::text AS oportunidade_id,
           u.nome AS responsavel_nome, e.nome AS empresa_nome
      FROM negocios n
      LEFT JOIN oportunidades o ON o.negocio_id_legado = n.id
      LEFT JOIN usuarios u ON u.id = n.responsavel_id
      LEFT JOIN empresas e ON e.id = n.empresa_id
     WHERE n.id = ${negocioId}::uuid
  `)) as unknown as Array<Record<string, string | null>>;
  if (!negocio) throw new Error(`negócio ${negocioId} não existe`);
  if (negocio.status === "ganho") throw new Error(`negócio ${negocioId} já está ganho`);
  if (!negocio.empresa_id) throw new Error("negócio sem empresa: vincule a empresa antes (o ganho exige)");

  const [jaTem] = (await db.execute(sql`
    SELECT id::text FROM contratos WHERE signature_provider_ref = ${envelopeRef}
  `)) as unknown as Array<{ id: string }>;
  if (jaTem) throw new Error(`o envelope ${envelopeRef} já está registrado no contrato ${jaTem.id}`);

  // A divergência entre o PDF assinado e o que o CRM estimou é decisão humana, não
  // arredondamento: para quem informou um valor, exige que bata com a estimativa.
  if (centavos(mrr) !== centavos(dinheiro(negocio.mrr_estimado))) {
    throw new Error(`mensalidade informada R$ ${mrr.toFixed(2)} difere da estimada no negócio R$ ${dinheiro(negocio.mrr_estimado).toFixed(2)}`);
  }
  if (centavos(setup) !== centavos(dinheiro(negocio.valor_projeto))) {
    throw new Error(`setup informado R$ ${setup.toFixed(2)} difere do estimado no negócio R$ ${dinheiro(negocio.valor_projeto).toFixed(2)}`);
  }

  const envelope = await lerEnvelope(envelopeRef);
  const nomes = envelope.assinantes.map((d) => d.name?.trim()).filter(Boolean).join(", ");

  console.log(`negócio   ${negocio.titulo?.trim()} (${negocio.service_family}) — ${negocio.empresa_nome}`);
  console.log(`etapa     ${negocio.etapa} / ${negocio.status}`);
  console.log(`envelope  ${envelope.titulo} — concluído ${envelope.concluidoEm.toISOString()}`);
  console.log(`assinaram ${envelope.assinantes.length}: ${nomes}`);
  console.log(`valores   mensalidade R$ ${mrr.toFixed(2)} · setup R$ ${setup.toFixed(2)}${prazo ? ` · ${prazo} meses` : ""}`);
  if (!aplicar) { console.log("\nSIMULAÇÃO — use --aplicar"); process.exit(0); }

  const contratoId = crypto.randomUUID();
  await db.insert(contratos).values({
    id: contratoId,
    organizacaoId: negocio.organizacao_id!,
    leadId: negocio.lead_id!,
    negocioId: negocio.id!,
    oportunidadeId: negocio.oportunidade_id ?? null,
    empresaId: negocio.empresa_id,
    tipo: `${negocio.service_family} · ${envelope.titulo}`.slice(0, 120),
    produto: String(negocio.service_family ?? "").toLowerCase() || null,
    serviceFamily: negocio.service_family,
    status: "ativo",
    assinaturaStatus: "assinado",
    signatureStatus: "signed",
    signatureProvider: "documenso",
    signatureProviderRef: envelopeRef,
    assinadoEm: envelope.concluidoEm,
    assinadoNome: nomes || null,
    signatarios: envelope.assinantes.map((d) => ({ nome: d.name ?? null, email: d.email ?? null, role: d.role ?? null, signedAt: d.signedAt ?? null })),
    documentoFinalUrl: `/api/contratos/${contratoId}/pdf-final`,
    mrr: mrr.toFixed(2),
    valorSetup: setup.toFixed(2),
    ...(prazo ? { prazoMeses: prazo } : {}),
    // A vigência começa no e-mail de ativação, não na assinatura: fica em branco
    // de propósito, em vez de uma data inventada.
    notas: `Contrato assinado no Documenso fora do fluxo do CRM (envelope ${envelopeRef}, "${envelope.titulo}"). Registrado por script para que a venda fechasse pelo caminho normal. Vigência começa no e-mail de ativação.`,
  });
  console.log(`\ncontrato ${contratoId} registrado`);

  /* A evidência é o que a política de Ganho lê, e ela NÃO nasce do contrato existir:
     nasce de alguém registrar a assinatura. No caminho normal quem faz isso é
     `processarContratoAssinado`, chamado pelo webhook do Documenso. Sem este passo o
     negócio continua em Negociação com o contrato assinado na frente — medido no
     ensaio em homologação, onde a política PABX exige `signed_contract` e o fallback
     legado não é alcançado quando a política tem combinação configurada. */
  await registrarEvidencia({
    negocioId: negocio.id!,
    organizacaoId: negocio.organizacao_id!,
    tipo: "signed_contract",
    sourceRef: contratoId,
    metadata: { provider: "documenso", envelope: envelopeRef, origem: "contrato_assinado_fora_do_crm", assinantes: nomes },
  });
  console.log("evidência signed_contract registrada");

  const r = await tentarGanhar({
    organizacaoId: negocio.organizacao_id!,
    negocioId: negocio.id!,
    ator: atorHumano(negocio.responsavel_id ?? null),
  });
  console.log(`ganho: ${r.ganhou ? "SIM" : "NÃO"} — ${r.motivo}`);

  const [depois] = (await db.execute(sql`
    SELECT status, etapa, mrr_fechado, valor_setup, ganho_at FROM negocios WHERE id = ${negocioId}::uuid
  `)) as unknown as Array<Record<string, string | null>>;
  console.log(`negócio   ${depois?.status} / ${depois?.etapa} · MRR R$ ${depois?.mrr_fechado} · setup R$ ${depois?.valor_setup} · ganho em ${depois?.ganho_at}`);

  /* `tentarGanhar` dispara o pós-venda (serviço canônico, entrega, jornada) SEM aguardar:
     numa requisição HTTP o processo continua vivo, num script `process.exit` o mata no meio.
     Espera o serviço aparecer, em vez de dormir um tempo fixo e torcer. */
  let servicos = 0;
  for (let tentativa = 0; tentativa < 20 && servicos === 0; tentativa++) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const [s] = (await db.execute(sql`
      SELECT count(*)::int AS n FROM servicos_canonicos WHERE empresa_id = ${negocio.empresa_id}::uuid
    `)) as unknown as Array<{ n: number }>;
    servicos = s?.n ?? 0;
  }
  console.log(`pós-venda ${servicos > 0 ? `${servicos} serviço(s) canônico(s) na empresa` : "serviço canônico NÃO materializado — conferir à mão"}`);
  process.exit(r.ganhou ? 0 : 1);
}
main().catch((e) => { console.error(`\nERRO: ${e instanceof Error ? e.message : e}`); process.exit(1); });
