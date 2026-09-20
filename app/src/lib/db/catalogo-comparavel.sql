\pset tuples_only on
\pset format unaligned
\pset fieldsep '|'

-- COLUNAS: tabela|coluna|tipo|nullable|default
SELECT 'COL|'||c.relname||'|'||a.attname||'|'||format_type(a.atttypid, a.atttypmod)
       ||'|'||(CASE WHEN a.attnotnull THEN 'NOT NULL' ELSE 'NULL' END)
       ||'|'||COALESCE(pg_get_expr(d.adbin, d.adrelid), '-')
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
WHERE n.nspname = 'public' AND c.relkind IN ('r','p') AND a.attnum > 0 AND NOT a.attisdropped
ORDER BY 1;

-- INDICES
SELECT 'IDX|'||tablename||'|'||indexname||'|'||regexp_replace(indexdef, '^CREATE (UNIQUE )?INDEX [^ ]+ ON ', 'ON ')
FROM pg_indexes WHERE schemaname = 'public' ORDER BY 1;

-- CONSTRAINTS (pk, fk, unique, check)
SELECT 'CON|'||c.relname||'|'||con.conname||'|'||pg_get_constraintdef(con.oid)
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' ORDER BY 1;

-- ENUMS
SELECT 'ENUM|'||t.typname||'|'||string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder)
FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public' GROUP BY t.typname ORDER BY 1;

-- VIEWS
SELECT 'VIEW|'||c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('v','m') ORDER BY 1;

-- FUNCTIONS
SELECT 'FUNC|'||p.proname||'|'||pg_get_function_identity_arguments(p.oid)
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' ORDER BY 1;

-- TRIGGERS
SELECT 'TRG|'||c.relname||'|'||t.tgname
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY 1;
