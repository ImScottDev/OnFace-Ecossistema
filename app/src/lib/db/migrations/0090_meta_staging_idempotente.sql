-- Reentrega de webhook da Meta não pode duplicar o staging.
--
-- `POST /api/webhooks/meta-lead-ids` inseria em `meta_lead_staging` sem
-- nenhuma marca de idempotência, e a tabela só tinha PK no `id`. A Meta
-- reentrega webhook quando não recebe 200 a tempo, e cada reentrega criava uma
-- linha nova para o mesmo `fb_lead_id`.
--
-- O consumo (`/api/webhooks/rd-lead`) pega a linha mais recente por
-- email/telefone, então o efeito imediato era pequeno — mas o staging crescia
-- sem limite e a duplicata mascarava quantos leads a Meta realmente mandou.
--
-- Havia duplicata de verdade: a aplicação em 22/09 removeu **18 linhas**
-- repetidas antes de criar o índice. O risco não era teórico, estava
-- materializado no banco.
--
-- A deduplicação mantém a linha mais recente de cada `fb_lead_id`, que é
-- exatamente a que `/api/webhooks/rd-lead` já escolhia
-- (`orderBy(desc(createdAt)).limit(1)`) — nenhum consumidor muda de resposta.

-- Dedup defensivo: mantém a mais recente de cada fb_lead_id.
DELETE FROM meta_lead_staging a
 USING meta_lead_staging b
 WHERE a.fb_lead_id = b.fb_lead_id
   AND a.fb_lead_id IS NOT NULL
   AND (a.created_at, a.id) < (b.created_at, b.id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_meta_lead_staging_fb_lead_id
    ON meta_lead_staging (fb_lead_id)
 WHERE fb_lead_id IS NOT NULL;
