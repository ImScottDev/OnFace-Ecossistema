# Campanha promocional de preço (Black Friday e as próximas)

Como uma promoção entra no ONFACE e chega ao Stripe sem criar produto nem
price novo, e o que o time precisa fazer em cada ponta.

## Por que não é um produto no Stripe

O time libera o acesso do cliente pelo **Product ID**. Criar
"Callface AI - Full Black" quebraria essa liberação e deixaria um produto
promocional no catálogo para sempre. Criar um *price* novo tem o mesmo
problema em menor escala: ele vira uma "variação" vendável que continua
aparecendo em dezembro.

Cupom do Stripe também não serve como mecanismo da campanha: o desconto não é
percentual redondo (R$ 149,90 sobre R$ 199,90 = 25,01%), e cupom não aparece
na proposta, no PDF nem no contrato — só na fatura.

Então a campanha é **preço de venda com prazo**, e mora no ONFACE. O Stripe
continua recebendo exatamente o que já recebia:

- **Checkout Session:** o Price oficial, com a diferença em `coupon`.
- **Assinatura faturada:** `price_data` sobre o **mesmo Product oficial**.

Nenhum Product ID ou Price ID muda por causa de uma promoção.

## As tabelas (migration 0142)

- `campanhas_promocionais` — código, nome, janela (`inicio`/`fim`), `ativo`.
  Não confundir com `campanhas`, que é campanha de **mídia** (plataforma,
  utm_campaign, investimento). As duas aparecem na mesma venda: o lead vem de
  uma campanha de mídia e compra sob uma campanha promocional.
- `campanhas_promocionais_precos` — uma linha por *(campanha, price oficial,
  condição)*. A condição entra na chave porque o mesmo price tem dois preços
  na mesma campanha: o Full é R$ 149,90 sem fidelidade e R$ 119,90 com
  contrato de 12 meses.
- `proposta_itens.campanha_promocional_preco_id` — de qual oferta a linha
  nasceu. É o que permite somar quanto a campanha vendeu sem adivinhar pelo
  valor.

### `valor_ancora`

O "de" que a proposta exibe, quando a comunicação usa uma âncora diferente do
preço de tabela vigente. Em 04/11/2026 o Full de tabela é R$ 179,90 e sobe
para R$ 199,90 em 01/12: a Black anuncia "de 199,90 por 149,90" enquanto o
catálogo ainda está em 179,90.

`valor_tabela` na linha da proposta continua sendo o preço **oficial**, nunca
a âncora — é ele que audita o desconto concedido e alimenta o MRR.

## O bônus, e como o time vê

Uma oferta pode conceder um bônus que alguém libera na mão depois do
pagamento (`bonus` e `bonus_descricao`). No fechamento ele vai para a metadata
do Stripe, na assinatura e na sessão de checkout:

| chave | exemplo |
|---|---|
| `crm_oferta_campanha` | `black-friday-2026` |
| `crm_oferta_bonus` | `agente_ia_30d_100min` |
| `crm_oferta_bonus_descricao` | `30 dias de Agente IA com 100 minutos para 1 usuário` |

São `crm_oferta_*` e **não** `crm_campanha_*` de propósito: a metadata já tem
`crm_campaign`, que é o `utm_campaign` do lead. Confundir as duas faria o time
liberar bônus para quem só veio de um anúncio.

Para achar quem tem bônus pendente, filtre as assinaturas por
`metadata['crm_oferta_bonus']`.

## Operação

No servidor, os dois scripts estão compilados na imagem (`app/dist`), porque
uma campanha precisa ser ligada, conferida e encerrada no ambiente onde ela
vende — não só na máquina de quem escreveu:

```bash
# dentro do diretório do ambiente, ex.: /opt/callface/crm2-dev
sudo docker compose run --rm api node app/dist/seed-campanha-black-friday-2026.mjs --dry-run
sudo docker compose run --rm api node app/dist/seed-campanha-black-friday-2026.mjs
sudo docker compose run --rm api node app/dist/smoke-campanha-promocional.mjs
```

Na máquina de desenvolvimento:

```bash
# conferir sem gravar
npx tsx --env-file=.env src/scripts/seed-campanha-black-friday-2026.ts --dry-run

# semear/atualizar (idempotente: rodar de novo ATUALIZA, não duplica)
npx tsx --env-file=.env src/scripts/seed-campanha-black-friday-2026.ts

# provar contra o banco
npx tsx --env-file=.env src/scripts/smoke-campanha-promocional.ts
```

**Ligar as ofertas de White Label** (entram desativadas porque as condições da
Black para White Label não foram confirmadas):

```sql
UPDATE campanhas_promocionais_precos SET ativo = true, updated_at = now()
 WHERE condicao = 'black'
   AND campanha_id = (SELECT id FROM campanhas_promocionais WHERE codigo = 'black-friday-2026');
```

**Encerrar a campanha antes do prazo:**

```sql
UPDATE campanhas_promocionais SET ativo = false, updated_at = now() WHERE codigo = 'black-friday-2026';
```

Encerrar não mexe em nada já vendido: as linhas gravadas mantêm o preço e o
vínculo com a oferta.

## O que o servidor garante

`lib/catalogo/campanha.ts` é a porta única, e a regra vive em
`@onface/catalog` (`politica-campanha.ts`). Na hora de **gravar** a linha, o
servidor confere de novo:

- a campanha está vigente **agora** (a tela pode estar aberta desde antes do fim);
- a oferta é daquele price (oferta do Full não entra em linha de Starter);
- a oferta é da mesma organização;
- o preço promocional não está acima da tabela.

A tela nunca manda o valor promocional — manda só o id da oferta.

## Fora da campanha

Linha sem `campanha_promocional_preco_id` segue exatamente como antes. Nada no
caminho de venda normal mudou.
