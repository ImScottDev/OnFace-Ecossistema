-- Busca na base de conhecimento pelo BANCO, nao pela aplicacao (SPEC 19).
--
-- Como estava: `knowledge.search` carregava 500 chunks para a memoria e
-- pontuava por substring em JavaScript. Tres problemas, e o primeiro e grave:
--
--   1. LIMIT 500 SEM ordenacao. Com mais de 500 chunks publicados, o trecho
--      relevante pode simplesmente nao estar entre os carregados — o agente
--      responde "nao encontrei" sobre algo que existe. Mesma classe do board
--      com limite global corrigido na fase 17;
--   2. substring nao tem stemming: "pagamentos" nao casa "pagamento";
--   3. acento: quem digita sem acento nao acha o que foi escrito com.
--
-- O Postgres resolve os tres nativamente, sem dependencia nova e sem chamada a
-- provedor. Embedding vetorial continua sendo camada possivel por cima, nao
-- pre-requisito para a busca funcionar.
--
-- A ORDEM importa: `unaccent` entra como filtro do DICIONARIO, antes do
-- stemmer, e nao aplicado ao texto cru. Aplicar antes quebra o stemmer
-- portugues, e os dois lados geram radicais diferentes — medido: com unaccent
-- no texto, "ligacoes" vira 'ligaco' e "ligacao" vira 'ligaca', e a busca nao
-- casa nada.
--
-- A coluna e GERADA: nao existe passo de atualizacao para alguem esquecer,
-- entao o indice nao tem como ficar dessincronizado do conteudo.

BEGIN;

CREATE EXTENSION IF NOT EXISTS unaccent;

DROP INDEX IF EXISTS idx_ai_knowledge_chunks_busca;
ALTER TABLE ai_knowledge_chunks DROP COLUMN IF EXISTS busca;
DROP FUNCTION IF EXISTS onface_busca_pt(text);

DROP TEXT SEARCH CONFIGURATION IF EXISTS pt_unaccent;
CREATE TEXT SEARCH CONFIGURATION pt_unaccent (COPY = portuguese);
ALTER TEXT SEARCH CONFIGURATION pt_unaccent
  ALTER MAPPING FOR hword, hword_part, word WITH unaccent, portuguese_stem;

-- O stemmer portugues trata -cao e -coes como radicais DIFERENTES:
-- "implantacao" vira 'implantaca' e "implantacoes" vira 'implantaco'. Medido,
-- nao suposto. Isso importa neste dominio porque as palavras centrais dele sao
-- todas em -cao: implantacao, ligacao, negociacao, aquisicao.
--
-- A normalizacao roda nos DOIS lados, no texto indexado e na consulta, senao o
-- documento no plural e a pergunta no singular continuam sem se encontrar.
CREATE OR REPLACE FUNCTION onface_texto_busca(t text)
RETURNS tsvector LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT to_tsvector('pt_unaccent', regexp_replace(t, '(ç|c)(ões|oes)\y', '\1ão', 'gi'))
$$;

CREATE OR REPLACE FUNCTION onface_query_busca(t text)
RETURNS tsquery LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT plainto_tsquery('pt_unaccent', regexp_replace(t, '(ç|c)(ões|oes)\y', '\1ão', 'gi'))
$$;

ALTER TABLE ai_knowledge_chunks
  ADD COLUMN busca tsvector
  GENERATED ALWAYS AS (onface_texto_busca(content)) STORED;

CREATE INDEX idx_ai_knowledge_chunks_busca
  ON ai_knowledge_chunks USING GIN (busca);

COMMIT;

-- Reversao:
--   DROP INDEX IF EXISTS idx_ai_knowledge_chunks_busca;
--   ALTER TABLE ai_knowledge_chunks DROP COLUMN IF EXISTS busca;
--   DROP FUNCTION IF EXISTS onface_texto_busca(text);
--   DROP FUNCTION IF EXISTS onface_query_busca(text);
--   DROP TEXT SEARCH CONFIGURATION IF EXISTS pt_unaccent;
