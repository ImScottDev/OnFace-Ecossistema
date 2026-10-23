/**
 * Implementação Postgres do repositório de vendas.
 *
 * O `estadoDaOportunidade` é a peça delicada: ele responde o que de fato
 * aconteceu com a venda, e é dele que a política de ganho depende. Cada sinal
 * vem de uma prova no banco, nunca de um campo de status que alguém escreveu
 * à mão.
 */
import type { RepositorioVendas, Oportunidade } from "../../../domain/sales/commands/oportunidade";
import type { OfertaComercial, EstadoOportunidade } from "../../../domain/catalog/policies/politica-oferta";

export interface Executor {
  execute<T = unknown>(query: unknown): Promise<T[]>;
}
type SqlTag = (strings: TemplateStringsArray, ...values: unknown[]) => unknown;

export function criarRepositorioVendas(db: Executor, sql: SqlTag): RepositorioVendas {
  const um = async <T>(q: unknown): Promise<T | null> => ((await db.execute<T>(q))[0] ?? null);
  // postgres.js quebra com `Date` cru dentro do template `sql`: o driver tenta
  // medir o byteLength do objeto e estoura. Gotcha já conhecido neste projeto.
  const ts = (d: Date) => d.toISOString();

  return {
    async buscarOportunidade(id) {
      const r = await um<Record<string, unknown>>(sql`
        SELECT id, organizacao_id, empresa_id, pessoa_id, oferta_comercial_id,
               ganho_at, perdido_at, etapa_id_canonico
        FROM (
          SELECT o.*, NULL::uuid AS etapa_id_canonico FROM oportunidades o
        ) x WHERE id = ${id}::uuid`);
      if (!r) return null;
      return {
        id: String(r.id),
        organizacaoId: String(r.organizacao_id),
        empresaId: (r.empresa_id as string) ?? null,
        pessoaPrincipalId: (r.pessoa_id as string) ?? null,
        servicoCatalogoId: null,
        ofertaComercialId: (r.oferta_comercial_id as string) ?? null,
        status: r.ganho_at ? "WON" : r.perdido_at ? "LOST" : "OPEN",
        etapaId: null,
      } satisfies Oportunidade;
    },

    async buscarOferta(id) {
      const r = await um<Record<string, unknown>>(sql`
        SELECT id, codigo, requires_company_before_proposal, requires_contract,
               win_condition, payment_trigger, onboarding_required, implementation_required,
               permite_trial
        FROM ofertas_comerciais WHERE id = ${id}::uuid AND ativo`);
      if (!r) return null;
      return {
        id: String(r.id), codigo: String(r.codigo),
        requiresCompanyBeforeProposal: Boolean(r.requires_company_before_proposal),
        requiresContract: Boolean(r.requires_contract),
        winCondition: r.win_condition as OfertaComercial["winCondition"],
        paymentTrigger: r.payment_trigger as OfertaComercial["paymentTrigger"],
        onboardingRequired: Boolean(r.onboarding_required),
        implementationRequired: Boolean(r.implementation_required),
        permiteTrial: Boolean(r.permite_trial),
      };
    },

    async estadoDaOportunidade(id) {
      // Cada sinal é uma prova, não um campo de status:
      //   empresa      → a oportunidade tem empresa resolvida
      //   proposta     → existe proposta aceita ligada a ela
      //   contrato     → existe contrato com assinatura COMPLETA
      //   pagamento    → fatura PAGA no financeiro OU evidência comercial de
      //                  pagamento (é o webhook do Stripe que grava esta, e ela
      //                  era a única que existia: medido em 23/10/2026, as 230
      //                  evidências de pagamento da base tinham ZERO linha
      //                  correspondente em `pagamentos`/`faturas`, então esta
      //                  prova nunca era verdadeira para venda por checkout e
      //                  nenhuma oferta PAYMENT_CONFIRMED fechava sozinha —
      //                  Sicolos #1587, pago e parado em Negociação)
      //   aprovação    → registro explícito em comercial_evidencia
      const r = await um<Record<string, boolean>>(sql`
        SELECT
          (o.empresa_id IS NOT NULL) AS tem_empresa,
          EXISTS (SELECT 1 FROM propostas p
                   WHERE p.oportunidade_id = o.id AND p.aceita_em IS NOT NULL) AS proposta_aceita,
          EXISTS (SELECT 1 FROM contratos c
                   WHERE c.oportunidade_id = o.id
                     AND lower(coalesce(c.status,'')) IN ('fully_signed','assinado','ativo')) AS contrato_assinado,
          (EXISTS (SELECT 1 FROM pagamentos pg
                   JOIN faturas f ON f.id = pg.fatura_id
                   WHERE pg.status = 'PAID'
                     AND (f.negocio_id = o.negocio_id_legado
                          OR f.empresa_id = o.empresa_id AND f.servico_canonico_id IS NOT NULL))
           OR EXISTS (SELECT 1 FROM comercial_evidencia ce
                   WHERE ce.negocio_id = o.negocio_id_legado
                     AND lower(coalesce(ce.tipo,'')) IN ('stripe_payment','stripe_subscription','financial_attestation'))
          ) AS pagamento_confirmado,
          EXISTS (SELECT 1 FROM comercial_evidencia ce
                   WHERE ce.negocio_id = o.negocio_id_legado
                     AND lower(coalesce(ce.tipo,'')) IN ('admin_approval','aprovacao_manual')) AS aprovacao_manual
        FROM oportunidades o WHERE o.id = ${id}::uuid`);
      return {
        temEmpresa: Boolean(r?.tem_empresa),
        propostaAceita: Boolean(r?.proposta_aceita),
        contratoAssinadoPorCompleto: Boolean(r?.contrato_assinado),
        pagamentoConfirmado: Boolean(r?.pagamento_confirmado),
        aprovacaoManual: Boolean(r?.aprovacao_manual),
      } satisfies EstadoOportunidade;
    },

    async marcarGanha(id, em, motivo) {
      await db.execute(sql`
        UPDATE oportunidades
           SET ganho_at = ${ts(em)}::timestamptz, perdido_at = NULL, stage = 'ganho', updated_at = now()
         WHERE id = ${id}::uuid AND ganho_at IS NULL`);
      await db.execute(sql`
        INSERT INTO timeline_events (organizacao_id, empresa_id, pessoa_id, oportunidade_id,
                                     tipo, titulo, descricao, actor_type, occurred_at, metadata)
        SELECT o.organizacao_id, o.empresa_id, o.pessoa_id, o.id,
               'oportunidade_ganha', 'Oportunidade ganha', ${motivo}, 'SYSTEM', ${ts(em)}::timestamptz,
               jsonb_build_object('motivo', ${motivo}::text)
        FROM oportunidades o WHERE o.id = ${id}::uuid`);
    },

    async marcarPerdida(id, em, motivo) {
      await db.execute(sql`
        UPDATE oportunidades
           SET perdido_at = ${ts(em)}::timestamptz, motivo_perda = ${motivo}, stage = 'perdido', updated_at = now()
         WHERE id = ${id}::uuid AND perdido_at IS NULL`);
      await db.execute(sql`
        INSERT INTO timeline_events (organizacao_id, empresa_id, pessoa_id, oportunidade_id,
                                     tipo, titulo, descricao, actor_type, occurred_at, metadata)
        SELECT o.organizacao_id, o.empresa_id, o.pessoa_id, o.id,
               'oportunidade_perdida', 'Oportunidade perdida', ${motivo}, 'SYSTEM', ${ts(em)}::timestamptz,
               jsonb_build_object('motivo', ${motivo}::text)
        FROM oportunidades o WHERE o.id = ${id}::uuid`);
    },

    async moverEtapa(id, etapaId) {
      // Isto NÃO move etapa nenhuma, e por isso falha alto em vez de fingir.
      //
      // A etapa canônica não existe como dado: `oportunidades.etapa_id` tem
      // zero linhas preenchidas em 1.561 oportunidades, e quem move etapa de
      // verdade é `lib/vendas/pipeline`. A versão anterior deste método só
      // rodava `SET updated_at = now()` — silenciosamente não movia e ainda
      // marcava a oportunidade como recém-alterada, que é como o board já
      // mostrou "17min" em tudo uma vez.
      //
      // Some quando a fase 25 decidir onde a etapa canônica mora.
      void id; void etapaId;
      throw new Error(
        "moverEtapa canônico não implementado: a etapa vive em lib/vendas/pipeline " +
        "e oportunidades.etapa_id não tem dado (fase 25)",
      );
    },

    async criarServicoEJornadas(oportunidadeId, jornadas) {
      // O serviço do cliente nasce da oportunidade ganha (SPEC §17). Se já
      // existir, não se cria outro: ganho idempotente não pode multiplicar
      // serviço.
      const srv = await um<{ id: string }>(sql`
        WITH ja AS (
          SELECT id FROM servicos_canonicos WHERE oportunidade_origem_id = ${oportunidadeId}::uuid LIMIT 1
        ), nova AS (
          INSERT INTO servicos_canonicos (organizacao_id, empresa_id, oportunidade_origem_id,
                                          oferta_comercial_id, service_family, canonical_key,
                                          revenue_nature, billing_source, commercial_lifecycle,
                                          billing_status, confidence)
          SELECT o.organizacao_id, o.empresa_id, o.id, o.oferta_comercial_id,
                 coalesce(o.service_family, 'UNKNOWN'),
                 'op:' || o.id::text,
                 -- Natureza e origem ficam declaradas como vindas do CRM, nao
                 -- adivinhadas: o valor real chega quando a cobranca existir.
                 -- confidence tem vocabulario fechado no banco: CONFIRMED,
                 -- PROBABLE, AMBIGUOUS, UNRESOLVED. Um servico criado a partir
                 -- de uma oportunidade GANHA pela politica e CONFIRMED: existe
                 -- contrato assinado ou pagamento por tras.
                 'UNKNOWN', 'CRM_POSVENDA', 'ACTIVE', 'PENDING', 'CONFIRMED'
          FROM oportunidades o
          WHERE o.id = ${oportunidadeId}::uuid AND o.empresa_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM ja)
          RETURNING id
        )
        SELECT id FROM nova UNION ALL SELECT id FROM ja LIMIT 1`);
      if (!srv) return { servicoId: null, jornadas: 0 };

      let criadas = 0;
      for (const tipo of jornadas) {
        const f = await um<{ id: string }>(sql`
          INSERT INTO fulfillments (organizacao_id, servico_canonico_id, service_family, tipo,
                                    cycle_number, status, started_at)
          SELECT o.organizacao_id, ${srv.id}::uuid, coalesce(o.service_family, 'UNKNOWN'), ${tipo},
                 1, 'NOT_STARTED', now()
          FROM oportunidades o WHERE o.id = ${oportunidadeId}::uuid
          ON CONFLICT DO NOTHING
          RETURNING id`);
        if (f) criadas++;
      }
      return { servicoId: srv.id, jornadas: criadas };
    },
  };
}
