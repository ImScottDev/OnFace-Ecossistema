-- Status operacional da atividade.
--
-- Até aqui `tarefas` só sabia dizer "concluída ou não". A operação precisa de
-- mais: uma atividade pode estar parada esperando o cliente, ou ter sido
-- declinada, e nenhum dos dois é "aberta" nem "concluída". Sem esse campo o
-- kanban do ONFACE era derivado de data de vencimento, o que descrevia o
-- prazo, não o trabalho.
--
-- `concluida` continua existindo: várias rotinas do CRM e do sweep de
-- automação leem essa coluna. Os dois ficam sincronizados por trigger, então
-- quem escreve em qualquer um dos lados não precisa saber do outro.

ALTER TABLE tarefas
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'a_fazer';

-- Backfill: o que já estava concluído entra como concluído; o resto, a fazer.
UPDATE tarefas SET status = 'concluida' WHERE concluida = true AND status = 'a_fazer';

ALTER TABLE tarefas
  DROP CONSTRAINT IF EXISTS tarefas_status_check;
ALTER TABLE tarefas
  ADD CONSTRAINT tarefas_status_check
  CHECK (status IN ('a_fazer','em_andamento','aguardando','concluida','declinada'));

CREATE INDEX IF NOT EXISTS idx_tarefas_org_status ON tarefas (organizacao_id, status);

-- Mantém `concluida` e `status` coerentes nos dois sentidos.
CREATE OR REPLACE FUNCTION tarefas_sincronizar_status() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.concluida AND NEW.status <> 'concluida' THEN
      NEW.status := 'concluida';
    ELSIF NEW.status = 'concluida' THEN
      NEW.concluida := true;
      NEW.concluida_em := COALESCE(NEW.concluida_em, now());
    END IF;
    RETURN NEW;
  END IF;

  -- Quem mudou o status manda; se mudou só `concluida`, o status acompanha.
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'concluida' THEN
      NEW.concluida := true;
      NEW.concluida_em := COALESCE(NEW.concluida_em, now());
    ELSE
      NEW.concluida := false;
      NEW.concluida_em := NULL;
    END IF;
  ELSIF NEW.concluida IS DISTINCT FROM OLD.concluida THEN
    IF NEW.concluida THEN
      NEW.status := 'concluida';
      NEW.concluida_em := COALESCE(NEW.concluida_em, now());
    ELSE
      NEW.status := 'a_fazer';
      NEW.concluida_em := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tarefas_sincronizar_status ON tarefas;
CREATE TRIGGER trg_tarefas_sincronizar_status
  BEFORE INSERT OR UPDATE ON tarefas
  FOR EACH ROW EXECUTE FUNCTION tarefas_sincronizar_status();
