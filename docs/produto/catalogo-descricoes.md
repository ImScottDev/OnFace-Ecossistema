# Catálogo: descrições comerciais para aprovar

> 13/10/2026. Para o Scott aprovar. Depois da aprovação, a descrição proposta
> sobe para a `description` do Product no Stripe (live), pelo fluxo de catálogo.
> **Nada foi escrito no Stripe.** Até lá o texto vive só no ONFACE.

## Como o ONFACE usa isto

- **Nome** do item = nome do Product no Stripe (`servicos_catalogo.nome`, espelhado pela sincronização).
- **Variação** = apelido do Price sem repetir o produto (`lib/catalogo/rotulos.ts`, `variacaoAmigavel`):
  "PABX - Canais — 04 Canais" aparece como "04 Canais"; "PABX - Linha 4004 — Linha 4004 | Até 800min" como "Linha 4004 · Até 800min".
- **Descrição** = `servicos_catalogo.descricao_comercial` (do ONFACE, migration 0109) e, se vazia, a `description` do Stripe.
  A sincronização com o Stripe nunca sobrescreve a comercial.
- A linha da proposta guarda a descrição no momento em que é criada: é o texto que o cliente leu no link público, no PDF e no contrato.
  Linhas antigas, gravadas sem descrição, mostram a do catálogo.

Para mudar um texto: `UPDATE servicos_catalogo SET descricao_comercial = '…' WHERE stripe_product_id = '…'` (a migration 0109 não sobrescreve texto já preenchido).

## Os 15 produtos vendáveis (família definida, entram no construtor de proposta)

| Família | Produto (nome no Stripe) | Product | Descrição atual no Stripe | Descrição proposta (ONFACE) |
|---|---|---|---|---|
| Callface AI | Callface AI - Agente IA | `prod_VBSyiHwwDQQ0rn` | Add-on para liberar Agente IA dentro da plataforma Callface AI. Permite criar até 3 agentes inteligentes para apoiar atendimento, prospecção ou automações comerciais. | Agentes de IA que trabalham com o seu time em prospecção, atendimento e automações comerciais. Libera até 3 agentes dentro da plataforma Callface AI. |
| Callface AI | Callface AI - Business | `prod_UXZFswcs0JwBwC` | Plano para empresas com operação de maior volume. Inclui usuários ilimitados, 10.000 minutos de chamadas por mês, gestão centralizada, relatórios avançados e estrutura para grandes equipes. | Para operações de alto volume que precisam crescer sem limite de usuários. Inclui usuários ilimitados, 10.000 minutos de chamadas por mês, gestão centralizada e relatórios avançados. |
| Callface AI | Callface AI - Full | `prod_VBStibYEs8zaMv` | Plano completo para equipes que precisam de mais capacidade operacional, chamadas, relatórios, automações inteligentes, processos e gestão completa da equipe. | A plataforma completa para o time comercial ligar mais e gerir melhor. Inclui chamadas, relatórios avançados, automações inteligentes e gestão da equipe, cobrado por usuário. |
| Callface AI | Callface AI - Minutos Extras | `prod_VBSy6AHLTtHvCW` | Minutos adicionais para complementar a franquia de chamadas do cliente. O time comercial define a quantidade de minutos na proposta. | Minutos adicionais para a operação não parar quando a franquia acaba. Cobrados por minuto, na quantidade definida na proposta, uma vez ou todo mês. |
| Callface AI | Callface AI - Pacote 500 Minutos | `prod_VBSzMAyCF6vQmC` | Pacote adicional de 500 minutos para complementar a franquia de chamadas do cliente. | 500 minutos a mais na franquia de chamadas, por um valor fechado. Pode ser contratado uma vez ou todo mês. |
| Callface AI | Callface AI - Pro | `prod_VGD0gNcwJLDTMC` | Plano avançado que combina os recursos do Callface AI Full com Agente IA para apoiar prospecção, atendimento e automações comerciais dentro da plataforma. | Tudo do plano Full com Agente IA incluso, para automatizar prospecção, atendimento e follow-up sem aumentar o time. |
| Callface AI | Callface AI - Starter | `prod_UFcYI8riFCtqdq` | Plano inicial para equipes que estão começando. Inclui 300 minutos de chamadas por mês, transcrição automática para insights, relatórios avançados, automações inteligentes de processos e gestão completa da equipe. | Para equipes que estão começando a vender por telefone com inteligência artificial. Inclui 300 minutos de chamadas por mês, transcrição automática, relatórios e automações de processo. |
| PABX | PABX - BINA Inteligente | `prod_VBTtaQiq4g8Efp` | Serviço de BINA Inteligente com franquia de minutos para identificação de chamadas com DDD de destino. | Mais ligações atendidas: o cliente vê na tela um número com o DDD dele. Inclui franquia mensal de 1.000 a 3.000 minutos, conforme o pacote. |
| PABX | PABX - Canais | `prod_VBTtctBbOH0NK5` | Canais simultâneos para ampliar a capacidade de chamadas do PABX. | Define quantas chamadas a empresa faz e recebe ao mesmo tempo. Escolha o pacote pelo pico da operação, de 1 a 128 canais simultâneos. |
| PABX | PABX - Hardware | `prod_VBTX0pnNCGRI3W` | Locação ou venda de equipamentos de telefonia, como telefones IP, headsets, gateways, ATAs e nobreaks. | Equipamentos para usar com o PABX: telefones IP, aparelhos Wi-Fi, gateways e ampliação de armazenamento, em locação mensal ou venda. |
| PABX | PABX - Linhas | `prod_VBTJJbZONMN6Sy` | Linha especial 4003/4004/3003/0800 para operação receptiva com regras comerciais e tarifárias próprias. | Números para a empresa receber e fazer chamadas: linha SIP e números nacionais 0800, 4003, 4004 e 3003 para o atendimento receptivo. Cada linha tem a sua franquia e tarifa. |
| PABX | PABX - Minutos Extras | `prod_VBTnIIwm7oMsAR` | dicional de minutos para chamadas nacionais ou franquias mensais da operação PABX. | Minutos adicionais para chamadas nacionais quando a franquia do PABX não basta. Cobrados por minuto, de forma avulsa ou como franquia mensal. |
| PABX | PABX - Ramal | `prod_VBTFygSQgjTg2d` | Ramal PABX para usuários, atendimento, operação interna ou fale à vontade, conforme a variação contratada. | Ramal em nuvem para cada pessoa ou posição de atendimento, sem central física no escritório. O interno fala entre ramais; o externo também liga para fora. |
| White Label | Callface AI White Label - Licença | `prod_VBT1z51A9QFKtB` | Licença mensal White Label Callface AI, cobrada conforme a quantidade de licenças ativadas pelo cliente dentro do limite reservado em contrato. | A plataforma Callface AI com a sua marca, para revender aos seus clientes. Você paga só pelas licenças ativadas no mês, dentro do limite reservado em contrato, e o valor por licença cai conforme o volume. |
| White Label | Callface AI White Label - Setup | `prod_VBT0qY3SQZS5Ht` | Taxa de setup e reserva de licenças para ativação do ambiente White Label Callface AI. O valor é calculado conforme a quantidade de licenças reservadas no contrato. | Implantação do ambiente White Label com a sua marca e reserva das licenças contratadas. Cobrança única, calculada pela quantidade de licenças reservadas. |

## O que vi no catálogo e precisa de decisão (não mexi)

- **White Label - Licença** tem 5 Prices avulsos que são cobranças pontuais, não variações de venda:
  "White Label - Clientes Ref. Junho/Julho/Agosto" e "Parcelamento Matte - 01/03 e 02/02". Hoje aparecem como variações no seletor.
  Sugestão: arquivar esses Prices no Stripe (ou desativar no espelho) para o vendedor não escolher um deles numa proposta nova.
- **Callface AI - Pacote 500 Minutos** tem dois Prices "Avulso": R$ 99,90 (duplicado) e R$ 105,00. Falta decidir qual é o preço vigente.
- **Callface AI - Starter**, **Full** e **Agente IA** têm Prices avulsos sem apelido no Stripe (aparecem como "Avulso"). Vale dar um apelido que diga o que é.
- **PABX - Minutos Extras**: a description do Stripe começa com "dicional" (falta o "A").
- Os 40 Products sem família (legado: "CALLFACE AI", "SETUP", "Cold Calling", "PARCEIRO G30"…) não entram no construtor de proposta e ficaram fora desta lista.
