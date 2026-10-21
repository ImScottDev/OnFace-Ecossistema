# Em qual ambiente você está

Este arquivo é espelhado pelo `deploy.sh` para dentro de cada ambiente no
servidor. Se você está lendo por SSH, ele descreve a máquina onde está.

## Como saber, sem adivinhar

```bash
grep -E '^(STACK|CRM_DOMAIN)=' .env
```

| STACK          | CRM_DOMAIN           | O que é                      |
|----------------|----------------------|------------------------------|
| `crm2-dev`     | crm.callface.io      | **PRODUÇÃO**                 |
| `crm2-homolog` | dev.crm.callface.io  | homologação (ambiente de teste) |

## Por que os nomes enganam

A pilha `crm2-dev` nasceu como ambiente de desenvolvimento e **virou produção em
13/10/2026**, na virada do domínio. Diretório, containers e volumes mantiveram o
nome antigo: renomear volume de Postgres não é renomear, é dump + restore, e isso
pede janela combinada.

Até essa janela acontecer, vale a regra: **o alvo que você digita diz a verdade,
a pilha guarda o nome velho.**

```bash
./deploy.sh producao     # crm.callface.io      (pilha crm2-dev)
./deploy.sh homolog      # dev.crm.callface.io  (pilha crm2-homolog)
```

`./deploy.sh dev` ainda funciona, como apelido de `producao`, para não quebrar
automação antiga. Não use em texto novo.

## O CRM legado é outra coisa

`/opt/callface/crm` é o CRM antigo (Hono/Drizzle), congelado em
`homolog.crm.callface.io`, sem deploy novo, aguardando decisão de descarte.
`/opt/callface/crm-homolog` está desativado e **não deve ser subido**: declara a
mesma regra Traefik que o `crm`, e os dois no ar fazem o domínio virar sorteio.
