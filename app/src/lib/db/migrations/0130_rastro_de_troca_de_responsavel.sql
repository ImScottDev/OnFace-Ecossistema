-- Toda troca de dono deixa rastro, venha de onde vier.
--
-- Cards estavam aparecendo na Jenifer sem ninguém ter atribuído, e a
-- investigação parou numa parede: zero automações ativas, zero regras de
-- distribuição, zero registros em audit_log com o id dela, nenhum trigger no
-- banco, o worker não toca em responsavel_id. A porta oficial
-- (atribuirResponsavel) grava OwnerChanged; portanto a troca NÃO passou por
-- ela — e o que escreve direto no banco não deixa rastro nenhum.
--
-- Auditar no banco, e não na aplicação, é o que fecha isso: o trigger pega
-- qualquer escritor (server action, rota Hono, worker, script avulso, psql na
-- mão), e guarda a consulta que fez a troca. Da próxima vez que acontecer, a
-- resposta é uma query, não uma caçada.

CREATE OR REPLACE FUNCTION auditar_troca_de_responsavel() RETURNS trigger AS $$
BEGIN
  IF NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id THEN
    INSERT INTO audit_log (organizacao_id, actor_id, action, entity_type, entity_id, before, after, source)
    VALUES (
      NEW.organizacao_id,
      NULL, -- o banco não conhece o usuário da sessão; o "quem" está na consulta
      TG_TABLE_NAME || '.responsavel_alterado',
      TG_TABLE_NAME,
      NEW.id,
      jsonb_build_object('responsavel_id', OLD.responsavel_id),
      jsonb_build_object(
        'responsavel_id', NEW.responsavel_id,
        -- Quem escreveu: o nome da conexão e a consulta inteira. É isto que
        -- transforma "apareceu na Jenifer" em "esta linha deste arquivo".
        'aplicacao', current_setting('application_name', true),
        'consulta', left(current_query(), 2000)
      ),
      'trigger'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auditar_responsavel_leads ON leads;
CREATE TRIGGER trg_auditar_responsavel_leads
  AFTER UPDATE OF responsavel_id ON leads
  FOR EACH ROW EXECUTE FUNCTION auditar_troca_de_responsavel();

DROP TRIGGER IF EXISTS trg_auditar_responsavel_negocios ON negocios;
CREATE TRIGGER trg_auditar_responsavel_negocios
  AFTER UPDATE OF responsavel_id ON negocios
  FOR EACH ROW EXECUTE FUNCTION auditar_troca_de_responsavel();

DROP TRIGGER IF EXISTS trg_auditar_responsavel_oportunidades ON oportunidades;
CREATE TRIGGER trg_auditar_responsavel_oportunidades
  AFTER UPDATE OF responsavel_id ON oportunidades
  FOR EACH ROW EXECUTE FUNCTION auditar_troca_de_responsavel();
