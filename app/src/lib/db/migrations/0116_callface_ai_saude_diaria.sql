-- 0116 — Callface AI: saúde diária do cliente (última atividade real, sete sinais e semáforo)
--
-- Aditiva e idempotente. Nada é escrito no banco do SaaS; só toca o ONFACE.
--
-- Por que existe: o SaaS NÃO tem last_login/last_access. "Última atividade" é
-- derivada do uso real (chamada, sessão do copiloto, reunião) e precisa valer
-- SEM janela: o snapshot de 7/30 dias devolvia NULL para quem parou há mais de
-- 30 dias, justamente o cliente que o CS precisa ligar. Esta tabela guarda UMA
-- LINHA POR CLIENTE POR DIA: o estado de hoje e a série que dá tendência e
-- permite contar a história do semáforo.
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS callface_ai_saude_diaria;

CREATE TABLE IF NOT EXISTS callface_ai_saude_diaria (
  external_identity_id   uuid NOT NULL REFERENCES callface_ai_external_identities(id) ON DELETE CASCADE,
  dia                    date NOT NULL,                 -- dia civil em America/Sao_Paulo
  -- 1. Silêncio (último sinal de uso, sem janela)
  ultima_atividade_em    timestamp with time zone,
  ultima_chamada_em      timestamp with time zone,
  ultima_copiloto_em     timestamp with time zone,
  ultima_reuniao_em      timestamp with time zone,
  dias_silencio          integer,
  inicio_em              timestamp with time zone,      -- primeira licença paga (ou criação da organização)
  -- 2/3. Consumo × direito e licença ociosa
  usuarios_total         integer,
  usuarios_ativos        integer,
  licencas_pagas         integer,
  licencas_em_uso        integer,
  minutos_mes            numeric(12,2),
  minutos_contratados_mes numeric(12,2),                -- NULL = ilimitado ou desconhecido
  -- 5. Tendência (14 dias contra os 14 anteriores)
  minutos_14d            numeric(12,2),
  minutos_14d_anteriores numeric(12,2),
  -- 4. Adoção do copiloto (30 dias)
  copiloto_sessoes_30d   integer,
  copiloto_sugestoes_30d integer,
  copiloto_usadas_30d    integer,
  -- 6. Sinal de saída
  assinaturas_total      integer,
  assinaturas_canceladas integer,
  cancelada_em           timestamp with time zone,
  cancelamento_motivo    text,
  -- 7. Vencimento
  licenca_vence_em       timestamp with time zone,
  licencas_vencendo_30d  integer,
  licencas_vencendo_60d  integer,
  -- Veredito do dia
  semaforo               text NOT NULL DEFAULT 'sem_dado',
  motivos                jsonb NOT NULL DEFAULT '[]'::jsonb,
  calculado_em           timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (external_identity_id, dia),
  CONSTRAINT ck_callface_ai_saude_semaforo CHECK (semaforo IN ('verde','amarelo','vermelho','sem_dado'))
);

CREATE INDEX IF NOT EXISTS idx_callface_ai_saude_dia_semaforo
  ON callface_ai_saude_diaria (dia, semaforo);
