-- CARGA MARCO ZERO · passo 07 · financeiro (Stripe e ledger).
-- Mapa: 02_MAPA_CARGA_MARCO_ZERO.md secao 2.7. Depende do passo 03 (empresas,
-- leads), 05 (servicos_canonicos) e 06 (contratos). Roda numa transacao do
-- run.sh (psql --single-transaction), com o schema `legado` do 00_preparar.
--
-- Regras que moram aqui:
--  - billing_identities e aliases entram ANTES do primeiro stripe-sync, senao o
--    sync recria identidades e duplica empresa.
--  - Assinatura Stripe NAO e contrato (P17): os contratos tipo 'assinatura' nao
--    entraram no passo 06, entao assinaturas.contrato_id, faturas.contrato_id e
--    mrr_movimentos.contrato_id so apontam para contrato que EXISTE no destino;
--    o resto fica NULL. A assinatura continua inteira em `assinaturas`.
--  - updated_at e created_at vem de prod, nunca now() (M10).
--  - pagamentos nao existe em prod: e derivado das faturas stripe pagas.
--
-- Idempotente: INSERT ... ON CONFLICT (id) DO UPDATE ... WHERE (linha) IS
-- DISTINCT FROM (nova). Segunda execucao nao toca linha nenhuma.

\set ON_ERROR_STOP on

-- Helper: copia legado.<tabela> para public.<tabela> usando as colunas que existem
-- nos DOIS lados (coluna que so existe no destino toma o default da tabela).
--   filtro      predicado SQL sobre o alias s (linhas que entram)
--   sobrescreve {coluna: 'expressao sql sobre s'} troca ou cria o valor da coluna
-- Devolve quantas linhas foram inseridas ou realmente mudadas.
CREATE FUNCTION pg_temp.mz_carga(tabela text, filtro text DEFAULT 'true', sobrescreve jsonb DEFAULT '{}') RETURNS bigint
LANGUAGE plpgsql AS $f$
DECLARE cols text[]; sel text; lista text; atualiza text; velho text; novo text; n bigint;
BEGIN
  SELECT array_agg(t.column_name::text ORDER BY t.ordinal_position) INTO cols
    FROM information_schema.columns t
   WHERE t.table_schema = 'public' AND t.table_name = tabela
     AND (sobrescreve ? t.column_name::text OR EXISTS (
           SELECT 1 FROM information_schema.columns l
            WHERE l.table_schema = 'legado' AND l.table_name = tabela AND l.column_name = t.column_name));
  SELECT string_agg(quote_ident(c), ', '),
         string_agg(coalesce(sobrescreve->>c, 's.' || quote_ident(c)), ', ')
    INTO lista, sel FROM unnest(cols) c;
  SELECT string_agg(quote_ident(c) || ' = EXCLUDED.' || quote_ident(c), ', '),
         string_agg('t.' || quote_ident(c), ', '), string_agg('EXCLUDED.' || quote_ident(c), ', ')
    INTO atualiza, velho, novo FROM unnest(cols) c WHERE c <> 'id';
  EXECUTE format(
    'INSERT INTO public.%1$I AS t (%2$s) SELECT %3$s FROM legado.%1$I s WHERE %4$s
       ON CONFLICT (id) DO UPDATE SET %5$s WHERE (%6$s) IS DISTINCT FROM (%7$s)',
    tabela, lista, sel, filtro, atualiza, velho, novo);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $f$;

-- Empresa so se ela existe no destino (o merge de CNPJ do passo 03 pode ter
-- removido duplicadas); senao NULL em vez de quebrar a FK.
CREATE FUNCTION pg_temp.emp_ok(e uuid) RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT id FROM public.empresas WHERE id = e $$;

-- ─── 1. Identidades de cobranca (antes de tudo) ────────────────────────────
SELECT 'billing_identities' AS tabela, pg_temp.mz_carga('billing_identities', 'true', jsonb_build_object(
  'empresa_id',           'pg_temp.emp_ok(s.empresa_id)',
  'canonical_empresa_id', 'pg_temp.emp_ok(s.canonical_empresa_id)')) AS linhas;
SELECT 'billing_customer_aliases' AS tabela, pg_temp.mz_carga('billing_customer_aliases') AS linhas;

-- ─── 2. Assinaturas ────────────────────────────────────────────────────────
-- empresa_id: a de prod, senao a do lead, senao a da identidade Stripe do cliente.
SELECT 'assinaturas' AS tabela, pg_temp.mz_carga('assinaturas', 'true', jsonb_build_object(
  'empresa_id', $$pg_temp.emp_ok(coalesce(s.empresa_id,
      (SELECT l.empresa_id FROM public.leads l WHERE l.id = s.lead_id),
      (SELECT b.empresa_id FROM public.billing_identities b
        WHERE b.external_customer_id = s.stripe_customer_id AND b.empresa_id IS NOT NULL LIMIT 1)))$$,
  'contrato_id', '(SELECT c.id FROM public.contratos c WHERE c.id = s.contrato_id)')) AS linhas;

-- ─── 3. Faturas e itens ────────────────────────────────────────────────────
-- empresa_id por COALESCE(fatura, assinatura, lead, identidade Stripe da assinatura).
SELECT 'faturas' AS tabela, pg_temp.mz_carga('faturas', 'true', jsonb_build_object(
  'empresa_id', $$pg_temp.emp_ok(coalesce(s.empresa_id,
      (SELECT a.empresa_id FROM public.assinaturas a WHERE a.id = s.assinatura_id),
      (SELECT l.empresa_id FROM public.leads l WHERE l.id = s.lead_id),
      (SELECT b.empresa_id FROM public.assinaturas a
         JOIN public.billing_identities b ON b.external_customer_id = a.stripe_customer_id AND b.empresa_id IS NOT NULL
        WHERE a.id = s.assinatura_id LIMIT 1)))$$,
  'contrato_id', '(SELECT c.id FROM public.contratos c WHERE c.id = s.contrato_id)')) AS linhas;
-- servico_catalogo_id so se o catalogo (passo 2) tem o id; senao NULL em vez de
-- derrubar a carga. O check 07 conta quantos itens perderam o vinculo.
SELECT 'fatura_itens' AS tabela, pg_temp.mz_carga('fatura_itens', 'true', jsonb_build_object(
  'servico_catalogo_id', '(SELECT c.id FROM public.servicos_catalogo c WHERE c.id = s.servico_catalogo_id)')) AS linhas;

-- ─── 4. Pagamentos (derivado) ──────────────────────────────────────────────
-- Uma linha por fatura stripe paga com paga_em e empresa (pagamentos.empresa_id
-- e NOT NULL). As zoho_legado "pagas" nao tem data de pagamento: ficam so como
-- fatura. id deterministico para a segunda execucao nao duplicar.
INSERT INTO pagamentos (id, organizacao_id, fatura_id, empresa_id, servico_canonico_id, provider,
                        external_payment_id, amount, currency, status, paid_at, idempotency_key,
                        metadata, created_at, updated_at)
SELECT md5('mz-pagamento:' || f.id)::uuid, f.organizacao_id, f.id, f.empresa_id, f.servico_canonico_id,
       'stripe', f.external_id, f.valor, f.moeda, 'PAID', f.paga_em, 'marco-zero:' || f.id,
       jsonb_build_object('marco_zero', true, 'status_origem', f.status), f.paga_em, f.paga_em
  FROM faturas f
 WHERE f.origem = 'stripe' AND f.status = 'paga' AND f.paga_em IS NOT NULL AND f.empresa_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- ─── 5. MRR movimentos, ledger, webhooks ───────────────────────────────────
SELECT 'mrr_movimentos' AS tabela, pg_temp.mz_carga('mrr_movimentos', 'true', jsonb_build_object(
  'contrato_id', '(SELECT c.id FROM public.contratos c WHERE c.id = s.contrato_id)')) AS linhas;
SELECT 'service_ledger_batches' AS tabela, pg_temp.mz_carga('service_ledger_batches') AS linhas;
SELECT 'service_ledger_entries' AS tabela, pg_temp.mz_carga('service_ledger_entries') AS linhas;

-- Eventos completos (idempotencia do sync). A coluna se chama event_id no
-- destino e stripe_event_id em prod; created/updated vem de received_at.
SELECT 'stripe_webhook_events' AS tabela, pg_temp.mz_carga('stripe_webhook_events', 'true', jsonb_build_object(
  'event_id',       's.stripe_event_id',
  'organizacao_id', '(SELECT id FROM public.organizacoes)',
  'created_at',     's.received_at',
  'updated_at',     'coalesce(s.processed_at, s.received_at)')) AS linhas;
