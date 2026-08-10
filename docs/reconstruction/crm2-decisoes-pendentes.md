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

(novas entradas serão appendadas abaixo conforme a execução avança)
