-- Descrição comercial do catálogo, mantida pelo ONFACE (13/10/2026).
--
-- O nome do produto é o do Stripe (servicos_catalogo.nome) e a sincronização
-- sobrescreve `descricao` com a description do Stripe a cada ciclo. Várias delas
-- são técnicas ou estão vazias, e é esse texto que o cliente lê na proposta.
-- `descricao_comercial` é do ONFACE: a sincronização não a toca, e ela ganha da
-- description do Stripe em toda tela (editor, link público, PDF, contrato).
-- Os textos estão em docs/produto/catalogo-descricoes.md para o Scott aprovar e,
-- depois, subirmos ao Stripe.
--
-- Idempotente: a coluna só nasce uma vez e o texto só entra onde ainda não há
-- descrição comercial (uma edição posterior nunca é sobrescrita por esta migration).

ALTER TABLE servicos_catalogo ADD COLUMN IF NOT EXISTS descricao_comercial text;

UPDATE servicos_catalogo sc
   SET descricao_comercial = v.texto
  FROM (VALUES
    ('prod_UFcYI8riFCtqdq', 'Para equipes que estão começando a vender por telefone com inteligência artificial. Inclui 300 minutos de chamadas por mês, transcrição automática, relatórios e automações de processo.'),
    ('prod_VBStibYEs8zaMv', 'A plataforma completa para o time comercial ligar mais e gerir melhor. Inclui chamadas, relatórios avançados, automações inteligentes e gestão da equipe, cobrado por usuário.'),
    ('prod_VGD0gNcwJLDTMC', 'Tudo do plano Full com Agente IA incluso, para automatizar prospecção, atendimento e follow-up sem aumentar o time.'),
    ('prod_UXZFswcs0JwBwC', 'Para operações de alto volume que precisam crescer sem limite de usuários. Inclui usuários ilimitados, 10.000 minutos de chamadas por mês, gestão centralizada e relatórios avançados.'),
    ('prod_VBSyiHwwDQQ0rn', 'Agentes de IA que trabalham com o seu time em prospecção, atendimento e automações comerciais. Libera até 3 agentes dentro da plataforma Callface AI.'),
    ('prod_VBSy6AHLTtHvCW', 'Minutos adicionais para a operação não parar quando a franquia acaba. Cobrados por minuto, na quantidade definida na proposta, uma vez ou todo mês.'),
    ('prod_VBSzMAyCF6vQmC', '500 minutos a mais na franquia de chamadas, por um valor fechado. Pode ser contratado uma vez ou todo mês.'),
    ('prod_VBTFygSQgjTg2d', 'Ramal em nuvem para cada pessoa ou posição de atendimento, sem central física no escritório. O interno fala entre ramais; o externo também liga para fora.'),
    ('prod_VBTJJbZONMN6Sy', 'Números para a empresa receber e fazer chamadas: linha SIP e números nacionais 0800, 4003, 4004 e 3003 para o atendimento receptivo. Cada linha tem a sua franquia e tarifa.'),
    ('prod_VBTtctBbOH0NK5', 'Define quantas chamadas a empresa faz e recebe ao mesmo tempo. Escolha o pacote pelo pico da operação, de 1 a 128 canais simultâneos.'),
    ('prod_VBTtaQiq4g8Efp', 'Mais ligações atendidas: o cliente vê na tela um número com o DDD dele. Inclui franquia mensal de 1.000 a 3.000 minutos, conforme o pacote.'),
    ('prod_VBTnIIwm7oMsAR', 'Minutos adicionais para chamadas nacionais quando a franquia do PABX não basta. Cobrados por minuto, de forma avulsa ou como franquia mensal.'),
    ('prod_VBTX0pnNCGRI3W', 'Equipamentos para usar com o PABX: telefones IP, aparelhos Wi-Fi, gateways e ampliação de armazenamento, em locação mensal ou venda.'),
    ('prod_VBT1z51A9QFKtB', 'A plataforma Callface AI com a sua marca, para revender aos seus clientes. Você paga só pelas licenças ativadas no mês, dentro do limite reservado em contrato, e o valor por licença cai conforme o volume.'),
    ('prod_VBT0qY3SQZS5Ht', 'Implantação do ambiente White Label com a sua marca e reserva das licenças contratadas. Cobrança única, calculada pela quantidade de licenças reservadas.')
  ) AS v(stripe_product_id, texto)
 WHERE sc.stripe_product_id = v.stripe_product_id
   AND sc.descricao_comercial IS NULL;
