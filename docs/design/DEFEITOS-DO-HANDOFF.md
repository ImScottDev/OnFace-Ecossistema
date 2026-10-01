# Defeitos do handoff — para corrigir no Claude Design

O markup em `app/src/components/onface/proto/*Desenho.tsx` é GERADO por
`scripts/dc-para-tsx.mjs`. Consertar aqui dura até a próxima regeração, então
o que está nesta lista precisa ser corrigido no Claude Design e vir no próximo
zip.

Duas travas de arquitetura isentam os arquivos gerados justamente por isso
(`cor-tem-nome.test.ts` e `botao-sem-acao.test.ts`). Esta lista existe para
que a isenção não vire esquecimento.

## 1. CSS escapado para fora das aspas

`OnFace Atividades.dc.html:651` — uma regra de CSS escapou do atributo `style`
e virou texto visível na tela. O conversor escapa o `>` para não quebrar o
build, mas o texto continua aparecendo para quem usa.

## 2. Botões sem ação

Botões que existem e não fazem nada. A regra do projeto é clara: botão que
existe funciona, ou fica desabilitado com o motivo.

| arquivo | linha | botão |
|---|---|---|
| `AtividadesDesenho.tsx` | 1254 | "Anexar" no compositor do NEXO |
| `AtividadesDesenho.tsx` | 1273 | segundo botão do mesmo compositor |
| `ClientesDesenho.tsx` | 836 | — |
| `ClientesDesenho.tsx` | 855 | — |

Nenhuma dessas telas está ligada a uma rota ainda. **Antes de ligar, cada
botão precisa de ação ou de estado desabilitado honesto** — é o critério de
pronto, e é o que vai ser conferido.

## 3. `motion.js` escreve no DOM que o React controla

Ele põe `data-tilt` nos nós que anima. Se entrar antes da hidratação, o React
avisa que o atributo não vai ser corrigido — um aviso por cartão.

`MotionDoProto` adia a injeção para o main thread ocioso, o que resolve na
prática. O conserto definitivo é o `motion.js` não escrever atributo no
elemento — usar uma `WeakMap` interna, por exemplo.

## 4. Chaves de motivo que divergem do domínio

Na peça de desqualificação, o handoff oferece `sem_interesse` e
`dados_invalidos`; o domínio chama de `sem_necessidade` e `contato_invalido`.
`saidas-do-lead.ts` traduz os dois, e a tradução fica inerte sozinha se o
handoff passar a usar as chaves do domínio.

Os motivos de NUTRIÇÃO já batem um a um — é só a desqualificação.

## 5. Rota que não existe no produto

O menu da casca aponta para `/operacao/onboarding`; o produto serve em
`/pos-vendas`. Resolvido com um redirect, mas o nome certo no handoff evitaria
o desvio.

## 6. Dado inventado nas fichas de contato

O maior risco do handoff: campos que a tela GERA quando o dado não vem, e que
saem plausíveis.

| arquivo | o que inventa |
|---|---|
| `ContatosDesenho` (lógica) | e-mail (`slug(nome)@slug(empresa).com.br`) e telefone (hash do nome), em 41 pontos, sem fallback para o real |
| `ContatosDesenho` (lógica) | clientes fixos "Grupo Solaris" e "Clínica Aurea", sem guarda |
| `PessoaDesenho` (lógica) | `linkedin.com/in/` + o nome, e `+55 11 91234-5678` como telefone |
| `EmpresaDesenho` (lógica) | `"São Paulo / SP"` como cidade, e três pessoas fixas |

Empresa e Pessoa foram ligadas: elas têm um ramo honesto quando o registro
vem preenchido, e o que sobrava foi corrigido por rótulo no adaptador.

**Contatos foi ligada em 01/10** (`ContatosProto.tsx`). Toda a invenção mora em `base()`, que é método da classe: a subclasse filtra o mock (linhas sem `lead.real`) e troca e-mail/telefone/segmento/última interação pelo real, ou "—". `"São Paulo / SP"`, "Canal principal" e as oportunidades fictícias saem no pós-processamento de `renderVals`; a visão "Meus contatos" (EU fixo) foi removida. Defeitos do gerado contornados por subclasse: `E.irPara` descarta os parâmetros (vale para TODA tela, corrigir no script) e `this.diz` não é definido em ContatosLiga (o primeiro toast derrubava a tela).
Enquanto for assim, a tela mostraria endereços falsos de pessoas reais — e
alguém escreveria para eles. O conserto é no Claude Design: ler o e-mail e o
telefone do dado, e cair para vazio quando não houver.

## 7. Destinos do menu que não existem no produto

O menu da casca aponta para rotas do namespace do protótipo. Tirar o prefixo
`/onface-preview` resolve a maioria, mas não estas quatro:

| no handoff | no produto |
|---|---|
| `/onface-preview/visao-geral` | `/inicio` |
| `/onface-preview/atividades` | `/tarefas` |
| `/onface-preview/empresa` | `/contatos` (ficha exige id) |
| `/onface-preview/pessoa` | `/contatos` (ficha exige id) |

A pior era a primeira: **"Início", o primeiro item do menu, dava 404.**

Mapeado em `CascaProto.tsx`. Se o handoff passar a usar as rotas do produto,
o mapa fica inerte sozinho.

## 8. Dado inventado na tela de CS

`CsLiga.renderVals()` fabrica, a partir do hash do nome da empresa: a **data
de renovação** de toda conta (`renovDe`), os **dias e o valor da fatura
vencida** (`sinaisDe`, valor = MRR), o pedido de **"mais N usuários"** e o
**"uso baixo"** (gatilhos por `saude`), e a **origem** de quem não casa lead
por nome (`oriDe`). Fixa ainda o usuário (`EU = "Scott Ferraz"`, que existe de
verdade no banco) e dois colegas inexistentes na equipe. E o Liga chama
`this.diz` sem defini-lo: o primeiro aviso derrubava a tela.

Tudo isso é `const` local de `renderVals`, sem gancho de subclasse. Em
`CsProto.tsx` o conserto entra pelo dado (saude neutra, `ultima` real,
renovação marcada como tratada, lead com origem para toda conta) e pela saída
(aba/KPI/kanban de renovação vazios, texto de fatura real, distribuição e
histórico por família, equipe real).

Pedido ao script: subir `EU`, `renovDe`, `sinaisDe`, `diasSem` e `oriDe` a
métodos da classe. Conserto no Claude Design: ler renovação, inadimplência e
uso do dado, e cair para vazio quando não houver.

## 9. Atendimento: conversas, IA e números fabricados

`AtendimentoLiga.tsx` (o gerado) fabrica em vários pontos; todos estão contidos
em `AtendimentoProto.tsx`, sem editar o gerado:

- **SSR**: `state = { ..., w: window.innerWidth }` é class field (roda no
  construtor da base). Único Liga assim. Hoje a tela só monta no cliente.
  Pedido ao script: `typeof window === "undefined" ? 1280 : window.innerWidth`.
- **`EXTRA` + `juntar`** (c9 "Marcos", c10 "Rede Vivace"/"Diego Nunes"):
  duas conversas inventadas concatenadas em toda lista e contagem. Contido
  passando uma lista cujo `concat` devolve só a cópia (`semExtra`). Pedido:
  `D.EXTRA || []`.
- **Ligação**: toda conversa de canal Telefone recebe um clone de
  `ANALISES.c4` com os nomes trocados (68% de chance, transcrição inventada).
  Contido não emitindo canal Telefone — as 5.221 ligações ficam fora. Pedido:
  remover o clone.
- **E-mail e telefone** gerados do nome para lead conhecido (543/545):
  corrigidos por rótulo ("Copiar e-mail"/"Copiar telefone").
- **E-mail como canal**: remetente, destinatário e assinatura gerados
  (`slug(resp)+"@onface.com.br"`) dentro do map de mensagens. Canal fora.
- **`CAIXAS`**: cinco números inexistentes, e `caixaDe` casa por substring
  deles. Trocado pelas sessões de `whatsapp_sessao`, filtro por `sessaoId`.
- **Simulações por timer** (`depois`): tique de lido, "digitando…", resposta
  automática do cliente, sugestão de IA, conversa do NEXO. `depois` é no-op.
- **"1ª RESP. MÉDIA" = "3m 40s"** literal; histórico com duas entradas
  inventadas; presença "Online"/"Ausente"; quatro agentes NEXO; `REL` com
  probabilidade "20%"; segmento "Serviços"; prioridade "Média".
- **Aba "Não lidas"**: `noFiltro` não conhece a chave `naolidas` — contava 0 e
  esvaziava a lista. Religada ao `soNaoLidas`.
- **Reunião**: o confirmar envia ao cliente "Te mandei o convite por e-mail"
  sem convite nenhum. Desligado com aviso.
