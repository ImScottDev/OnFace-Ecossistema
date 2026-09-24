# Fidelidade — Pré-vendas

**Fonte de verdade:** `OneFace2.zip` → `design_handoff_pre_vendas/`
(README + `OnFace Pre-vendas.dc.html` + `screenshots/`).

**Regra:** o Claude Design manda. A implementação não reinterpreta, não
simplifica e não "melhora". Elemento sem dado no banco é implementado assim
mesmo e marcado aqui — nunca removido por conta própria.

---

## Estado por elemento

Legenda: **fiel** = confere com o design · **difere** = existe mas diverge ·
**falta** = não implementado.

### Casca

| elemento | estado | nota |
|---|---|---|
| Sidebar clara 228/56px, grupos expansíveis | fiel | |
| Topo 52px, breadcrumb com subtítulo ao lado | fiel | |
| Busca ⌘K, notificações, perfil | fiel | |
| NEXO no rodapé | fiel | |

### Barra de controles

| elemento | estado | nota |
|---|---|---|
| Busca local 34px | fiel | |
| Filtros split (Responsável, Origem, Interesse, SLA) | fiel | |
| `+ Filtros` tracejado | fiel | |
| Alternador Quadro / Lista | fiel | |
| Exportar com 3 caminhos | fiel | |
| `+ Novo lead` split coral | **removido** | 24/09, decisão do Kauã: não existe no desenho e o botão só abria um toast. Exportar herdou posição e coral |
| Faixa de indicadores em texto puro | **difere** | falta a linha da fórmula (`count(leads) · estagio = ativos`) |

### Quadro

| elemento | estado | nota |
|---|---|---|
| Coluna com ponto de cor, nome, contador, recolher | fiel | |
| Cadeado em coluna que pede confirmação | fiel | |
| Coluna recolhida vertical que aceita drop | fiel | |
| Cartão: empresa, pessoa, chips, próxima ação, rodapé | fiel | |
| Checkbox no hover, fixo quando marcado | fiel | |
| Arrasto HTML5 com realce da coluna | fiel | |
| Contador da coluna | fiel | 24/09: passou a mostrar o total real da etapa; "Ver mais" carrega o resto |

### Saídas do lead

| elemento | estado | nota |
|---|---|---|
| Popup de qualificação (interesse, tamanho com faixa, dor, fit) | fiel | faixas Micro ≤10 · Pequena ≤50 · Média ≤200 · Enterprise >200 |
| Nutrição (motivo + data de retomada) | fiel | |
| Desqualificação (motivo) | fiel | |
| **Criar oportunidade** | fiel | **feito em 24/09** — ver abaixo |
| Split `Qualificar ⌄` com as saídas | fiel | |

### Gaveta do lead

| elemento | estado | nota |
|---|---|---|
| Identidade, telefone, e-mail | fiel | |
| **Ligar / WhatsApp / E-mail** | fiel | **corrigido em 24/09** — ver abaixo |
| Etapa e Responsável como menu | fiel | |
| Tags com criação inline | fiel | |
| Origem + tabela de atribuição | fiel | |
| Cadência, Próxima ação, Qualificação, Timeline | fiel | |
| Rodapé: Abrir empresa · Abrir contato · Qualificar ⌄ | fiel | |

### Não implementado

| elemento | estado | motivo |
|---|---|---|
| Visão Lista agrupada por etapa | verificar | existe no código; fidelidade não conferida elemento a elemento |
| Modal de cadência | verificar | |

---

## Correções de 24/09

### 1. Ligar / WhatsApp / E-mail não abriam o Atendimento

`GavetaLead.tsx` chamava só `registrarContato()`. O toast dizia "WhatsApp
registrado" e nada abria — e o lead mudava de etapa por uma conversa que
ninguém teve.

`urlAtendimento()` já existia em `vendas/atendimento.ts` e não estava ligada a
nada. Agora os três registram o toque **e** navegam para
`/atendimento?canal=…&leadId=…&telefone=…`. Sem telefone ou e-mail o botão fica
desabilitado com o motivo no `title`, em vez de registrar um contato impossível.

### 2. Arrastar para Oportunidade não abria nada

`PreVendasQuadro.tsx` definia a coluna Oportunidade só com `confirma`, que
mostra um toast anunciando o que *seria* pedido. O tipo dizia, em texto:
*"Confirmação que ainda não tem peça própria"*, e o menu da gaveta dizia
*"peça a desenhar"*.

Era a única saída do funil sem peça — justamente a passagem que leva o lead
para o Pipeline. Agora a coluna tem `saida: "oportunidade"` e abre o mesmo
modal das outras três.

**A peça nova** (`SaidasLead.tsx`, saída `"oportunidade"`): família em chips
multi-seleção (marcar duas cria oportunidades irmãs, como manda o domínio),
responsável comercial, e um aviso no topo quando o lead não tem empresa
associada — porque a oportunidade pertence à conta, não à pessoa.

---

## Como conferir

```
http://localhost:3100/pre-vendas
```

1. Abrir a gaveta de um lead → clicar em WhatsApp → vai para o Atendimento no
   contato certo.
2. Na gaveta, `Qualificar ⌄` → **Criar oportunidade** → modal com família e
   responsável.
3. Arrastar um cartão para a coluna **Oportunidade** → mesmo modal.
4. Arrastar para **Qualificado** → popup de qualificação.

---

## Correções de 24/09 (segunda rodada)

### 3. "Novo lead" removido; Exportar virou a ação primária

O botão não existe no desenho e era decorativo — `toast("Novo lead —
formulário a ligar")`. Exportar assumiu a posição e a superfície coral, que
vinha do invólucro `.pv-novo`. Um acento por barra, e ele pertence a quem age.

### 4. O limite de 67 por coluna

Vinha de `Math.ceil(limite / 6)` sobre um limite global de 400 — 67 fixos em
toda coluna, enquanto o cabeçalho anunciava o total da etapa. O número e a
lista discordavam na mesma tela e não havia caminho para o resto.

Agora: `porColuna` explícito (padrão 120), o cabeçalho mostra o **total real da
etapa** (de `count()`, não do array carregado), e o fim da lista traz
`Ver mais` com "N de M". O valor vive na URL (`?mostrar=`), então sobrevive ao
recarregar e às ações que recarregam o quadro.

Não existe "sem limite": a maior coluna tem centenas de registros e montar
todos de uma vez trava o navegador sem ajudar — para volume alto o caminho é
filtro e busca.

---

## Sobre os números da coluna "Novo" (medido em 24/09)

Levantado porque o desenho mostra `NOVO 0` e a tela mostrava outro número.

| medida | valor |
|---|---|
| gravadas com etapa `novo` | 2.182 |
| **destas, encerradas (`closed_at`)** | **2.070** |
| **abertas — o que a tela mostra** | **112** |
| abertas que entraram nos últimos 2 dias | 57 |
| abertas que entraram na última semana | 75 |
| abertas paradas há mais de 30 dias | 37 |
| mais antiga aberta | 05/08/2026 |

**A conciliação de "novo" está correta.** A tela filtra encerradas e mostra
112, dos quais metade chegou nos últimos dois dias — que é o que a etapa
significa.

Fica registrado um resíduo que não afeta esta tela: **2.070 aquisições
encerradas continuam com etapa `novo`**. Elas nunca saíram da etapa inicial e
foram fechadas. Qualquer relatório que agrupe por etapa sem filtrar
`closed_at` vai contá-las.

---

## 24/09 — a tela passou a SER o protótipo

O que estava acontecendo até aqui: a tela era **recriada** em React lendo o
desenho. Cada transcrição introduz divergência — espaçamento, peso, chip, cor —
e o resultado é que o Kauã precisava validar elemento por elemento e ainda
sobrava coisa errada. Duas rodadas de correção não resolveram, porque o método
é que estava errado.

Agora `/pre-vendas` renderiza o protótipo convertido por máquina.

### As três peças

| arquivo | o que é | escrito à mão? |
|---|---|---|
| `proto/PreVendasDesenho.tsx` | o markup, convertido do `.dc.html` | **não** |
| `proto/PreVendasLiga.tsx` | a lógica do protótipo, portada por substituição | **não** |
| `proto/PreVendasProto.tsx` | traduz o domínio e liga os overlays | sim |

Só o terceiro foi escrito, e de propósito: decidir que campo do
`CardPreVendas` vira que campo do lead do desenho é julgamento, e julgamento
não se automatiza. O markup e a lógica não passaram por transcrição nenhuma,
então não há divergência visual para procurar neles.

### O que mudou na tela, de imediato

- A faixa de indicadores voltou a mostrar **a fórmula** de cada número
  (`count(leads) · estagio ∈ ativos`), que a versão recriada não tinha.
- O checkbox do cartão voltou para o **canto superior direito**.
- Espaçamento, chips de origem com cor por canal, e o cartão inteiro passaram
  a ser os do desenho.

### O que a versão recriada tinha e o protótipo não

Estas eram correções pedidas sobre o código antigo. Como a tela agora é o
desenho, elas voltaram ao estado do desenho e precisam de decisão:

| item | no desenho | pedido do Kauã em 24/09 |
|---|---|---|
| botão `+ Novo lead` | existe | remover, Exportar assume o lugar |
| contador da coluna | conta os cartões carregados | mostrar o total real da etapa |
| `Ver mais` por coluna | não existe | carregar além da primeira leva |

**Onde corrigir:** no Claude Design, não aqui. Editar o arquivo gerado é
reabrir a porta da divergência — a próxima geração sobrescreve, e volta tudo.
Se a decisão for manter no código, ela precisa entrar como opção do adaptador,
declarada neste registro.

### Arquivos da versão recriada

`vendas/PreVendasQuadro.tsx` e `vendas/pre-vendas-quadro.css` deixaram de ser
usados pela rota. Não foram removidos: remoção de código é autorização à
parte, e a comparação entre os dois ainda é útil enquanto a virada assenta.
