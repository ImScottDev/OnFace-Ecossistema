-- Anexos do legado (Zoho) sem entidade: 725 de 1.980 não apareciam em lugar nenhum
-- (medido em produção em 26/10/2026). Esta migration guarda o vínculo original,
-- registra o método de cada vínculo novo e liga só o que é inequívoco:
--
--   1. "CT - NNN" / "ID NNN" no nome do arquivo que casa com EXATAMENTE um
--      contrato pela descrição "CT - NNN - mm/aaaa" (amostra 10/10 concordante).
--   2. Nome de empresa (>= 6 caracteres, com fronteira de palavra, sem "Callface",
--      "teste", "[QA") que aparece no nome do arquivo e casa com EXATAMENTE uma
--      empresa. Vai para a EMPRESA, que é o que a ficha 360 lista.
--
-- O número de cotação (QT_PPA - NNN) NÃO é `propostas.numero` (3 de 340 concordam):
-- não é usado. "SalesOrder_<id>" não existe em nenhuma tabela: fica sem vínculo e
-- aparece em Ajustes › Qualidade de dados › Anexos do legado para vínculo manual.
--
-- Reaplicável: só toca linhas com entidade_id nulo e sem método registrado.
-- Reversível: UPDATE anexos_legado SET entidade_tipo = entidade_tipo_original,
--   entidade_id = entidade_id_original, vinculo_metodo = NULL WHERE vinculo_metodo IS NOT NULL.
-- Custo: o casamento por nome usa position() (busca de texto) antes do regex de
-- fronteira; regex por par anexo×empresa estourava 120 s em produção.

ALTER TABLE anexos_legado ADD COLUMN IF NOT EXISTS entidade_tipo_original text;
ALTER TABLE anexos_legado ADD COLUMN IF NOT EXISTS entidade_id_original uuid;
ALTER TABLE anexos_legado ADD COLUMN IF NOT EXISTS vinculo_metodo text;
ALTER TABLE anexos_legado ADD COLUMN IF NOT EXISTS vinculado_em timestamptz;

UPDATE anexos_legado
   SET entidade_tipo_original = entidade_tipo, entidade_id_original = entidade_id
 WHERE entidade_tipo_original IS NULL;

-- 1. contrato pelo número no nome do arquivo
WITH num AS (
  SELECT a.id, a.organizacao_id,
         (regexp_match(a.nome_arquivo, '(?:CT|ID)\s*-?\s*(\d{2,4})', 'i'))[1] AS n
    FROM anexos_legado a
   WHERE a.entidade_id IS NULL AND a.vinculo_metodo IS NULL
     AND a.nome_arquivo !~* 'QT_PPA|SalesOrder'
     AND a.nome_arquivo ~* '(CT|ID)\s*-?\s*\d{2,4}'
), par AS (
  SELECT num.id AS anexo_id, c.id AS contrato_id
    FROM num JOIN contratos c
      ON c.organizacao_id = num.organizacao_id
     AND c.descricao ~ ('CT\s*-\s*0*' || num.n || '\s*-')
), unico AS (
  SELECT anexo_id, min(contrato_id::text)::uuid AS contrato_id FROM par GROUP BY anexo_id HAVING count(*) = 1
)
UPDATE anexos_legado a
   SET entidade_tipo = 'contrato', entidade_id = unico.contrato_id,
       vinculo_metodo = 'numero_do_contrato_no_nome', vinculado_em = now()
  FROM unico
 WHERE a.id = unico.anexo_id;

-- 2. empresa pelo nome no arquivo (fronteira de palavra; entre várias, vence o nome
--    mais longo; empate = ambíguo, fica sem vínculo). Nomes genéricos cadastrados
--    como empresa ("Aditivo", "Telecom", "Software"...) ficam fora: casariam com
--    qualquer arquivo. Medido em 26/10/2026: 358 únicos, 5 empates.
WITH emp AS (
  SELECT e.id, e.organizacao_id, e.nome, lower(e.nome) AS nome_l
    FROM empresas e
   WHERE e.nome !~* 'callface|teste|\[qa|^test' AND length(e.nome) >= 6 AND e.nome ~ '[A-Za-z]{3}'
     AND lower(trim(e.nome)) NOT IN ('aditivo','telecom','software','construtora','contrato','proposta','upgrade',
       'servicos','serviços','comercial','consultoria','tecnologia','sistemas','ltda','empresa','cliente','pessoal',
       'prefeitura','hospital','clinica','clínica','escola','faculdade','imobiliaria','imobiliária','advogados',
       'contabilidade','hotel','hoteis','hotéis','engenharia','distribuidora','industria','indústria','transportes',
       'logistica','logística','seguros','financeira','agencia','agência','marketing','digital','solucoes','soluções',
       'grupo','holding','associados','corretora','veiculos','veículos','motos','autopecas','autopeças','farmacia',
       'farmácia','laboratorio','laboratório','mineracao','mineração')
), cand AS (
  SELECT a.id AS anexo_id, emp.id AS empresa_id, a.nome_arquivo, emp.nome
    FROM anexos_legado a
    JOIN emp ON emp.organizacao_id = a.organizacao_id
             AND position(emp.nome_l IN lower(a.nome_arquivo)) > 0
   WHERE a.entidade_id IS NULL AND a.vinculo_metodo IS NULL
), par AS (
  SELECT anexo_id, empresa_id, length(nome) AS len FROM cand
   WHERE nome_arquivo ~* ('(^|[^a-z0-9])' || regexp_replace(nome, '([.*+?^${}()|\[\]\\])', '\\\1', 'g') || '([^a-z0-9]|$)')
), top AS (
  SELECT anexo_id, max(len) AS mx FROM par GROUP BY anexo_id
), unico AS (
  SELECT p.anexo_id, min(p.empresa_id::text)::uuid AS empresa_id
    FROM par p JOIN top t ON t.anexo_id = p.anexo_id AND p.len = t.mx
   GROUP BY p.anexo_id HAVING count(DISTINCT p.empresa_id) = 1
)
UPDATE anexos_legado a
   SET entidade_tipo = 'empresa', entidade_id = unico.empresa_id,
       vinculo_metodo = 'nome_da_empresa_no_arquivo', vinculado_em = now()
  FROM unico
 WHERE a.id = unico.anexo_id;

CREATE INDEX IF NOT EXISTS anexos_legado_sem_vinculo_idx ON anexos_legado (organizacao_id) WHERE entidade_id IS NULL;
