-- Normaliza RBAC: papeis, o mapa papel->permissao e o vinculo usuario->papel.
--
-- As 16 permissoes do SPEC 31 ja estavam semeadas pela migration 0058, mas
-- `roles`, `role_permissions` e `user_roles` estavam VAZIAS: a autorizacao
-- continuava sendo a string `usuarios.role` lida por funcoes booleanas grossas
-- (isAdminView / isPersonalView), sem permissao granular nenhuma.
--
-- O MAPA ABAIXO NAO INVENTA POLITICA. Ele traduz o que o sistema ja faz hoje:
--
--   admin, super_admin, gerente, director, coordinator, operations
--       -> `isAdminView` devolve true e eles veem/administram tudo;
--   closer, sdr
--       -> `isPersonalView`: trabalham vendas e pre-vendas com os proprios
--          dados, e a UI nao esconde nada alem do que ja e adminOnly;
--   leitor
--       -> so /dashboard e /relatorios: leitura, nenhuma acao.
--
-- A UNICA permissao que nao e derivavel do comportamento atual e
-- `sales.approve_discount`: alcada de desconto nao existe no sistema hoje,
-- ninguem a exerce. Ela fica so com admin, que e o padrao restritivo. Quem
-- aprova desconto e decisao de negocio do Kaua, nao deducao de codigo.

BEGIN;

-- 1. Papeis, um por organizacao. `sistema = true` marca papel que o produto
--    define e o cliente nao pode apagar.
INSERT INTO roles (organizacao_id, codigo, nome, descricao, sistema)
SELECT o.id, p.codigo, p.nome, p.descricao, true
  FROM organizacoes o
 CROSS JOIN (VALUES
   ('admin',       'Administrador', 'Acesso total, incluindo configuracao e usuarios'),
   ('gerente',     'Gerente',       'Visao agregada da empresa e gestao operacional'),
   ('director',    'Diretoria',     'Visao executiva agregada'),
   ('coordinator', 'Coordenacao',   'Gestao de time'),
   ('operations',  'Operacoes',     'Administra configuracao, pipeline, produtos e automacoes'),
   ('closer',      'Closer',        'Fecha vendas; trabalha os proprios negocios'),
   ('sdr',         'SDR',           'Pre-vendas; trabalha as proprias aquisicoes'),
   ('leitor',      'Leitor',        'Somente leitura de relatorio')
 ) AS p(codigo, nome, descricao)
ON CONFLICT DO NOTHING;

-- 2. Mapa papel -> permissao.
WITH gestao AS (SELECT unnest(ARRAY['admin','gerente','director','coordinator','operations']) AS codigo),
     operacao AS (SELECT unnest(ARRAY['closer','sdr']) AS codigo)
INSERT INTO role_permissions (role_id, permission_id)
-- 2a. Gestao ve e administra tudo, menos a alcada de desconto.
SELECT r.id, pe.id
  FROM roles r
  JOIN gestao g ON g.codigo = r.codigo
  JOIN permissions pe ON pe.codigo <> 'sales.approve_discount'
UNION
-- 2b. Alcada de desconto: so admin, por ser o padrao restritivo.
SELECT r.id, pe.id
  FROM roles r JOIN permissions pe ON pe.codigo = 'sales.approve_discount'
 WHERE r.codigo = 'admin'
UNION
-- 2c. Operacao comercial: trabalha venda e aquisicao, ve empresa e carteira,
--     usa a IA. Nao configura nada.
SELECT r.id, pe.id
  FROM roles r
  JOIN operacao o ON o.codigo = r.codigo
  JOIN permissions pe ON pe.codigo IN (
    'acquisition.read','acquisition.manage','sales.read','sales.manage',
    'companies.read','companies.write','cs.read','ai.use')
UNION
-- 2d. Leitor: so as leituras que alimentam relatorio.
SELECT r.id, pe.id
  FROM roles r JOIN permissions pe ON pe.codigo LIKE '%.read'
 WHERE r.codigo = 'leitor'
ON CONFLICT DO NOTHING;

-- 3. Vinculo usuario -> papel, a partir da string que vale hoje. Os papeis
--    legados sao normalizados igual `normalizeRole`: vendedor vira closer e
--    super_admin vira admin.
INSERT INTO user_roles (usuario_id, role_id, organizacao_id)
SELECT u.id, r.id, u.organizacao_id
  FROM usuarios u
  JOIN roles r ON r.organizacao_id = u.organizacao_id
   AND r.codigo = CASE
     WHEN u.role = 'vendedor' THEN 'closer'
     WHEN u.role = 'super_admin' THEN 'admin'
     WHEN u.role IN ('admin','gerente','director','coordinator','operations','closer','sdr','leitor') THEN u.role
     ELSE 'closer'
   END
ON CONFLICT DO NOTHING;

COMMIT;

-- Reversao:
--   DELETE FROM user_roles;
--   DELETE FROM role_permissions;
--   DELETE FROM roles WHERE sistema = true;
