-- Contato avulso ganha o registro que a ficha base exige (12/10/2026).
--
-- `/contatos/pessoas/:id` criava esse registro no GET (escrita em leitura). A criação
-- fica nos pontos de cadastro (`garantirRegistroDeContato`) e este backfill cobre quem
-- já existia sem ele. Mesmo formato do helper: tipo 'contato', sem estágio de
-- Pré-vendas, sem aquisição, sem SDR e sem dono. Idempotente: só pessoas sem lead.
WITH novos AS (
  SELECT p.id AS pessoa_id, gen_random_uuid() AS lead_id, p.organizacao_id, p.nome, p.sobrenome,
         p.email, p.telefone, p.whatsapp, p.cargo, p.empresa_id, e.nome AS empresa
    FROM pessoas p LEFT JOIN empresas e ON e.id = p.empresa_id
   WHERE p.lead_id_legado IS NULL
), inseridos AS (
  INSERT INTO leads (id, organizacao_id, nome, sobrenome, email, telefone, whatsapp, cargo, empresa_id, empresa,
                     tipo, status, sdr_status, estagio_pre_vendas)
  SELECT lead_id, organizacao_id, nome, sobrenome, email, telefone, whatsapp, cargo, empresa_id, empresa,
         'contato', 'novo', NULL, NULL
    FROM novos
  RETURNING id
)
UPDATE pessoas SET lead_id_legado = n.lead_id, updated_at = now()
  FROM novos n WHERE pessoas.id = n.pessoa_id;
