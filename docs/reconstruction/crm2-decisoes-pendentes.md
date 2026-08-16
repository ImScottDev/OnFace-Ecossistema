# CRM 2.0 — Decisões Pendentes (checkpoint pro Kauã)

> Regra: aqui só entra decisão que altera dinheiro, regra comercial, permissão,
> dado histórico ou comportamento de venda. Decisão técnica/UX eu decido e
> sigo — não entra aqui. Formato: contexto → o que decidi fazer por padrão
> (sempre a opção mais conservadora/real) → o que precisa da tua confirmação.

Sessão iniciada em 10/08/2026, execução autônoma de ponta a ponta (mandato do Kauã).

---

## 1. Badge "Qualificado" em Contatos & Empresas

**Contexto**: não existe campo `relacionamento` no schema. Cliente = `leads.tipo='cliente'` (real). Lead = demais. "Qualificado" não tem fonte explícita — a única regra real existente no sistema hoje é do board SDR (negócio ativo fora de ganho/perdido).

**Decidido por padrão**: usar "tem negócio ativo vinculado" como regra de "Qualificado". Já implementado e documentado no código.

**Precisa confirmar**: essa é a regra certa, ou "Qualificado" deveria significar outra coisa (ex: SDR marcou como qualificado manualmente, sem precisar ter negócio aberto)?

---

## 2. Assinatura digital de contratos (fluxo Propostas → PABX)

**Contexto**: o fluxo novo de Propostas (10/08) precisa que o cliente formalize contrato antes do pagamento pra produtos que exigem contrato (hoje só PABX). Não existe nenhuma integração de assinatura digital qualificada no sistema (DocuSign, Clicksign, etc) — confirmado por auditoria, zero código/schema relacionado.

**Decidido por padrão**: implementei um "aceite eletrônico simples" — cliente confirma nome completo numa página pública, sistema grava nome + IP + timestamp em `contratos.assinadoNome/assinadoIp/assinadoEm`, rotulado explicitamente na UI como "não é assinatura digital com certificação". Isso desbloqueia o fluxo PABX ponta a ponta (aceite → contrato → Won → evidência) sem fingir uma validação jurídica que o sistema não tem.

**Precisa confirmar**: quando você decidir a ferramenta de assinatura (você mencionou que ia procurar opção open source/gratuita), a integração real substitui esse aceite simples no mesmo ponto do fluxo (`assinarContratoPublico` em `lib/crm/proposta-publica.ts`) — não deve mudar o resto da arquitetura (Won/evidência/notificação continuam iguais, só o que conta como "assinado" muda).

## 3. Cobrança PABX pós-assinatura — sem billing automático

**Contexto**: quando um contrato PABX é assinado (aceite simples), não existe nenhuma automação de cobrança pra esse produto (diferente do Callface AI, que já usa Stripe checkout). Implementei uma tarefa manual real ("Cobrar X — sem billing automático") pro responsável do negócio, prioridade alta, vencimento em 1 dia.

**Precisa confirmar**: isso é aceitável como processo por ora (cobrança manual via time comercial/financeiro), ou existe uma forma de cobrança PABX que eu não encontrei no código (ex: emitido fora do CRM, direto na operadora)?

---

## 4. White Label exige contrato assinado antes do pagamento?

**Contexto**: não existia nenhum item de catálogo White Label ativo até 16/08 (Commercial Core, ADR-EXEC-020) — não dava pra fechar o fluxo ponta a ponta sem criar um. `requer_contrato` decide se o fluxo pós-aceite é proposta→pagamento (como Callface AI) ou proposta→contrato→assinatura→pagamento (como PABX).

**Decidido por padrão**: `requer_contrato=true`, mesmo tratamento de PABX (reseller com compromisso de infra, não é self-serve tipo SaaS).

**Precisa confirmar**: essa é a política certa pra White Label, ou o produto real que vocês vendem é mais parecido com Callface AI (aceite → pagamento direto, sem contrato formal)? Reversível sem tocar em código — é só um campo no catálogo (`servicos_catalogo.requer_contrato`).

## 5. Item "avulso" de proposta — sempre ONE_TIME?

**Contexto**: `proposta_itens.tipo` tem só 3 valores estruturais (`recorrente`|`avulso`|`setup`), mas `revenue_nature` do domínio novo tem 6 (`MRR`|`SETUP`|`PROJECT`|`ONE_TIME`|`USAGE`|`HARDWARE`). Faltava uma correspondência clara pra "avulso".

**Decidido por padrão**: `avulso` → `ONE_TIME` (opção mais conservadora — não presume que seja consumo variável nem projeto grande).

**Precisa confirmar**: existe hoje algum item "avulso" no catálogo que devesse virar `PROJECT` (ex: uma implantação grande, cobrada por escopo) ou `USAGE` (ex: minutos excedentes, consumo variável — "Pacote 500min Adicionais" e "Minutos adicionais Callface AI" são candidatos reais a `USAGE`, hoje classificados como `ONE_TIME`)? Se sim, ajusto o mapeamento (é um dicionário simples em `lib/crm/composicao-comercial.ts`, não um redesenho).

## 6. Quando uma oportunidade mista é "Won" de fato?

**Contexto** (Commercial Core v2, 16/08): numa venda mista, o Callface AI pode ser pago no mesmo dia enquanto o PABX ainda aguarda contrato por semanas. `marcarNegocioGanhoSeAindaNao` marca o NEGÓCIO como ganho na primeira evidência real de qualquer grupo — não espera todos os componentes.

**Decidido por padrão**: Won no nível do negócio/pipeline dispara com UMA evidência válida (mesma Commercial Evidence Policy de sempre); o fulfillment de cada grupo é rastreado à parte (`proposta_grupo_comercial.status`) e NUNCA é resumido de volta pro status do negócio. Ou seja: "ganho" = "fechamos negócio de verdade", não "entregamos tudo".

**Precisa confirmar**: essa é a leitura certa pro relatório de meta/comissão (contar a venda inteira como fechada assim que o primeiro componente confirma), ou vocês preferem que meta/comissão só considere o valor dos grupos JÁ concluídos (parcial, crescendo conforme PABX/White Label também fecham)? Isso é calibração de indicador, não vou inventar — o dado bruto (por grupo) já está disponível pros dois jeitos de calcular.

## 7. Checkout automático pós-assinatura pra PABX/White Label — sempre tentar?

**Contexto**: depois que o contrato é assinado (PABX/White Label/AI-com-fidelidade), o sistema agora tenta gerar checkout Stripe automaticamente (antes era só manual pro PABX). Nesse sandbox a chamada falha (sem STRIPE_API_KEY) e o grupo fica aguardando o vendedor gerar manualmente — comportamento correto e esperado.

**Decidido por padrão**: sempre tentar automático primeiro, cair pro manual se falhar.

**Precisa confirmar**: existe algum caso (ex: contrato PABX que ainda depende de aprovação financeira antes de cobrar) onde vocês NÃO querem que o checkout seja dado automaticamente logo após a assinatura — preferindo sempre a ação manual do vendedor como gatilho? Se sim, é uma flag por `commercial_model` ou por item de catálogo, não uma mudança de arquitetura.

(novas entradas serão appendadas abaixo conforme a execução avança)
