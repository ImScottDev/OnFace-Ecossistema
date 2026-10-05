-- CARGA DA VIRADA · faturamento, passo 03 — churn só para quem dava para medir.
--
-- O QUE ESTAVA ERRADO: o passo 02 marcou como `churned` todo cliente que não
-- apareceu na planilha de setembro. Mas "não apareceu" tem duas causas muito
-- diferentes, e elas estavam recebendo o mesmo rótulo:
--
--   32 clientes TÊM CNPJ cadastrado e não têm linha na planilha
--      → não pagaram. Churn de verdade.
--
--   26 clientes têm empresa SEM CNPJ
--      → nunca poderiam casar com a planilha, que é indexada por documento.
--        Não é que não pagaram: é que não dá para saber. E 22 DESSES 26 TÊM
--        SERVIÇO `ACTIVE` no canônico, ou seja, a evidência que existe aponta
--        para o contrário.
--
-- Por que isso importa na virada: o time abre a tela e lê "churned" como
-- "cliente que perdemos". Chamar de perdido quem só não tem CNPJ cadastrado é
-- pior do que não classificar — vira decisão errada de CS em cima de um dado
-- que nunca foi medido.
--
-- A REGRA passa a ser: churn exige evidência. Sem documento para reconciliar,
-- o cliente não vira churn; fica com o lifecycle dizendo exatamente por que
-- ficou indeciso, para o time resolver cadastrando o CNPJ.
--
-- Achado do verificador adversarial da frente B, 05/10/2026.
--
-- IDEMPOTENTE: a segunda execução não encontra mais `churned` sem documento.

UPDATE clientes c
   SET status_financeiro = CASE
         -- A evidência que existe diz que o serviço está ativo: respeitá-la.
         WHEN EXISTS (SELECT 1 FROM servicos_canonicos s
                       WHERE s.empresa_id = c.empresa_id AND s.billing_status = 'ACTIVE')
           THEN 'ativo'
         -- Sem serviço ativo e sem documento: não dá para afirmar nada.
         ELSE NULL
       END,
       lifecycle_status = 'SEM_DOCUMENTO_NAO_RECONCILIAVEL_2026-09',
       updated_at = now()
  FROM empresas e
 WHERE e.id = c.empresa_id
   AND c.status_financeiro = 'churned'
   AND COALESCE(regexp_replace(COALESCE(e.cnpj, ''), '[^0-9]', '', 'g'), '') = '';

-- Cliente sem empresa nenhuma tampouco pode ser reconciliado por documento.
UPDATE clientes c
   SET status_financeiro = NULL,
       lifecycle_status = 'SEM_EMPRESA_NAO_RECONCILIAVEL_2026-09',
       updated_at = now()
 WHERE c.status_financeiro = 'churned'
   AND c.empresa_id IS NULL;

DO $$
DECLARE churn int; indeciso int; ativo int;
BEGIN
  SELECT count(*) INTO churn    FROM clientes WHERE status_financeiro = 'churned';
  SELECT count(*) INTO ativo    FROM clientes WHERE status_financeiro = 'ativo';
  SELECT count(*) INTO indeciso FROM clientes WHERE lifecycle_status LIKE '%NAO_RECONCILIAVEL%';
  RAISE NOTICE '── churn medido: % · ativos: % · sem documento para medir: %', churn, ativo, indeciso;
END $$;
