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

(novas entradas serão appendadas abaixo conforme a execução avança)
