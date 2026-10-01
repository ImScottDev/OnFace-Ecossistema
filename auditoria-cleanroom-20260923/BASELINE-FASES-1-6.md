# BASELINE CONGELADO — Fases 1–6 (emenda 9)

Gravado em 23/09/2026 ANTES de ler qualquer documentação (README/CLAUDE.md/HANDOFF/Vault). A Fase 7 compara docs contra este baseline; **nenhum fato aqui pode ser reescrito por afirmação documental — só por nova evidência de nível superior, registrada como adendo datado.**

## Fatos estabelecidos (com nível de evidência)

### Terreno / git (RUNTIME/git)
1. 1 repo, 3 worktrees; branch redesign é descendente git de todas as demais (+434 sobre prod-real). NÃO é "superset funcional" provado.
2. 47 commits só no disco local; origin/redesign 33 atrás, onface/redesign 47 atrás. Risco de perda.
3. Produção roda `prod-real-20260920` (código de 20/09; dado até 22/09), não o redesign.

### Ambiente local (RUNTIME)
4. Ambiente híbrido: Next :3100 (redesign) + API/worker :3001/:3002 (CP63, callface-crm-dev). Sem API do redesign viva.
5. Proxy `/api` do :3100 aponta para :3012 (morto) → 53 de 72 telas reais inoperantes no runtime local. Server actions do bloco vendas funcionam.
6. Banco vivo `callface_crm` foi RECRIADO hoje 01:51; NÃO é espelho fiel de produção.

### Produto visível (RUNTIME + código)
7. 82 páginas (crm2), 72 reais / 7 placeholders / 3 redirects; 79/79 → 307 sem sessão (auth ok). 5 telas `/pos-venda/*` em 500 sem gate de auth.
8. 4 regressões confirmadas: Carteira (placeholder), sequências de e-mail (sem tela), contratos lista/detalhe (sem tela), impersonação/view-as (UI removida, cookie ainda honrado).
9. Financeiro órfão na navegação (tela funcional inalcançável).
10. 19 rotas Hono do redesign não existem em produção — backend de Clientes/CS/Atendimento/Automações não implantado.

### Arquitetura (código + banco)
11. 4-5 motores de automação; 2 publicadores de evento; 2 resolvedores de tenant; 3 gates de auth; dual model com dual-write vivo (escrita primária no legado).
12. Outbox transacional + sweep 60s FECHADO e rodando, com consumidores reais. Espinha dorsal correta.
13. 30 de 39 packages são stubs vazios; script arq:fronteiras inexistente; apps/* não existe.
14. 29 de 31 tabelas ai_* vazias; 0 execuções de agente. Meta é a única integração com ciclo completo.
15. Isolamento de tenant procedural (127/208 mutações sem org no WHERE); RBAC cobre ~10/68 rotas.
16. Zero observabilidade de integração (integracao_sync_estado vazia).

### Dados (banco RO)
17. Perdas locais vs snapshot 20/09: cliente_receita_mensal 12.917→0, fulfillments 416→26, cs_marcos 2.114→0, cs_riscos 396→0, 12.739 WhatsApp. PENDENTE: ocorreu em produção ou só local? (exige captura remota).
18. 877 empresas de texto livre criadas hoje; 38% não referenciadas; "empresa" não é agregável.
19. MRR com 6 respostas (canônico 425.619,39; causa do desvio: 101 subs Stripe duplicadas = R$62.822 em dobro). "Cliente" com 4 respostas (275/285/299/361).
20. correction_change_log 30.876 mudanças materializado em 434. semantic_* quase 100% NULL.
21. Migração Pipedrive NÃO existe (colunas 100% vazias). Linhagem real = Zoho + Stripe.

### Lineage Zoho (export + banco)
22. Cutoff Zoho 10/08/2026. Migração forte em identidade/valores (empresas 99,7%, contratos 94,6%), fraca em estado/vínculos.
23. ZohoSign 100% perdido: 178 assinados, 0 no banco (158 casariam). signature_* NULL em 745. Reparável determinístico.
24. Owner degradado (38→16 usuários, fallback growth@ em 1.680); Lead Status 100% achatado; 141 oportunidades perdidas (R$243.388) na migração original.

### Jornadas (código + dado)
25. Núcleo comercial (aquisição→won) funciona (histórico + runtime parcial). Pós-venda (CS/onboarding/risco) frágil, dado zerado local. Assinatura = elo perdido.

### Integrações (código + dado)
26. Meta RUNTIME (madura). Stripe RUNTIME com falha (1 evento travado 9d, subs duplicadas). WhatsApp RUNTIME com perda de histórico. Callface AI e Documenso: infra sem dado (NÃO PROVADO).

### Operação real
27. 3 pessoas operam (Mayra/Mayara/Jenifer); 9 de 16 usuários com zero atividade. ~200 negócios/mês. Operação real está na geração ANTERIOR, não no ONFACE.

### Fitness
28. Overengineered (packages/ai/motores) + inacabado + subarquitetado (tenant/RBAC/observabilidade). Recomendação: podar e concluir, não reconstruir.

## Pendências que só a captura remota (entregável 09) resolve
- Perdas da carga: produção ou local?
- Commit/migração realmente implantados em PROD e DEV remoto em 23/09.

---

## ADENDO PÓS-CAPTURA REMOTA (23/09, evidência de runtime em produção — nível superior)
Corrige itens do baseline com prova direta do servidor (permitido pela emenda: nova evidência de nível superior):
- **#17 (perda de dado) REVISADO**: NÃO houve perda em produção. Produção nunca teve cliente_receita_mensal/cs_marcos/cs_riscos/oportunidades/aquisicoes/pessoas/clientes/domain_events (a camada canônica CP1–CP63 nunca foi implantada). As "perdas" eram do experimento de carga LOCAL. fulfillments prod = 27 (não 26→416). P0-2 → resolvido/rebaixado.
- **#18 (empresas corrompida) REVISADO**: só no LOCAL. Produção tem 2222 empresas limpas. P0-3 → P1-10 (corrigir antes da virada).
- **Produção é geração INTERMEDIÁRIA** (não "geração anterior" genérica): F0–F7 + CRM 2.0 + billing/reconciliação/servicos_canonicos/fulfillments/ai_sdr/automacoes SIM; camada de identidade canônica + CS + outbox de domínio NÃO. Grupo (crm) é a UI operada.
- **P0-1 (assinatura) AGRAVADO**: em produção `contratos` nem tem coluna `assinado_em`. Confirmado.
- **Regra do PO**: produção intocável, é a verdade operacional. A virada é promoção futura.
