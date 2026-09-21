-- 0082 — no-show é estado da reunião, não campo do negócio (SPEC §23)
--
-- Medido: `negocios.no_show_em` está preenchido em 38 registros, e em exatamente
-- os mesmos 38 em que `negocios.status = 'no_show'`. A coluna não carrega
-- informação própria: é uma cópia do status legado. Nenhum código de runtime a
-- escreve — só o backfill histórico.
--
-- Enquanto isso `reunioes.status` tem só 'agendada' e 'cancelada' em 295 linhas:
-- a reunião a que o cliente faltou continua "agendada" para sempre. Uma auditoria
-- anterior já tinha tropeçado nisso ("realizadas era sempre 0, ninguém atualiza
-- reunioes.status") e contornado contando eventos.
--
-- Esta migration move o fato para onde ele mora: a reunião.
--
-- SÓ os casos sem ambiguidade. Dos 38 negócios com no-show, 34 entram: têm
-- exatamente uma reunião, e ela está 'agendada'. Ficam de fora, como caso de
-- reconciliação nomeado e NÃO resolvido por palpite:
--   · 1 negócio sem reunião nenhuma;
--   · 1 negócio com duas reuniões, sem como saber a qual o cliente faltou;
--   · 2 cujas reuniões já estavam 'cancelada' — cancelar antes e não aparecer
--     são fatos diferentes, e sobrescrever um com o outro apaga informação.
--     (A primeira versão desta migration sobrescreveu esses dois; foram
--     restaurados do backup pre-refactor-20260920.dump e o filtro entrou aqui.)
--
-- Aditiva: nenhuma coluna sai, e `negocios.no_show_em` continua como fallback de
-- leitura para o histórico que não pôde ser movido.
--
-- ROLLBACK:
--   UPDATE reunioes SET status = 'agendada'
--    WHERE status = 'no_show' AND id IN (SELECT id FROM reunioes WHERE status = 'no_show');

UPDATE reunioes r
   SET status = 'no_show', updated_at = r.updated_at
  FROM (
    SELECT n.id AS negocio_id, (array_agg(x.id))[1] AS reuniao_id
      FROM negocios n
      JOIN reunioes x ON x.negocio_id = n.id
     WHERE n.no_show_em IS NOT NULL AND x.status = 'agendada'
     GROUP BY n.id
    HAVING count(x.id) = 1
  ) unico
 WHERE r.id = unico.reuniao_id
   AND r.status <> 'no_show';
