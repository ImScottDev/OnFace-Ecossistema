# Documentação do ONFACE

O mapa do sistema (arquitetura, estrutura, ambientes, comandos, deploy) está no
`README.md` da raiz. Aqui fica o que não cabe nele.

| Pasta | O que tem | Natureza |
|---|---|---|
| `produto/` | spec do Módulo 01 de Vendas (`specdrive-modulo-01-vendas.md`, fonte das regras citadas no código como "Bloco NN §NN"), as decisões de implementação do módulo, o construtor de automações, as regras canônicas dos relatórios e o modelo de contrato PABX | vivo: descreve o que o produto deve fazer |
| `design/` | como uma tela do handoff do Claude Design vira tela do produto (`COMO-LIGAR-UMA-TELA.md`), os defeitos conhecidos do handoff, o registro de ligação de cada tela (`telas/`) e o próprio handoff (`handoff-onface/`, fonte do padrão visual) | vivo |
| `operacao/` | protocolo de trabalho, Stripe (diagnóstico e referência para agentes) e a virada (`virada/`: roteiro de passos, plano de carga, de-para de pré-vendas e o estado de 05/10) | vivo até a virada; o que for só da virada sai depois dela |
| `decisoes/` | ADRs e decisões pendentes com o Kauã, mais o registro do refactor arquitetural de 22/09 | **registro datado**: vale para a data em que foi escrito, não descreve o estado atual |

`PRODUCT.md` e `DESIGN.md` ficam na raiz porque as ferramentas de design os
leem de lá. Histórico de sessões, auditorias e contexto de negócio ficam no
vault do Scott (`02_PROJETOS/Callface/ONFACE/`) e no histórico do git.
