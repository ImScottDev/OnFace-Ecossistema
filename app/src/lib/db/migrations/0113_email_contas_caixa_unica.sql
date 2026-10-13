-- E-mail: uma caixa, uma conta (13/10/2026).
--
-- Contexto: o callback OAuth da Microsoft/Google fazia INSERT puro, então cada
-- clique repetido em "Conectar" criava outra linha em email_contas para a MESMA
-- caixa (o Kauã tinha 6 ativas de kaua.araujo@callface.ai). Efeitos: evento de
-- calendário recriado ao editar a reunião (o PATCH ia à conta errada, dava 404 e
-- o ONFACE criava outro evento), e-mails importados em dobro e 6 assinaturas de
-- change notification do Outlook. O código passou a fazer UPSERT
-- (lib/email/conta-oauth.ts); esta migration é a trava no banco.
--
-- Índice único PARCIAL em (organizacao_id, usuario_id, tipo, lower(email)) para
-- contas que não foram mescladas (sync_status <> 'mesclada').
--
-- TOLERANTE a duplicata existente: enquanto houver caixa repetida (a consolidação
-- é o script app/src/scripts/consolidar-email-contas.ts --aplicar), a migration
-- NÃO falha o deploy: avisa e pula a criação. O script cria o mesmo índice ao
-- terminar a consolidação. O UPSERT do código não depende do índice (usa advisory
-- lock), então os dois caminhos são seguros em qualquer ordem.
--
-- Aditiva e idempotente. Nenhuma coluna sai, nenhum dado muda.
--
-- ROLLBACK:
--   DROP INDEX IF EXISTS uq_email_contas_caixa;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM email_contas
     WHERE sync_status <> 'mesclada'
     GROUP BY organizacao_id, usuario_id, tipo, lower(email)
    HAVING count(*) > 1
  ) THEN
    RAISE NOTICE 'uq_email_contas_caixa NAO criado: ainda ha caixa duplicada em email_contas. Rode consolidar-email-contas.ts --aplicar (ele cria o indice).';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS uq_email_contas_caixa
      ON email_contas (organizacao_id, usuario_id, tipo, lower(email))
      WHERE sync_status <> 'mesclada';
  END IF;
END $$;
