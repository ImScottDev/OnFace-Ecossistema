# Diagramas do ONFACE

Gerados do **schema de produção** (`callface_crm_mz`), não do `schema.ts`: o que
existe no banco e o que o Drizzle declara divergem, e é na divergência que os
defeitos moram. A contagem de linhas é `count(*)` real — `reltuples` do planner
errou por 80 tabelas quando testei (dizia 135 vazias; são 55).

Sintaxe do [Eraser](https://eraser.io) (diagram-as-code). Cole o conteúdo em
um diagrama novo, ou deixe que o MCP publique.

| Arquivo | O que mostra | Tamanho |
|---|---|---|
| `00-banco-completo.eraser` | **as 233 tabelas**, todas as colunas, 595 relações | grande |
| `00-banco-com-dados.eraser` | só as 177 com linha | grande |
| `01-nucleo-de-dados.eraser` | identidade + comercial + receita, colunas que contam a história | leitura |
| `02-jornada-comercial.eraser` | do lead ao MRR, e onde cada regra mora no código | leitura |
| `03-sistema.eraser` | containers, filas e integrações externas | leitura |

Publicados em **https://app.eraser.io/workspace/EPHGtKvquS9b6nKOA7sL** (5 diagramas
num arquivo só, para não gastar o plano gratuito). O DSL vai verbatim, então não
consome crédito de IA do Eraser.

E o mapa que o banco sozinho não mostra: [`../MAPA-TELAS.md`](../MAPA-TELAS.md) —
cada uma das 121 telas e o que ela consome, gerado por `../mapear-codigo.py`.

Comece pelo **02** (a jornada) e pelo **01** (o núcleo). O `00` é o retrato
completo, para procurar o que ninguém lembra que existe.

## O que os números já dizem

| | |
|---|---|
| Tabelas | **233** |
| Com dados | 177 |
| **Vazias** | **55** |
| Chaves estrangeiras | 595 |
| `leads` | **145 colunas** |
| `negocios` / `propostas` / `contratos` / `empresas` | 69 / 60 / 53 / 52 colunas |

As duas pontes do cutover — `aquisicoes.lead_legado_id` e
`oportunidades.negocio_id_legado` — **não são chave estrangeira**. São
convenção, e por isso não aparecem em nenhuma ferramenta que leia só o banco.
Estão desenhadas à mão no fim de cada arquivo.

## Regerar

Os arquivos saem de consultas ao banco de produção (somente leitura). O
procedimento está no histórico da sessão de 23/10; o essencial é:
`information_schema.columns` + `table_constraints` para a estrutura, e um
`UNION ALL` de `count(*)` por tabela para o volume — nunca `reltuples`.
