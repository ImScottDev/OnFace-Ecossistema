# Insights 2.0 — estado

Atualizado: 2026-10-21. Plano: `~/.claude/plans/miss-o-onface-insights-2-0-mutable-hippo.md`.
Evidências medidas: `EVIDENCIAS-insights-2.md` (ao lado).

## O diagnóstico, em uma frase

Duas arquiteturas de dados coexistem no módulo. O catálogo (`lib/metricas/`) garante card = soma
do detalhe por construção; a camada pré-catálogo (`lib/relatorios/` + 20 endpoints Hono) tem SQL
ad-hoc por endpoint, outro calendário e outro fuso — e é ela que alimenta as 8 abas de
`crm2/relatorios/`. A Visão Geral e o Explorador já estavam do lado bom.

## Feito e provado (banco local, nada em produção)

| commit | o quê |
|---|---|
| `030a38b0` | regra de receita vendida numa fonte só; o Fechamento mostrava R$ 100.123,87 a menos |
| `f7635293` | White Label sai do MRR vendido: R$ 73.043,00 que nunca foram cobrados |
| `ea7ce99c` | Visão Geral: sem masthead, valor sem quebra, aviso de White Label, 4 CSS → 1 |
| `19a41039` | 12 métricas novas, razões, alertas, endpoint único do painel, estado honesto |

Números de referência depois das correções: MRR atual R$ 478.822,89 · MRR vendido R$ 469.198,63 ·
setup vendido R$ 100.123,87 · booking R$ 569.322,50 · avulso R$ 26.465,00 · faturado set/26
R$ 512.404,49 em 303 linhas.

Provas: `pnpm typecheck` limpo; `src/lib/metricas/*.test.ts` 41/41; `receita-fechada.test.ts` 10/10
(dois contra o banco, SQL vs TS linha a linha nas 623 vendas ganhas); travas do DS sem violação nos
arquivos tocados; contraste 56/56; navegador em 1440/1024/375 com drill, console limpo em carga nova.

## Decisões do Scott (21/10)

1. Sou dono único do módulo; o trabalho de 21/10 é evidência, não base.
2. Booking = recorrente + setup num número; avulso/projeto separado.
3. White Label: na venda só o setup; a recorrência nunca existiu. Tirar do booking **sem apagar o
   valor original**.
4. MRR atual **mantém** os R$ 29.921,55 de White Label, marcados como sem recorrência confirmada.
5. Contratos legados do Zoho: importar, com trilha e aprovação por lote.
6. Insights segue fechado em produção por `AREAS_EM_BREVE` até ele mandar abrir.
7. PLATAFORM: provar cruzando Callface AI + Stripe + ONFACE + Zoho, não responder por achismo.

## Perguntas abertas (nenhuma bloqueia; o estado honesto está implementado)

1. **Risco de MRR** é `past_due`, `unpaid` ou os dois? Hoje `past_due` (R$ 10.101,90 em 31
   assinaturas); o snapshot diário antigo usa `unpaid`.
2. **Churn**: o Stripe cobre o suficiente para a Visão Geral falar de churn? São 165 cancelamentos,
   sem boleto e NF do PABX.
3. **"Recorrência confirmada"** de White Label = 3 competências seguidas é limiar proposto, não
   decidido.
4. **Meta comparável a booking**: o banco só tem metas do tipo `mrr_fechado` (aposentado), e booking
   inclui setup — o atingimento de 135,9% está superestimado por isso.
5. **Período padrão da Visão Geral**: `mes_atual` deixa o faturamento por competência indisponível
   (outubro não fechou). Provável trocar para `12m`.
6. **Data do booking**: `ganho_at` ou data da evidência de ganho (pagamento/assinatura)?

## Divergência medida que ainda não fecha

Movimento líquido de MRR vs variação do MRR faturável, por competência:

| competência | variação do faturável | movimento líquido | gap |
|---|---|---|---|
| 2026-09 | +R$ 40.787,85 | +R$ 6.340,11 | R$ 34.447,74 |
| 2026-08 | −R$ 9.749,10 | +R$ 11.443,45 | −R$ 21.192,55 |
| 2026-07 | +R$ 30.061,17 | +R$ 8.051,30 | R$ 22.009,87 |

`cruzadas.test.ts` trava a magnitude em R$ 50 mil/mês para a conta não piorar calada. **O bridge de
MRR não vai ao ar enquanto isso não reconciliar.**

## Lacunas de dado confirmadas (não são bug da tela)

- `oportunidades.probabilidade` e `previsao_fechamento`: nulas nas 110 abertas → pipeline ponderado
  e previsto indisponíveis.
- `oportunidade_itens`: 3 linhas no banco inteiro, 0 das 626 oportunidades ganhas tem item. Era a
  saída para a família do booking e não serve hoje.
- Família do booking: derivável com honestidade em 274 de 623 casos (família única do serviço
  canônico da empresa); 2 ambíguos, 347 sem serviço.
- `cliente_receita_mensal` só tem MRR, SETUP e DEBITO_RECUPERADO — não há ONE_TIME nem USAGE.
- `primeiro_contato_at`: cobertura baixa (pendência antiga da frente de Pré-vendas).

## Pendências abertas

- **Causa raiz do White Label não foi consertada**: `aceitar-proposta.ts` segue gravando a linha
  Recorrente em `mrr_fechado` no aceite, então toda venda nova de WL volta a entrar inflada e vai
  precisar de classificação. Mexer nisso é entrar em Vendas e depende de autorização.
- Conciliação aplicada **só no banco local** (run `0096fe55`, reversível).
- Identidade Stripe N:1 (`billing_identities` + `billing_customer_aliases`) ainda vazia: uma empresa
  pode ter vários customers no Stripe, e `empresas.stripe_customer_id` é 1:1 e mente.
- Contratos legados do Zoho não importados: 191 das 291 pagantes sem contrato (R$ 286.688,61 de MRR).
- As 8 abas de `crm2/relatorios/` seguem na camada pré-catálogo.
- `SdrTempoExplorer.tsx` (WIP de outra sessão, órfão e com JSX truncado) foi tirado do build e
  preservado no scratchpad da sessão; `sdr-insights.ts` e seu teste seguem no repo, não commitados.
- Erro de hidratação intermitente: visto 1 vez em ~6 cargas, não reproduz em carga limpa, árvore
  aponta para `CascaDesenho`/`Suspense` (fora do módulo). Já constava como pista em `BUGS.md`.

## Próximo passo concreto

A tela consome 8 métricas individuais via `useMetrica`; o endpoint `/api/relatorios/painel` está
pronto e não é consumido ainda. Migrar a Visão Geral para ele, acrescentando os blocos que só
existem lá (pipeline, metas, alertas, lacunas servidas pelo servidor) — com prova de não-regressão:
cada um dos números de hoje idêntico ao centavo ao `curl` da métrica individual.
