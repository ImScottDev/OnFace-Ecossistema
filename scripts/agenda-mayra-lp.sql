-- Grade da closer que atende as LPs: 9h às 18h, segunda a sexta, almoço 12h-13h.
-- Idempotente: roda de novo sem duplicar.
INSERT INTO closer_disponibilidade (organizacao_id, usuario_id, horario_trabalho, pausa_almoco, ativo)
SELECT u.organizacao_id, u.id,
       '{"inicio":"09:00","fim":"18:00","diasSemana":[1,2,3,4,5],"timezone":"America/Sao_Paulo"}'::jsonb,
       '{"inicio":"12:00","fim":"13:00"}'::jsonb, true
  FROM usuarios u
  JOIN organizacoes o ON o.id = u.organizacao_id AND o.slug = 'scott-studio'
 WHERE u.email = 'mayra.schincariol@callface.ai'
   AND NOT EXISTS (SELECT 1 FROM closer_disponibilidade d WHERE d.usuario_id = u.id);

UPDATE closer_disponibilidade d
   SET horario_trabalho = '{"inicio":"09:00","fim":"18:00","diasSemana":[1,2,3,4,5],"timezone":"America/Sao_Paulo"}'::jsonb,
       pausa_almoco = '{"inicio":"12:00","fim":"13:00"}'::jsonb,
       ativo = true, updated_at = now()
  FROM usuarios u
 WHERE d.usuario_id = u.id AND u.email = 'mayra.schincariol@callface.ai';
