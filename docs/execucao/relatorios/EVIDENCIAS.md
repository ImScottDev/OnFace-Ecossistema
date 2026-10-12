# Evidências

## 12/10 — MRR agregado x detalhe (local)
- Consulta direta no Postgres local: base competência 2026-09 MRR = 476.414,49; assinaturas ativas fora do fechamento = 1.599,30; agregado catálogo = 478.013,79. Drill antigo = só 476.414,49. Diferença = 1.599,30 (no Dev: 2.318,50).

## 12/10 — L1 provado
- `lib/metricas/catalogo.ts`: cada métrica tem UM `recorte`; valor e detalhe derivam dele (`definir`). Filtros `familia` e `incluirTestes` em `lib/metricas/recorte.ts`. Filtro sem suporte lança `FiltroNaoSuportado` em vez de ser ignorado.
- `catalogo-aditividade.test.ts` 5/5: card = soma do detalhe (centavos), MRR contra oráculo independente, soma por família, teste excluído por padrão e devolvido com `incluirTestes`, todas as métricas aditivas. Travas existentes (`metrica-definicao-unica`, `mrr-fonte-unica`) seguem verdes (15/15 no conjunto).
