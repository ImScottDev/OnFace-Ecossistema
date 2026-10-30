-- Esquema `legado` (ONF-0024, 27/10/2026): 83 tabelas estrangeiras (postgres_fdw)
-- apontando para callface_freshprod_20261012_2250, banco que não existe mais.
-- Qualquer leitura dava erro. Foi criado pela carga do marco zero
-- (scripts/carga-marco-zero/00_preparar.sql), que o recria quando roda.
-- Só remove se TUDO no esquema for tabela estrangeira: dado real nunca sai daqui.
DO $$
BEGIN
  IF to_regnamespace('legado') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'legado' AND c.relkind <> 'f')
  THEN
    EXECUTE 'DROP SCHEMA legado CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_foreign_server WHERE srvname = 'legado')
     AND to_regnamespace('legado') IS NULL THEN
    EXECUTE 'DROP SERVER legado CASCADE';
  END IF;
END $$;
