-- CARGA DA VIRADA · frente D — VERIFICAÇÃO ADVERSARIAL do 01_marcar_lixo_zoho.sql.
-- Somente SELECT. Não escreve nada, não cria nada, pode rodar quantas vezes quiser.
--
-- Por que existe: o 01 afirma "0 registros lixo_* têm vínculo comercial" e usa isso
-- como licença para um DELETE futuro. A afirmação é verdadeira para a definição de
-- vínculo que o 01 usa (negócio/contrato/fatura/serviço/assinatura/cliente), e FALSA
-- para a realidade operacional: a conversa de WhatsApp não pendura em `leads`, ela
-- pendura em `contatos` -> `whatsapp_mensagens.contato_id`, e `contatos.lead_id` só
-- está preenchido em 25 de 1.906 linhas. A guarda `cont_vinc` do 01, portanto, é
-- cega por construção.
--
-- O QUE FOI MEDIDO (banco callface_crm_ensaio_virada, 05/10/2026):
--   · 41 dos 123 leads marcados lixo_* (33%) casam por telefone com um `contatos`
--     que TEM mensagem de WhatsApp (43 marcações: 39 lixo_email_gateway_whatsapp
--     + 4 lixo_nome_invalido; 2 leads caem nas duas regras). Somam 3.730 mensagens; a mais recente é de 02/10/2026.
--     O casamento é por dígitos exatos do telefone; em 54 dos 85 pares o nome do
--     lead é idêntico ao nome do contato, em 72 um contém o outro. Não é
--     similaridade, é a mesma pessoa.
--     Exemplos: Wesley Ozorio (466 msgs), Elaine (452), Melo (438), Rodrigo (269).
--   · As 9 empresas marcadas lixo_nome_invalido não são órfãs: 14 leads e 14
--     pessoas apontam para elas, com 71 timeline_events e 30 communications.
--     `emp_vinc` não checa quem aponta para a empresa, só o que a empresa tem.
--   · Duplicidade de empresa por nome: a regra só olha quem tem CNPJ nulo e acha
--     37 grupos / 74 registros. Na base inteira são 49 grupos / 102 registros.
--     11 grupos (23 registros) são os MISTOS — um lado com CNPJ,
--     outro sem — e incluem "City Card", "Enigma Franquias", "Odisseia Seguros",
--     "Ello Consorcios LTDA - 54338838000119 Belo Horizonte" (duas vezes, o mesmo
--     CNPJ está dentro do próprio nome). É exatamente a dor do Scott e está fora.
--   · `aquisicoes` é espelho 1:1 de `leads` (4.080 = 4.080, lead_legado_id único).
--     Nenhuma linha de `aquisicoes` é marcada. Um DELETE guiado pelas marcações
--     deixa a aquisição para trás.
--
-- O que CONFIRMOU do 01: os 1.253 / 1.237 distintos, as contagens por motivo, os
-- dois únicos domínios sintéticos, 0 e-mail malformado, idempotência (1.253 nas
-- duas execuções), zero escrita em leads/pessoas/contatos/empresas, e o rótulo
-- "(espelho do lead)" das 110 pessoas (0 fora da lista de leads).

\echo '--- A) leads lixo_* com conversa de WhatsApp viva (esperado: 39 + 4, 41 distintos)'
WITH lx AS (
  SELECT s.motivo, l.id,
         regexp_replace(coalesce(nullif(btrim(l.whatsapp),''), nullif(btrim(l.telefone),''),
                                 split_part(l.email,'@',1)), '\D','','g') AS tel
    FROM _carga_registros_suspeitos s JOIN leads l ON l.id = s.entidade_id
   WHERE s.motivo LIKE 'lixo\_%'
)
SELECT coalesce(motivo,'TOTAL') AS motivo, count(DISTINCT id) AS leads_com_conversa
  FROM (SELECT DISTINCT lx.motivo, lx.id FROM lx
          JOIN contatos c ON regexp_replace(coalesce(c.telefone,''),'\D','','g') = lx.tel
         WHERE length(lx.tel) >= 10
           AND EXISTS (SELECT 1 FROM whatsapp_mensagens w WHERE w.contato_id = c.id)) v
 GROUP BY ROLLUP(motivo) ORDER BY 1;

\echo '--- B) empresas lixo_nome_invalido: quem aponta para elas (esperado: 9 linhas, todas com lead e pessoa)'
SELECT s.detalhe AS nome,
       (SELECT count(*) FROM leads  l WHERE l.empresa_id = s.entidade_id) AS leads,
       (SELECT count(*) FROM pessoas p WHERE p.empresa_id = s.entidade_id) AS pessoas,
       (SELECT count(*) FROM timeline_events t WHERE t.empresa_id = s.entidade_id) AS timeline,
       (SELECT count(*) FROM communications c WHERE c.empresa_id = s.entidade_id) AS comms
  FROM _carga_registros_suspeitos s
 WHERE s.motivo = 'lixo_nome_invalido' AND s.entidade = 'empresa'
 ORDER BY 2 DESC;

\echo '--- C) duplicidade de empresa por nome: base inteira vs. só CNPJ nulo (49/102 vs 37/74)'
WITH norm AS (
  SELECT id, organizacao_id, nullif(btrim(cnpj),'') AS cnpj,
         regexp_replace(lower(unaccent(nome)),'[^a-z0-9]','','g') AS k
    FROM empresas
), g AS (
  SELECT organizacao_id, k, count(*) n, count(cnpj) cc
    FROM norm WHERE k <> '' GROUP BY 1,2 HAVING count(*) > 1
)
SELECT 'base inteira' AS escopo, count(*) grupos, sum(n) registros, sum(n-1) excedentes FROM g
UNION ALL
SELECT 'MISTOS (1 lado com CNPJ) — fora da regra', count(*), sum(n), sum(n-1) FROM g WHERE cc > 0 AND cc < n
UNION ALL
SELECT 'todos com CNPJ — fora da regra', count(*), sum(n), sum(n-1) FROM g WHERE cc = n;

-- a regra do 01 pré-filtra cnpj nulo ANTES de agrupar, então ela vê 37/74:
WITH norm AS (
  SELECT id, organizacao_id, regexp_replace(lower(unaccent(nome)),'[^a-z0-9]','','g') AS k
    FROM empresas WHERE nullif(btrim(cnpj),'') IS NULL
), g AS (SELECT organizacao_id,k,count(*) n FROM norm WHERE k<>'' GROUP BY 1,2 HAVING count(*)>1)
SELECT 'regra do 01 (pré-filtra cnpj nulo)' AS escopo, count(*) grupos, sum(n) registros, sum(n-1) excedentes FROM g;

\echo '--- D) aquisicoes: espelho 1:1 de leads, nunca marcado'
SELECT (SELECT count(*) FROM aquisicoes) AS aquisicoes,
       (SELECT count(DISTINCT lead_legado_id) FROM aquisicoes) AS leads_distintos,
       (SELECT count(*) FROM leads) AS leads,
       (SELECT count(*) FROM _carga_registros_suspeitos WHERE entidade = 'aquisicao') AS marcadas;

\echo '--- E) eficácia da guarda cont_vinc: contatos.lead_id preenchido'
SELECT count(*) AS contatos, count(lead_id) AS com_lead_id FROM contatos;
