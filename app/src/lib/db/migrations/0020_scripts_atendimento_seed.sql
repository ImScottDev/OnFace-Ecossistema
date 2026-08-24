-- Catálogo inicial de roteiros internos. Idempotente por organização e título:
-- não sobrescreve edição do time nem cria duplicatas ao reaplicar migration.
INSERT INTO scripts_atendimento (organizacao_id, titulo, categoria, conteudo)
SELECT o.id, s.titulo, s.categoria, s.conteudo
FROM organizacoes o
CROSS JOIN (VALUES
  ('Qualificação inicial', 'pre_vendas', E'Objetivo: entender contexto antes de apresentar solução.\n1. Confirmar quem é a pessoa e o papel dela na decisão.\n2. Perguntar como o processo funciona hoje e onde há retrabalho ou perda de oportunidade.\n3. Registrar dor, urgência, impacto e próximo passo combinado.\nRegra: não prometer diagnóstico, integração ou resultado que não esteja confirmado no CRM.'),
  ('Follow-up de proposta ou reunião', 'comercial_b2b', E'Revisar a última atividade, a proposta vigente e o próximo passo combinado.\nPerguntar o que mudou desde a conversa e se existe algum ponto impedindo a decisão.\nSeparar dúvida de escopo, prazo, investimento e aprovação interna.\nEncerrar com responsável e data do próximo passo registrados no CRM.'),
  ('Levantamento para implantação', 'implantacao_entrega', E'Confirmar escopo contratado e responsável operacional do cliente.\nMapear acessos, dados, dependências e riscos que podem impedir o início.\nRegistrar o que depende do cliente e o que depende da equipe.\nNão marcar entrega como concluída sem evidência no fulfillment.'),
  ('Primeiro contato de onboarding', 'onboarding', E'Alinhar objetivo do cliente, participantes e critério de sucesso.\nApresentar a sequência de treinamento e execução prevista para o serviço contratado.\nValidar a próxima sessão e os responsáveis por cada pendência.\nRegistrar bloqueios na timeline e escalar somente com contexto.'),
  ('Acompanhamento de saúde e valor', 'cs', E'Revisar uso, resultado percebido, pendências abertas e risco de perda.\nPerguntar o que precisa ser ajustado para o cliente avançar.\nDiferenciar problema de adoção, suporte, escopo e cobrança.\nRegistrar plano de ação com dono e prazo, sem fabricar health score.'),
  ('Cobrança e inadimplência', 'cobranca_financeiro', E'Conferir fatura, vencimento, valor, contrato e histórico antes de abordar o cliente.\nRegistrar canal, data, retorno e promessa de pagamento quando houver.\nNão alterar status financeiro sem confirmação no dado de cobrança.\nEscalar divergência de valor, contrato ou Stripe para o responsável financeiro.')
) AS s(titulo, categoria, conteudo)
WHERE NOT EXISTS (
  SELECT 1 FROM scripts_atendimento existente
  WHERE existente.organizacao_id = o.id AND existente.titulo = s.titulo
);
