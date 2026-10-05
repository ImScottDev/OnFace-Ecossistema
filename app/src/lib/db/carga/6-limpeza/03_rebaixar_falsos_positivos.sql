-- CARGA DA VIRADA · limpeza, passo 03 — tira do "pode excluir" o que tem
-- dependente vivo.
--
-- O passo 01 separou as marcações em `lixo_*` (candidato a descarte) e
-- `revisar_*` (problema de qualidade que contém cliente real). A guarda que
-- decide isso olha o que o registro TEM — negócio, contrato, fatura, serviço,
-- assinatura, cliente. Ela não olha duas coisas, e o verificador adversarial
-- pegou as duas:
--
--   1. CONVERSA. A guarda liga contato a lead por `contatos.lead_id`, que está
--      preenchido em 25 de 1.906 linhas (1,3%). A conversa real pendura em
--      `whatsapp_mensagens.contato_id`. Casando pelo telefone, há lead marcado
--      `lixo_` cujo número tem conversa de WhatsApp recente.
--
--   2. QUEM APONTA PARA A EMPRESA. A guarda de empresa checa o que a empresa
--      tem, nunca quem referencia ela. As 9 empresas de nome inválido
--      (O, X, M, E, B, L, z, ?, teste) somam 14 leads, 14 pessoas, 71 eventos
--      de timeline e 30 comunicações. A empresa "O" sozinha tem 4 leads e 32
--      eventos. Um DELETE nelas orfana tudo isso.
--
-- O prefixo `lixo_` autoriza exclusão — é o que está escrito no cabeçalho do
-- 01 e é como o Scott vai ler a planilha. Então o conserto é rebaixar para
-- `revisar_`, não discutir se o DELETE seria cuidadoso.
--
-- IDEMPOTENTE: depois de rodar não há mais `lixo_` com dependente.

-- 1. lead cujo telefone tem conversa de WhatsApp viva
UPDATE _carga_registros_suspeitos s
   SET motivo = 'revisar_' || substring(s.motivo from 6),
       detalhe = COALESCE(s.detalhe || ' · ', '') || 'rebaixado: telefone tem conversa de WhatsApp'
  FROM leads l
 WHERE l.id = s.entidade_id
   AND s.entidade = 'lead'
   AND s.motivo LIKE 'lixo_%'
   AND length(right(regexp_replace(COALESCE(l.telefone, l.whatsapp, ''), '[^0-9]', '', 'g'), 8)) = 8
   AND EXISTS (
     SELECT 1 FROM contatos c
      WHERE right(regexp_replace(COALESCE(c.telefone, ''), '[^0-9]', '', 'g'), 8)
          = right(regexp_replace(COALESCE(l.telefone, l.whatsapp, ''), '[^0-9]', '', 'g'), 8)
        AND EXISTS (SELECT 1 FROM whatsapp_mensagens w WHERE w.contato_id = c.id));

-- 2. empresa que tem lead ou pessoa apontando para ela
UPDATE _carga_registros_suspeitos s
   SET motivo = 'revisar_' || substring(s.motivo from 6),
       detalhe = COALESCE(s.detalhe || ' · ', '') || 'rebaixado: tem lead/pessoa vinculada'
 WHERE s.entidade = 'empresa'
   AND s.motivo LIKE 'lixo_%'
   AND (EXISTS (SELECT 1 FROM leads   l WHERE l.empresa_id = s.entidade_id)
     OR EXISTS (SELECT 1 FROM pessoas p WHERE p.empresa_id = s.entidade_id));

-- 3. pessoa espelho do lead rebaixado acompanha
UPDATE _carga_registros_suspeitos s
   SET motivo = 'revisar_' || substring(s.motivo from 6),
       detalhe = COALESCE(s.detalhe || ' · ', '') || 'rebaixado: lead de origem foi rebaixado'
  FROM pessoas p
 WHERE p.id = s.entidade_id
   AND s.entidade = 'pessoa'
   AND s.motivo LIKE 'lixo_%'
   AND EXISTS (SELECT 1 FROM _carga_registros_suspeitos s2
                WHERE s2.entidade = 'lead' AND s2.entidade_id = p.lead_id_legado
                  AND s2.motivo LIKE 'revisar_%');

DO $$
DECLARE lixo int; revisar int;
BEGIN
  SELECT count(*) INTO lixo    FROM _carga_registros_suspeitos WHERE motivo LIKE 'lixo_%';
  SELECT count(*) INTO revisar FROM _carga_registros_suspeitos WHERE motivo LIKE 'revisar_%';
  RAISE NOTICE '── pode excluir: % · revisar: %', lixo, revisar;
END $$;
