-- 0146 — Uma venda de autoatendimento por assinatura.
--
-- Quem assina sozinho na plataforma e paga no Stripe vira venda no CRM
-- (`negocios.origem_negocio = 'self_checkout'`). Até aqui essas vendas só
-- existiam por carga manual, e NADA impedia a mesma assinatura virar duas
-- vendas: não havia vínculo entre o negócio e a assinatura que o originou.
--
-- O vínculo já existe no modelo: `negocios.servico_origem_id` aponta para o
-- serviço canônico, e o serviço canônico guarda `current_subscription_id`. O que
-- faltava era (a) preencher nos 21 negócios que a carga criou e (b) uma trava
-- que impeça o segundo.
--
-- Sem a trava, o automático que entra agora criaria venda repetida em toda
-- reentrega do webhook e em toda rodada do sync (de 30 em 30 min).
--
-- Aditiva e idempotente. Não cria, não apaga e não muda valor de venda nenhuma.
--
-- ROLLBACK:
--   DROP INDEX IF EXISTS uniq_negocio_self_checkout_por_servico;
--   (o backfill de servico_origem_id não precisa voltar: é o vínculo correto)

-- 1. Liga cada venda de autoatendimento ao serviço canônico da assinatura dela.
--    Casa por empresa + serviço vindo da plataforma (billing_source CALLFACE_AI).
--    Só preenche o que está vazio, e só quando a empresa tem UM serviço desses:
--    com dois, a escolha seria chute e o campo fica nulo (o automático resolve
--    daqui pra frente, porque ele nasce sabendo qual assinatura criou a venda).
UPDATE negocios n
   SET servico_origem_id = s.id
  FROM servicos_canonicos s
 WHERE n.origem_negocio = 'self_checkout'
   AND n.servico_origem_id IS NULL
   AND s.empresa_id = n.empresa_id
   AND s.billing_source = 'CALLFACE_AI'
   AND (SELECT count(*) FROM servicos_canonicos s2
         WHERE s2.empresa_id = n.empresa_id AND s2.billing_source = 'CALLFACE_AI') = 1;

-- 2. Uma venda de autoatendimento por serviço/assinatura. Parcial: não atrapalha
--    negócio comum (que pode nascer de um serviço, em expansão) nem venda de
--    autoatendimento antiga que ficou sem vínculo.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_negocio_self_checkout_por_servico
    ON negocios (servico_origem_id)
 WHERE origem_negocio = 'self_checkout' AND servico_origem_id IS NOT NULL;
