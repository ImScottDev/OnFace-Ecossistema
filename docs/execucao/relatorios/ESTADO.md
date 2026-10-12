# Estado

Atualizado: 2026-10-12, fim da sessão 1 (lotes 1 a 4 + painel executivo).

## Ambiente
- Repo `~/Documents/Scott Studio/onface-ux-rebuild`, main, commits locais `wip(relatorios)` sobre `0e5393d`. Sem push, sem deploy, sem migration nova (nada alterou schema).
- Banco local `callface_crm` (cópia de produção de 06/10: "mês atual" termina em 06/10). Dev: Next :3000 (`npm run dev`), Hono :3012 (`npx tsx --env-file=.env src/api-server/index.ts`, não recarrega: reiniciar após mexer em rota ou catálogo).
- Outro agente trabalha em WhatsApp/Atendimento/NEXO: não tocar `lib/whatsapp`, `lib/atendimento`, `lib/nexo`, Ajustes > WhatsApp.

## Implementado e provado (local)
- **Catálogo de métricas** (`lib/metricas/`): cada métrica tem UM `recorte`; valor, detalhe, composição, série, paginação e CSV derivam dele. Filtros família e testes. 7 métricas: mrr_atual, booking_ganho, faturado, recebido, clientes_ativos, oportunidades_abertas, faturamento_competencia, clientes_faturados (8). Janelas em São Paulo [início, fim), MTD x MTD.
- **Rotas** `GET /api/relatorios/metricas/:codigo` (+`/exportar`), gate `podeVer`, 401/403 provados.
- **Explorador** `/relatorios/biblioteca/metrica-<codigo>`: filtros, chips, composição clicável (filtro cruzado), série com comparação e legenda, lista paginada, gaveta de registro, exportação do recorte, estado na URL, Voltar.
- **Painel Executivo** (aba padrão da gestão em `/relatorios`): consolidado + Callface AI/PABX/White Label, MRR, faturado do último mês fechado (YoY), booking, recebido, clientes ativos, faturamento mensal com ano anterior, por família, concentração Top 5/10, lacunas declaradas.
- **Faturamento histórico**: 67 competências conciliadas ao centavo com as planilhas originais; LEASE → PABX aplicado no banco local (50 linhas, R$ 201.455,21, reversível).
- **Diagnóstico Zoho** (somente leitura): `ZOHO-DIAGNOSTICO.md`, SQL em `depara/`, CSV fora do Git.
- Testes: `node --import tsx --env-file-if-exists=.env --test src/lib/metricas/*.test.ts` (21); `npx tsx --env-file=.env src/scripts/provar-relatorios-metricas.ts` (navegador, 1440/820/390px).

## Aguardando decisão (nada bloqueia o resto)
1. Titular x pagador (22 contratos Facilita/Saffe): modelo (ver ZOHO-DIAGNOSTICO D1).
2. Aplicar os 6 contratos sem empresa que o negócio indica (D2) e criar empresas dos 32 documentos sem cadastro (D3).
3. PLATAFORM = Callface AI? (D4). Hoje 286 linhas estão como CALLFACE_AI.
4. Aplicar a regra LEASE → PABX também no Dev/produção (script `conciliacao/corrigir-lease-pabx.py --aplicar` apontando para o banco certo, com OK do Kauã).
5. Túnel do banco do Callface AI (:55432) está fechado: abrir exige acesso SSH à infra; sem isso adoção/retenção ficam sem dado.

## Pendente (ver PLANO.md)
L3b Stripe x planilhas (conciliar recebido e assinaturas), L3c Callface AI (snapshots/definição de ativo), L5 bridge MRR/coortes, L6 marketing (conversão por coorte), L7 pré-vendas/comercial, L8 demais áreas, L9 construtor, L10 instrumentação + revisão independente + build de produção.
