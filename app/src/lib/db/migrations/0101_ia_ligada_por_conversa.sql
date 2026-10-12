-- Resposta automática de IA numa conversa de WhatsApp só acontece quando uma
-- pessoa LIGOU nela (ou quando o responsável pela conversa é um agente).
-- Antes, qualquer agente publicado respondia toda mensagem recebida, e só a
-- pausa manual segurava. Agora o padrão é desligado: nenhuma conversa existente
-- recebe resposta automática até alguém ligar na tela de Atendimento.
ALTER TABLE ai_sdr_contato_state
  ADD COLUMN IF NOT EXISTS ia_ligada_por uuid NULL REFERENCES usuarios(id),
  ADD COLUMN IF NOT EXISTS ia_ligada_em timestamptz NULL;
