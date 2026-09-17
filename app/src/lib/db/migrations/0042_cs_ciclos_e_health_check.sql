-- ═══════════════════════════════════════════════════════════════
-- CS — régua 3/6/9/12 recorrente + Health Check estruturado (08/09/2026)
--
-- Duas mudanças pequenas. `cs_marcos` já nasceu com `ciclo` e com
-- `resultado jsonb`, então a régua permanente e o mini-playbook não pedem
-- tabela nova — só o código M12 no CHECK e a lógica na aplicação.
-- ═══════════════════════════════════════════════════════════════

-- M12 fecha o ciclo anual de relacionamento. Distinto de RENOVACAO, que
-- continua saindo da vigência real do contrato: contrato de 24 meses tem
-- checkpoint de 12 meses e nenhuma renovação naquele momento.
ALTER TABLE cs_marcos DROP CONSTRAINT IF EXISTS cs_marcos_codigo_check;
ALTER TABLE cs_marcos ADD CONSTRAINT cs_marcos_codigo_check
  CHECK (codigo IN ('D0','D7','D30','M3','M6','M9','M12','RENOVACAO'));

-- Health Check deixa de ser só uma nota de NPS. A tabela `nps_respostas` já
-- é o lugar certo (tem score, comentário, tipo e vínculo com contrato); o
-- que faltava era onde guardar o resto do questionário sem criar uma coluna
-- por pergunta.
ALTER TABLE nps_respostas ADD COLUMN IF NOT EXISTS respostas jsonb;
ALTER TABLE nps_respostas ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES empresas(id) ON DELETE CASCADE;
ALTER TABLE nps_respostas ADD COLUMN IF NOT EXISTS registrado_por uuid REFERENCES usuarios(id);
ALTER TABLE nps_respostas ADD COLUMN IF NOT EXISTS marco_id uuid REFERENCES cs_marcos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_nps_empresa ON nps_respostas (empresa_id, respondido_em DESC)
  WHERE empresa_id IS NOT NULL;

-- Health Check antigo era gravado só com lead_id; resolve a empresa pra que
-- a consulta por conta não dependa de join por lead.
UPDATE nps_respostas np
   SET empresa_id = l.empresa_id
  FROM leads l
 WHERE l.id = np.lead_id AND np.empresa_id IS NULL AND l.empresa_id IS NOT NULL;

-- Health check pertence à EMPRESA. Cliente sem lead cadastrado (existe na
-- base) não pode ficar sem poder responder — relaxa, nunca quebra quem já
-- escreve com lead.
ALTER TABLE nps_respostas ALTER COLUMN lead_id DROP NOT NULL;
