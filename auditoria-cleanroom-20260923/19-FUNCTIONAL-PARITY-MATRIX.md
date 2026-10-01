# 19 — FUNCTIONAL PARITY MATRIX (PROD legado × CRM 2.0 × ONFACE atual)

Eixos:
- **PROD legado** = worktree `callface-crm` @ prod-real-20260920 — grupo `(crm)`, telas ricas que RODAM em produção hoje (código de 20/09, na verdade dado até 22/09).
- **CRM 2.0** = grupo `(crm2)` + `components/crm2/Cf2*` + `api-server/routes` (a lógica/backend da geração nova).
- **ONFACE atual** = casca `components/onface` + redesign visual (a pele mais nova sobre o CRM 2.0).
Status: PRESERVADA / SUBSTITUÍDA / INCOMPLETA / PERDIDA / NOVA. Recomendação: HERDAR / HERDAR+ADAPTAR DOMÍNIO / HERDAR+REDESENHAR UI / RECONSTRUIR / REMOVER / DECISÃO PO.
Ressalva: "melhor implementação" é avaliada por completude de código + prova de dado; nenhuma tela do redesign foi provada com sessão autenticada (proxy morto no runtime local).

| Módulo | PROD legado (crm) | CRM 2.0 (crm2/api) | ONFACE (pele) | Melhor hoje | Status | Recomendação |
|---|---|---|---|---|---|---|
| **Pipeline/negócios** | pipeline 1.485 l. rica | `/pipeline`+13 SA, board via @onface/sales; negocios[id] Cf2 1.513 l. (API morta) | casca nova | **CRM 2.0** (server actions funcionam sem proxy) | SUBSTITUÍDA | **HERDAR+REDESENHAR UI** — lógica canônica é superior |
| **Pré-vendas/SDR** | pre-vendas 947 l. | `/pre-vendas`+18 SA, board @onface/acquisition | pele nova (tela que o usuário valida) | **CRM 2.0** | SUBSTITUÍDA | **HERDAR+REDESENHAR UI** |
| **Prospecção** | prospeccao 744 l. | `/prospeccao`+12 SA; apollo (API morta) | — | **CRM 2.0** | SUBSTITUÍDA | HERDAR+REDESENHAR UI |
| **Contatos/Pessoas** | contatos 896 + [id] 910 l. | `/contatos`+9 SA, pessoas/empresas 360 (SA) | — | **CRM 2.0** | SUBSTITUÍDA | HERDAR+ADAPTAR (modelo canônico pessoas) |
| **Cliente 360** | (via empresas[id] 613 + carteira) | `/clientes/[id]` Cf2Cliente360 1.594 l. (API morta) | — | **CRM 2.0** (mais completo) mas NÃO PROVADO | INCOMPLETA | **HERDAR+ADAPTAR** — resolver API + tabela clientes vazia de campos |
| **Propostas** | propostas + [id] 796 l. | `/propostas`+9 SA | — | **CRM 2.0** | SUBSTITUÍDA | HERDAR+REDESENHAR UI |
| **Contratos (lista/detalhe)** | contratos 260 + [id] 429 l. — **operacional** | apenas `/ajustes/contratos` = TEMPLATES | — | **PROD legado** (redesign não tem) | **PERDIDA** | **RECONSTRUIR** a lista/detalhe no CRM 2.0 (ou reaproveitar a de prod) |
| **Assinatura de documento** | ZohoSign (178 assinados) | Documenso code, 0 uso; signature_* 100% NULL | — | **nenhuma viva** (Zoho histórico) | **PERDIDA** | **RECONSTRUIR** + backfill ZohoSign (P0) |
| **CS (health/risco/renovação)** | (cs_marcos 2.114, cs_riscos 396 em 20/09) | `/clientes/cs`+risco Cf2 (API morta); cs_* zerados hoje | — | **CRM 2.0 em código; PROD em dado** | INCOMPLETA | **HERDAR+ADAPTAR** — recuperar dado + ligar API |
| **Onboarding/Implantação** | onboarding 264 l. + pos-venda | `/clientes/onboarding`+implantação Cf2 (API morta); 26 fulfillments (416 em 20/09) | — | **CRM 2.0 em código; PROD em dado** | INCOMPLETA | **HERDAR+ADAPTAR** — recuperar fulfillments |
| **Atendimento (WhatsApp/email/inbox)** | whatsapp 667 + email 463 + email/sequencias 345 + inbox(placeholder) | `/atendimento` Cf2 412 l. (API morta) | — | **misto** — core no CRM 2.0, sequências só em PROD | INCOMPLETA + PERDIDA (sequências, 5 caps WhatsApp) | **HERDAR+ADAPTAR**; **RECONSTRUIR** sequências de e-mail |
| **Financeiro** | financeiro 6 abas | `/clientes/financeiro` 7 abas (backend Next VIVO) — **órfão na navegação** | — | **CRM 2.0** (superset, funcional) | SUBSTITUÍDA mas inacessível | **HERDAR** + religar à navegação |
| **Carteira** | carteira 311 l. (por responsável) | `/clientes/carteira` = **ModuloPendente** | — | **PROD legado** | **PERDIDA** | **RECONSTRUIR** (placeholder no lugar) |
| **Automações** | campanhas + automacoes | `/automacoes`+cadencias+agentes+ai (API morta); 4-5 motores | — | **CRM 2.0** (mais amplo) mas sem uso real | INCOMPLETA | **HERDAR+ADAPTAR** + **unificar motores** (decisão de arquitetura) |
| **Relatórios** | 7 relatórios | `/relatorios` 7 abas (API morta); –1 (fechamento comercial), +1 (pós-venda) | — | empate | SUBSTITUÍDA (–1 aba) | HERDAR+ADAPTAR; recuperar fechamento comercial |
| **Agenda/Calendário** | agenda 499 l. | `/calendario` 153 l. (mais raso) | — | **PROD legado** (mais completo) | SUBSTITUÍDA (mais rasa) | DECISÃO PO — verificar se o raso basta |
| **Admin/Organizações/Membros** | admin/usuarios 370 + org | `/ajustes/organizacoes`+membros (mais raso); **view-as/org-switch perdidos** | — | **PROD legado** (view-as) | INCOMPLETA + PERDIDA (impersonação) | **RECONSTRUIR** impersonação (+ risco de cookie residual) |
| **Configurações** | 14 telas configuracoes | `/ajustes/*` 14 equivalentes 1:1 (API morta) | — | **CRM 2.0** | SUBSTITUÍDA (paridade) | HERDAR+REDESENHAR UI |
| **IA/Agentes** | — | ai-platform 29 endpoints (29/31 tabelas vazias); AI SDR desligado | — | **CRM 2.0** (só infra) | NOVA (não comprovada) | DECISÃO PO — quanto de IA o produto precisa (ver Fitness) |
| **Início/Dashboard** | dashboard 780 l. | `/inicio` VisaoGeral (SC/DB vivo) | HomePageFigma (só em preview) | **CRM 2.0** | SUBSTITUÍDA | HERDAR+REDESENHAR UI |

## Síntese
- **Regra geral**: a lógica/backend do **CRM 2.0 é a melhor geração** para o núcleo comercial (canônico, server actions vivas). A recomendação dominante é **HERDAR+REDESENHAR UI**, não reconstruir.
- **Capacidades a RECONSTRUIR** (o redesign regrediu de verdade): contratos (lista/detalhe), assinatura de documento, carteira, sequências de e-mail, impersonação/view-as.
- **Capacidades onde PROD legado ainda é a melhor**: contratos operacionais, carteira por responsável, agenda (mais completa), impersonação. Nenhuma foi reescrita melhor no redesign — foram perdidas ou rebaixadas.
- **Capacidades INCOMPLETAS por infra** (código bom, dado/API faltando): Cliente 360, CS, onboarding/implantação, atendimento, automações — o gargalo não é a UI, é (a) o proxy de API na porta certa e (b) recuperar dados que sumiram na carga local.
- **NÃO recomendar reconstrução por a tela ONFACE estar incompleta**: na maioria dos módulos a implementação boa já existe no CRM 2.0; falta pele + integração.
