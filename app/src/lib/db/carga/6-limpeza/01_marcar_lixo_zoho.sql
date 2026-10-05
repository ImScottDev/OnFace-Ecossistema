-- CARGA DA VIRADA · frente D — marcar o lixo que veio do Zoho. NÃO apaga nada.
--
-- Por que existe: o Scott: "quando eu puxei do Zoho pro que está em produção hoje
-- veio muito lixo. O e-mail é um número arroba whatsapp.merencia.ai. Isso pra mim
-- é tudo contato lixo". Mas limpeza não é a prioridade da virada — o sistema tem
-- que subir funcional. Então este arquivo só MARCA e CONTA, numa tabela ao lado.
-- Nenhuma linha de `leads`, `pessoas`, `contatos` ou `empresas` é tocada.
-- Reverter é `DELETE FROM _carga_registros_suspeitos;` — nada a desfazer no dado.
--
-- Por que tabela nova e não `entity_labels`: `entity_labels` existe e seria o
-- lugar natural, mas (a) o CHECK `ck_entity_labels_type` não aceita 'pessoa', e
-- mexer no CHECK é alterar schema na véspera do deploy, e (b) label em
-- `entity_labels` aparece na UI, em filtro e em card — 1.246 etiquetas vermelhas
-- novas na manhã da virada é efeito colateral que ninguém pediu. Tabela `_carga_`
-- ao lado, no mesmo padrão de `_carga_contagem_antes`.
--
-- ============================ O QUE FOI MEDIDO ============================
-- Universo: leads 4.080 · pessoas 4.040 · contatos 1.906 · empresas 2.272.
--
-- Domínios de e-mail (top 40, leads) — os sintéticos NÃO são só o que o Scott
-- citou. Varrendo leads+pessoas+contatos, os únicos domínios cujo local-part é
-- puramente numérico são dois, ambos gateway de WhatsApp:
--     whatsapp.merencia.ai  200 linhas (100 leads + 100 pessoas)
--     whatsapp.callface.ai   12 linhas (6 leads + 6 pessoas)
-- Fora deles: gmail 1.267, hotmail 264, outlook 40, yahoo.com.br 37, e o resto é
-- domínio corporativo real (accor.com, tozzinifreire.com.br, onr.org.br...).
-- Nenhum e-mail malformado (0 sem @ / sem TLD). Domínio de teste: teste.com.br,
-- teste.com, empresa.com.br — 8 linhas.
--
-- Guarda contra falso positivo: as regras `lixo_*` EXCLUEM quem tem negócio,
-- contrato, fatura, serviço canônico, assinatura ou cliente — direto ou pela
-- empresa. Isso não é teoria, pegou gente de verdade:
--   · `sem_meio_de_contato`: 110 leads, 84 DELES têm vínculo comercial. São os
--     "Contato — ETAGE", "Contato — MANDIC ARARAS", Accor, Coteminas, Tozzini
--     Freire POA: cliente real cujo dado de contato não veio na migração. Por
--     isso essa regra ficou `revisar_` e NUNCA `lixo_` — é falta de dado, não
--     lixo. Nem os 26 sem vínculo são descartáveis (Davoli, Lubrificantes Fênix).
--   · `lixo_email_gateway_whatsapp`: 106 leads, 1 com negócio aberto (Vinicius
--     Mercante, 5511945705316@whatsapp.merencia.ai). A guarda tira ele. Sobram 105.
--   · `lixo_nome_invalido`: a primeira versão olhava só `nome` e pegava 28 leads,
--     entre eles "1658823" (= leonora.rodrigues@enesens.com, cliente Stripe),
--     "5219 - KARUAN DE CARVALHO PROENCA & CIA LTDA", "A | & A Consultoria",
--     "G | Abreu Solar", "T | h a d e u Silveira" — o nome real estava em
--     `sobrenome`. Regra estreitada para `nome || sobrenome` inteiro: 15 leads,
--     1 com vínculo (o 1658823), 14 marcados.
--   · empresas com nome de 1–2 caracteres: 2 caracteres pega V4, OI, RH, SH, ST,
--     que são abreviação legítima. Estreitado para 1 caractere / só pontuação /
--     placeholder: 10 empresas.
--
-- Duplicidade de empresa por NOME, entre as SEM CNPJ (as 17 duplicadas por CNPJ
-- já foram mescladas na frente 3): 37 grupos, 74 registros, 37 excedentes.
-- 27 desses 74 têm vínculo comercial — é exatamente a dor do Scott ("se eu vou
-- pesquisar empresa, aparece duplicada"), então aqui a guarda NÃO se aplica: a
-- regra não acusa lixo, acusa candidato a merge. E não mescla: sem documento o
-- match é incerto. Vários grupos nem são empresa ("Autônomo", "Crédito",
-- "Imóveis", "Cobrança", "Consignado" como razão social) — decisão humana.
--
-- `contatos`: 705 de 1.906 têm nome numérico (689 com nome == telefone). São
-- conversas de WhatsApp que nunca receberam nome — JID/LID cru. Conversa viva
-- não é lixo, por isso `revisar_contato_whatsapp_sem_nome`.
-- ==========================================================================
--
-- Convenção dos motivos:
--   lixo_*    → candidato a descarte. Guardado contra vínculo comercial: zero
--               registros marcados têm negócio/contrato/fatura/serviço.
--   revisar_* → problema de qualidade, NÃO é candidato a descarte. Pode e vai
--               conter cliente pagante. Não rodar DELETE em cima destes.

BEGIN;

CREATE TABLE IF NOT EXISTS _carga_registros_suspeitos (
  entidade     text        NOT NULL CHECK (entidade IN ('lead','pessoa','contato','empresa')),
  entidade_id  uuid        NOT NULL,
  motivo       text        NOT NULL,
  detalhe      text,
  detectado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entidade, entidade_id, motivo)
);
CREATE INDEX IF NOT EXISTS idx_carga_suspeitos_motivo ON _carga_registros_suspeitos (motivo);

-- Nome de pessoa claramente inválido, olhando nome+sobrenome JUNTOS.
CREATE OR REPLACE FUNCTION _carga_nome_e_lixo(p_nome text, p_sobrenome text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $fn$
  SELECT CASE
    WHEN btrim(coalesce(p_nome,'')||' '||coalesce(p_sobrenome,'')) = '' THEN true
    WHEN lower(btrim(coalesce(p_nome,'')||' '||coalesce(p_sobrenome,''))) IN
         ('null','undefined','n/a','na','-','.','sem nome','teste','test',
          'teste teste','nome','xxx','asd','aaa') THEN true
    -- só dígitos/pontuação: nome que na verdade é telefone ou id
    WHEN btrim(coalesce(p_nome,'')||' '||coalesce(p_sobrenome,'')) ~ '^[0-9+()\s.-]+$' THEN true
    WHEN length(btrim(coalesce(p_nome,'')||' '||coalesce(p_sobrenome,''))) = 1 THEN true
    ELSE false END;
$fn$;

-- Idempotência: este arquivo é dono dos motivos abaixo. Reaplicar recalcula do
-- zero, então um registro que deixou de casar com a regra some da marcação.
DELETE FROM _carga_registros_suspeitos
 WHERE motivo IN ('lixo_email_gateway_whatsapp','lixo_email_dominio_teste',
                  'lixo_nome_invalido','revisar_sem_meio_de_contato',
                  'revisar_contato_whatsapp_sem_nome',
                  'revisar_empresa_duplicada_nome_sem_cnpj');

WITH
-- ---------- vínculo comercial (a guarda contra falso positivo) ----------
emp_vinc AS (
  SELECT e.id FROM empresas e
   WHERE EXISTS (SELECT 1 FROM negocios            x WHERE x.empresa_id = e.id)
      OR EXISTS (SELECT 1 FROM contratos           x WHERE x.empresa_id = e.id)
      OR EXISTS (SELECT 1 FROM faturas             x WHERE x.empresa_id = e.id)
      OR EXISTS (SELECT 1 FROM servicos_canonicos  x WHERE x.empresa_id = e.id)
      OR EXISTS (SELECT 1 FROM clientes            x WHERE x.empresa_id = e.id)
),
lead_vinc AS (
  SELECT l.id FROM leads l
   WHERE EXISTS (SELECT 1 FROM negocios           x WHERE x.lead_id = l.id)
      OR EXISTS (SELECT 1 FROM contratos          x WHERE x.lead_id = l.id)
      OR EXISTS (SELECT 1 FROM faturas            x WHERE x.lead_id = l.id)
      OR EXISTS (SELECT 1 FROM servicos_canonicos x WHERE x.lead_id = l.id)
      OR EXISTS (SELECT 1 FROM assinaturas        x WHERE x.lead_id = l.id)
      OR l.empresa_id IN (SELECT id FROM emp_vinc)
),
pes_vinc AS (
  SELECT p.id FROM pessoas p
   WHERE p.lead_id_legado IN (SELECT id FROM lead_vinc)
      OR p.empresa_id     IN (SELECT id FROM emp_vinc)
      OR EXISTS (SELECT 1 FROM oportunidades x WHERE x.pessoa_id = p.id)
      OR EXISTS (SELECT 1 FROM clientes      x WHERE x.pessoa_principal_id = p.id)
),
cont_vinc AS (
  SELECT c.id FROM contatos c WHERE c.lead_id IN (SELECT id FROM lead_vinc)
),
-- ---------- grupos de empresa duplicada por nome, sem CNPJ ----------
emp_norm AS (
  SELECT id, organizacao_id, regexp_replace(lower(unaccent(nome)),'[^a-z0-9]','','g') AS chave
    FROM empresas WHERE nullif(btrim(cnpj),'') IS NULL
),
emp_dup AS (
  SELECT organizacao_id, chave FROM emp_norm
   WHERE chave <> '' GROUP BY 1,2 HAVING count(*) > 1
),
-- ---------- candidatos, regra a regra ----------
cand AS (
  -- R1 e-mail sintético de gateway de WhatsApp: <numero>@whatsapp.<qualquer>
  SELECT 'lead' e, id, 'lixo_email_gateway_whatsapp' m, lower(split_part(email,'@',2)) d
    FROM leads    WHERE email ~* '^[0-9+]{8,}@whatsapp\.'
  UNION ALL SELECT 'pessoa', id, 'lixo_email_gateway_whatsapp', lower(split_part(email,'@',2))
    FROM pessoas  WHERE email ~* '^[0-9+]{8,}@whatsapp\.'
  UNION ALL SELECT 'contato', id, 'lixo_email_gateway_whatsapp', lower(split_part(email,'@',2))
    FROM contatos WHERE email ~* '^[0-9+]{8,}@whatsapp\.'

  -- R1b domínio de teste
  UNION ALL SELECT 'lead', id, 'lixo_email_dominio_teste', lower(split_part(email,'@',2))
    FROM leads    WHERE lower(split_part(email,'@',2)) IN ('teste.com','teste.com.br','test.com','empresa.com.br','example.com','exemplo.com','exemplo.com.br','mailinator.com')
  UNION ALL SELECT 'pessoa', id, 'lixo_email_dominio_teste', lower(split_part(email,'@',2))
    FROM pessoas  WHERE lower(split_part(email,'@',2)) IN ('teste.com','teste.com.br','test.com','empresa.com.br','example.com','exemplo.com','exemplo.com.br','mailinator.com')
  UNION ALL SELECT 'contato', id, 'lixo_email_dominio_teste', lower(split_part(email,'@',2))
    FROM contatos WHERE lower(split_part(email,'@',2)) IN ('teste.com','teste.com.br','test.com','empresa.com.br','example.com','exemplo.com','exemplo.com.br','mailinator.com')

  -- R3 nome inválido (pessoa física) / nome inválido de empresa
  UNION ALL SELECT 'lead', id, 'lixo_nome_invalido', btrim(coalesce(nome,'')||' '||coalesce(sobrenome,''))
    FROM leads    WHERE _carga_nome_e_lixo(nome, sobrenome)
  UNION ALL SELECT 'pessoa', id, 'lixo_nome_invalido', btrim(coalesce(nome,'')||' '||coalesce(sobrenome,''))
    FROM pessoas  WHERE _carga_nome_e_lixo(nome, sobrenome)
  UNION ALL SELECT 'empresa', id, 'lixo_nome_invalido', nome
    FROM empresas WHERE _carga_nome_e_lixo(nome, NULL)

  -- R2 sem nenhum meio de contato (revisar: 84/110 são cliente com negócio)
  UNION ALL SELECT 'lead', id, 'revisar_sem_meio_de_contato', coalesce(origem,'(sem origem)')
    FROM leads    WHERE coalesce(nullif(btrim(email),''),nullif(btrim(telefone),''),nullif(btrim(whatsapp),'')) IS NULL
  UNION ALL SELECT 'pessoa', id, 'revisar_sem_meio_de_contato', '(espelho do lead)'
    FROM pessoas  WHERE coalesce(nullif(btrim(email),''),nullif(btrim(telefone),''),nullif(btrim(whatsapp),'')) IS NULL

  -- conversa de WhatsApp sem nome (JID/LID cru no lugar do nome)
  UNION ALL SELECT 'contato', id, 'revisar_contato_whatsapp_sem_nome', nome
    FROM contatos WHERE _carga_nome_e_lixo(nome, NULL)

  -- R4 empresa duplicada por nome normalizado, sem CNPJ. Só lista; não mescla.
  UNION ALL SELECT 'empresa', n.id, 'revisar_empresa_duplicada_nome_sem_cnpj', n.chave
    FROM emp_norm n JOIN emp_dup d USING (organizacao_id, chave)
)
INSERT INTO _carga_registros_suspeitos (entidade, entidade_id, motivo, detalhe)
SELECT e, id, m, d FROM cand
 WHERE m NOT LIKE 'lixo\_%'   -- regras revisar_: sem guarda, de propósito
    OR NOT (   (e = 'lead'    AND id IN (SELECT id FROM lead_vinc))
            OR (e = 'pessoa'  AND id IN (SELECT id FROM pes_vinc))
            OR (e = 'contato' AND id IN (SELECT id FROM cont_vinc))
            OR (e = 'empresa' AND id IN (SELECT id FROM emp_vinc)))
ON CONFLICT (entidade, entidade_id, motivo) DO NOTHING;

COMMIT;

-- Conferência (deve sair 0 em todas as linhas lixo_*):
--   SELECT motivo, count(*) FROM _carga_registros_suspeitos GROUP BY 1 ORDER BY 1;
