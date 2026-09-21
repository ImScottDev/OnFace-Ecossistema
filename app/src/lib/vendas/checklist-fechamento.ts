/**
 * Checklist de fechamento do drawer (Documento Mestre v0.13, §02.4).
 *
 * O documento é específico sobre o que a tela mostra:
 *
 *     Proposta aceita            ✓
 *     Contrato assinado          ✓ / —
 *     Pagamento                  Pendente / ✓
 *     Regra desta oferta         "ganha na assinatura" / "ganha no pagamento"
 *
 * E é específico sobre por quê: "O vendedor NÃO precisa clicar 'Tentar fechar
 * como ganho'. Won deve acontecer automaticamente quando a evidência exigida
 * pela oferta comercial chegar." O checklist responde a pergunta que sobra —
 * *o que ainda falta para esta venda fechar?* — sem transformar isso num botão.
 *
 * NADA AQUI DECIDE GANHO. A decisão é de `avaliarGanho`, no domínio, e este
 * arquivo só a explica. Reimplementar o critério aqui criaria a segunda regra
 * de Won, que é exatamente o que o Módulo 04 proíbe: "Nenhuma UI, webhook,
 * worker ou integração decide Won por regra própria."
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { avaliarGanho, type CondicaoGanho } from "@onface/catalog";

export type EstadoItem = "ok" | "pendente" | "nao_se_aplica";

export interface ItemFechamento {
  codigo: "proposta" | "contrato" | "pagamento";
  rotulo: string;
  estado: EstadoItem;
  /** O que a tela mostra ao lado do rótulo. */
  detalhe: string;
}

export interface ChecklistFechamento {
  /** A regra da oferta, em português. */
  regra: string;
  ofertaCodigo: string | null;
  itens: ItemFechamento[];
  /** Já fechou? Quando sim, o checklist é histórico. */
  ganha: boolean;
  /** O que ainda falta, segundo o domínio — não segundo esta tela. */
  falta: string[];
}

const FRASE_DA_CONDICAO: Record<CondicaoGanho, string> = {
  PAYMENT_CONFIRMED: "esta oferta ganha quando o pagamento é confirmado",
  CONTRACT_FULLY_SIGNED: "esta oferta ganha quando o contrato é assinado por todas as partes",
  MANUAL_APPROVAL: "esta oferta ganha por aprovação manual registrada",
};

interface Linha extends Record<string, unknown> {
  oportunidade_id: string | null;
  ganha: boolean;
  oferta_id: string | null;
  oferta_codigo: string | null;
  win_condition: string | null;
  requires_contract: boolean | null;
  requires_company: boolean | null;
  payment_trigger: string | null;
  onboarding_required: boolean | null;
  implementation_required: boolean | null;
  permite_trial: boolean | null;
  tem_empresa: boolean;
  proposta_aceita: boolean;
  contrato_assinado: boolean;
  pagamento_confirmado: boolean;
  aprovacao_manual: boolean;
}

/**
 * Recebe o id do NEGÓCIO legado, que é por onde a tela abre o detalhe hoje, e
 * resolve a oportunidade canônica a partir dele.
 */
export async function checklistDeFechamento(
  organizacaoId: string, negocioId: string,
): Promise<ChecklistFechamento | null> {
  const [l] = await db.execute<Linha>(sql`
    SELECT o.id::text AS oportunidade_id,
           (o.ganho_at IS NOT NULL) AS ganha,
           oc.id::text AS oferta_id, oc.codigo AS oferta_codigo,
           oc.win_condition, oc.requires_contract,
           oc.requires_company_before_proposal AS requires_company,
           oc.payment_trigger, oc.onboarding_required, oc.implementation_required,
           oc.permite_trial,
           (o.empresa_id IS NOT NULL) AS tem_empresa,
           EXISTS (SELECT 1 FROM propostas p
                    WHERE (p.oportunidade_id = o.id OR p.negocio_id = ${negocioId}::uuid)
                      AND p.aceita_em IS NOT NULL) AS proposta_aceita,
           EXISTS (SELECT 1 FROM contratos c
                    WHERE (c.oportunidade_id = o.id OR c.negocio_id = ${negocioId}::uuid)
                      AND lower(coalesce(c.status,'')) IN ('fully_signed','assinado','ativo')) AS contrato_assinado,
           EXISTS (SELECT 1 FROM pagamentos pg
                     JOIN faturas f ON f.id = pg.fatura_id
                    WHERE f.empresa_id = o.empresa_id
                      AND upper(coalesce(pg.status,'')) IN ('PAGO','PAID','SUCCEEDED')) AS pagamento_confirmado,
           EXISTS (SELECT 1 FROM comercial_evidencia ce
                    WHERE ce.negocio_id = ${negocioId}::uuid
                      AND upper(coalesce(ce.tipo,'')) LIKE '%APROVACAO%') AS aprovacao_manual
      FROM oportunidades o
      LEFT JOIN ofertas_comerciais oc ON oc.id = o.oferta_comercial_id
     WHERE o.negocio_id_legado = ${negocioId}::uuid
       AND o.organizacao_id = ${organizacaoId}::uuid
     LIMIT 1`);

  if (!l) return null;

  // Sem oferta vinculada não se inventa política: 1.085 oportunidades ainda
  // estão sem oferta, e supor uma regra de ganho para elas seria decidir
  // fechamento por palpite.
  if (!l.oferta_id || !l.win_condition) {
    return {
      regra: "esta oportunidade ainda não tem oferta comercial vinculada, " +
             "então a regra de fechamento dela não está definida",
      ofertaCodigo: null,
      ganha: l.ganha,
      falta: ["oferta comercial vinculada"],
      itens: [
        { codigo: "proposta", rotulo: "Proposta aceita", estado: l.proposta_aceita ? "ok" : "pendente", detalhe: l.proposta_aceita ? "aceita" : "sem aceite registrado" },
        { codigo: "contrato", rotulo: "Contrato assinado", estado: l.contrato_assinado ? "ok" : "pendente", detalhe: l.contrato_assinado ? "assinado" : "sem assinatura completa" },
        { codigo: "pagamento", rotulo: "Pagamento", estado: l.pagamento_confirmado ? "ok" : "pendente", detalhe: l.pagamento_confirmado ? "confirmado" : "pendente" },
      ],
    };
  }

  const oferta = {
    id: l.oferta_id, codigo: l.oferta_codigo ?? "",
    requiresCompanyBeforeProposal: Boolean(l.requires_company),
    requiresContract: Boolean(l.requires_contract),
    winCondition: l.win_condition as CondicaoGanho,
    paymentTrigger: (l.payment_trigger ?? "MANUAL") as never,
    onboardingRequired: Boolean(l.onboarding_required),
    implementationRequired: Boolean(l.implementation_required),
    permiteTrial: Boolean(l.permite_trial),
  };

  // A decisão vem do DOMÍNIO. Esta tela só a explica.
  const decisao = avaliarGanho(oferta, {
    temEmpresa: l.tem_empresa,
    propostaAceita: l.proposta_aceita,
    contratoAssinadoPorCompleto: l.contrato_assinado,
    pagamentoConfirmado: l.pagamento_confirmado,
    aprovacaoManual: l.aprovacao_manual,
  });

  const itens: ItemFechamento[] = [
    {
      codigo: "proposta", rotulo: "Proposta aceita",
      estado: l.proposta_aceita ? "ok" : "pendente",
      detalhe: l.proposta_aceita ? "aceita" : "sem aceite registrado",
    },
    {
      codigo: "contrato", rotulo: "Contrato assinado",
      // Oferta que não exige contrato mostra "—", não "pendente": pendente
      // sugere que falta algo, e não falta.
      estado: !oferta.requiresContract ? "nao_se_aplica" : l.contrato_assinado ? "ok" : "pendente",
      detalhe: !oferta.requiresContract ? "esta oferta não exige contrato"
        : l.contrato_assinado ? "assinado por todas as partes" : "sem assinatura completa",
    },
    {
      codigo: "pagamento", rotulo: "Pagamento",
      estado: l.pagamento_confirmado ? "ok" : "pendente",
      // Ganho na assinatura com pagamento pendente é estado NORMAL (§04):
      // a venda fecha e a cobrança segue em aberto no Financeiro.
      detalhe: l.pagamento_confirmado ? "confirmado"
        : oferta.winCondition === "CONTRACT_FULLY_SIGNED"
          ? "pendente — esta oferta fecha na assinatura, e a cobrança segue no Financeiro"
          : "pendente",
    },
  ];

  return {
    regra: FRASE_DA_CONDICAO[oferta.winCondition],
    ofertaCodigo: oferta.codigo,
    ganha: l.ganha,
    falta: decisao.ganha ? [] : (decisao.falta ?? []),
    itens,
  };
}
