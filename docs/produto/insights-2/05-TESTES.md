# Insights 2.0 — matriz de testes e QA

O que prova que um número está certo, e o que já está provado hoje.

## Comandos

```bash
pnpm typecheck                                              # raiz
cd app && node --import tsx --env-file=.env --test "src/lib/metricas/*.test.ts"
cd app && node --import tsx --env-file=.env --test "src/lib/relatorios/*.test.ts"
cd app && pnpm test                                         # suíte completa (lenta, serial)
npx tsx --env-file=.env src/scripts/checar-invariantes-relatorios.ts
BASE=http://localhost:3000 API_PORT=3012 npx tsx --env-file=.env src/scripts/checar-rotas-onface.ts
pnpm ds:all && pnpm ds:contraste                            # travas do Design System
```

Dev local: Next em `:3000`, Hono em `:3012`. **O Hono não recarrega catálogo/rota sozinho em todo
caso** — reinicie depois de mexer em rota ou no catálogo. Nunca rodar `pnpm build` com o `next dev`
de pé.

---

## 1. Invariantes de métrica — **estado: passando (41/41)**

Em `app/src/lib/metricas/catalogo-aditividade.test.ts`, `explorar.test.ts`, `mrr-oficial.test.ts`,
`janela.test.ts`, `painel-geral.test.ts`, `cruzadas.test.ts`.

| Invariante | Por que existe |
|---|---|
| Card = soma do detalhe inteiro, em centavos | é o defeito que o catálogo existe para matar |
| Card bate com um oráculo independente (outra forma de escrever a regra) | teste que repete a consulta não prova nada |
| Soma por família fecha o total | composição não pode perder nem duplicar linha |
| Série mensal soma o card | o gráfico não pode contar diferente do número |
| Composição + "outros" = total | o agrupamento não esconde resto |
| Paginação não perde linha | soma das páginas = recorte |
| Toda métrica aditiva: card = soma do detalhe | laço sobre `CATALOGO` — cobre métrica nova de graça |
| Métrica `retrato` ignora a janela | `pipeline_aberto` e `mrr_atual` tornam o erro fácil |
| Piso respeitado: nenhum registro antes do piso declarado | piso decorativo é pior que piso nenhum |
| Filtro fora da allowlist não vira SQL | injeção por nome de coluna |
| Filtro sem suporte avisa (422) em vez de ser ignorado | filtro decorativo é o defeito-raiz da camada antiga |
| Isolamento: outra organização não enxerga valor | multi-tenant |
| Cartão com estado ≠ disponível/parcial tem valor `null` | a trava contra "zero bonito" |
| `drill` de todo cartão é recorte válido e abre o mesmo valor | garante cartão ↔ lista ↔ CSV |
| Razão com denominador zero ou amostra pequena → `null` com motivo | impede "0%" na tela |
| `mrr_atual` ≥ `metricas_diarias.mrr_stripe` | o snapshot é subconjunto (só Stripe) |
| SQL concorda com TS em toda venda ganha, linha a linha | as duas formas da política de receita |
| `booking + avulso` fecha o total vendido | decomposição não perde nem duplica |

## 2. Divergências medidas e travadas — **estado: medidas, não resolvidas**

Testes que **não** exigem que a conta feche, mas travam a magnitude para ela não piorar calada.

| Divergência | Tamanho hoje | Trava |
|---|---|---|
| Movimento líquido de MRR vs variação do MRR faturável | R$ 22 mil a R$ 34 mil por mês (jul, ago, set/26) | magnitude ≤ R$ 50 mil/mês |
| Booking canônico (`oportunidades`) vs legado (`negocios`) | R$ 800,00 em 1 registro + 3 ganhos `[QA]` de valor zero | `cobertura.test.ts` (vermelho, pré-existente) |

**O bridge de MRR não vai ao ar enquanto a primeira não reconciliar.** Um teste que falha para
sempre é um teste que alguém comenta: por isso a asserção é sobre magnitude, com o número no relatório.

## 3. Camada legada — **estado: parcial**

`app/src/lib/relatorios/`: `cobertura.test.ts`, `pipeline-fonte-unica.test.ts`,
`receita-fechada.test.ts`, `calendario-sp.test.ts`, `insights-narrativa.test.ts`,
`meta-capi-saude.test.ts`, `comercial-qualificacao.test.ts`.

Os 20 endpoints ad-hoc **não têm teste de invariante**. É parte do motivo de serem aposentados em
vez de corrigidos.

## 4. O que falta testar

| Lacuna | Risco |
|---|---|
| Rota do painel por HTTP (hoje o zod foi validado à mão) | contrato quebra sem aviso |
| Exportação CSV = recorte filtrado, abrindo o arquivo | exportar a página em vez do recorte |
| `org NULL` não vaza: `financeiro/metricas.ts:28` usa `col = org OR col IS NULL` | **segurança**; hoje só há uma org real, então nenhum número muda — teste tem que ser sintético |
| Gate anunciado = gate aplicado nos 20 endpoints | `biblioteca.ts` promete `admin`/`gestao`; 18 só exigem autenticação |
| Fronteira de mês e fuso em `custom:` | competência deslocada por fuso |
| Mês parcial rotulado, nunca desenhado como queda | queda falsa a zero |
| Comparação não publicada quando a janela anterior cai antes do piso | seta mentindo |
| Performance: réguas por papel, sem cruzar papéis | ranking injusto |
| Deduplicação: empresa com vários customers no Stripe | **1:N real**, `empresas.stripe_customer_id` é 1:1 e mente |

## 5. QA de navegador — o gate

Teste verde não prova que a tela funciona. Para cada superfície: abrir, filtrar, **conferir contra
SQL**, clicar no gráfico, chegar ao registro, voltar, **recarregar e checar que o recorte
sobreviveu**, exportar e **abrir o arquivo**, console e network limpos.

Larguras: **390 / 768 / 1440 / desktop amplo**. Sem rolagem horizontal, sem valor cortado ou
quebrado, tooltip alcançável, foco visível, teclado funcionando.

**Erro de hidratação conhecido:** intermitente, observado 1 vez em ~6 cargas, não reproduz em carga
limpa, árvore aponta para `CascaDesenho`/`Suspense` — fora do módulo. Já constava em
`docs/execucao/relatorios/BUGS.md` antes desta frente.

**Lição registrada:** `Info is not defined` passou pelo typecheck e quebrou a tela em runtime (Fast
Refresh com módulo stale). Carga limpa em aba nova é parte do gate, não opcional.

## 6. Travas de design

`pnpm ds:all` (1.233 violações herdadas no projeto; o placar zera módulo a módulo — os arquivos de
Insights tocados estão limpos), `pnpm ds:contraste` (56/56), e o detector do Impeccable sobre os
arquivos alterados.
