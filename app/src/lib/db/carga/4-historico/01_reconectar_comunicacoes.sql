-- CARGA DA VIRADA · histórico, passo 01 — devolve dono às comunicações órfãs.
--
-- O PROBLEMA, medido no dump de 05/10/2026 depois dos 11 backfills:
--
--     canal      total   sem pessoa   %
--     whatsapp   32351   31266        96,6
--     email       5451    4681        85,9
--     ligacao     5716     775        13,6
--
-- 36.722 comunicações entram no canônico sem `pessoa_id`. Elas EXISTEM na
-- tabela, mas a timeline do cliente é montada a partir da pessoa: sem dono, a
-- conversa não aparece em lugar nenhum. Para quem abre um cliente na ONFACE, o
-- histórico simplesmente não está lá.
--
-- POR QUE ACONTECE: `13-comunicacoes` resolve a pessoa por
-- `backfill_provenance` a partir de `leads`. Mas 24.380 das mensagens de
-- WhatsApp não têm `lead_id` — têm `contato_id`, apontando para a tabela
-- `contatos` (1.906 linhas), que `05-identidade` NÃO lê. Nenhum desses contatos
-- virou pessoa, então não há o que resolver.
--
-- O CONSERTO: casar pelo meio de contato, que é o dado que sempre existe na
-- mensagem. Telefone pelos 8 últimos dígitos (ignora DDD e o nono dígito, que
-- variam no mesmo cadastro); e-mail por endereço normalizado.
--
-- REGRA DE OURO: só vincula quando o meio de contato aponta para UMA pessoa.
-- Telefone que bate com duas pessoas fica sem dono de propósito — pendurar a
-- conversa de um cliente na pessoa errada é pior do que deixá-la sem dono, e é
-- o tipo de erro que ninguém percebe. Medido: 166 telefones ambíguos, 3.991
-- mensagens, que permanecem órfãs e saem no relatório.
--
-- IDEMPOTENTE: só toca linha com `pessoa_id IS NULL`. Rodar de novo é no-op.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. WhatsApp — pessoa pelo telefone, quando o telefone é de uma pessoa só
-- ─────────────────────────────────────────────────────────────────────────
WITH pes AS (
  SELECT id, organizacao_id,
         right(regexp_replace(telefone,'[^0-9]','','g'), 8) AS fone8
    FROM pessoas
   WHERE length(regexp_replace(COALESCE(telefone,''),'[^0-9]','','g')) >= 8
),
unicos AS (
  SELECT fone8, organizacao_id, (array_agg(id))[1] AS pessoa_id
    FROM pes GROUP BY fone8, organizacao_id HAVING count(DISTINCT id) = 1
)
UPDATE communications c
   SET pessoa_id = u.pessoa_id
  FROM whatsapp_mensagens w, unicos u
 WHERE c.canal = 'whatsapp'
   AND c.pessoa_id IS NULL
   AND c.origem_tabela = 'whatsapp_mensagens'
   AND w.id = c.origem_legado_id
   AND u.organizacao_id = c.organizacao_id
   AND u.fone8 = right(regexp_replace(COALESCE(w.telefone,''),'[^0-9]','','g'), 8);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. E-mail — pessoa pelo endereço, quando o endereço é de uma pessoa só
-- ─────────────────────────────────────────────────────────────────────────
WITH pes AS (
  SELECT id, organizacao_id, lower(trim(email)) AS em
    FROM pessoas WHERE COALESCE(email,'') <> ''
),
unicos AS (
  SELECT em, organizacao_id, (array_agg(id))[1] AS pessoa_id
    FROM pes GROUP BY em, organizacao_id HAVING count(DISTINCT id) = 1
)
UPDATE communications c
   SET pessoa_id = u.pessoa_id
  FROM emails e, unicos u
 WHERE c.canal = 'email'
   AND c.pessoa_id IS NULL
   AND c.origem_tabela = 'emails'
   AND e.id = c.origem_legado_id
   AND u.organizacao_id = c.organizacao_id
   AND u.em = ANY (ARRAY[lower(trim(COALESCE(e.de,''))), lower(trim(COALESCE(e.para,'')))]);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Empresa — herda da pessoa já resolvida
--
-- A comunicação pertence à empresa da pessoa com quem se falou. Sem isso, a
-- conversa aparece na pessoa mas não na tela da empresa, que é por onde o CS
-- trabalha.
-- ─────────────────────────────────────────────────────────────────────────
UPDATE communications c
   SET empresa_id = p.empresa_id
  FROM pessoas p
 WHERE c.empresa_id IS NULL
   AND c.pessoa_id = p.id
   AND p.empresa_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Relatório — o que ficou sem dono, e por quê
-- ─────────────────────────────────────────────────────────────────────────
DO $$
DECLARE r record; amb int;
BEGIN
  RAISE NOTICE '── comunicações depois da reconexão ──';
  FOR r IN
    SELECT canal, count(*) AS total,
           count(*) FILTER (WHERE pessoa_id IS NULL) AS sem_pessoa,
           count(*) FILTER (WHERE empresa_id IS NULL) AS sem_empresa
      FROM communications GROUP BY canal ORDER BY 2 DESC
  LOOP
    RAISE NOTICE '  %: % total · % sem pessoa · % sem empresa',
                 rpad(r.canal,9), r.total, r.sem_pessoa, r.sem_empresa;
  END LOOP;

  SELECT count(*) INTO amb
    FROM communications c
    JOIN whatsapp_mensagens w ON w.id = c.origem_legado_id
   WHERE c.canal='whatsapp' AND c.pessoa_id IS NULL
     AND EXISTS (
       SELECT 1 FROM pessoas p
        WHERE right(regexp_replace(COALESCE(p.telefone,''),'[^0-9]','','g'),8)
            = right(regexp_replace(COALESCE(w.telefone,''),'[^0-9]','','g'),8)
          AND length(regexp_replace(COALESCE(p.telefone,''),'[^0-9]','','g')) >= 8
       HAVING count(DISTINCT p.id) > 1);
  RAISE NOTICE '  (% do WhatsApp seguem sem dono por telefone AMBÍGUO — não foram chutadas)', amb;
END $$;
