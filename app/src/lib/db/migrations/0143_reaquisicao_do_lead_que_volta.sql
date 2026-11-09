-- O lead que volta pode abrir um processo novo (09/11/2026).
--
-- A 0069 gravou a premissa "um lead vira no maximo uma aquisicao" num indice
-- unico global sobre `lead_legado_id`. Ela contradiz a regra do dominio, que diz
-- que Empresa e Pessoa sao identidades persistentes e que processos historicos
-- distintos podem compartilhar a identidade: quem ja comprou, perdeu ou foi
-- desqualificado e volta, volta como PROCESSO NOVO, nao como o mesmo.
--
-- O que isso custou, medido em producao na semana de 01 a 07/11/2026: 11 pessoas
-- que ja estavam na base reconverteram pela midia paga e NENHUMA gerou aquisicao.
-- A entrada legada seguiu (o `updated_at` do lead foi tocado) e a ponte canonica
-- falhou com 23505 em todas. Sem aquisicao nova nao nasce cartao, nem etapa, nem
-- responsavel: 9 das 11 nao receberam nenhuma atividade nem tarefa depois de
-- voltar, e 3 seguem paradas em Desqualificado. Levantaram a mao e a casa nao viu.
--
-- A correcao mantem a intencao original e corrige o alcance: o que nao pode
-- existir em duplicata e o processo ABERTO. Duas aquisicoes abertas para o mesmo
-- lead seriam dois cartoes do mesmo processo no board, e isso continua proibido.
-- Uma aquisicao nova depois que a anterior fechou e o comportamento desejado.
--
-- Efeito previsto nos 11 casos reais: 7 passam a abrir processo novo (os que
-- tinham a aquisicao fechada: desqualificados, nutricao, oportunidade ja
-- convertida); 4 seguem sem duplicar, porque a aquisicao deles esta ABERTA e
-- alguem ja esta trabalhando - para esses o sinal vem do `last_touch_at`, que
-- esta no mesmo commit.
--
-- Seguranca: o indice novo e ESTRITAMENTE mais estreito que o antigo (mesma
-- coluna, mais um predicado), entao todo estado que passava no antigo passa no
-- novo. Nao ha risco de a criacao falhar por dado existente.

BEGIN;

DROP INDEX IF EXISTS uq_aquisicoes_lead_legado;

-- Um lead tem no maximo uma aquisicao ABERTA. Fechada nao bloqueia a proxima.
CREATE UNIQUE INDEX IF NOT EXISTS uq_aquisicoes_lead_legado_aberta
    ON aquisicoes (lead_legado_id)
 WHERE lead_legado_id IS NOT NULL AND closed_at IS NULL;

-- A leitura por lead legado passa a varrer mais de uma linha por lead (historico
-- de processos). Sem este indice a tela do lead e a reconciliacao fariam seq scan
-- em `aquisicoes` a cada abertura.
CREATE INDEX IF NOT EXISTS idx_aquisicoes_lead_legado_historico
    ON aquisicoes (lead_legado_id, created_at DESC)
 WHERE lead_legado_id IS NOT NULL;

COMMIT;

-- Reversao (volta a proibir reaquisicao; so e aplicavel se nenhum lead tiver
-- ganhado a segunda aquisicao ainda, por isso o indice antigo entra sem IF NOT
-- EXISTS: se houver historico, a criacao falha e avisa em vez de apagar dado):
--   BEGIN;
--   DROP INDEX IF EXISTS uq_aquisicoes_lead_legado_aberta;
--   DROP INDEX IF EXISTS idx_aquisicoes_lead_legado_historico;
--   CREATE UNIQUE INDEX uq_aquisicoes_lead_legado
--       ON aquisicoes (lead_legado_id) WHERE lead_legado_id IS NOT NULL;
--   COMMIT;
