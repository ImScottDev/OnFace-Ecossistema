# Achado de dados: Pipeline lê a tabela legado, não o modelo novo

Data: 2026-09-17. Ambiente: banco local `callface_crm` (clone com dados reais). Nada verificado em produção.

## O fato

A tela `/onface-preview/pipeline` mostra 450 em aberto, 569 ganhas e 424 perdidas. Soma: 1443.

| Fonte | Registros |
|---|---|
| `negocios` (legado) | 1443 |
| `oportunidades` (modelo novo do Módulo 01) | 24 |

`src/lib/vendas/consultas.ts` consulta `FROM negocios` nas linhas 306, 359, 391, 399, 595, 641, 868, 1022, 1124 e 1161. Não há leitura de `oportunidades` no caminho do Pipeline.

Conclusão: o Módulo 01 foi reconstruído sobre o modelo de domínio novo, mas a superfície de Vendas continua servindo a tabela antiga. As duas convivem, e a nova está praticamente vazia.

## Por que isso importa para a regra de negócio

A especificação diz que uma oportunidade tem uma família, e o gate de Won depende dela: AI padrão exige pagamento, PABX e White Label inicial aceitam contrato assinado.

Distribuição real de `service_family` em `negocios`:

| Família | Registros |
|---|---|
| nulo | 1441 |
| WHITE_LABEL | 2 |

99,9 por cento dos registros não têm família. É por isso que a tela exibe "Não classificada" em todos os cards. Na prática, a regra de Won não tem dado para operar sobre a base atual.

## Segundo achado, operacional

A própria tela informa 450 oportunidades em aberto e 450 sem próxima ação. Cem por cento do pipeline aberto está sem próximo passo definido.

## O que isto NÃO é

Não é bug introduzido pelo WIP da TASK-001. É estado herdado da base. Nenhuma correção foi aplicada.

## Decisões que precisam do Scott

1. O Pipeline deve continuar lendo `negocios`, ou o Módulo 01 depende de migrar `negocios` para `oportunidades` com família preenchida?
2. Se migrar: qual a regra de inferência de família para os 1441 registros sem classificação?
3. "Sem próxima ação" em 100 por cento do pipeline é dado sujo de importação ou retrato real da operação?
