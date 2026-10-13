-- Subtarefa, comentário e anexo da atividade (13/10/2026).
--
-- A peça de atividade do desenho (gaveta com subtarefas, painel lateral de
-- comentários com @menção e anexos) existia no front sem tabela atrás: o que
-- se digitava não gravava, e a peça foi trocada por uma versão sem esses
-- blocos. Aqui o domínio que faltava:
--
--   tarefa_subtarefas  — checklist da atividade (título, descrição, feita,
--                        responsável, prazo, ordem).
--   tarefa_comentarios — conversa da atividade; `mencoes` guarda os ids de
--                        usuário citados com @ (quem foi avisado).
--   file_links         — o acervo canônico passa a aceitar 'tarefa' e
--                        'tarefa_comentario' como entidade do vínculo.
--
-- Idempotente: tabelas e índices com IF NOT EXISTS; a constraint do acervo é
-- recriada com a lista completa (a anterior + as duas novas).

CREATE TABLE IF NOT EXISTS tarefa_subtarefas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  tarefa_id      uuid NOT NULL REFERENCES tarefas(id) ON DELETE CASCADE,
  titulo         text NOT NULL,
  descricao      text,
  concluida      boolean NOT NULL DEFAULT false,
  concluida_em   timestamptz,
  ordem          integer NOT NULL DEFAULT 0,
  responsavel_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  vence_em       date,
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid REFERENCES usuarios(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_tarefa_subtarefas_tarefa ON tarefa_subtarefas (tarefa_id, ordem);
CREATE INDEX IF NOT EXISTS idx_tarefa_subtarefas_org ON tarefa_subtarefas (organizacao_id);

CREATE TABLE IF NOT EXISTS tarefa_comentarios (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  tarefa_id      uuid NOT NULL REFERENCES tarefas(id) ON DELETE CASCADE,
  autor_id       uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  corpo          text NOT NULL,
  mencoes        jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  editado_em     timestamptz
);
CREATE INDEX IF NOT EXISTS idx_tarefa_comentarios_tarefa ON tarefa_comentarios (tarefa_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tarefa_comentarios_org ON tarefa_comentarios (organizacao_id);

ALTER TABLE file_links DROP CONSTRAINT IF EXISTS ck_file_links_entity;
ALTER TABLE file_links ADD CONSTRAINT ck_file_links_entity CHECK (entity_type IN (
  'empresa','pessoa','oportunidade','proposta','contrato',
  'servico_canonico','fulfillment','communication','reuniao','aquisicao',
  'tarefa','tarefa_comentario'
));
