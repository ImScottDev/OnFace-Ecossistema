# Proposta (Builder), Empresa e Pessoa — registro de ligação

Ligadas em 30/09, fechando a Fase 1 menos Contatos (ver o porquê no fim).

## Proposta — `/propostas/nova?oportunidade=<id>`

A tela **não mostra** uma proposta: constrói uma, em cinco passos, a partir de
uma oportunidade. Sem `?oportunidade=` a rota devolve a lista, porque proposta
nasce de oportunidade — é dela que vêm empresa, contato e família.

### O catálogo era mock, e os preços não batiam

O protótipo carrega o catálogo escrito dentro de `catalogo()`, com preços
concretos. O Agente IA está **R$ 349,90 no mock e R$ 500,00 no catálogo real**.
Uma proposta criada com preço de mock é um compromisso com o cliente por um
valor que a empresa não pratica.

`catalogo-do-desenho.ts` traduz o catálogo real (55 preços em 15 serviços) para
a forma do Builder, e a subclasse sobrescreve o método. 11 testes cobrem o
agrupamento, o intervalo (mensal × anual sai da variação, porque as duas são
`MRR` no banco), o preço padrão e a conversão de valor.

### Provado

Criei a proposta #1536 pela tela: item "Callby AI - Business", R$ 1.799,00,
`total_geral` e `total_recorrente` corretos, e o item **amarrado ao
`catalogo_precos` real** — não a um id inventado. A criação também gerou a
linha em `oportunidade_itens`, então a ponte canônica funcionou. Depois apaguei
a proposta de teste.

### Um bug do domínio que travava 128 oportunidades

`proposta-criacao.ts` lia só `negocios.service_family` para o gate de família.
**128 das 536 oportunidades abertas** têm a família apenas na oportunidade
canônica, deduzida no backfill — e para elas a tela mostrava "Callface AI",
o Builder dizia "Definido pela oportunidade", e ao salvar o command pedia para
definir a família que já estava ali.

`pipeline.carregarOportunidade` e `consultas.ts` já usavam a cadeia
`COALESCE(n.service_family, o.service_family)`. Esta era a única porta que
olhava um lado só.

### Criar e enviar são dois fatos

`acaoCriar` grava o rascunho; `acaoEnviar` manda o e-mail ao cliente. O Builder
marca `status: "enviada"` quando o fluxo de envio conclui, e só então o segundo
passo roda. Se o envio falhar, a proposta JÁ existe e o toast leva até ela — em
vez de sumir com o trabalho.

## Empresa — `/empresas/[id]` · Pessoa — `/pessoas/[id]`

As duas telas do handoff são centradas em **lead**, não no diretório canônico:
leem uma lista e escolhem o alvo por `?registro=`. O adaptador entrega o lead
real achatado (`registro-do-desenho.ts`) em vez de forçar `Empresa360` num
molde que não é o dela.

Com `registro` preenchido, o desenho usa o ramo que lê o dado recebido. Sem
ele, cai num ramo de demonstração com "Ricardo Alves", "Juliana Prado" e
telefones fixos.

### Dado inventado que foi removido

| campo | o que o desenho fazia | agora |
|---|---|---|
| LinkedIn | `"linkedin.com/in/" + slug(nome)` | o campo real, ou "—" |
| Telefone | `"+55 11 91234-5678"` como fallback | o real, ou "—" |
| Cidade | `"São Paulo / SP"` sem registro | a real, ou "—" |

O LinkedIn era o pior: o botão "Abrir LinkedIn" levava ao perfil de **outra
pessoa** com nome parecido. `leads.linkedin` existe no banco e passou a ser
lido (65 dos 4.066 leads têm o campo).

A correção é por RÓTULO, na saída de `renderVals` (`corrigirInventados`), e
fica inerte sozinha quando o handoff parar de inventar.

## Contatos NÃO foi ligada — e por quê

`ContatosLiga` monta e-mail com `slug(nome) + "@" + slug(empresa) + ".com.br"`
**sem nenhum fallback para o e-mail real** — são 41 pontos, e não há como
injetar o valor verdadeiro. Também traz clientes hardcoded ("Grupo Solaris",
"Clínica Aurea") sem guarda de registro.

Ligar assim mostraria e-mail falso de lead real. A tela atual
(`vendas/Contatos`) funciona com dado real e fica onde está até o Claude Design
corrigir — está registrado em `DEFEITOS-DO-HANDOFF.md`.
