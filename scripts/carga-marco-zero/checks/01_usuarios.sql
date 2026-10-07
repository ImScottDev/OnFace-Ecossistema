-- CHECK 01 · usuarios e acesso (mapa secao 7: usuarios 16; qa.% 0).
\set ON_ERROR_STOP on
\ir _ck.sql
DO $$
DECLARE f text := '';
BEGIN
  f := f || pg_temp.ck('usuarios', (SELECT count(*) FROM usuarios), pg_temp.esp('usuarios'));
  f := f || pg_temp.ck('usuarios qa.%', (SELECT count(*) FROM usuarios WHERE email LIKE 'qa.%'), 0);
  f := f || pg_temp.ck('usuario sem papel (user_roles)', (SELECT count(*) FROM usuarios u WHERE NOT EXISTS (SELECT 1 FROM user_roles r WHERE r.usuario_id = u.id)), 0);
  f := f || pg_temp.ck('usuario sem senha_hash', (SELECT count(*) FROM usuarios WHERE senha_hash IS NULL OR senha_hash = ''), 0);
  f := f || pg_temp.ck('usuarios com team_id', (SELECT count(*) FROM usuarios WHERE team_id IS NOT NULL), 0);
  f := f || pg_temp.ck('auth_tokens', (SELECT count(*) FROM auth_tokens), (SELECT count(*) FROM legado.auth_tokens));
  f := f || pg_temp.ck('metas', (SELECT count(*) FROM metas), (SELECT count(*) FROM legado.metas));
  f := f || pg_temp.ck('api_tokens (deve ficar vazio)', (SELECT count(*) FROM api_tokens), 0);
  f := f || pg_temp.ck('organizacoes', (SELECT count(*) FROM organizacoes), (SELECT count(*) FROM legado.organizacoes));
  f := f || pg_temp.ck('usuarios.updated_at diferente de prod',
             (SELECT count(*) FROM usuarios u JOIN legado.usuarios l ON l.id = u.id WHERE u.updated_at IS DISTINCT FROM l.updated_at), 0);
  IF f <> '' THEN RAISE EXCEPTION E'check 01 VERMELHO:%', f; END IF;
  RAISE NOTICE 'check 01 verde';
END $$;
