# 15–17 — DECISÕES DO PO / TARGET STATE / ORDEM DE EXECUÇÃO

## 15 — DECISÕES QUE EXIGEM O PRODUCT OWNER
Questões que nenhuma evidência técnica/histórica resolve:
1. **Remoto único**: consolidar em `onface` ou `origin`? (hoje dessincronizados, código canônico em risco).
2. **Escopo de IA**: manter a plataforma de IA (29 tabelas/rotas) como roadmap ou remover? Custo de andaime vs intenção de produto.
3. **Callface AI**: a integração de leitura do SaaS é requisito do produto ou pode sair?
4. **141 oportunidades + 15 contratos perdidos na migração Zoho** (R$243k+): re-extrair do Zoho pós-cutoff e reimportar, ou aceitar a perda?
5. **Agenda rasa**: o calendário de 153 linhas basta, ou precisa da profundidade das 499 linhas da produção?
6. **`aquisicoes` vs `leads`** como modelo primário: qual desligar? (define a virada canônica).
7. **Assinatura**: Documenso é a escolha definitiva? (decisão pendente há meses nos docs).
8. **Nível de "empresa"**: reverter as 877 de texto livre exige política de o que é uma empresa cadastrável.

## 16 — RECOMMENDED TARGET STATE
Princípio (do Fitness Review): **podar e concluir, não reconstruir**. O CRM 2.0 é a base correta.

Estado-alvo:
- **Uma geração de UI**: `(crm2)` + pele `components/onface`, com o Design System ONFACE realmente aplicado (hoje 10 de 260 telas). Remover as outras 3 cascas e o grupo `(crm)`.
- **Um caminho de dado**: consolidar em Hono (A) + server actions para leitura pesada (B); eliminar rotas Next mortas (C exceto webhooks/auth). Proxy /api apontando para porta viva.
- **Modelo canônico como primário**: desligar dual-write (fases 25/26 declaradas), escrita direta em pessoas/oportunidades, legado read-only até remoção.
- **Fonte de verdade única de métrica**: metric_catalog real, com MRR desduplicado e portfólio atualizado.
- **Isolamento estrutural de tenant** (org no WHERE) + RBAC cobrindo as rotas sensíveis.
- **Observabilidade**: integracao_sync_estado populada; telemetria de login.
- **Assinatura funcional** ponta a ponta + backfill ZohoSign.
- **1 motor de automação** (consolidar os 4-5).
- **Andaime podado**: remover packages stub, ai-* dormente [se decidido], filas placebo, apps fantasma.
- Dimensionado para ~3 operadores e ~200 negócios/mês; IA/automação avançada só depois do núcleo sólido.

## 17-B — ESTRATÉGIA REVISADA PELO PO (24/09): plataforma primeiro, legado por último
Decisão do PO, validada tecnicamente: NÃO amarrar o término do produto à migração do legado. O schema canônico é estável e o front/backend dependem dele, não da migração. Sequência:
1. **Terminar a plataforma** sobre o schema canônico com dados de seed (trabalho que NÃO depende do legado): corrigir o proxy de API (53 telas mortas), implantar o backend Hono, terminar o front, eleger UMA casca de UI. Provar ONFACE ponta a ponta.
2. **Check de schema (decisão #10) cedo, em paralelo** — único item do legado que vale olhar antes: diff coluna-a-coluna legado→canônico para garantir que o modelo novo tem lugar para tudo que importa. É check de dias, não migração. Evita retrabalho de front.
3. **Cutover dos dados reais por último** — as planilhas `de-para-cutover.csv` e `decisoes-cutover.csv` são o roteiro DESTA fase, não pré-requisito da fase 1. As 13 decisões de negócio amadurecem como backlog paralelo, resolvidas na hora do cutover.
Racional: a migração é operação de uma vez; travar o produto nela = nunca terminar. Migrar contra plataforma pronta é mais seguro que migrar e construir ao mesmo tempo.
Independente de tudo (risco puro): push dos 47 commits + decidir assinatura de contrato.

## 17 — EXECUTION ORDER (versão anterior — substituída pela 17-B acima; mantida por registro)
Ordenada por: destravar prova → estancar risco → concluir núcleo → podar → evoluir.

**Fase 0 — Destravar a verdade (dias)**
1. Rodar a captura remota (entregável 09) — decide se as perdas de dado são de produção (P0-2). BLOQUEADOR de tudo.
2. Push dos 47 commits locais para os remotos (P1-8) — proteger o código canônico.
3. Sessão autenticada local para elevar jornadas a RUNTIME provado.

**Fase 1 — Estancar P0 (semana 1)**
4. Backfill determinístico ZohoSign (P0-1) — 158 contratos ganham prova de assinatura.
5. Reverter/quarentenar o job de normalização de empresas (P0-3) + política de empresa cadastrável.
6. Se captura confirmar perda em produção: restaurar do dump/backup (P0-2).

**Fase 2 — Fazer o redesign funcionar de ponta a ponta (semanas 2-3)**
7. Corrigir o proxy /api (porta) + implantar backend Hono do redesign em produção (P1-1, P1-2).
8. Religar Financeiro à navegação; corrigir /pos-venda (layout+auth) (P1-9, P1-7).
9. Recuperar as 4 regressões de UI: Carteira, sequências e-mail, contratos lista/detalhe, impersonação (P1-5, P1-6).
10. Desduplicar 101 subs Stripe → MRR fonte única (P1-4).

**Fase 3 — Concluir a virada canônica (semanas 4-6)**
11. Desligar dual-write (escrita primária no canônico), legado read-only (P1-3).
12. Isolamento estrutural de tenant + RBAC nas rotas sensíveis (P2-1, P2-2).
13. Observabilidade de integração + telemetria (P2-3).
14. Recuperar Lead Status/owner do campos_custom; reparar vínculos de empresa (P2-6).

**Fase 4 — Podar (semana 7)**
15. Remover andaime morto (packages stub, filas placebo, cascas extras, branches) conforme entregável 14, após confirmação da captura remota.
16. Consolidar motores de automação em 1.

**Fase 5 — Evoluir (pós-conclusão)**
17. Decidir escopo de IA/Callface AI (decisões PO) e só então investir.

Definição de conclusão do ONFACE = todos os módulos da Functional Parity Matrix em status PRESERVADA/SUBSTITUÍDA com os 7 critérios de PRONTO satisfeitos, sem itens PERDIDA/INCOMPLETA.
