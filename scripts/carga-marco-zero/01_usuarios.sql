-- CARGA MARCO ZERO · passo 01 · usuarios e acesso (mapa 2.1).
-- usuarios (16, com senha_hash, sem qa.%), user_roles, auth_tokens, metas, organizacoes.
-- roles/permissions/role_permissions NAO se carregam: sao seed da migration 0070.
-- api_tokens fica vazio. Filipe continua usuario (so as tarefas dele saem, no 09).
--
-- Idempotente (ver _lib.sql): segunda execucao nao toca linha, created_at/updated_at
-- vem de prod.
\set ON_ERROR_STOP on
BEGIN;
\ir _lib.sql

-- Organizacao: direto, inclusive apollo_api_key. O id e o mesmo da seed das migrations.
SELECT 'organizacoes' AS tabela, pg_temp.mz_carga('organizacoes', 'legado.organizacoes') AS linhas;

-- Usuarios: direto. team_id fica NULL (prod tem 0 times); a coluna so existe no destino.
SELECT 'usuarios' AS tabela,
       pg_temp.mz_carga('usuarios', 'legado.usuarios', $$ s.email NOT LIKE 'qa.%' $$) AS linhas;

-- Papel RBAC: mesma regra da migration 0070 (vendedor vira closer, super_admin vira
-- admin, desconhecido vira closer). So cria quem ainda nao tem papel: reexecutar nao
-- desfaz o ajuste de papel que o Scott fizer na tela depois da virada.
INSERT INTO user_roles (usuario_id, role_id, organizacao_id)
SELECT u.id, r.id, u.organizacao_id
  FROM usuarios u
  JOIN roles r ON r.organizacao_id = u.organizacao_id
   AND r.codigo = CASE
     WHEN u.role = 'vendedor' THEN 'closer'
     WHEN u.role = 'super_admin' THEN 'admin'
     WHEN u.role IN ('admin','gerente','director','coordinator','operations','closer','sdr','leitor') THEN u.role
     ELSE 'closer' END
 WHERE NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.usuario_id = u.id);

SELECT 'auth_tokens' AS tabela,
       pg_temp.mz_carga('auth_tokens', 'legado.auth_tokens', 's.usuario_id IN (SELECT id FROM public.usuarios)') AS linhas;
SELECT 'metas' AS tabela,
       pg_temp.mz_carga('metas', 'legado.metas',
         's.usuario_id IN (SELECT id FROM public.usuarios) AND (s.criado_por IS NULL OR s.criado_por IN (SELECT id FROM public.usuarios))') AS linhas;

COMMIT;
