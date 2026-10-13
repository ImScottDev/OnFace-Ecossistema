# Correção de dado em homologação — 13/10/2026

Executado **somente em homologação** (`dev.crm.callface.io`, container
`callface-crm2-homolog-postgres`, banco `callface_crm_mz`). **Produção não foi
tocada.** O objetivo era medir o efeito real antes de pedir autorização para
produção, em vez de decidir por estimativa de um banco local defasado.

Os scripts `scripts/vincular-empresa-por-dominio.ts` e
`scripts/mesclar-pessoas-duplicadas.ts` entraram no repositório pelo commit
`d64ea18`, que trata de outro assunto (gravação da família no Ganho). Foi
descuido de quem commitou, não intenção: o registro correto deles é este
documento.

## O que os números mostraram

A estimativa do diagnóstico vinha de um banco local defasado. Contra a cópia de
produção, o problema é quase três vezes maior: **249 pares de pessoas
duplicadas**, não ~87. Os pseudo-e-mails bateram (108 pessoas, estimativa 106).

Um achado desfaz uma suspeita anterior: das **365 conversas com LID**, nenhuma
tem par real na mesma sessão. Ou seja, o LID não está duplicando conversa como
se temia — ele atrapalha a identificação, mas não gera a segunda conversa.

## O que foi executado

| Ação | Resultado |
|---|---|
| Vínculo por domínio de e-mail | 255 pessoas ganharam empresa |
| Mescla de pessoas (prova forte) | 71 pares, 0 falhas, 538 linhas repontadas |
| Mescla de empresas | **nenhuma** — ver abaixo |
| Mescla de conversas de canal | **nenhuma** — depende de campo próprio para o LID |

Efeito: pessoas sem empresa de 1.413 para 1.155; vínculos ativos de 2.858 para
3.101; pessoas de lead mesclado ainda listadas de 94 para 30. Pontos de contato,
comunicações, timeline, eventos de venda, atividades, negócios, oportunidades e
faturas não mudaram, e nenhuma mensagem de WhatsApp ficou apontando para contato
inexistente.

## Por que nenhuma empresa foi mesclada

Nenhum par por CNPJ. Os pares por domínio são **filiais com CNPJs diferentes**
(Atrio em Pelotas e Uberlândia mais a matriz; Bravo Log em Paulínia, Uberaba e
Cuiabá; Hospital Care). Mesclar apagaria filial, que é cadastro legítimo. Os 62
pares que casam só por nome continuam sendo decisão humana.

## O que ficou para decisão

- **34 pares em corrente** (a mesma pessoa aparecendo em mais de um par) com
  prova forte — mesma pessoa, mas o documento manda tratar corrente à parte.
- **104 pares com prova fraca** (só telefone ou só e-mail).
- **40 pessoas de `wevy.cloud` / `wevy.com.br`**, excluídas de propósito: o
  segundo domínio apontava para outra empresa por causa de um único colega.
- **Levar vínculo e mescla para produção.**

Lista dos 178 pares para revisão: `revisao-humana-pessoas.csv` (scratchpad da
sessão).

## Como desfazer

Dumps completos, no servidor de homologação, em
`/opt/callface/crm2-homolog/backups/`:
`homolog-antes-mesclas-20261013.dump` (antes de qualquer escrita) e
`homolog-antes-mescla-pessoas-20261013.dump` (depois do vínculo).

No banco, uma tabela por operação, com o estado completo de cada linha antes da
mudança: `_vinculo_dominio_20261013`, `_mescla_homolog_20261013`,
`_mescla_homolog_20261013_refs` e `_mescla_homolog_20261013_descartes`.

O script de mescla tem `--desfazer`, validado antes da rodada completa com um
canário de 2 pares: as contagens voltaram iguais e as duas pessoas foram
restauradas idênticas.

## Trava dos scripts

Os dois recusam rodar se a `DATABASE_URL` não contiver o alvo declarado em
`ALVO_PERMITIDO`. É o que impede que um comando de homologação acerte produção
por engano.
