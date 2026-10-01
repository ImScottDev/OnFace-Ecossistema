# 10 — CONTRADICTIONS REGISTER (Fase 7: documentação × realidade)

Método: 20 docs lidos (18 .md raiz + docs/ + 2 notas de vault), confrontados com o BASELINE congelado. Achado macro: **a documentação NÃO é propaganda** — é majoritariamente honesta e frequentemente antecipa os fatos do baseline. O risco real é **"vocabulário de prontidão"**: "pronto/completo/certificado/P0 fechado/resolvido" aplicados a código que compila e passa testes num banco acumulado, não a produto rodando em produção. Há auto-refutação interna (mesmo doc afirma pronto numa seção, nega na seguinte).

## Tabela AFIRMAÇÃO × FONTE × REALIDADE × CONFIRMADA × DIVERGÊNCIA (os 10 mais graves)
| Afirmação | Fonte | Realidade (baseline) | Confirmada? | Divergência |
|---|---|---|---|---|
| "O motor está pronto... falta configuração, não código" | AUDITORIA-ONFACE-2026-09-23 §6 | 30/39 packages stub; apps/* inexiste; 29/31 ai_* vazias; 0 runs de agente | **NÃO** | vazio atribuído a config; é stub/ausência |
| "MRR fonte única, divergência R$0,00" | PRODUCTION-READINESS P0-7 | MRR 6 respostas; 101 subs = R$62.822 em dobro | **NÃO** | R$0 é da API, não da realidade Stripe; dedup feito (60/R$24k) < problema real (101/R$62k) |
| "Won→Cliente→Service→Fulfillment→CS certificada 31/31, 32/32" | PRODUCTION-READINESS P0-5/6 | cs_marcos 2.114→0, fulfillments 416→26 no banco atual | **PARCIAL** | certificado por script num banco hoje vazio/recriado |
| "5 telas já são ONFACE de verdade, a casca é o produto" | AUDITORIA-ONFACE §2 | produção roda prod-real; proxy morto → 53/72 telas inoperantes | **NÃO** | é sobre qual componente importa, não sobre runtime |
| "RBAC normalizado, paridade provada usuário por usuário" | entrega-final §3 | RBAC cobre ~10/68 rotas | **PARCIAL** | corrigiu financeiro/ajustes; cobertura global ~15% |
| "Arquivo no disco → object storage (entregue)" | entrega-final §3 | criarS3=undefined; 3 tabelas de arquivo vazias | **NÃO** | auto-refutado: §10 marca storage pendente |
| "Catálogo resolvido, sincroniza Stripe" | entrega-final §10 | 208/233 UNKNOWN; 55 preços vs 213 | **NÃO** | auto-refutado §9: "vendedor não monta venda PABX" |
| "event sourcing funciona" | AUDITORIA-ONFACE §2 | outbox move; mas tabela `eventos`=0, nenhum INSERT; lead-scoring lê dela | **PARCIAL** | barramento outbox ok, event-sourcing canônico não |
| "276 testes 0 falhas / build passando" = pronto | entrega-final §7 | 0 runs de agente; motores IA draft; verde escondeu 8 defeitos que só apareceram com dado de prod | **PARCIAL** | verde em tsc/testes ≠ produto funcional |
| "DEV remoto tudo healthy, sincronizado" | AUDITORIA-COMPLETA §5 | proxy morto; rebuild remoto NÃO executado (próprio CHECKLIST/DIAGNOSTICO) | **NÃO/PARCIAL** | "healthy" otimista; imagem carrega query antiga |

## Afirmações que o baseline CONFIRMA (docs honestos)
877 empresas de texto livre poluindo a base (META-PRONTO-PARA-DEPOIS, DIAGNOSTICO); banco local recriado (AUDITORIA-COMPLETA); cs_* = 0 linhas; fulfillments 416→26→"3 de 26"; 3+ motores de automação; produção não tem packages/ (roda CRM v1); 101 subs duplicadas (DIAGNOSTICO, AUDITORIA-FINANCEIRO); "qualificado" com 6 definições (AUDITORIA §4); cookie mcrm-view-as existe e é lido; DS ONFACE aplicado em 10 de 260 telas, QA "aprovou botão morto" (vault ESTADO-ATUAL 21/09). **README "os nomes das pastas mentem"** — o próprio projeto reconhece o descompasso.

## Silêncios graves (baseline NÃO COBERTO por nenhum doc)
1. **ZohoSign 100% perdido** (178 assinados, 0 no banco) — nenhum doc registra como regressão; AUDITORIA-COMPLETA lista contratos como "TEM dado" sem sinalizar signature_* nulo.
2. **Migração Pipedrive não existe** — nenhum doc menciona Pipedrive (só Zoho/RD/Meta/Stripe).
3. **correction_change_log 30.876→434 materializado** — não mencionado em lugar algum.
4. **README alega "pós-venda completo, Ganho gera Onboarding/Implantação automaticamente"** — refutado pelos 5 × 500 de /pos-venda e Financeiro órfão.

## Inconsistências DOC × DOC (sinal de baixa confiança nos números "prontos")
- Testes: 51 (PRODUCTION-READINESS) vs 104 (README) vs 276 (entrega-final).
- Telas: 143 (README) vs 148 (AUDITORIA-ONFACE) vs 72 (PRODUCT-FINALIZATION).
- MRR: 425.619,39 vs 428.565,69 vs 422.199,73 vs 48.844,50 vs 119.801,57 — os próprios docs dão 5 números (confirma "6 respostas").
- Tabelas vazias: 78 (AUDITORIA-COMPLETA) vs 59 (AUDITORIA-ONFACE), mesmo dia.

## Classificação dos docs
- **Planos/intenção (baixo risco)**: PLANO-*, PRODUCT, DESIGN, REFORMA-UI, LOGICA-SDR, ONFACE-PROTOCOLO (autoconsciente: "parcial apresentado como completo é o único erro não tolerável"), CLAUDE, AGENTS.
- **Cautelosos**: PRODUCT-FINALIZATION-TRACKER, HANDOFF-ONFACE-FINALIZATION (quase tudo ⏳ "aguardando validação tela a tela").
- **Alegam prontidão (onde mora a distância)**: AUDITORIA-ONFACE-2026-09-23, entrega-final, PRODUCTION-READINESS-TRACKER, IMPLEMENTATION_PROGRESS (F4 ~92% "arquitetura completa"), RECONSTRUCTION_STATE, README.

## Regra derivada (para o Source of Truth Contract)
Substituir o vocabulário de prontidão pela **Definição objetiva de PRONTO** do entregável 22 (7 critérios). "Pronto" = provado em runtime com sessão + backend em produção + jornada gera dado + sem regressão — não "compila e passa teste".
