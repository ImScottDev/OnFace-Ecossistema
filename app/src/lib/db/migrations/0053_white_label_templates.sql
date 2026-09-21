-- Templates editáveis, inseridos uma vez por organização. O link é resolvido
-- no contexto da implantação White Label; nunca dispara envio automático.
INSERT INTO whatsapp_templates (organizacao_id, nome, categoria, conteudo, ativo)
SELECT o.id, 'Implantação White Label — solicitar materiais', 'pos_venda',
  'Olá, {{empresa}}! Tudo bem? Eu sou [seu nome], da Callface, e vou acompanhar sua implantação White Label. Para começarmos, preencha as informações de domínio, identidade visual, contato técnico e faturamento aqui: {{link_implantacao}}. Depois que recebermos os dados, validamos o material, configuramos o ambiente e orientamos sobre DNS. No final, marcamos uma reunião para apresentar tudo pronto. Qualquer dúvida, pode me chamar por aqui.', true
FROM organizacoes o
WHERE NOT EXISTS (SELECT 1 FROM whatsapp_templates t WHERE t.organizacao_id = o.id AND t.nome = 'Implantação White Label — solicitar materiais');

INSERT INTO email_templates (organizacao_id, nome, assunto, corpo, variaveis, categoria)
SELECT o.id, 'Implantação White Label — solicitar materiais', 'Próximos passos da implantação White Label',
  '<p>Olá, {{empresa}}.</p><p>Tudo bem? Eu sou [seu nome], da Callface, e serei o responsável por acompanhar sua implantação White Label.</p><p>Para iniciarmos a configuração do ambiente, peço que preencha as informações de domínio, identidade visual, contato técnico e faturamento no formulário abaixo:</p><p>{{link_implantacao}}</p><p>Depois que recebermos os dados, validaremos o material, configuraremos o ambiente e enviaremos as orientações de DNS quando necessário. Ao final, agendaremos uma reunião para apresentar o ambiente pronto e liberar os acessos administrativos.</p><p>Fico à disposição caso precise de ajuda.</p><p>Atenciosamente,<br>[seu nome]<br>Callface</p>',
  '["empresa", "link_implantacao"]'::jsonb, 'pos_venda'
FROM organizacoes o
WHERE NOT EXISTS (SELECT 1 FROM email_templates t WHERE t.organizacao_id = o.id AND t.nome = 'Implantação White Label — solicitar materiais');
