# Contatos sem empresa e "Ganho, sem serviço ativo": diagnóstico

Medido em 13/10/2026 no banco local (`app/.env`, `callface_crm`), só com SELECT,
organização `320a9052-…` (a única com pessoas: 4.206). Nada foi escrito.
Os números são do banco local, que é uma cópia; podem diferir de produção.

## 1. O caso da Ariane Dias Solatium seguros

Pessoa `c8a54623-9ea6-437c-cf12-2b7ae77a3a72`, lead `6536bf6c-…`, Zoho `5938068000037010001`.

| Fato | Valor |
|---|---|
| `pessoas.empresa_id` | vazio |
| `pessoa_empresa_vinculos` | **nenhuma linha** (nem ativa, nem encerrada) |
| `leads.empresa_id` e texto `leads.empresa` | vazios |
| Empresa SOLATIUM SEGUROS existe | sim, `13c2da6d-…`, com 6 pessoas, 1 linha em `clientes` e **1 serviço canônico ACTIVE** |
| Oportunidades da pessoa | 2, ambas `empresa_id` nulo: `SOLATIUM - MINUTOS EXTRAS` ganha (17:19, 07/10) e uma de carteira ativa (17:33, 07/10, criada pelo próprio Ganho) |
| Proposta P-1558 (aceita) | `empresa_id` nulo |

**O vínculo nunca foi criado.** Não é a tela que deixa de ler: nenhuma tabela tem
o par pessoa↔Solatium. A empresa e o serviço existem, só não estão ligados a ela.

**Por que "Ganho, sem serviço ativo".** A ficha pergunta se há serviço ACTIVE
com `servicos_canonicos.empresa_id = leads.empresa_id`
(`app/src/lib/vendas/consultas.ts:1913-1914`). Com `empresa_id` nulo a
comparação nunca é verdadeira. O rótulo é montado em
`app/src/components/onface/proto/relacoes-da-ficha.ts:123`. Ligando a pessoa à
Solatium, o mesmo código passa a dizer "Ganho" e "Cliente ativo".

**A hipótese do LID não se confirma neste caso.** O número do pseudo-e-mail
(`5511911515479`) é um celular brasileiro válido e é o telefone real da Ariane:
aparece em `pessoas` "Ariane" (`0cdac441`), no lead `44a75beb` e na conversa de
WhatsApp "Ariane Dias Solatium seguros" (`contatos a26a0e64`, 03/07). Ou seja, o
pseudo-e-mail está certo. O que está errado é o **telefone exibido**,
`+55 11 98975-9431`: é o de **Thiago**, outra pessoa da Solatium
(`aa2cd8e3`, lead `52038bca`; é também a conversa `56c9aa9c`). Esse número foi
parar na ficha da Ariane na entrada do registro; não há `audit_log` dela para
dizer por quem, então a origem exata do telefone fica **não confirmada**.

**Caminho de entrada.** Registro do Zoho (`zoho_id` preenchido, origem vazia, criado
16/07). O e-mail `@whatsapp.merencia.ai` é do gateway antigo de WhatsApp do Zoho
(o `01_marcar_lixo_zoho.sql` já documentava). O Zoho entregou a pessoa sem a
conta vinculada, e o backfill `05-identidade.ts` só copia o `empresa_id` que o
lead já tem (`:109`, `:138`), então não havia de onde sair vínculo.
Ainda: a Ariane existe em **4 registros** (`990e4541`, `64848202`, `44a75beb`,
`6536bf6c`), dois deles sem empresa. É assunto de `contatos-duplicados.md`.

## 2. O que "Ganho, sem serviço ativo" significa

É a resposta (c), "outra coisa", e mistura três situações diferentes. A condição
é só: etapa ganho **e** nenhum serviço ACTIVE na empresa do lead
(`naCarteira`, `consultas.ts:1913`; `PessoaProto.tsx:165`; `LeadProto.tsx:52`).
Das 432 pessoas com Ganho, 253 caem no rótulo:

| Situação real | Pessoas | Leitura |
|---|---:|---|
| A. Lead **sem empresa** (o caso da Ariane) | 32 | rótulo enganoso: o serviço pode existir na empresa, ninguém liga |
| B. Empresa existe, **nenhum serviço canônico** | 182 | (a) de verdade: ganhou e o pós-venda não materializou serviço |
| C. Empresa só com serviço **não ativo** (churn/superseded) | 39 | o rótulo é correto |
| D. Empresa com serviço ACTIVE (rótulo "Ganho") | 179 | ok |

Só A é bug de vínculo. B é outro problema (pós-venda sem serviço canônico, a
investigar à parte). Os 253 estão juntos num rótulo só, por isso parece
"tudo igual".

## 3. Tamanho do problema, por categoria

Universo: 4.206 pessoas, 2.349 empresas. **1.638 pessoas sem empresa** (39%);
1.637 sem `empresa_id` e sem vínculo ativo, 1 com vínculo ativo mas sem
`empresa_id`.

| # | Categoria | Quantas | Exemplo real |
|---|---|---:|---|
| 1 | Pessoa sem empresa (total) | 1.638 | — |
| 2 | Sem empresa, **nome contém** nome de empresa cadastrada (empresas com 2+ palavras ou 9+ letras; ~metade é falso positivo por empresa de nome genérico: "Marketing", "Corretora") | 57 | "Ariane Dias Solatium seguros" → SOLATIUM SEGUROS; "Edilene Teixeira Renova Seguros" → RENOVA SEGUROS; "IBIS Barretos - Gerência" → IBIS BARRETOS |
| 3 | Sem empresa, e-mail **corporativo** | 571 | — |
| 3a | …cujo domínio bate com empresa cadastrada (site da empresa ou colega com o mesmo domínio) | 390 (293 com uma só empresa candidata) | `alessandro@idomestica.com` → IDOMESTICA; `diego.silva@almseguradora.com.br` → ALM SEGURADORA |
| 3b | …sem nenhuma empresa que combine | 181 | — |
| 4 | Pseudo-e-mail (`número@whatsapp.*`) | 106 (100 `merencia.ai`, 6 `callface.ai`), todos sem empresa | `5511911515479@whatsapp.merencia.ai` |
| 5 | Pseudo-e-mail cujo número **não bate** com o telefone da ficha | 1 de 106 (a Ariane). 105 não têm telefone nenhum | Ariane (acima) |
| 6 | Pessoas com Ganho sem empresa | 32 (153 oportunidades ganhas sem empresa; 150 negócios) | Ariane |
| 6a | …resolvíveis por nome/domínio | só 3 (Ariane, Marcus/DATAOCEAN, Edione/ELGIN) | |
| 6b | …sem pista de empresa | 29, quase todos gmail/hotmail, 22 com Stripe: pessoa física/venda de balcão | `jeferson.reghini@mrv.com.br`, `casparydev@gmail.com` |
| 7 | Clientes (`leads.tipo='cliente'`) sem empresa | 71 (só 10 resolvíveis; 72 leads sem empresa têm cliente Stripe) | — |
| 8 | "Ganho, sem serviço ativo" | 253 de 432 (A 32 / B 182 / C 39) | tabela da seção 2 |
| 9 | Leads com texto `empresa` preenchido e `empresa_id` nulo | 483 (só 16 batem exato com empresa cadastrada; 467 são texto livre: "Padaria", "Autônomo") | "Franciely / Mercado Livre", "Andrezza / Callface" |
| 10 | Conversas de WhatsApp (`contatos`) com telefone de 14+ dígitos (provável LID) | 363 (133 com 14, 227 com 15, 3 com 19-20); 362 sem lead | — |
| 11 | Serviços canônicos sem `empresa_id` | 41 de 502 (todos ligados por `lead_id`) | — |
| 12 | Propostas sem empresa | 123 de 1.596 | P-1558 |

A categoria 3b e boa parte de 1 são esperadas: lead de mídia paga que digitou
"Padaria" no formulário (487 leads de Mídia Paga sem empresa) não tem empresa de
verdade. **O universo realmente corrigível é ~436 pessoas** (união de nome +
domínio); o resto precisa de decisão de produto (pessoa física sem empresa).

Origem dos 1.638: ZohoDesk 718 e origem nula do Zoho 276 (1.050 vieram do Zoho no
total), Mídia Paga 487, stripe 42, manual 13.

## 4. Causa de cada categoria

1. **Zoho/Desk (cat. 1, 2, 3a, 4, 6).** O contato de helpdesk veio sem conta
   vinculada. O backfill só propaga `empresa_id` já existente
   (`app/src/scripts/backfill/05-identidade.ts:109,138`) e **nenhum passo infere
   empresa por nome ou domínio**. O importador do Zoho não está neste repositório
   (era o do CRM anterior).
2. **`resolverEmpresaId` só roda com nome ou CNPJ explícito**
   (`app/src/lib/crm/resolver-empresa.ts:35-39` devolve `null`). Aceita o domínio
   como `website` só ao **criar** empresa; **nunca usa o domínio para achar uma
   existente** (`:41-52` casa só por CNPJ ou nome exato). `dominioCorporativo`
   existe (`:96`) mas ninguém o usa para buscar.
3. **Ganho e proposta aceitam empresa nula.** `criarOportunidade` exige empresa
   (`app/src/lib/vendas/pipeline.ts:120`), mas `tentarGanhar` (`:722-790`) não olha
   `op.empresa_id`, e três portas gravam `empresa_id` nulo:
   `api-server/routes/propostas.ts:821-833` (`lead.empresaId ?? null`),
   `api-server/routes/negocios.ts:444-449` (`parsed.data.empresaId || null`),
   `api-server/routes/contatos.ts:179`. É o que fez a P-1558 ser aceita e o Ganho
   da Ariane acontecer sem empresa (o caminho exato que criou os 2 negócios
   dela não é rastreável: sem `audit_log`; os três acima são os candidatos).
4. **"Ganho, sem serviço ativo" para lead sem empresa (cat. 8-A).** O serviço é
   buscado só por `empresa_id` (`consultas.ts:1913-1915`), sem tentar
   `servicos_canonicos.lead_id`, que existe e está preenchido nos 41 serviços
   sem empresa.
5. **LID (cat. 10).** `app/src/worker/index.ts:619-636`: `extractPhone` já
   ignora `@lid`, mas o `||` final (`:634-636`,
   `rawChat.replace(/@.*$/, "")`) cai de volta nos dígitos do próprio LID, e o
   filtro `length <= 15` (`:640`) deixa passar LID de 15 dígitos. Resultado:
   conversa gravada com o LID como telefone (363). **Isso não é o caso da
   Ariane**, mas é um defeito real e independente. A busca por `last8`
   (`:191`) também pode casar o LID com a pessoa errada.
6. **Telefone trocado (cat. 5).** Não há código que o produza nesta amostra
   (1 caso). Pessoas da mesma empresa com telefone cruzado sugerem dado vindo
   errado do Zoho; precisa ser olhado no export original.
7. **Pseudo-e-mail (cat. 4).** Gerado pelo gateway antigo, não pelo ONFACE.
   O número dele é o telefone real do contato (na Ariane bate com o WhatsApp
   dela). O `01_marcar_lixo_zoho.sql` os marca como lixo em
   `_carga_registros_suspeitos`, mas **essa tabela está vazia neste banco local**
   e a guarda não pega quem tem negócio.

## 5. Correção proposta

### (a) Código, para parar de nascer errado

1. `tentarGanhar` e a aceitação de proposta **recusam** quando a oportunidade
   não tem empresa, com a ação "Associar empresa", como `criarOportunidadeDoLead`
   já faz (`pipeline.ts:326-332`). Fecha as três portas da categoria 3.
2. `resolverEmpresaId` / `resolverEmpresa` ganham uma etapa de **domínio
   corporativo único** (via `dominioCorporativo`) antes de criar empresa nova,
   para os pontos de entrada (webhooks, Pré-vendas, Contatos).
3. `detalheLead` busca serviço também por `servicos_canonicos.lead_id` quando
   `empresa_id` é nulo; e o rótulo separa "sem empresa vinculada" de "sem
   serviço" de "só serviço encerrado" (hoje as três viram a mesma frase).
4. Worker: o fallback `rawChat.replace(...)` (`:634-636`) não pode usar `@lid`;
   sem telefone real, não grava telefone. Subir o corte de 15 dígitos não resolve
   sozinho (LID tem 15).
5. Novas pessoas de gateway de WhatsApp não nascem com pseudo-e-mail como e-mail
   real.

### (b) Dado, precisa de script e autorização

1. **Ariane (e as 3 pessoas que a mesma busca resolve)**: criar o vínculo com
   SOLATIUM SEGUROS, copiar `empresa_id` em `pessoas`/`leads`/`oportunidades`/
   `negocios`/`propostas` do caso, e corrigir o telefone `+5511989759431` para
   `+5511911515479`. Depois mesclar com os outros 3 registros da Ariane (frente
   de duplicados).
2. **Domínio com empresa única (293)**, em lote, com relatório antes e dry-run.
   Os 97 com mais de uma empresa candidata e o caso `ticket@wevy.cloud` →
   "Teste Leo" (domínio de ferramenta, não de cliente) vão para revisão humana.
3. **Nome contém empresa (57)**: revisão manual (metade é falso positivo).
4. **Ganho sem empresa (32)**: 3 resolvem pelo item acima; 29 exigem decisão do
   Scott sobre pessoa física como cliente (criar empresa "pessoa física" ou
   permitir serviço por `lead_id`). Os 41 serviços sem empresa seguem a mesma
   decisão.
5. **Categoria 8-B (182 ganhos sem serviço canônico)**: investigação própria do
   pós-venda; não é vínculo.
6. **LID (363 conversas)**: não apagar; marcar e reconciliar pelo pushName/ JID
   real quando o WhatsApp entregar `SenderAlt`.
7. **Pseudo-e-mail**: só 106 pessoas; o número é telefone real, então dá para
   **preencher telefone e trocar o e-mail por vazio**, em vez de descartar.

## Limites desta medição

- Banco local, não produção. Refazer as contagens antes de qualquer script.
- Heurística de nome (cat. 2) e domínio (cat. 3a) são candidatos, não verdade.
- A origem do telefone trocado e do caminho exato do Ganho da Ariane não é
  recuperável sem `audit_log`.

## Implementado (código; dado segue pendente de autorização)

- Rótulo do Ganho (`consultas.ts` busca serviço também por `lead_id`; `rotuloDoGanho` em `relacoes-da-ficha.ts` separa "sem empresa vinculada", "serviço não criado" e "serviço encerrado").
- `resolverEmpresaId` tenta domínio corporativo que aponta para UMA empresa (`dominio-empresa.ts`); domínio público nunca casa, ambíguo não resolve.
- Worker: o helper puro `worker/telefone-do-jid.ts` diz se o JID tem telefone real, mas o LID **continua** sendo gravado como telefone (a mensagem nunca é descartada). A correção certa é um campo/tabela própria para o identificador do WhatsApp (migration nova, precisa de autorização).
- Recusar Ganho sem empresa: função `oportunidadeAptaParaGanho` pronta e **desligada** (`lib/crm/oportunidade-apta.ts`), sem chamador, aguardando OK do dono.
- Nenhuma correção de dado foi executada.
