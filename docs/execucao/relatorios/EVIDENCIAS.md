# Evidências

## 12/10 — MRR agregado x detalhe (local)
- Consulta direta no Postgres local: base competência 2026-09 MRR = 476.414,49; assinaturas ativas fora do fechamento = 1.599,30; agregado catálogo = 478.013,79. Drill antigo = só 476.414,49. Diferença = 1.599,30 (no Dev: 2.318,50).

## 12/10 — L1 provado
- `lib/metricas/catalogo.ts`: cada métrica tem UM `recorte`; valor e detalhe derivam dele (`definir`). Filtros `familia` e `incluirTestes` em `lib/metricas/recorte.ts`. Filtro sem suporte lança `FiltroNaoSuportado` em vez de ser ignorado.
- `catalogo-aditividade.test.ts` 5/5: card = soma do detalhe (centavos), MRR contra oráculo independente, soma por família, teste excluído por padrão e devolvido com `incluirTestes`, todas as métricas aditivas. Travas existentes (`metrica-definicao-unica`, `mrr-fonte-unica`) seguem verdes (15/15 no conjunto).

## 12/10 — L2 camada de dados (provado)
- `lib/metricas/janela.ts`: janelas [início, fim) em São Paulo (fuso fixo -03:00), mês parcial comparado MTD x MTD; `janela.test.ts` 9/9 (fronteira de fuso, virada de ano, dia 31, custom).
- `lib/metricas/explorar.ts` + `consulta.ts`: composição por dimensão, filtro cruzado, série temporal, paginação e exportação saem do mesmo recorte; colunas só por lista de permissão. `explorar.test.ts` 4/4 (fatias+outros = card, clicar numa fatia = valor da fatia, páginas somam o recorte, exportação = linhas da fatia). Bug pego pelo teste: `date_trunc('mes')`.
- Hono `GET /api/relatorios/metricas/:codigo` e `/exportar` (gate `podeVer`, tenant da sessão, 401 sem sessão, 422 para filtro sem suporte). Medido local: MRR 478.013,79 = PABX 376.432 + AI 64.619 + WL 29.922 + sem família 7.041; booking 90d exporta 157 linhas.

## 12/10 — L2 explorador (provado no navegador)
- `components/onface/relatorios/ExploradorMetrica.tsx` + `explorador-formato.ts` + `.rx-*` em `relatorios.css`; página `relatorios/biblioteca/[id]` agora só monta o explorador para métrica oficial. Removidos `lerMetrica` e a rota `[id]/exportar` (dois caminhos divergentes); o CSV vem de `/api/relatorios/metricas/:codigo/exportar`, com os mesmos filtros e a seleção da tela.
- `provar-relatorios-metricas.ts` (Chrome headless, sessão real): MRR R$ 478.013,79, lista soma o card, clicar em PABX filtra para R$ 376.431,90, recarregar e Voltar preservam o recorte, gaveta de registro abre/fecha sem perder filtro, família do topo, filtro sem suporte avisa (422 tratado), booking: clicar na barra filtra o recorte, legenda liga/desliga o período anterior, 820px e 390px sem rolagem horizontal e valor monetário em uma linha. Capturas em `app/.tmp-relatorios/`.
- Bugs reais pegos pela prova: linha de comparação interceptava o clique da barra; tabela com cabeçalho desalinhado da célula; coluna "Produto" sempre vazia no MRR (removida); buraco ao lado do KPI no retrato.
- Aviso: o dev server (Turbopack) regenera a hidratação de forma intermitente em sequências longas de navegação (0 em 32 cargas simples; ~1 em 3 no roteiro completo), e já devolveu 500 "module factory is not available" após muitas edições; reiniciar o `next dev` resolve. Repetir a checagem com build de produção no fim (L10).
