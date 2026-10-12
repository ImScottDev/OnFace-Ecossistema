# Relatórios e dashboards ONFACE — plano e checklist

Escopo completo: `~/Documents/Brain - Scott Studio/02_PROJETOS/Callface/ONFACE/execucao/2026-10-12-plano-claude-relatorios.md`
Pesquisa: `.../2026-10-12-relatorios-executivos-pesquisa-e-direcao.md`

Regra de trabalho: cada lote = dados + consulta + interface + interação + teste, commit local `wip(relatorios): lote N`, e atualização de ESTADO/EVIDENCIAS/RETOMADA. Sem deploy sem "pode subir".

## Lotes

- [x] L1 Fundação do catálogo: `recorte` único (agregado = detalhe = exportação por construção), filtros família/testes, MRR conciliado. Teste de aditividade.
- [x] L2 (métricas oficiais; falta replicar nas demais áreas conforme L5-L8) Drawer de registros no clique (card, barra, ponto), URL com recorte, exportação do recorte completo. Primeira superfície: Executivo consolidado.
- [ ] L3 Identidade e vínculos Zoho: diagnóstico da cadeia contrato → empresa → serviço → pagador → fatura/pagamento; De/Para com evidência; simulação. Sem aplicar histórico.
- [x] L4 (conciliado e visível no explorador e no Executivo; falta o pouso rastreável por linha de fonte, ver L3b) Faturamento histórico 2021–2026
- [ ] L5 SaaS e carteira: bridge de MRR, coortes, NRR/GRR só onde reconciliar.
- [ ] L6 Marketing/Growth: conversões por coorte (corrige >100%), CPL/custo de mídia declarados.
- [ ] L7 Pré-vendas e Comercial: safra lida no servidor, datas de evento, SLA mediana/p90.
- [ ] L8 Propostas/contratos/cobrança, Onboarding, CS, Atendimento, Time, IA, Qualidade dos dados.
- [ ] L9 Construtor livre de relatórios e dashboards (persistência versionada, permissões).
- [ ] L10 Instrumentação das lacunas, revisão independente, validação visual desktop/tablet/390px.

## Diretrizes adicionadas em 12/10 (valem para todo lote)

**Prioridade 1: consistência e veracidade dos dados; o visual não substitui a conciliação.**

- Integrar e cruzar Stripe, planilhas mensais de faturamento e eventos reais da ONFACE. Faturado, recebido, contratado e MRR separados; origem e histórico preservados; atualização mensal rastreável e REPROCESSÁVEL sem duplicar (idempotência por source_hash/arquivo/linha).
- Verificar (não assumir) a integração com o banco do Callface AI: `CALLFACE_AI_DATABASE_URL` existe no `.env`. Mapear empresas/serviços/contas ONFACE ↔ contas do Callface AI para uso, usuários ativos, adoção e retenção, com definição escrita de "ativo". Respeitar acessos e permissões (somente leitura).
- Cada número: fonte, período, detalhamento verificável. Sem integração ou evidência, mostrar a lacuna, nunca inventar.

**UI/UX premium ONFACE em cada lote, não no fim:** skills impeccable/frontend-design, typography, shadcn, react best practices; gráficos Recharts sofisticados e interativos (tooltip completo, legenda selecionável, comparação, seleção de período, drill-down); animação suave e útil com `prefers-reduced-motion`; botões/filtros alinhados, valores monetários sem quebra, tabelas resolvidas; responsivo desktop/tablet/390px; estados carregando/vazio/erro/foco/confirmação. Validar no navegador, controle por controle.

Novos lotes: **L3b** integração Stripe x faturamento x planilhas (conciliação por fonte); **L3c** Callface AI (diagnóstico de acesso, mapeamento, definição de ativo, adoção/retenção).

## Decisões confirmadas (não perguntar de novo)
Consolidado + filtros AI/PABX/WL; LEASE ∈ PABX (categoria original preservada); testes excluídos por padrão sem apagar; só custo de mídia (sem lucro/margem/CAC completo); histórico de faturamento desde 03/2021; referências visuais são inspiração, identidade ONFACE.
