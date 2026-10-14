# Auditoria geral do ONFACE — 14/10/2026

Seis frentes mediram produção no mesmo dia, só leitura: fluxo comercial, dinheiro e
integridade, entrada e atendimento, pós-venda e carteira, confiabilidade, telas.
Todo número aqui foi medido em `callface_crm_mz`, no Stripe live ou no host de
produção. Nada foi corrigido durante a auditoria.

**Contexto que condiciona tudo:** a virada foi em 13/10. Quase todo o histórico do
funil foi produzido pelo CRM anterior e carregado; o código ONFACE passou a ser dono
dele ontem. O diagnóstico é do processo e do código que hoje o executa, não do
histórico do ONFACE.

---

## O quadro em uma frase

O ONFACE registra bem o que acontece dentro dele e **quase não sabe verificar o que
acontece fora**: 78% da receita vem de uma planilha sem contraparte auditável, 75% dos
contratos ativos não têm cobrança ligada, metade dos ganhos não sustenta o próprio
status, e os três maiores motores de trabalho do time — cadência, distribuição de lead
e implantação — estão construídos e desligados.

---

## A. Dinheiro em risco ou errado

| # | Achado | Valor | Conserto |
|---|---|---|---|
| A1 | 78% do MRR (PABX, **R$ 376.431,90**) vem da planilha e não tem contraparte auditável: não dá para reconciliar valor, cancelamento nem cobrança | — | Decisão |
| A2 | 319 de 424 contratos ativos (75%) sem assinatura no Stripe: **R$ 355.300/mês** declarados contra **R$ 51.058/mês** verificáveis. Os 265 legados estão há 23 meses sem fatura registrada | R$ 304 mil/mês sem prova de cobrança | Grande |
| A3 | Card "MRR de assinaturas" soma canceladas: mostra **R$ 153.708**, real **R$ 51.058** | R$ 102.649/mês inflados | **1 linha** |
| A4 | **R$ 565.527** de proposta enviada expirou — 157 propostas, **100% sem nenhuma visualização registrada**, mediana de 4,4 dias | R$ 565 mil | Pequeno |
| A5 | Espelho da conta Stripe compartilhada nunca marcado (0 de 383 assinaturas, 0 de 1.123 faturas): **R$ 37.611** de recebível do SaaS dentro do CRM. 4 das 6 faturas vencidas que o CS vê são da Matte, cliente do SaaS | R$ 37.611 cobrados do cliente errado | Médio |
| A6 | Inadimplência mede atraso pela emissão, não pelo vencimento. **76 das 86 faturas abertas não têm vencimento** | R$ 50.714 mal priorizados | Pequeno |
| A7 | **R$ 28.739/mês** de recorrência ativa invisível no MRR (empresa fora de `clientes`, sem empresa, ou `past_due`). Inclui 16 assinaturas numa empresa-placeholder que nenhuma tela abre | R$ 344 mil/ano | Decisão + pequeno |
| A8 | 37 serviços marcados CHURNED com assinatura ativa (carga do marco zero churnou quem entrou depois do corte, sem consultar o Stripe). **Reversível**: estado anterior guardado | R$ 15.936/mês | **Pequeno** |
| A9 | 41 assinaturas ativas de empresas cuja carteira está toda CHURNED; 6 empresas com serviço ativo e assinatura cancelada | R$ 15.251 + R$ 12.951/mês | Médio |
| A10 | 13 serviços com valor diferente da assinatura; 3 clientes pagando mais de R$ 1,2 mil/mês acima do contrato | R$ 3.797/mês | Pequeno |
| A11 | **R$ 9.823/mês** cobrando no Stripe sem existir no CRM | R$ 117 mil/ano | Pequeno |
| A12 | Dois cards chamados "canônico" com **R$ 97.296** de diferença (contratado × faturado) — a divergência é legítima, o rótulo não | — | Trivial |

**Já corrigido hoje:** Auvo, quantidade 24 → 1. Renovação de 18/10 caiu de R$ 67.557,20
para R$ 3.249,40. A alteração veio de fora do ONFACE (chave `stripe-node-retry-*`, SDK
Node; o ONFACE assina `onface-*`).

---

## B. Motores construídos e desligados

| # | Achado | Número |
|---|---|---|
| B1 | **Cadência não inscreve ninguém.** 1.364 de 1.365 leads fora; a tabela de inscrições tem **1 linha no banco inteiro**, travada há 6 dias. O gatilho é gravado na tela e nunca lido. "Primeiro contato inbound" (15 passos) nunca foi publicada | 1.364 leads sem follow-up automático |
| B2 | **Nenhuma política de dono configurada.** 381 leads órfãos, média 49 dias. De 07/10 a 13/10, **74% dos leads novos nasceram sem dono**. A tarefa de primeiro contato herda o dono nulo e some: **39 de 45 invisíveis para todos** | 381 leads |
| B3 | **A estação de implantação não existe.** 50 fulfillments: **50 ONBOARDING, 0 IMPLEMENTATION**. Os 185 serviços PABX ativos (R$ 362.507 de MRR) não têm estação técnica. Três modelos de pós-venda no código se contradizem | 94% do MRR sem implantação |
| B4 | **Contrato com assinatura eletrônica nunca produziu uma linha.** 446 contratos, 100% dos campos de assinatura nulos, justamente em PABX e White Label, que exigem contrato | 446 contratos |
| B5 | **`ofertas_comerciais` tem zero linhas.** A política da oferta, que o README chama de fonte da verdade do Ganho, nunca foi consultada em nenhum fechamento | 100% dos registros |
| B6 | Quatro rotinas rodam 1.440×/dia contra tabelas vazias (`fluxos-sweep`, `campanha-sweep`, `check-sequences`, `ai-sdr-*`) | 4.320 execuções/dia para o vazio |

---

## C. Verdade do dado

| # | Achado | Número |
|---|---|---|
| C1 | **Metade dos ganhos não se sustenta.** 313 de 624 (R$ 359.414) sem evidência nenhuma; 194 (R$ 281.626) com `manual_contract` que um backfill de hoje fabricou a partir do próprio status — circular, `verificado_por` nulo em 439 de 439 | R$ 641 mil |
| C2 | **SLA de Pré-vendas erra por fator 3.** `primeiro_contato_at` não é gravado quando um humano responde pelo Atendimento: 550 leads atendidos contam como parados. Os realmente parados são **299**, não 936 | 936 → 299 |
| C3 | **41% do WhatsApp fora de qualquer ficha** — 14.739 mensagens. 2.022 de 2.668 conversas sem lead, **754 casam por telefone com lead existente** | 14.739 mensagens |
| C4 | **435 clientes escreveram e ninguém respondeu** — média 35 dias, 63 na última semana. Não existe SLA de conversa parada | 435 conversas |
| C5 | 219 empresas duplicadas por **dois resolvedores com precedência diferente**: um é cego para as 47 empresas com CNPJ mascarado, o outro para as 124 com site e sem domínio | 219 empresas |
| C6 | 21 de 37 onboardings "concluídos" fecharam com **zero itens marcados**, em média 3,6 dias | 8% de confiabilidade |
| C7 | **139 colunas totalmente vazias** em produção; ~30 delas são renderizadas em tela (o bloco de endereço da empresa são 7 campos que nunca têm valor) | ~30 campos |
| C8 | 56 leads sem aquisição **não aparecem em tela nenhuma**; 90 divergências entre os dois modelos de etapa; `leads.status` é `'novo'` em 100% das 4.328 linhas | 146 registros |
| C9 | Os 294 clientes ativos têm **a mesma dona**; `responsavel_cs_id` nulo em 294 de 294 | 294 clientes |
| C10 | Detector de entrega parada é código morto: exige duas condições que o criador de board torna impossíveis. **0 riscos `ENTREGA_PARADA` em 532 riscos abertos**, com 5 boards parados há mais de 15 dias | 0 de 5 |

---

## D. Confiabilidade

| # | Achado | Risco |
|---|---|---|
| D1 | **Disco em 96%, 4,7 GB livres** — Postgres, Redis e uploads no mesmo volume. Log driver sem rotação, nenhum prune no deploy | Parada total. **Corrigido durante a auditoria: 15 GB livres (86%)**. Falta o prune no `deploy.sh` e `max-size` no log |
| D2 | **Operação cega.** Nenhuma retenção de log: o container é recriado no deploy e leva o histórico. "Erros das últimas 72h" é fisicamente impossível de responder. Sem `pg_stat_statements`, sem timing de página | Nenhum incidente investigável depois de um deploy |
| D3 | Fila `email-sequence` sem retenção: **47.373 jobs retidos**. Redis com `maxmemory=0` e `noeviction` — quando estourar, **recusa escrita e todas as filas param juntas** | Parada total |
| D4 | **Dois webhooks devolvem `ok:true` no catch** (WhatsApp e Apollo): o provedor entende que entregou e nunca reenvia. 124 webhooks de WhatsApp por hora | Mensagem de cliente perdida sem rastro |
| D5 | No Stripe, efeitos de pagamento em `.catch(() => {})` **com retorno de sucesso**: estorno e cancelamento que não entram no outbox somem. 13 `catch {}` + 204 `.catch` mudos, 72 deles sobre escrita | "0 falhados" é o que esse padrão produz |
| D6 | **40 de 49 chamadas HTTP externas sem timeout.** Workers com concorrência 1: um provedor lento congela a fila inteira sem erro no log | Pausa geral silenciosa |
| D7 | Só 2 de 11 webhooks persistem o que receberam. RD, Documenso e Microsoft não têm retomada nenhuma | Fato perdido se o processo cair |
| D8 | 18 jobs de WhatsApp falhados por chave duplicada (8 só hoje) — nenhuma mensagem perdida, mas o ruído esconde a próxima falha real. E **2 mensagens não saíram hoje** (`no LID found`) | Ruído + 2 falhas reais |
| D9 | **Reset de senha mente:** sem `RESEND_API_KEY` a tela diz "e-mail enviado" e nada sai | Usuário sem acesso sem saber por quê |
| D10 | `SUPABASE_URL` e `SUPABASE_SERVICE_KEY` em produção com **zero ocorrências no código** | Segredo exposto sem contrapartida |
| D11 | O desligamento do JIT do Postgres **nunca chegou à produção** (`jit=on`, source default). E não importa: nenhum plano medido chega perto do limiar. A premissa estava errada | Premissa, não efeito |

---

## E. Telas

| # | Achado |
|---|---|
| E1 | **`/design` aberto para qualquer usuário logado** — está no matcher do middleware e fora da lista de gestão. Mostra clientes fictícios, metas e nomes do time numa casca idêntica à do produto. **Conserto: uma linha** |
| E2 | **Existem dois menus.** O renderizado não é o declarado: 3 telas prontas marcadas como "Rota sem módulo", a única pendente não é marcada, 3 destinos inalcançáveis. O verificador oficial e a trava "pendente diz a verdade" validam a árvore que ninguém vê |
| E3 | **A mesma ficha muda conforme a porta de entrada:** pela empresa não se vê tarefa nem nota; pela pessoa não se vê arquivo. **326 reuniões, 512 tarefas e 4.737 notas** invisíveis dependendo de onde se clicou |
| E4 | **28 quebras do padrão único** — 47 consultas paralelas, 62 escritores, 19 componentes paralelos. Causa: **o backend Hono não foi desligado**; 13 rotas já estão mortas-vivas (montadas, zero consumidores) |
| E5 | 27 botões em 14 telas avisam e não fazem (todos com toast honesto). Mais concentrados em Atendimento (6) e Pipeline (5) |
| E6 | Excluir proposta tem duas regras: um caminho só aceita rascunho, o outro **permite excluir proposta já enviada** |

**O que está certo e não deve ser mexido:** dos 474 links internos, **zero levam a rota
inexistente**. Protótipo vazado em produção: **zero ativo** — há 5 fixtures fósseis, todas
neutralizadas pelo adaptador. Mas nenhum teste prende esses overrides: **5 asserts** é o
conserto mais barato da auditoria inteira.

---

## Ordem de ataque sugerida

**Hoje, custo quase zero, risco quase zero**
1. `/design` na lista de gestão — 1 linha (E1)
2. Filtrar status no card de MRR — 1 linha (A3)
3. `defaultJobOptions` na fila `email-sequence` + `maxmemory`/`allkeys-lru` no Redis (D3)
4. `onConflictDoNothing` no insert de mensagem do WhatsApp (D8)
5. Os dois webhooks devolverem 500 no catch (D4)
6. 5 asserts prendendo os overrides de fixture
7. Prune no fim do `deploy.sh` + `max-size` no log driver (D1, D2)

**Esta semana, impacto direto no time**
8. Reverter os 37 churns indevidos — o estado anterior está guardado (A8)
9. Publicar a cadência de primeiro contato e ligar o gatilho (B1)
10. Configurar a regra de distribuição e dar dono ao lead (B2)
11. `registrarPrimeiroContato` no envio humano do Atendimento — destrava medir todo o resto (C2)
12. Casar conversa de WhatsApp com lead por telefone + backfill dos 754 (C3)
13. Unificar a expiração de proposta (três implementações) e ligar bounce/abertura (A4)

**Decisões suas, antes de qualquer código**
- A1: o que fazer com os 78% do MRR que só existem na planilha
- A5/A7: de quem são as 96 assinaturas sem marca (R$ 25.834/mês cobrando)
- B3: qual dos três modelos de pós-venda vale
- B4/B5: contrato eletrônico e `ofertas_comerciais` — ligar ou apagar o módulo
- C1: reverificar os 194 ganhos com evidência fabricada
- C9: distribuir a carteira (294 clientes numa pessoa)
- A conta Stripe compartilhada: enquanto for uma só, alteração de fora se repete

---

## O que a auditoria não conseguiu medir

- **Erros das últimas 72h**: o log não sobrevive ao deploy (D2)
- **Tempo das telas pesadas**: exigiria forjar sessão de admin em produção; fora do escopo de leitura
- **Quantos webhooks chegaram** por provedor: só Stripe e Meta registram recebimento
- **A quem pertence o gap de R$ 128.799** entre a planilha de setembro e a soma dos serviços
- **Se o Documenso está quebrado ou apenas sem uso**: provar exigiria disparar uma assinatura real
- **Nenhuma tela foi aberta no navegador** — tudo foi medido por código, banco e Stripe
