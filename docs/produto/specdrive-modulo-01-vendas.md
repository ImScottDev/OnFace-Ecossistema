# SPECDRIVE — VENDAS
## Bloco 01 — Pré-vendas

**Status:** FECHADO para implementação  
**Produto:** ONFACE — Business Operating System  
**Objetivo:** estruturar a entrada, contato, qualificação e handoff de empresas para o processo comercial.

---

## 1. Princípio do módulo

Pré-vendas **não é uma lista de pessoas**.

O objeto operacional que o usuário enxerga é uma **Empresa em processo de qualificação**, com uma ou mais Pessoas associadas.

```text
EMPRESA
│
├── Pessoa principal
├── Outras pessoas
│
└── LEAD
    Processo de Pré-vendas
```

Definições canônicas:

```text
Empresa       = identidade permanente da organização
Pessoa        = identidade permanente do contato humano
Lead          = processo temporário de Pré-vendas daquela empresa
Oportunidade  = processo comercial criado depois da qualificação
Cliente       = estado pós-Won da relação comercial
```

Portanto:

> Lead NÃO deve mais ser tratado conceitualmente como Pessoa.

O schema atual ainda carrega dados de pessoa dentro de `leads`, mas o novo Domain Model já possui `empresas`, `pessoas`, `pontosContato` e `oportunidades`.

A implementação deve evoluir em direção a esse modelo sem exigir uma reescrita destrutiva do legado.

---

## 2. Fluxo oficial de Pré-vendas

```text
NOVO
  ↓
EM CONTATO
  ↓
QUALIFICAÇÃO
  ↓
QUALIFICADO
  ↓
OPORTUNIDADE
```

Saídas auxiliares:

```text
                ┌──→ NUTRIÇÃO
                │
QUALIFICAÇÃO ───┤
                │
                └──→ DESQUALIFICADO
```

Nutrição e Desqualificado são estados reais, mas **não precisam ocupar permanentemente duas colunas gigantes no board principal**.

A interface pode trabalhar com:

```text
Ativos | Nutrição | Desqualificados
```

Mantendo no board de ativos:

```text
Novo | Em Contato | Qualificação | Qualificado | Oportunidade
```

---

## 3. Entrada de um novo Lead

Para o fluxo futuro de inbound, **todos os formulários devem possuir Empresa**.

Entrada canônica:

```text
Formulário / API / integração
        ↓
Identificar ou criar Empresa
        ↓
Identificar ou criar Pessoa
        ↓
Associar Pessoa ↔ Empresa
        ↓
Registrar Ponto de Contato / atribuição
        ↓
Criar Lead
        ↓
NOVO
```

### Regra crítica

**Um formulário inbound não cria uma Oportunidade automaticamente.**

Hoje a rota existente já resolve/cria Empresa e possui uma captura bastante rica de origem, mas também pode criar `negocio` junto da entrada.

Essa lógica deve deixar de ser o comportamento padrão do novo inbound.

A oportunidade só nasce posteriormente por uma ação explícita de conversão.

---

## 4. Identidade e deduplicação

Antes de criar registros novos:

```text
Empresa
→ tentar resolver por CNPJ
→ domínio
→ outros identificadores confiáveis
→ fallback controlado por nome

Pessoa
→ e-mail
→ telefone / WhatsApp
→ outros identificadores confiáveis
```

Se a Empresa já existe:

**não duplicar Empresa.**

Se a Pessoa já existe:

**não duplicar Pessoa.**

Porém uma mesma Empresa/Pessoa pode possuir **mais de um Lead histórico**.

Exemplo:

```text
NovaTech
│
├── Lead #001 — Meta Ads — desqualificado em março
│
└── Lead #048 — Indicação — entrou novamente em setembro
```

Isso é proposital.

Precisamos medir reengajamento sem ressuscitar artificialmente processos comerciais antigos.

---

## 5. Empresa-first na interface

O board não deve apresentar:

```text
Rafael Lima
NovaTech
```

como conceito principal.

Deve apresentar:

```text
NovaTech
Rafael Lima · Head de Operações
```

A Empresa é protagonista.

A Pessoa é o contato através do qual estamos trabalhando aquela empresa.

Exemplo de card:

```text
┌───────────────────────────────┐
│ NovaTech                      │
│ Rafael Lima · Head Operações  │
│                               │
│ Meta Ads · Campanha SaaS      │
│ Callface AI                   │
│                               │
│ Mariana           há 2h       │
│                               │
│ ☎   WhatsApp                  │
└───────────────────────────────┘
```

Não entupir o card.

Contexto aprofundado fica no drawer/página.

---

## 6. Etapa: NOVO

Significado:

> Lead entrou em Pré-vendas e ainda não recebeu tratamento operacional real.

Registrar obrigatoriamente:

```text
data/hora de entrada
origem
touchpoint
responsável, se atribuído
empresa
pessoa principal
serviço/interesse, se conhecido
```

Possíveis ações:

```text
Assumir
Atribuir
Abrir
WhatsApp
E-mail
Ligar
Mover para Em Contato
Nutrir
Desqualificar
```

Ao primeiro contato real:

```text
primeiroContatoAt
executor
canal
data/hora
```

O projeto já registra primeiro contato para WhatsApp/e-mail/ligação e possui infraestrutura de atividades que deve ser reaproveitada.

---

## 7. Etapa: EM CONTATO

Significado:

> A empresa já está sendo trabalhada, mas o processo de qualificação ainda não começou ou não possui informação suficiente.

Pode ter:

```text
tentativas de contato
WhatsApp
e-mails
ligações
tarefas
follow-ups
responsável
última interação
próxima ação
SLA
```

O simples fato de enviar uma tentativa não significa automaticamente que o lead está qualificado.

Toda movimentação deve registrar:

```text
de
para
quando
quem
motivo/contexto
```

---

## 8. Etapa: QUALIFICAÇÃO

Significado:

> Estamos entendendo se aquela empresa possui fit e oportunidade comercial real.

A qualificação é **estruturada**, não apenas uma observação de texto.

Base de informação:

```text
ICP / aderência
Dor / problema
Necessidade / objetivo
Serviço(s) de interesse
Cenário atual
Solução / concorrente atual
Urgência
Budget / condição comercial
Decisor / influenciadores
Prazo / timing de decisão
Quantidade de usuários/unidades, quando relevante
Observações
```

Nem todos os campos precisam ser obrigatórios.

A regra deve permitir que a organização configure posteriormente critérios mais rígidos, sem bloquear o MVP.

### Pessoa decisora

Uma Empresa pode possuir:

```text
Contato principal
Decisor
Influenciador
Financeiro
Técnico
Outros
```

Não precisamos construir uma mega-matriz de buying committee agora, mas o modelo não deve limitar Lead a uma única Pessoa para sempre.

---

## 9. Etapa: QUALIFICADO

Essa definição é crítica:

> **Qualificado significa que a empresa passou pelos critérios de qualificação.**

Não significa que uma oportunidade já foi criada.

Não significa que uma reunião foi marcada.

Não significa que o closer já assumiu.

Portanto:

```text
QUALIFICAÇÃO
      ↓
QUALIFICADO
      ↓
fica aguardando próxima ação
```

O Lead pode permanecer nessa etapa.

---

## 10. O fato “Qualificado” precisa sobreviver ao estágio atual

Não depender apenas de:

```text
stage = QUALIFICADO
```

Porque amanhã ele poderá estar:

```text
Oportunidade
Proposta
Negociação
Cliente
```

e ainda assim precisamos saber que **ele foi qualificado em determinado momento**.

A implementação deve possuir fato estruturado equivalente a:

```text
qualificado = true
qualificadoEm
qualificadoPor
qualificadoPorTipo
```

Onde `qualificadoPorTipo` pode ser, por exemplo:

```text
HUMAN
AI_AGENT
AUTOMATION
```

Ou modelagem equivalente via eventos + projeção.

Visualmente podemos mostrar:

`Qualificado`

como badge/tag.

Mas uma tag removível **não é a fonte da verdade**.

---

## 11. Etapa: OPORTUNIDADE

Definição:

> Existe uma Oportunidade comercial real criada no Pipeline.

A movimentação:

```text
Qualificado
     ↓
Oportunidade
```

não é apenas alteração de status.

Ela executa uma ação de negócio:

```text
CRIAR OPORTUNIDADE
```

Deve abrir uma superfície/modal contendo minimamente:

```text
Empresa
Pessoa/contato principal

Responsável comercial / closer

Família / interesse comercial

Próximo passo:
○ Criar oportunidade
○ Criar oportunidade + agendar reunião
```

### Reunião NÃO é requisito

Fluxo A:

```text
Qualificado
↓
Criar oportunidade
↓
Pipeline
```

Fluxo B:

```text
Qualificado
↓
Criar oportunidade + reunião
↓
Pipeline + Agenda
```

O conversor atual já aceita oportunidade com ou sem reunião, mas internamente ainda grava status `reuniao_agendada` mesmo no caminho sem reunião.

Essa semântica deve ser corrigida ao consolidarmos Pipeline.

---

## 12. Oportunidade como estágio espelho

Depois da criação:

```text
Pré-vendas:
OPORTUNIDADE

Pipeline:
oportunidade real sendo trabalhada
```

Pré-vendas não deve continuar simulando o Pipeline inteiro.

O estágio Oportunidade funciona como:

> “Esse Lead concluiu o handoff de Pré-vendas.”

Ao clicar:

```text
Abrir oportunidade
```

leva ao objeto comercial correspondente.

---

## 13. NUTRIÇÃO

Nutrição não pode ser uma “lixeira elegante”.

Ao mover para Nutrição, abrir modal.

Motivos estruturados iniciais:

```text
Sem resposta
Sem interesse no momento
Timing inadequado
Sem orçamento agora
Contrato vigente
Aguardando decisão interna
Retomar em outra data
Outro
```

Campos:

```text
Motivo *
Retomar em
Observação
```

Dependendo do motivo, `Retomar em` pode se tornar obrigatório.

Se houver data futura:

```text
Lead → Nutrição
↓
cria retomada / atividade futura
↓
na data definida
↓
entra novamente na fila operacional
```

O histórico anterior não é apagado.

---

## 14. DESQUALIFICADO

Ao desqualificar, motivo estruturado obrigatório.

Base inicial:

```text
Fora do ICP
Contato inválido
Empresa sem fit
Sem necessidade
Duplicado
Outro
```

Registrar:

```text
motivo
detalhe
responsável pela decisão
data/hora
etapa anterior
origem
campanha
tempo até desqualificação
```

Isso precisa alimentar relatórios posteriormente.

---

## 15. NO-SHOW

No-show não é coluna.

No-show não é nova oportunidade.

No-show é **evento comercial**.

Fluxo:

```text
Oportunidade existente
↓
Reunião marcada
↓
Cliente não compareceu
↓
NO-SHOW
```

Consequências:

```text
registrar evento NoShow
registrar reunião envolvida
registrar responsável
registrar data
preservar oportunidade existente
marcar visualmente "No-show"
Lead retorna para QUALIFICADO
```

Visualmente:

```text
NovaTech
Qualificado · No-show
```

Quando reagendar:

```text
Qualificado
↓
Reagendar
↓
reutiliza oportunidade existente
↓
cria/remarca reunião
↓
Oportunidade
```

**Proibido criar uma segunda oportunidade apenas porque houve no-show.**

O motor atual já possui uma boa base para recuperação e reutilização da oportunidade em no-show; preservar essa propriedade.

---

## 16. Origem e atribuição

Toda entrada deve produzir rastreabilidade.

Manter, quando disponível:

```text
Origem
Canal
Source
Medium
Campaign
Campaign ID
Ad Set
Ad
UTM source
UTM medium
UTM campaign
UTM content
UTM term
Landing page
Formulário
gclid
gbraid
wbraid
fbclid
fbc
fbp
event id
```

O schema legado já captura grande parte desses campos na entrada.

No Domain Model novo, a atribuição deve continuar em `pontosContato`, não enterrada exclusivamente no Lead.

`pontosContato` já suporta explicitamente source, campaign, first touch e last touch, exatamente para que a origem sobreviva à conversão comercial.

---

## 17. Histórico/eventos obrigatórios

Nenhuma mudança importante pode existir apenas como “estado atual”.

Precisamos poder reconstruir:

```text
LeadCreated
LeadAssigned
FirstContactMade
StageChanged
QualificationStarted
LeadQualified
LeadNurtured
LeadDisqualified
OpportunityCreated
MeetingScheduled
MeetingRescheduled
MeetingNoShow
OwnerChanged
LeadReactivated
```

Os nomes internos podem variar.

O requisito funcional é:

> **todo evento relevante possui entidade, timestamp, executor e contexto.**

Podemos reaproveitar:

```text
status_changes
atividades
audit_log
event/outbox
reuniões
tarefas
```

em vez de criar cinco sistemas paralelos.

---

## 18. Métricas que essa estrutura precisa permitir

Sem necessariamente construir todos os dashboards agora, os dados devem conseguir responder futuramente:

```text
Quantos Leads entraram?
Quantos foram contatados?
Quantos chegaram à qualificação?
Quantos foram qualificados?
Quantos viraram oportunidade?
Quantos foram nutridos?
Quantos foram desqualificados?
Quantos tiveram no-show?
Quantos foram recuperados?
```

E cruzar isso por:

```text
Origem
Canal
Campanha
Anúncio
Landing page
Responsável
Agente IA
Equipe
Produto
Período
```

Além de calcular:

```text
Lead → contato
Lead → qualificado
Qualificado → oportunidade
Lead → oportunidade

tempo até primeiro contato
tempo até qualificação
tempo até oportunidade
tempo por etapa
```

---

## 19. Humano e IA precisam usar o MESMO motor

Não criar:

```text
fluxo humano
+
fluxo NEXO
```

como sistemas distintos.

Ambos executam comandos de negócio equivalentes:

```text
moveStage()
qualifyLead()
nurtureLead()
disqualifyLead()
createOpportunity()
scheduleMeeting()
registerNoShow()
assignOwner()
```

A diferença é somente **quem executou**.

---

## 20. Contrato do futuro NEXO / Agente SDR

O NEXO pode ser configurado para atuar até diferentes pontos.

Exemplo:

```text
NEXO pode avançar até:

○ Em Contato
○ Qualificação
● Qualificado
○ Oportunidade
```

Portanto um agente pode executar:

```text
Novo
→ Em Contato
→ Qualificação
→ Qualificado
STOP
```

enquanto outro pode:

```text
Novo
→ Em Contato
→ Qualificação
→ Qualificado
→ marcar reunião
→ criar Oportunidade
```

O Deskcomm reforça essa arquitetura ao manter os passos do agente separados das etapas configuradas do CRM e aplicar um mapeamento entre os dois.

No ONFACE **não vamos tornar as cinco etapas de Pré-vendas configuráveis agora**.

Pegamos do Deskcomm o mecanismo conceitual de integração com agentes, não a obrigação de copiar toda sua arquitetura.

---

## 21. Superfícies mínimas de Pré-vendas

Para o MVP, considero necessárias:

```text
/pré-vendas
Board operacional

/pré-vendas/[lead]
Detalhe completo OU drawer + acesso à página completa

Novo Lead
Criação manual

Converter em oportunidade
Modal/flow

Mover para Nutrição
Modal

Desqualificar
Modal
```

Não precisamos criar página separada para cada microação.

---

## 22. Board

Board principal:

```text
NOVO
EM CONTATO
QUALIFICAÇÃO
QUALIFICADO
OPORTUNIDADE
```

Controle:

```text
Ativos | Nutrição | Desqualificados
```

Filtros úteis:

```text
Busca
Responsável
Origem
Campanha
Produto/interesse
Tags
SLA
Período de entrada
```

Não transformar o topo num dashboard cheio de KPI.

Essa é uma **workspace operacional**.

---

## 23. Drawer / detalhe de Lead

Estrutura conceitual:

```text
EMPRESA
NovaTech
segmento
porte
site
cidade
dados enriquecidos

PESSOAS
Rafael Lima · Head de Operações
[principal]
WhatsApp
E-mail
Telefone

QUALIFICAÇÃO
ICP
dor
necessidade
interesse
budget
urgência
decisor
timing
concorrente

ATRIBUIÇÃO
origem
canal
campanha
adset
ad
UTMs
landing page

RESPONSÁVEL
SDR / agente atual

PRÓXIMA AÇÃO
tarefa / follow-up / reunião

TIMELINE
captura
mensagem
ligação
email
mudança de etapa
qualificação
reunião
no-show
etc.
```

Não precisa exibir tudo aberto simultaneamente.

Boa UI deve trabalhar com hierarquia, agrupamento e progressive disclosure.

---

## 24. Ações rápidas do Lead

Dependendo das integrações disponíveis:

```text
WhatsApp
E-mail
Ligar
Criar atividade
Criar tarefa
Agendar reunião
Atribuir / transferir
Adicionar pessoa
Adicionar tag
Incluir em cadência
Nutrir
Desqualificar
Criar oportunidade
```

Botão clicável precisa funcionar de ponta a ponta.

Nada de CTA decorativo para “fechar tela”.

---

## 25. Responsável

Todo Lead trabalhado deve possuir responsabilidade clara.

Precisamos preservar:

```text
responsável atual
histórico de responsáveis
quando mudou
quem transferiu
origem da atribuição:
  manual
  automação
  round-robin
  agente
```

O repo já possui histórico de mudança de responsável e função centralizada para isso; deve ser reutilizado.

---

## 26. SLA

A infraestrutura atual já trabalha com SLA por estágio.

Manter o conceito, mas **não congelar tempos comerciais nessa spec ainda**.

Precisamos permitir saber:

```text
tempo na etapa
dentro/fora do SLA
tempo desde última interação
próxima ação atrasada
```

Sem transformar SLA em estágio.

---

## 27. Estratégia em relação ao legado

Essa regra é importante para o Claude depois:

```text
LEGADO É FONTE DE DADOS A SER PRESERVADA.
LEGADO NÃO É FONTE DA NOVA REGRA DE NEGÓCIO.
```

Portanto:

- não apagar histórico existente;
- não fazer migração destrutiva agora;
- reaproveitar rotas, serviços e dados sólidos;
- adicionar campos/tabelas/eventos quando realmente necessários;
- mapear estados antigos para leitura;
- **novas entradas devem obedecer ao modelo novo**;
- progressivamente tornar Domain Model v2 a fonte da verdade;
- evitar continuar perpetuando `Lead = pessoa`;
- manter bridges/dual-write somente onde forem necessários durante a transição.

O repo já iniciou exatamente esse movimento através de `syncPessoaFromLead()` e `syncOportunidadeFromNegocio()`.

A refatoração não precisa recomeçar do zero.

---

## 28. Critérios de aceite desta frente

Pré-vendas só está implementado quando conseguimos executar:

```text
Form inbound
↓
Empresa/Pessoa resolvidas
↓
Lead em Novo
↓
origem preservada
↓
responsável definido
↓
primeiro contato
↓
Em Contato
↓
Qualificação
↓
dados de qualificação persistidos
↓
Qualificado
↓
fato histórico de qualificação preservado
↓
Criar oportunidade
↓
opção com ou sem reunião
↓
Oportunidade real no Pipeline
↓
Lead aparece como Oportunidade em Pré-vendas
```

Além dos caminhos:

```text
Lead → Nutrição + motivo
Lead → Desqualificado + motivo
Oportunidade → No-show
No-show → Lead volta Qualificado
Reagendamento → mesma Oportunidade é reutilizada
```

E depois de reload:

**tudo continua exatamente no estado persistido.**

---

## 29. Coisas explicitamente proibidas

```text
❌ Form inbound criar oportunidade automaticamente
❌ Lead ser tratado visualmente como uma pessoa isolada
❌ Qualificado criar oportunidade automaticamente
❌ Reunião ser necessária para existir oportunidade
❌ No-show criar segunda oportunidade
❌ No-show virar coluna permanente
❌ Qualificação depender de uma tag removível
❌ Nutrição sem motivo
❌ Desqualificação sem motivo
❌ Perder origem depois da conversão
❌ IA possuir lógica comercial paralela à lógica humana
❌ Claude redesenhar regra do módulo por conta própria
```

---

## 30. Referência conceitual externa — DeskcommCRM

Repositório de referência:

`https://github.com/melgarafael/DeskcommCRM`

Conceito reaproveitado:

- separar os passos internos do agente das etapas reais do funil;
- permitir mapear “quando o agente chegar neste momento, mova o card para aquela etapa”;
- permitir “não mover o card” como comportamento legítimo;
- não acoplar o estado interno da IA diretamente ao estado comercial configurado no CRM.

No ONFACE, esse conceito serve como referência para integração com NEXO/Agentes.

**Não significa copiar a arquitetura do Deskcomm nem tornar as cinco etapas de Pré-vendas configuráveis agora.**

---

# Estado do bloco

## PRÉ-VENDAS: CONCEITUALMENTE FECHADO

A única coisa que pode mudar depois é detalhe de implementação descoberto no código — **não a regra de negócio acima**.

Próximo bloco da SpecDrive:

# Bloco 02 — Oportunidades / Pipeline

Deve fechar:

- o que é uma oportunidade;
- como ela nasce;
- quais são as etapas reais;
- o que é etapa vs. evento vs. substatus;
- reunião;
- no-show;
- proposta;
- trial;
- negociação;
- perdido;
- Won;
- famílias de serviço;
- multi-family / oportunidades irmãs;
- receita;
- contrato;
- pagamento;
- handoff pós-Won;
- integração com Financeiro, Onboarding/Implantação e CS;
- regras de histórico;
- critérios de aceite.

---

# SPECDRIVE — VENDAS
## Bloco 02 — Oportunidades / Pipeline

**Status:** FECHADO para implementação  
**Produto:** ONFACE — Business Operating System  
**Objetivo:** definir a entidade Oportunidade, seu ciclo comercial, regras de entrada e progressão, gates de proposta/fechamento e consequências pós-Won.

---

## 1. Definição canônica de Oportunidade

> **Oportunidade é um processo comercial real aberto com uma Empresa para vender uma família de serviço específica.**

Uma Oportunidade:

- pertence obrigatoriamente a uma Empresa;
- pode ou não ter vindo de um Lead de Pré-vendas;
- deve pertencer obrigatoriamente a uma única família comercial;
- possui responsável, estágio, valor, histórico, atividades, proposta(s), eventos e fechamento;
- pode ter uma Pessoa principal associada como contato, mas nunca existe apenas para uma Pessoa física sem Empresa.

```text
EMPRESA
│
├── Pessoas
├── Lead de Pré-vendas (opcional)
│
└── Oportunidade
    ├── Família *
    ├── Responsável *
    ├── Pipeline
    ├── Valor
    ├── Atividades
    ├── Reuniões
    ├── Propostas
    └── Fechamento
```

---

## 2. Uma oportunidade = uma família

Famílias canônicas:

```text
CALLFACE_AI
PABX
WHITE_LABEL
UNKNOWN
```

`UNKNOWN` deve existir apenas para compatibilidade/legado ou registros ainda não classificados.

**Novas oportunidades não devem nascer como UNKNOWN.**

Exemplo:

```text
NovaTech quer:
Callface AI + PABX
```

Não criar uma oportunidade genérica para as duas famílias.

Criar:

```text
Bundle comercial NovaTech
│
├── Oportunidade #1 — Callface AI
└── Oportunidade #2 — PABX
```

As oportunidades podem compartilhar Empresa, Pessoa principal, origem, Lead, bundle e contexto, mas possuem ciclo comercial e fechamento independentes.

---

## 3. Multi-família na saída de Pré-vendas

Ao mover um Lead Qualificado para Oportunidade, a família é obrigatória.

Se o usuário selecionar uma única família:

```text
1 família
→ 1 oportunidade
```

Se selecionar duas ou mais:

```text
2 famílias
→ 2 oportunidades irmãs
→ mesmo bundleId
```

Exemplo:

```text
Callface AI + White Label
↓
Oportunidade: Empresa — Callface AI
Oportunidade: Empresa — White Label
```

O Lead de Pré-vendas permanece único; as oportunidades comerciais são separadas.

---

## 4. Família é editável

A família da oportunidade pode ser alterada enquanto a oportunidade estiver aberta.

Exemplo:

```text
WHITE_LABEL
↓
CALLFACE_AI
```

Ao alterar família, registrar evento estruturado contendo:

```text
família anterior
nova família
data/hora
executor
motivo/opcional
```

### Regra de consistência

A família da oportunidade define o catálogo comercial disponível para Propostas.

Se já existir proposta vinculada incompatível com a nova família, a alteração **não pode silenciosamente deixar proposta e oportunidade inconsistentes**.

A regra específica de como tratar proposta existente será fechada no Bloco 03 — Propostas, mas a implementação deve impedir inconsistência silenciosa.

---

## 5. Origens possíveis de uma Oportunidade

A oportunidade pode nascer por quatro caminhos oficiais:

### A. Pré-vendas

```text
Lead Qualificado
→ Criar oportunidade
→ NEW_BUSINESS
```

### B. Criação manual no Pipeline

```text
Pipeline
→ Nova oportunidade
→ NEW_BUSINESS
```

### C. Cliente / Carteira

```text
Cliente 360
→ Nova oportunidade
→ EXPANSION
```

### D. Prospecção

```text
Prospecção
→ Converter / Criar oportunidade
→ NEW_BUSINESS
```

Em todos os casos:

- Empresa é obrigatória;
- Família é obrigatória;
- responsável comercial deve estar definido;
- origem deve permanecer rastreável;
- Pessoa/contato principal é recomendada, mas não substitui a Empresa.

---

## 6. Criação a partir de Pré-vendas

Ao mover:

```text
QUALIFICADO
↓
OPORTUNIDADE
```

abrir uma ação de negócio, não apenas trocar status.

Campos mínimos:

```text
Empresa
Contato principal
Família(s) de interesse *
Responsável comercial *
Próximo passo
```

Próximo passo:

```text
○ Apenas criar oportunidade
○ Criar oportunidade + agendar reunião
```

Reunião não é requisito para criar oportunidade.

---

## 7. Criação manual no Pipeline

A oportunidade criada manualmente pode existir sem Lead de Pré-vendas, mas nunca sem Empresa.

Campos mínimos:

```text
Empresa *
Contato principal
Família *
Responsável *
Motion
Origem
Valor estimado
Previsão de fechamento
Próximo passo
```

`leadId` é opcional.

`empresaId` é obrigatório.

---

## 8. Nome da Oportunidade

Gerar automaticamente por padrão:

```text
{Empresa} — {Família}
```

Exemplos:

```text
NovaTech — Callface AI
NovaTech — PABX
```

O usuário pode editar o título se necessário.

---

## 9. Pipeline oficial

Etapas abertas:

```text
ENTRADA
   ↓
DIAGNÓSTICO
   ↓
PROPOSTA
   ↓
NEGOCIAÇÃO
```

Saídas fechadas:

```text
GANHO
PERDIDO
```

Board principal:

```text
Entrada | Diagnóstico | Proposta | Negociação
```

Ganhas e Perdidas devem continuar consultáveis via tab/filtro equivalente, sem ocupar permanentemente largura do board operacional.

---

## 10. Significado das etapas

### ENTRADA

Oportunidade acabou de entrar no processo comercial.

Pode ter reunião marcada ou não.

Pode ter vindo de Pré-vendas, Prospecção, criação manual ou Cliente/Expansão.

**Entrada não significa reunião agendada.**

---

### DIAGNÓSTICO

Closer está entendendo cenário, necessidade e solução comercial.

Pode envolver:

```text
reunião
ligação
WhatsApp
e-mail
trial
diagnóstico técnico
```

Trial é evento/estado contextual, não coluna do Pipeline.

---

### PROPOSTA

Existe proposta vinculada à oportunidade.

#### Gate obrigatório

Se o usuário tentar mover manualmente para `PROPOSTA` e não houver proposta vinculada:

```text
bloquear movimento
↓
mostrar mensagem
"Crie uma proposta para mover esta oportunidade para Proposta."
↓
oferecer CTA "Criar proposta"
```

Quando uma proposta for enviada/apresentada, a oportunidade deve mover automaticamente para `PROPOSTA` quando ainda estiver em etapa anterior.

A criação de mero rascunho não precisa forçar movimentação automática.

---

### NEGOCIAÇÃO

Existe processo comercial ativo sobre uma proposta.

#### Gate obrigatório

Não permitir entrada em `NEGOCIAÇÃO` sem proposta vinculada.

Se não houver:

```text
bloquear movimento
↓
explicar o requisito
↓
CTA para criar proposta
```

A negociação pode envolver:

```text
desconto
escopo
quantidade
prazo
contrato
forma de pagamento
pacote
condições especiais
```

---

## 11. Reunião é evento, nunca etapa

Uma oportunidade pode possuir nenhuma ou várias reuniões.

Eventos previstos:

```text
MeetingScheduled
MeetingRescheduled
MeetingCompleted
MeetingCancelled
MeetingNoShow
```

Reuniões aparecem em:

- Timeline;
- Calendário;
- próxima ação;
- badges/contexto.

Não devem ser modeladas como coluna do Pipeline.

---

## 12. No-show

No-show é evento, não etapa e não cria oportunidade nova.

```text
Oportunidade existente
+
Reunião marcada
↓
No-show
```

Consequências:

```text
registrar evento NoShow
preservar mesma opportunityId
preservar oportunidade
marcar contexto "No-show"
Lead de Pré-vendas retorna para QUALIFICADO, quando houver Lead associado
```

Ao reagendar:

```text
mesma oportunidade
+
nova reunião
```

Nunca criar Oportunidade #2 apenas por causa do no-show.

---

## 13. Próxima ação

Toda oportunidade aberta deve suportar:

```text
Próxima ação
Data
Responsável
```

Exemplo:

```text
Enviar proposta revisada · amanhã 10:00
```

Se não houver próxima ação:

```text
⚠ Sem próxima ação
```

Esse sinal alimentará futuramente Home, NEXO, alertas e detecção de estagnação.

---

## 14. Valor da Oportunidade

**Não assumir MRR como valor principal.**

Nem toda venda é recorrente.

Uma oportunidade pode conter diferentes naturezas econômicas, por exemplo:

```text
MRR
SETUP
PROJECT
ONE_TIME
USAGE
HARDWARE
```

### Exibição no card

O card deve priorizar:

```text
Valor da oportunidade
```

Não `MRR` por padrão.

Exemplo:

```text
NovaTech
Callface AI

R$ 8.940
Scott
```

O valor deve representar o valor comercial total conhecido daquela oportunidade segundo a melhor fonte disponível.

### Composição de receita

Na visão detalhada e em relatórios, manter a composição separada quando disponível:

```text
MRR estimado/fechado
Setup estimado/fechado
One-time
Projeto
Uso
Hardware
Outras naturezas
```

A fonte mais precisa de valor tende a vir dos itens da Proposta.

Até existir proposta, pode existir valor estimado informado manualmente.

Nunca misturar estimativa com realizado sem distinção.

---

## 15. Proposta é filtrada pela família da Oportunidade

Ao criar proposta a partir de uma oportunidade:

```text
Oportunidade: CALLFACE_AI
↓
Composer da proposta
↓
mostrar apenas produtos/itens elegíveis da família CALLFACE_AI
```

Exemplos:

```text
PABX → catálogo PABX
WHITE_LABEL → catálogo White Label
CALLFACE_AI → catálogo Callface AI
```

Não exibir todo o catálogo de todas as famílias por padrão.

Isso reduz erro comercial e mantém proposta coerente com a oportunidade.

A definição detalhada da relação Proposta ↔ oportunidade(s) será fechada no Bloco 03.

---

## 16. Pipeline e drag & drop

Toda movimentação deve persistir e gerar histórico estruturado.

```text
Entrada
↓
Diagnóstico
```

registrar equivalente a:

```text
OpportunityStageChanged
from
To
timestamp
actor
tempoNaEtapaAnterior
```

Após reload, a oportunidade permanece no novo estágio.

Não usar `updatedAt` como substituto de histórico real de estágio.

---

## 17. Perdido

Mover para Perdido abre modal obrigatório.

Motivos iniciais:

```text
Sem retorno
Sem interesse
Preço
Escolheu concorrente
Sem orçamento
Timing / outra data
Trava na negociação
Trava contratual
Projeto cancelado
Sem fit após diagnóstico
Outro
```

Registrar:

```text
motivo estruturado
detalhes opcionais
data/hora
responsável
estágio anterior
valor perdido
tempo de ciclo
```

No modelo futuro:

```text
stage = LOST
lossReason = motivo estruturado
```

Evitar perpetuar motivos como statuses diferentes.

---

## 18. Negociar em outra data

Pode ser encerrado como Perdido com motivo `TIMING / OUTRA DATA` e gerar atividade/follow-up futuro.

Quando chegar a data, o usuário pode decidir entre:

```text
Reabrir mesma oportunidade
ou
Criar nova oportunidade
```

Não reabrir automaticamente sem decisão operacional.

---

## 19. Ganho / Won

**GANHO não pode ser alcançado manualmente por drag-and-drop.**

Não existe movimento livre:

```text
Negociação
→ Ganho
```

O estado `WON` é consequência de um gate de evidência válido para aquela família e para aquele modo comercial.

Toda tentativa de conclusão deve usar o mesmo motor de validação.

---

## 20. Gates de Won por família

### Callface AI — fluxo padrão

```text
Proposta aceita
↓
Checkout / cobrança
↓
Pagamento confirmado
↓
WON
```

### Callface AI — fluxo contratual

Callface AI também pode ser comercializado via contrato.

A Proposta deverá permitir escolher o modo comercial correspondente.

A regra exata do gate do modo contratual será fechada no Bloco 03 — Propostas, mas o Pipeline deve estar preparado para receber um `closingMode`/modelo equivalente que determine a evidência necessária.

### PABX

```text
Proposta
↓
Contrato
↓
Contrato assinado
↓
WON
```

### White Label inicial

```text
Proposta
↓
Contrato
↓
Contrato assinado
↓
WON
```

### Licença adicional White Label para cliente existente

Pode seguir:

```text
Checkout / pagamento
↓
WON
```

sem contrato obrigatório, conforme regra comercial aplicável.

---

## 21. Proposta aceita não é Won

```text
ProposalAccepted
≠
OpportunityWon
```

Aceite significa que o cliente aceitou a oferta.

A oportunidade continua aguardando a evidência de fechamento exigida pela família/modo comercial.

---

## 22. Consequências de Won

Won sempre executa efeitos pós-venda consistentes.

```text
OpportunityWon
↓
Cliente criado/atualizado
↓
Service criado
↓
Onboarding criado
```

### Nova regra canônica de roteamento

**TODOS os novos Services passam primeiro por Onboarding.**

O Onboarding é específico por família.

```text
CALLFACE_AI
→ Onboarding Callface AI
→ conclusão da ativação dentro do próprio Onboarding
```

```text
PABX
→ Onboarding PABX
→ kickoff
→ alinhamento de próximos passos
→ solicitação/coleta de materiais e informações
→ quando pronto: Implantação PABX
```

```text
WHITE_LABEL
→ Onboarding White Label
→ kickoff
→ alinhamento de próximos passos
→ solicitação/coleta de materiais e informações
→ quando pronto: Implantação White Label
```

Portanto:

> Onboarding é a porta universal do pós-venda.

Implantação é uma segunda fase para famílias que exigem implementação técnica posterior.

---

## 23. Origem e atribuição

Oportunidade herda e preserva a origem comercial quando vier de Pré-vendas ou Prospecção.

Exemplos:

```text
Meta Ads
Campanha
Adset
Ad
UTMs
Landing page
Prospecção outbound
Campanha comercial
```

Não duplicar fonte da verdade sem necessidade.

Relacionamento preferencial:

```text
Oportunidade
→ Empresa
→ Pessoa(s)
→ Lead / origem, quando houver
→ Ponto(s) de Contato
```

Se criada manualmente:

```text
Origem = Manual
```

Se criada dentro de Cliente:

```text
Motion = EXPANSION
Origem relacional = Cliente/Carteira
```

---

## 24. Oportunidades relacionadas / bundle

Oportunidades irmãs devem conseguir aparecer relacionadas.

Exemplo:

```text
Bundle NovaTech
├── Callface AI — Proposta
└── PABX — Diagnóstico
```

Fechamento independente é permitido:

```text
AI → WON
PABX → NEGOCIAÇÃO
```

Nunca obrigar todas as oportunidades do bundle a fecharem juntas.

---

## 25. Detalhe da Oportunidade

Estrutura conceitual mínima:

```text
NovaTech — Callface AI

[ Diagnóstico ] [ New Business ]

Valor: R$ 8.940
Responsável: Scott
Previsão: 30 set

EMPRESA / CONTATO
ORIGEM
FAMÍLIA

PRÓXIMA AÇÃO

QUALIFICAÇÃO HERDADA

dor
necessidade
urgência
decisor
budget
timing

PROPOSTAS

ATIVIDADES / TIMELINE

OPORTUNIDADES RELACIONADAS
```

Não transformar a tela em uma grade de cards sem hierarquia.

---

## 26. Card do Pipeline

Informação principal:

```text
Empresa
Família
Valor
Responsável
Próxima ação
Tempo na etapa
```

Exemplo:

```text
NovaTech
Callface AI

R$ 8.940
Scott

Proposta enviada
Próxima ação amanhã

3d na etapa
```

Badges contextuais possíveis:

```text
Trial ativo
No-show
Sem próxima ação
Pagamento pendente
Contrato pendente
Proposta aberta
Atrasado
```

Badges não viram colunas.

---

## 27. Histórico/eventos mínimos

Precisamos poder reconstruir:

```text
OpportunityCreated
OpportunityAssigned
OpportunityFamilyChanged
OpportunityStageChanged
MeetingScheduled
MeetingRescheduled
MeetingCompleted
MeetingNoShow
TrialStarted
TrialEnded
ProposalCreated
ProposalSent
ProposalAccepted
ProposalRejected
ContractCreated
ContractSigned
PaymentCreated
PaymentConfirmed
OpportunityLost
OpportunityWon
```

Os nomes internos podem variar.

O requisito é persistir entidade, timestamp, executor e contexto.

---

## 28. Métricas habilitadas pelo modelo

O modelo deve permitir calcular futuramente:

```text
Oportunidades criadas
Oportunidades abertas
Oportunidades ganhas
Oportunidades perdidas
Win rate
Valor de pipeline
Valor ganho
Ticket médio
Tempo de ciclo
Tempo por etapa
```

Conversões:

```text
Entrada → Diagnóstico
Diagnóstico → Proposta
Proposta → Negociação
Negociação → Won
```

Cruzamentos:

```text
Responsável
Família
Origem
Campanha
Motion
Período
```

E também:

```text
No-show rate
Trial → Won
Proposal → Won
Motivos de perda
```

Receita recorrente e não recorrente devem continuar mensuráveis separadamente, mas **não transformar MRR no valor universal da Oportunidade**.

---

## 29. Coisas explicitamente proibidas

```text
❌ oportunidade sem Empresa
❌ nova oportunidade sem Família
❌ oportunidade multi-família única
❌ selecionar duas famílias e criar apenas um negócio genérico
❌ usar MRR como valor universal do card
❌ reunião ser etapa do Pipeline
❌ trial ser etapa do Pipeline
❌ no-show ser etapa do Pipeline
❌ no-show criar oportunidade nova
❌ entrar em Proposta sem proposta vinculada
❌ entrar em Negociação sem proposta vinculada
❌ Ganho manual por drag-and-drop
❌ ProposalAccepted ser tratado como Won
❌ catálogo de proposta mostrar produtos de famílias incompatíveis
❌ alteração de família deixar proposta incompatível silenciosamente
❌ PABX/White Label pularem Onboarding e irem direto para Implantação
```

---

## 30. Critérios de aceite do bloco

### Caminho vindo de Pré-vendas

```text
Lead Qualificado
↓
seleciona 1 família
↓
1 oportunidade criada
↓
Empresa obrigatória
↓
Família correta
↓
Entrada no Pipeline
```

### Multi-família

```text
Lead Qualificado
↓
seleciona 2 famílias
↓
2 oportunidades criadas
↓
mesmo bundle
↓
fechamento independente
```

### Prospecção

```text
Prospect qualificado/contextualizado
↓
Criar oportunidade
↓
Empresa + Família obrigatórias
↓
Pipeline
↓
origem "Prospecção" preservada
```

### Stage gate — Proposta

```text
Oportunidade sem proposta
↓
tenta mover para Proposta
↓
bloqueado
↓
CTA Criar proposta
```

### Stage gate — Negociação

```text
Oportunidade sem proposta
↓
tenta mover para Negociação
↓
bloqueado
```

### Proposta enviada

```text
Oportunidade em Entrada/Diagnóstico
↓
Proposta enviada
↓
move automaticamente para Proposta
```

### Família

```text
Editar família
↓
persiste
↓
histórico registrado
↓
catálogo futuro de proposta passa a respeitar nova família
```

### Won

```text
Tentativa manual de Ganho
↓
não existe / bloqueada

Gate válido da família/modo comercial
↓
OpportunityWon
↓
Cliente
↓
Service
↓
Onboarding da família
```

### Pós-Won

```text
AI
→ Onboarding AI

PABX
→ Onboarding PABX
→ Implantação PABX quando pronto

White Label
→ Onboarding White Label
→ Implantação White Label quando pronto
```

Após reload, todos os estados e relacionamentos continuam persistidos.

---

# Estado do bloco

## OPORTUNIDADES / PIPELINE: CONCEITUALMENTE FECHADO

Próximo bloco da SpecDrive:

# Bloco 03 — Propostas

Deve fechar:

- relação Proposta ↔ Oportunidade;
- catálogo filtrado por família;
- itens e naturezas de receita;
- quantidades e recorrência;
- setup, avulso, projeto, MRR, uso e hardware;
- proposta simples x contratual;
- Callface AI padrão x Callface AI com contrato;
- PABX;
- White Label;
- descontos;
- validade;
- envio e tracking;
- aceite;
- recusa;
- revisão/versionamento;
- geração de checkout;
- geração/assinatura de contrato;
- efeitos no Pipeline;
- gates de Won;
- critérios de aceite.

---

# Bloco 03 — Propostas

**Status:** CONCEITUALMENTE FECHADO  
**Escopo:** criação, versionamento, envio, tracking, aceite, ajuste, recusa e conexão da proposta com o modo de fechamento da oportunidade.

---

## 1. Relação entre Oportunidade e Proposta

A regra canônica é:

```text
1 Oportunidade
→ 1 Família comercial
→ N Propostas históricas
→ 1 Proposta vigente/principal por vez
```

Uma oportunidade pode possuir várias propostas ao longo da negociação, mas todas pertencem à **mesma família da oportunidade**.

Exemplo:

```text
Oportunidade
NovaTech — Callface AI

├── Proposta v1 — Substituída
├── Proposta v2 — Substituída
└── Proposta v3 — Vigente
```

Quando uma nova proposta substitui outra, a anterior passa para `SUBSTITUÍDA` e não pode mais ser aceita.

---

## 2. Catálogo filtrado pela família da oportunidade

Ao criar uma proposta, o usuário **não escolhe livremente entre produtos de todas as famílias**.

O catálogo é filtrado pela família da oportunidade.

Exemplo:

```text
Oportunidade:
NovaTech — CALLFACE_AI

Criar proposta
↓
mostrar apenas:
- produtos Callface AI
- setups Callface AI
- add-ons Callface AI
- serviços compatíveis com Callface AI
```

Mesma regra para `PABX` e `WHITE_LABEL`.

Se a família da oportunidade for alterada, propostas novas passam a usar o catálogo da nova família.

Propostas históricas já enviadas não devem ser reescritas retroativamente.

---

## 3. Jornada de criação da proposta

Criar proposta deve ser uma jornada guiada, não um formulário solto.

Fluxo recomendado:

```text
1. Selecionar itens
↓
2. Definir quantidades e preços
↓
3. Definir descontos, quando houver
↓
4. Conferir composição financeira
↓
5. Definir validade
↓
6. Definir modo de fechamento
↓
7. Validar dados obrigatórios
↓
8. Revisar proposta
↓
9. Enviar
```

A proposta só pode ser enviada quando os dados necessários ao modo de fechamento escolhido estiverem válidos.

---

## 4. Itens e natureza econômica

Cada item da proposta deve carregar minimamente:

```text
Produto / Serviço
Descrição
Quantidade
Preço unitário
Desconto
Subtotal
Natureza econômica
Recorrência
```

Naturezas canônicas:

```text
MRR
SETUP
PROJECT
ONE_TIME
USAGE
HARDWARE
```

Nem tudo é MRR.

O sistema não deve tratar toda venda como recorrência.

---

## 5. Valor da oportunidade

O Pipeline deve trabalhar com o conceito genérico de **Valor**, sem assumir MRR.

A composição financeira real vem da proposta.

Exemplos:

```text
Recorrente mensal: R$ 1.497
Setup:             R$ 2.000
```

ou:

```text
Venda avulsa:      R$ 8.500
```

ou:

```text
Projeto:           R$ 25.000
```

Quando houver recorrência + valores não recorrentes, não somar tudo de forma enganosa como se fosse um único total homogêneo.

Quando existir prazo contratual, o sistema pode calcular um valor contratado total, por exemplo:

```text
TCV =
(recorrência × prazo contratual)
+ setup
+ demais valores não recorrentes
```

Sem prazo contratual, não inventar TCV.

---

## 6. Validade da proposta

Antes de enviar, o usuário deve selecionar a validade.

Opções iniciais:

```text
7 dias
14 dias
22 dias
30 dias
```

A proposta deve armazenar:

```text
enviadaEm
validadeEmDias
dataValidade
```

Após expirar:

```text
status = EXPIRADA
```

Expiração da proposta **não perde automaticamente a oportunidade**.

---

## 7. Modo de fechamento

Antes de enviar, o usuário deve definir o modo de fechamento comercial.

Exemplo para Callface AI:

```text
Modo de fechamento

○ Pré-pago / Checkout
○ Contrato
```

Esse modo determina o fluxo posterior ao aceite.

O modo precisa ser conhecido **antes do envio**, porque muda regras, dados obrigatórios e gate de Won.

---

## 8. Estados da proposta

Estados canônicos:

```text
RASCUNHO
ENVIADA
VISUALIZADA
AJUSTE_SOLICITADO
ACEITA
RECUSADA
EXPIRADA
SUBSTITUÍDA
```

A proposta vigente pode transitar conforme a interação do cliente.

---

## 9. Proposta enviada move oportunidade para Proposta

Ao enviar uma proposta válida:

```text
ProposalSent
↓
Oportunidade → PROPOSTA
```

Se a oportunidade estiver em `Entrada` ou `Diagnóstico`, o avanço ocorre automaticamente.

Se o usuário tentar mover manualmente a oportunidade para `Proposta` sem existir proposta válida:

```text
BLOQUEAR
```

Mensagem operacional:

> Para mover esta oportunidade para Proposta, crie ou envie uma proposta primeiro.

CTA:

```text
Criar proposta
```

---

## 10. Negociação exige proposta

Uma oportunidade não pode entrar em `Negociação` sem possuir ao menos uma proposta criada/enviada no histórico comercial.

Se o usuário tentar:

```text
Proposta inexistente
↓
Mover para Negociação
```

bloquear e orientar a criação da proposta.

A etapa `Negociação` representa negociação sobre uma oferta comercial real.

---

## 11. Tracking da proposta

Registrar, quando disponível:

```text
criadaEm
criadaPor
enviadaEm
enviadaPor
destinatários
primeiraVisualizacaoEm
ultimaVisualizacaoEm
clienteRespondeuEm
aceitaEm
recusadaEm
ajusteSolicitadoEm
expiradaEm
substituidaEm
```

Esses eventos alimentam Timeline, Pipeline, relatórios e automações.

---

## 12. Solicitação de ajuste pelo cliente

Na proposta pública, o cliente pode selecionar:

```text
Solicitar ajuste
```

e preencher um texto explicando o que deseja alterar.

Registrar:

```text
ProposalAdjustmentRequested
descrição
data/hora
proposta
oportunidade
cliente/contato
```

A equipe comercial visualiza o pedido no ONFACE.

O pedido de ajuste não altera silenciosamente a proposta original.

O comercial cria uma nova versão.

---

## 13. Versionamento

Depois de uma proposta enviada, alterações comerciais relevantes geram nova versão.

Fluxo:

```text
Proposta v1 — Enviada
↓
cliente pede ajuste
↓
criar revisão
↓
Proposta v2
↓
v1 = SUBSTITUÍDA
v2 = vigente
```

A versão substituída continua disponível para histórico/auditoria.

Não editar silenciosamente uma proposta já recebida pelo cliente.

---

## 14. Recusa e expiração não encerram automaticamente a oportunidade

```text
Proposta RECUSADA
≠
Oportunidade PERDIDA
```

e:

```text
Proposta EXPIRADA
≠
Oportunidade PERDIDA
```

O comercial pode:

```text
Criar revisão
Negociar
Criar nova proposta
Marcar oportunidade como Perdida
```

Perda continua exigindo ação explícita + motivo estruturado.

---

## 15. Callface AI — pré-pago / checkout

Fluxo:

```text
Criar proposta
↓
Modo = PREPAID / CHECKOUT
↓
Enviar
↓
Cliente aceita
↓
Gerar / abrir checkout
↓
Pagamento confirmado
↓
WON
```

No fluxo padrão de Callface AI, pagamento confirmado é o gate de ganho.

---

## 16. Callface AI — contrato

Callface AI também pode ser vendido por contrato.

Exemplo:

```text
Criar proposta
↓
Modo = CONTRACT
↓
Definir condição contratual
↓
Enviar proposta
↓
Cliente aceita
↓
Gerar contrato
↓
Enviar assinatura
↓
Contrato assinado
↓
WON
```

### Regra de Won

Para `CALLFACE_AI + CONTRACT`:

```text
Contrato assinado = WON
```

O primeiro pagamento **não é gate de ganho**.

Se existir cobrança ainda aberta depois da assinatura:

- a oportunidade continua Ganho;
- o Cliente/Service é criado normalmente;
- a pendência financeira deve aparecer posteriormente em CS/Financeiro como cobrança em aberto.

Venda ganha e pagamento pendente são fatos diferentes.

---

## 17. Dados obrigatórios para proposta com contrato

Antes de enviar uma proposta configurada como `CONTRACT`, validar se a Empresa possui:

```text
Razão Social *
CNPJ *
Rua *
Número *
Bairro *
Cidade *
Estado *
CEP *
```

Se faltar qualquer dado obrigatório:

```text
Enviar proposta
↓
bloquear
↓
modal / etapa de completar dados da empresa
```

Mensagem:

> Para seguir com uma proposta contratual, complete os dados jurídicos e de endereço da empresa.

Os dados preenchidos devem atualizar a **Empresa**, não existir apenas dentro da proposta.

Assim ficam disponíveis para propostas e contratos futuros.

---

## 18. Variáveis de contrato vindas da proposta

Os itens contratuais devem ser derivados da proposta aceita.

Variáveis mínimas:

```text
Descrição do item
Recorrência
Quantidade
Preço unitário
Total
```

A recorrência deve representar a natureza real do item.

Para setup ou item não recorrente, usar uma representação estruturada equivalente a:

```text
Recorrência: Não se aplica
```

e não inventar mensalidade.

---

## 19. Condição de pagamento de Setup

Quando houver `SETUP`, a proposta precisa permitir definir a condição de pagamento.

Exemplos:

```text
À vista
2x
5x
12x
```

ou condição estruturada equivalente.

Guardar minimamente:

```text
forma / condição de pagamento
quantidade de parcelas
valor total do setup
valor por parcela, quando aplicável
```

Quando necessário para cobrança/contrato, a camada financeira poderá complementar com vencimentos e calendário de parcelas.

A condição escolhida deve alimentar as variáveis do contrato.

---

## 20. Desconto e condição contratual

A proposta pode aplicar:

```text
Preço de tabela
Desconto %
Desconto R$
Preço final
```

No Callface AI, contrato pode possuir preço/benefício diferente do fluxo pré-pago.

Exemplo conceitual:

```text
Pré-pago
R$ 1.497/mês

Contrato 12 meses
R$ 1.297/mês
```

A proposta deve deixar clara a condição atrelada ao desconto.

Não implementar workflow complexo de aprovação de desconto neste bloco, salvo se já existir algo sólido no projeto.

---

## 21. PABX e contratos de clientes existentes

Para oportunidades de clientes já existentes, especialmente PABX, a proposta pode representar diferentes ações contratuais.

O sistema deve distinguir pelo menos:

```text
NOVO_CONTRATO
ADITIVO
UPGRADE
DOWNGRADE
```

A proposta continua vinculada a uma oportunidade/família.

Quando for `ADITIVO`, `UPGRADE` ou `DOWNGRADE`, deve poder referenciar um contrato existente.

Exemplo:

```text
Cliente existente
↓
Nova oportunidade PABX
↓
Tipo contratual = UPGRADE
↓
Contrato base = Contrato #123
↓
Proposta
↓
Aceite
↓
Aditivo / instrumento correspondente
```

Não misturar isso com criação de uma nova Empresa ou novo Cliente.

É uma nova oportunidade comercial da carteira.

---

## 22. Relação com expansão

Oportunidades criadas a partir da carteira já podem carregar:

```text
commercialMotion = EXPANSION
```

Uma oportunidade de expansão pode gerar:

```text
novo contrato
aditivo
upgrade
downgrade
```

dependendo da natureza comercial.

O detalhamento operacional de expansão/renovação pertence ao módulo de Clientes/CS, mas Vendas precisa suportar o fechamento correto.

---

## 23. Proposta pública

O cliente deve receber uma página pública segura da proposta.

Exemplo:

```text
/p/{token}
```

A superfície deve mostrar:

```text
Empresa
Contato
Validade
Solução
Itens
Quantidades
Preço
Descontos
Recorrência
Setup
Condições de pagamento
Condições comerciais
Aceitar
Recusar
Solicitar ajuste
```

A interface deve seguir a identidade ONFACE/Callface e ser própria para cliente final.

---

## 24. Aceite

Ao aceitar:

```text
ProposalAccepted
```

Registrar:

```text
proposta
versão
contato
empresa
timestamp
IP/metadados se já houver suporte
```

### Regra

```text
ProposalAccepted
≠
OpportunityWon
```

O aceite apenas inicia o fluxo de fechamento correspondente.

---

## 25. Gate após aceite

### Callface AI — Checkout

```text
Aceita
↓
Pagamento
↓
PaymentConfirmed
↓
WON
```

### Callface AI — Contrato

```text
Aceita
↓
Contrato
↓
ContractSigned
↓
WON
```

### PABX

```text
Aceita
↓
Contrato / aditivo
↓
ContractSigned
↓
WON
```

### White Label inicial

```text
Aceita
↓
Contrato
↓
ContractSigned
↓
WON
```

### White Label adicional para cliente existente

Pode seguir checkout/pagamento quando essa for a condição comercial definida.

---

## 26. Ganho nunca é consequência do clique em “Aceitar proposta”

O aceite não deve alterar diretamente para Ganho.

O motor deve aguardar o evento de evidência da família/modo.

```text
proposta aceita
↓
gate pendente
↓
Pipeline permanece aberto
```

Podendo exibir:

```text
Proposta aceita
Contrato pendente
```

ou:

```text
Proposta aceita
Pagamento pendente
```

---

## 27. Consequência pós-Won

Toda oportunidade ganha entra primeiro em **Onboarding**, independentemente da família.

```text
WON
↓
Cliente criado/atualizado
↓
Service criado
↓
Onboarding correspondente à família
```

### Callface AI

```text
Onboarding Callface AI
↓
conclui ativação no próprio Onboarding
```

### PABX

```text
Onboarding PABX
↓
Kickoff
↓
levantamento / solicitações / materiais
↓
pronto para implantação
↓
Implantação PABX
```

### White Label

```text
Onboarding White Label
↓
Kickoff
↓
levantamento / materiais / requisitos
↓
pronto para implantação
↓
Implantação White Label
```

Cada família possui seu próprio checklist, critérios e handoff.

---

## 28. Regras de edição

Antes do envio:

```text
RASCUNHO
→ editável
```

Depois do envio:

```text
ENVIADA / VISUALIZADA / AJUSTE_SOLICITADO
→ não editar silenciosamente
→ criar revisão/versão
```

Depois de `ACEITA`:

- preservar versão aceita;
- não permitir alteração comercial retroativa;
- qualquer renegociação posterior gera nova proposta/processo compatível com o estado da oportunidade.

---

## 29. Critérios de aceite do bloco

### Criação

```text
Oportunidade CALLFACE_AI
↓
Criar proposta
↓
catálogo mostra somente CALLFACE_AI
↓
selecionar itens
↓
quantidade/preços/descontos
↓
validade
↓
modo PREPAID ou CONTRACT
```

### Contrato sem dados jurídicos

```text
Modo CONTRACT
↓
Empresa sem CNPJ/endereço completo
↓
Enviar
↓
BLOQUEADO
↓
usuário completa dados
↓
Empresa é atualizada
↓
envio liberado
```

### Envio

```text
Proposta enviada
↓
status ENVIADA
↓
oportunidade → PROPOSTA
↓
evento registrado
```

### Ajuste

```text
Cliente solicita ajuste
↓
descrição registrada
↓
comercial vê solicitação
↓
cria nova versão
↓
anterior = SUBSTITUÍDA
```

### Callface AI contratual

```text
Proposta aceita
↓
contrato gerado
↓
contrato assinado
↓
OpportunityWon
↓
Cliente + Service
↓
Onboarding AI
```

Mesmo que cobrança esteja aberta, a oportunidade permanece ganha.

### Setup parcelado

```text
Item SETUP
↓
definir 5x
↓
condição persistida
↓
proposta/contrato refletem condição
```

### Cliente existente / PABX

```text
Opportunity EXPANSION
↓
PABX
↓
Tipo contratual UPGRADE/ADITIVO
↓
vincular contrato existente
↓
proposta
↓
instrumento contratual correspondente
```

---

## 30. Coisas explicitamente proibidas

```text
❌ Mostrar catálogo de todas as famílias ao criar proposta
❌ Misturar famílias diferentes dentro da mesma oportunidade/proposta
❌ Tratar toda receita como MRR
❌ Somar recorrência + setup e chamar isso cegamente de “valor total”
❌ Enviar proposta contratual sem dados jurídicos obrigatórios
❌ Editar silenciosamente proposta já enviada
❌ Permitir aceitar proposta substituída
❌ Recusa da proposta perder oportunidade automaticamente
❌ Expiração perder oportunidade automaticamente
❌ Aceite da proposta marcar Won diretamente
❌ Callface AI contratual esperar pagamento para virar Won
❌ Perder vínculo com contrato base em aditivos/upgrades/downgrades
```

---

# Estado do bloco

## PROPOSTAS: CONCEITUALMENTE FECHADO

Próximo bloco da SpecDrive:

# Bloco 04 — Prospecção

Deve fechar:

- objetivo da frente de prospecção;
- origem de prospectos;
- empresa-first;
- pessoas associadas;
- enriquecimento;
- listas;
- filtros;
- seleção;
- duplicidade;
- prospecção manual e assistida por IA;
- conexão com campanhas/cadências;
- entrada em Pré-vendas;
- criação direta de oportunidade;
- origem/atribuição;
- ownership;
- estados;
- métricas;
- critérios de aceite.

---

# Bloco 04 — Prospecção

**Status:** CONCEITUALMENTE FECHADO  
**Escopo:** operação outbound, listas, enriquecimento, cadências, respostas, pré-qualificação e criação direta de oportunidades.

---

## 1. Princípio do módulo

Prospecção é uma workspace exclusiva de outbound.

Ela não substitui Pré-vendas e não deve virar um segundo Pipeline.

```text
PROSPECÇÃO
= descobrir / importar / enriquecer / abordar contas outbound

PRÉ-VENDAS
= qualificar formalmente uma empresa que entrou no funil

PIPELINE
= trabalhar uma oportunidade comercial real
```

O objeto principal continua sendo a **Empresa**, com Pessoas associadas.

---

## 2. Duas visualizações da mesma base

A Prospecção deve oferecer:

```text
[ Lista ] [ Kanban ]
```

### Lista

Visão principal para:

```text
busca
filtros
seleção em massa
listas
enriquecimento
responsável
cadências
tags
ações em massa
```

### Kanban

Visão visual do estado operacional da prospecção.

Não representa etapas de venda.

---

## 3. Fluxo operacional principal

```text
NOVO
  ↓
EM CADÊNCIA
  ↓
RESPONDEU
```

A partir daí, existem resultados/saídas:

```text
RESPONDEU
├──→ PRÉ-QUALIFICADO → Pré-vendas / Novo
├──→ OPORTUNIDADE DIRETA → Pipeline / Entrada
├──→ SEM RESPOSTA
└──→ DESCARTADO
```

Para evitar um board excessivamente largo, a visão operacional pode trabalhar com:

```text
Novo | Em cadência | Respondeu
```

e filtros/tabs complementares:

```text
Ativos | Pré-qualificados | Oportunidades | Sem resposta | Descartados
```

---

## 4. Prospect é empresa-first

Estrutura conceitual:

```text
EMPRESA PROSPECTADA
│
├── Pessoa principal
├── Outras pessoas
├── Dados enriquecidos
├── Lista
├── Responsável
├── Cadência
└── Histórico outbound
```

A interface deve destacar a Empresa.

Exemplo:

```text
NovaTech
Rafael Lima · Head de Operações

SaaS · 51–200 funcionários
Lista: SaaS Brasil
Cadência: Outbound Setembro · passo 3/7

Próxima ação: amanhã 10h
```

---

## 5. Entrada na Prospecção

Uma empresa pode entrar por:

```text
Importação CSV
Criação manual
Apollo / enriquecimento
API
Lista existente
Agente / pesquisa futura
Outras integrações outbound
```

Registrar a origem real.

Exemplo:

```text
Origem: Outbound
Fonte: Apollo
Lista: SaaS Brasil Setembro
Importado por: Scott
```

---

## 6. Deduplicação

Antes de criar nova Empresa ou Pessoa:

```text
Empresa
→ CNPJ
→ domínio
→ outros identificadores confiáveis
→ fallback controlado por nome

Pessoa
→ e-mail
→ telefone / WhatsApp
→ outros identificadores confiáveis
```

Não criar registros duplicados apenas porque a mesma empresa apareceu em outra lista ou importação.

Uma Empresa pode participar de várias listas/cadências ao longo do tempo, preservando histórico.

---

## 7. Estado: NOVO

Significado:

> Empresa entrou na base outbound, mas ainda não iniciou abordagem ativa.

Ações:

```text
Editar / enriquecer
Associar pessoas
Atribuir responsável
Adicionar à lista
Adicionar à cadência
Adicionar tag
WhatsApp
E-mail
Ligar
Pré-qualificar
Criar oportunidade
Descartar
```

---

## 8. Estado: EM CADÊNCIA

Ao adicionar à cadência:

```text
Novo
↓
Adicionar à cadência
↓
Em cadência
```

A Prospecção apenas **consome** o motor de cadências.

A configuração detalhada do motor pertence ao módulo:

```text
Automações → Cadências / Follow-ups
```

A workspace deve exibir os dados necessários para operação:

```text
nome da cadência
status
passo atual
total de passos
próxima ação
última execução
responsável
```

Exemplo:

```text
NovaTech

Cadência: Prospecção SaaS
Passo 3 de 7

✓ E-mail enviado
✓ Tarefa manual
→ Ligação amanhã

Responsável: Jenifer
```

---

## 9. Canais da cadência

A cadência pode executar ou solicitar ações como:

```text
E-mail
WhatsApp
Ligação
Tarefa manual
Follow-up
Wait / espera
Outros canais suportados futuramente
```

Não duplicar a lógica de cadência dentro de Prospecção.

---

## 10. Estado: RESPONDEU

Quando existe uma resposta real:

```text
Em cadência
↓
Resposta recebida
↓
RESPONDEU
```

A cadência pode pausar automaticamente conforme regra do motor.

Responder **não significa qualificado**.

Esse estado representa apenas:

> houve uma interação/resposta relevante do prospect.

---

## 11. Pré-qualificado

A Prospecção pode marcar um prospect como:

```text
PRÉ-QUALIFICADO
```

Definição:

> O outbound encontrou sinal suficiente para entregar essa empresa à jornada formal de Pré-vendas.

Isso NÃO equivale ao estado `Qualificado` de Pré-vendas.

Fluxo:

```text
Prospect
↓
Marcar como Pré-qualificado
↓
criar Lead de Pré-vendas
↓
Pré-vendas = NOVO
```

Preservar:

```text
Empresa
Pessoas
Origem outbound
Fonte
Lista
Cadência
Histórico de contatos
Responsável
Tags
Dados enriquecidos
```

Registrar fato estruturado equivalente a:

```text
preQualified = true
preQualifiedAt
preQualifiedBy
```

ou evento equivalente.

Na Pré-vendas:

```text
NovaTech
NOVO

[ Outbound ]
[ Pré-qualificado ]
```

A empresa passa normalmente pela jornada:

```text
Novo
→ Em contato
→ Qualificação
→ Qualificado
→ Oportunidade
```

---

## 12. Criar oportunidade diretamente

A Prospecção também pode criar oportunidade sem passar por Pré-vendas.

Ação:

```text
Criar oportunidade
```

Fluxo:

```text
Prospecção
↓
Selecionar família
↓
Selecionar responsável comercial
↓
Criar Opportunity
↓
Pipeline / Entrada
```

Modal mínimo:

```text
Empresa *
Contato principal
Família *
Responsável comercial *
```

Se selecionar mais de uma família:

```text
2+ famílias
↓
criar oportunidades irmãs
↓
mesmo bundleId
```

Cada oportunidade continua pertencendo a apenas uma família.

---

## 13. Origem da oportunidade direta

Não fingir que a oportunidade passou por Pré-vendas.

Registrar origem/processo equivalente a:

```text
Opportunity Source Process = OUTBOUND_DIRECT
```

versus:

```text
Opportunity Source Process = PRE_SALES
```

Isso precisa permitir medir posteriormente a eficiência de cada caminho.

---

## 14. Sem resposta

Quando a cadência termina sem resposta:

```text
Em cadência
↓
Cadência concluída
↓
SEM RESPOSTA
```

Registrar:

```text
quantidade de tentativas
canais
cadência
datas
responsável
última tentativa
```

Ações posteriores:

```text
Adicionar em nova cadência
Retomar
Reatribuir
Arquivar
```

Não apagar o histórico anterior.

---

## 15. Descartado

Em Prospecção, usar `Descartado` em vez de `Desqualificado`.

Motivo:

> nem todo prospect descartado passou por uma qualificação comercial formal.

Motivos estruturados iniciais:

```text
Contato inválido
Empresa fora do ICP aparente
Duplicado
Empresa encerrada
Dados insuficientes
Não prospectar
Outro
```

`Desqualificado` permanece reservado ao módulo de Pré-vendas.

---

## 16. Drawer / detalhe do Prospect

Estrutura conceitual:

```text
EMPRESA
NovaTech
setor
porte
site
LinkedIn
localização
dados enriquecidos

PESSOAS
Rafael Lima · Head de Operações
email
telefone
WhatsApp
LinkedIn

PROSPECÇÃO
Lista
Responsável
Origem
Fonte
Cadência
Passo atual

SINAIS
Respondeu
interesse
dados enriquecidos

PRÓXIMA AÇÃO

HISTÓRICO
Importado
Enriquecido
E-mail
Ligação
WhatsApp
Resposta
Cadência
Mudanças
```

---

## 17. Ações rápidas

```text
Adicionar à cadência
Pausar cadência
WhatsApp
E-mail
Ligar
Editar
Enriquecer
Atribuir responsável
Adicionar tag
Pré-qualificar
Criar oportunidade
Descartar
Arquivar
```

Toda ação precisa persistir e refletir na UI.

---

## 18. Ações em massa

Selecionando várias empresas:

```text
Atribuir responsável
Adicionar à lista
Trocar lista
Adicionar à cadência
Adicionar tag
Enriquecer
Pausar
Arquivar
```

Reaproveitar a infraestrutura existente do CRM2 sempre que estiver sólida.

---

## 19. Listas

Listas servem para organização operacional e segmentação.

Exemplos:

```text
SaaS Brasil Setembro
ICP Contabilidades SP
White Label — Agências
PABX — Clínicas
```

Uma Empresa pode participar de mais de uma lista historicamente.

Lista não é origem final de aquisição por si só; deve coexistir com `Origem`, `Fonte` e demais metadados.

---

## 20. Enriquecimento

Permitir enriquecer Empresa e Pessoas quando houver integração disponível.

Possíveis dados:

```text
setor
porte
site
domínio
LinkedIn
cargo
e-mail
telefone
localização
outros dados firmográficos
```

O enriquecimento atualiza as entidades permanentes `Empresa` e `Pessoa`.

Não criar cópias isoladas dos mesmos dados dentro da Prospecção.

---

## 21. Ownership

Todo prospect trabalhado deve possuir responsabilidade clara.

Registrar:

```text
responsável atual
histórico de responsáveis
data/hora
quem transferiu
origem da atribuição:
  manual
  automação
  agente
  round-robin
```

---

## 22. Histórico e eventos

Registrar eventos equivalentes a:

```text
ProspectAdded
ProspectImported
ProspectEnriched
ProspectAssigned
CadenceEnrolled
CadencePaused
CadenceStepExecuted
ProspectReplied
ProspectPreQualified
OpportunityCreatedFromProspecting
ProspectNoResponse
ProspectDiscarded
ProspectArchived
```

O requisito é:

> todo evento relevante precisa possuir entidade, timestamp, executor e contexto.

---

## 23. Métricas

A estrutura precisa permitir calcular:

```text
Prospectos adicionados
Prospectos em cadência
Respostas
Pré-qualificados
Oportunidades diretas
Sem resposta
Descartados
```

Taxas:

```text
Prospect → resposta
Resposta → pré-qualificado
Prospect → oportunidade
Cadência → resposta
```

Cruzar por:

```text
Lista
Cadência
Responsável
Fonte
Período
Família / interesse
```

---

## 24. Correção conceitual do CRM2 atual

A implementação atual da Prospecção deriva estados de sinais reais e já reaproveita listas, cadências e oportunidades.

Porém, hoje a existência de uma oportunidade pode fazer o prospect ser tratado como `qualificado` / `Pré-vendas`.

Essa regra deixa de ser válida no novo domínio.

Passam a existir duas saídas distintas:

```text
PRÉ-QUALIFICADO
→ cria Lead em Pré-vendas / Novo

OPORTUNIDADE DIRETA
→ cria Opportunity em Pipeline / Entrada
```

Não misturar as duas.

---

## 25. Estratégia de implementação

```text
LEGADO É FONTE DE DADOS.
A NOVA REGRA DE NEGÓCIO DEFINE AS NOVAS ENTRADAS.
```

Portanto:

- reaproveitar importação já existente;
- reaproveitar listas;
- reaproveitar cadências/enrollments;
- reaproveitar owner picker;
- reaproveitar drawer e ações sólidas;
- não manter semântica antiga apenas por compatibilidade;
- não construir um segundo motor de automação dentro da Prospecção;
- novas entradas seguem o novo domínio.

---

## 26. Critérios de aceite

### Importação / criação

```text
Empresa entra
↓
deduplicação
↓
Empresa/Pessoa persistidas
↓
Prospect em Novo
↓
origem/lista preservadas
```

### Cadência

```text
Prospect
↓
Adicionar à cadência
↓
Em cadência
↓
passo/próxima ação visíveis
↓
reload
↓
estado preservado
```

### Resposta

```text
Resposta recebida
↓
Prospect → Respondeu
↓
evento registrado
```

### Pré-qualificação

```text
Prospect
↓
Pré-qualificar
↓
Lead criado em Pré-vendas / Novo
↓
origem outbound preservada
↓
badge/fato Pré-qualificado preservado
```

### Oportunidade direta

```text
Prospect
↓
Criar oportunidade
↓
selecionar família
↓
Opportunity criada
↓
Pipeline / Entrada
↓
source process = outbound direct
```

### Multi-família

```text
Selecionar AI + PABX
↓
2 oportunidades irmãs
↓
mesmo bundleId
```

### Sem resposta

```text
Cadência concluída sem resposta
↓
Sem resposta
↓
histórico preservado
```

### Descartado

```text
Descartar
↓
motivo obrigatório
↓
estado persistido
↓
métrica disponível
```

---

## 27. Coisas explicitamente proibidas

```text
❌ Transformar Prospecção em um segundo Pipeline
❌ Tratar Pessoa como entidade principal do prospect
❌ Marcar oportunidade existente como se fosse Pré-qualificação
❌ Chamar prospect descartado de Desqualificado
❌ Criar Lead de Pré-vendas quando a ação escolhida foi Oportunidade Direta
❌ Criar oportunidade sem Empresa
❌ Criar oportunidade sem Família
❌ Duplicar Empresa/Pessoa por lista/importação
❌ Duplicar o motor de Cadências dentro de Prospecção
❌ Perder origem/lista/cadência ao mandar para Pré-vendas ou Pipeline
```

---

# Estado do bloco

## PROSPECÇÃO: CONCEITUALMENTE FECHADO

Próximo bloco da SpecDrive:

# Bloco 05 — Contatos & Empresas

Esse será o último bloco funcional do Módulo 1 — Vendas.

Campanhas foi removido do escopo do módulo Vendas.

A lógica de campanhas/cadências/execuções será tratada posteriormente na frente de Automações, onde faz mais sentido.

---

# Bloco 05 — Contatos & Empresas

**Status:** CONCEITUALMENTE FECHADO  
**Escopo:** diretório relacional transversal de Empresas e Pessoas, base de identidade usada por Vendas e pelos demais módulos do ONFACE.

---

## 1. Princípio do módulo

`Contatos & Empresas` não é um funil.

É o diretório relacional do ONFACE.

Definições canônicas:

```text
Empresa = identidade permanente da organização
Pessoa  = identidade permanente do humano
Lead    = processo temporário de Pré-vendas
Oportunidade = processo comercial real
Cliente = relação pós-Won da Empresa
```

Regras:

```text
Pessoa ≠ Lead
Pessoa ≠ Cliente
Empresa ≠ Lead
Empresa ≠ Oportunidade
```

Lead, Oportunidade e Cliente usam Empresa/Pessoa como identidade; não substituem essas entidades.

---

## 2. Empresa pode existir sem Pessoa

SIM.

Uma Empresa pode existir sem nenhuma Pessoa associada.

Casos válidos:

```text
importação outbound
prospecção
enriquecimento de contas
cadastro manual
integrações
```

Exemplo:

```text
Empresa: NovaTech
Pessoas: 0
Origem: Apollo / Lista outbound
```

Posteriormente, a Empresa pode ser enriquecida e receber Pessoas associadas.

Isso não é o cenário ideal para operação comercial, mas é um estado legítimo do sistema.

---

## 3. Pessoa pode existir sem Empresa

SIM.

Uma Pessoa pode existir temporariamente sem Empresa.

Exemplos:

```text
mensagem recebida pelo WhatsApp
contato importado
atendimento iniciado antes da identificação da empresa
cadastro manual
```

Exemplo:

```text
Pessoa: Rafael Lima
WhatsApp: +55...
Empresa: Não associada
```

A interface deve incentivar a resolução posterior:

```text
Associar a empresa existente
ou
Criar nova empresa
```

Não bloquear Atendimento por falta de Empresa.

Para entrar em fluxos B2B que exigem Empresa — Lead formal, Oportunidade, Proposta contratual etc. — a associação deve ser resolvida antes da ação correspondente.

---

## 4. Cliente pertence à Empresa

Regra canônica:

```text
Cliente = propriedade/estado relacional da Empresa
```

Pessoa não vira Cliente como entidade.

Uma Pessoa pode ser:

```text
contato principal
decisor
financeiro
técnico
usuário
influenciador
```

de uma Empresa cliente.

Exemplo:

```text
Empresa: NovaTech
Relacionamento: Cliente

Pessoas:
- Rafael Lima — Decisor
- Ana Souza — Financeiro
```

---

## 5. Superfície principal

Uma única área:

```text
CONTATOS & EMPRESAS

[ Empresas ] [ Pessoas ]
```

Busca global:

```text
empresa
nome da pessoa
CNPJ
e-mail
telefone
WhatsApp
domínio
```

A tela é um diretório operacional denso, não um dashboard.

---

## 6. Aba Empresas

Colunas mínimas:

```text
Empresa
Relacionamento
Pessoas
Oportunidades
Serviços
Responsável
Última atividade
```

Exemplo:

```text
NovaTech
Em oportunidade
3 pessoas
2 oportunidades
—
Scott
Hoje
```

ou:

```text
Acme
Cliente
5 pessoas
1 oportunidade aberta
2 serviços ativos
Mayara
Ontem
```

---

## 7. Relacionamento da Empresa é derivado

Não permitir que o usuário altere livremente algo como:

```text
Empresa = Cliente
```

O relacionamento deve ser derivado dos fatos reais.

Exemplo conceitual:

```text
sem processo comercial
→ Contato / Empresa cadastrada

Lead ativo
→ Lead / Em Pré-vendas

Oportunidade aberta
→ Em oportunidade

Service ativo
→ Cliente

teve Service histórico e nenhum ativo
→ Ex-cliente
```

Os nomes visuais podem ser ajustados, mas a regra é:

> o relacionamento atual é consequência dos processos reais, não um status manual solto.

---

## 8. Empresa 360 comercial

Ao abrir uma Empresa:

```text
NovaTech
CNPJ
Setor · Porte · Cidade
Site

[ WhatsApp ] [ E-mail ] [ Nova oportunidade ]
```

Seções:

```text
RESUMO
Relacionamento atual
Responsável
Origem
Última atividade
Próxima ação

PESSOAS
Contatos associados e papéis

VENDAS
Leads
Oportunidades
Propostas

RELACIONAMENTO
Atividades
Reuniões
WhatsApp
E-mails
Ligações

HISTÓRICO
Timeline consolidada
```

Essa é a visão comercial da Empresa.

Quando houver relação de Cliente, deve existir ação:

```text
Abrir Cliente 360
```

O `Cliente 360` completo pertence ao módulo Clientes e adicionará:

```text
Services
Onboarding
Implantação
CS
Contratos
Cobranças
Saúde
Expansão
```

Não duplicar essas responsabilidades em Vendas.

---

## 9. Dados jurídicos e cadastrais da Empresa

Campos estruturados da Empresa:

```text
Nome fantasia
Razão social
CNPJ

Rua
Número
Complemento
Bairro
Cidade
Estado
CEP

Site
Domínio
Setor
Porte
```

Esses dados são consumidos por:

```text
Propostas
Contratos
Financeiro
Onboarding
CS
```

Quando uma proposta contratual exigir dados faltantes e o usuário os preencher, deve atualizar a Empresa.

Não armazenar uma cópia isolada como fonte primária dentro da proposta/contrato.

---

## 10. Pessoa

Campos mínimos:

```text
Nome
Sobrenome
Cargo
E-mail
Telefone
WhatsApp
LinkedIn
```

A Pessoa pode existir sem Empresa, mas pode possuir vínculos empresariais.

---

## 11. Vínculo Pessoa ↔ Empresa

O vínculo deve permitir representar:

```text
Empresa
Papel
Principal?
Vínculo atual/histórico
```

Papéis comerciais iniciais:

```text
Contato principal
Decisor
Influenciador
Financeiro
Técnico
Usuário
Outro
```

---

## 12. Pessoa pode mudar de Empresa

Não assumir que uma Pessoa pertence eternamente a uma única organização.

Exemplo:

```text
Rafael Lima

2026
NovaTech

2027
Acme
```

Preservar o vínculo histórico quando possível.

Não é necessário construir um sistema complexo de histórico profissional agora, mas a modelagem não deve apagar o passado ao trocar a associação principal.

---

## 13. Contato principal é contextual

Uma Empresa pode possuir:

```text
Contato comercial principal
Contato financeiro
Contato técnico
```

Uma Oportunidade também pode escolher seu próprio contato principal.

Portanto:

```text
Contato principal da Empresa
≠ obrigatoriamente
Contato principal de toda Oportunidade
```

Trocar o contato principal da oportunidade não deve reescrever toda a Empresa.

---

## 14. Criar Pessoa não cria Lead

Regra:

```text
Nova Pessoa
≠
Novo Lead
```

Uma Pessoa pode ser apenas um contato operacional, financeiro, técnico ou outro.

---

## 15. Criar Empresa não cria Lead

Regra:

```text
Nova Empresa
≠
Novo Lead
```

Se o usuário quiser iniciar Pré-vendas:

```text
Criar Lead
```

Se houver oportunidade comercial real:

```text
Criar oportunidade
```

São ações explícitas.

---

## 16. Ações da Empresa

Ações mínimas:

```text
Adicionar pessoa
Criar Lead
Criar oportunidade
WhatsApp
E-mail
Ligar
Criar atividade
Criar tarefa
Adicionar tag
Editar
```

Quando for Cliente:

```text
Abrir Cliente 360
Nova oportunidade
```

---

## 17. Ações da Pessoa

Ações mínimas:

```text
WhatsApp
E-mail
Ligar
Criar tarefa
Editar
Associar a Empresa
Criar Empresa e associar
Abrir Empresa
Abrir oportunidades relacionadas
```

Não existir ação conceitual:

```text
Converter Pessoa em Cliente
```

---

## 18. Identidade única e deduplicação

Antes de criar:

### Empresa

```text
CNPJ
domínio
identificadores confiáveis
fallback controlado por nome
```

### Pessoa

```text
e-mail
telefone
WhatsApp
identificadores confiáveis
```

No MVP:

> bloquear ou reutilizar duplicidade óbvia.

Merge avançado pode ser posterior.

Não transformar a entrega em projeto de limpeza histórica de dados.

---

## 19. Uma Empresa em vários processos

A mesma Empresa pode simultaneamente estar em:

```text
Lead em Pré-vendas
+
Oportunidade Callface AI
+
Oportunidade PABX
+
Cliente White Label
```

Continua sendo uma única Empresa.

Nunca criar cópia por módulo ou processo.

---

## 20. Uma Pessoa em vários contextos

A mesma Pessoa pode ser:

```text
Contato principal do Lead
Decisor da Oportunidade
Destinatário da Proposta
Participante da Reunião
Contato no Atendimento
Contato em CS
```

Continua sendo uma única Pessoa.

---

## 21. Origem e touchpoints

Empresa/Pessoa devem permitir reconstruir:

```text
Primeiro touchpoint
Último touchpoint
Canais
Origens
Campanhas/origens históricas
Landing pages
Listas outbound
Integrações
```

Não depender de um único campo textual sobrescrito.

Reutilizar `pontosContato` e a arquitetura de first/last touch definida nos blocos anteriores.

---

## 22. Timeline consolidada

### Empresa

Pode mostrar:

```text
Empresa criada
Lead criado
Pré-qualificação
Qualificação
Oportunidade
Reunião
Proposta
Aceite
Contrato
Won
Onboarding
Atividades
```

### Pessoa

Pode mostrar:

```text
WhatsApp
E-mail
Ligação
Reunião
Proposta visualizada
Aceite
Atividades
```

A Timeline deve consumir eventos reais do sistema, não snapshots fabricados.

---

## 23. Tags

Tags podem organizar informações:

```text
ICP Enterprise
Parceiro
VIP
Evento XPTO
```

Não usar tag como fonte da verdade para fatos críticos:

```text
Cliente
Qualificado
Contrato assinado
Pagamento confirmado
```

Esses fatos vêm das entidades/eventos correspondentes.

---

## 24. Origem dos dados

Contatos & Empresas recebe dados vindos de:

```text
Pré-vendas
Pipeline
Prospecção
Importação
Formulários
Atendimento
Integrações
Enriquecimento
Onboarding
CS
```

Não criar diretórios separados por módulo.

---

## 25. Diretório é transversal ao ONFACE

Apesar de aparecer no agrupamento de Vendas, `Empresa` e `Pessoa` são entidades globais.

```text
Empresa / Pessoa
      │
 ┌────┼─────┬──────────┬──────┬──────────┐
 ↓    ↓     ↓          ↓      ↓
Vendas Atendimento Onboarding CS Financeiro
```

Implementação não deve criar entidades isoladas do tipo:

```text
sales_contacts
```

se isso duplicar a identidade central.

---

## 26. Correção conceitual do CRM2 atual

O CRM2 atual ainda possui semânticas equivalentes a:

```text
Pessoa.tipo = contato | lead | cliente
```

Isso deve ser eliminado progressivamente como fonte da verdade.

Nova regra:

```text
Pessoa = Pessoa

Lead = processo de Pré-vendas
Cliente = relação pós-Won da Empresa
```

Compatibilidade de leitura com legado pode permanecer quando necessária, mas novas entradas devem seguir o domínio novo.

---

## 27. UI

A superfície principal deve priorizar tabela/lista densa.

Exemplo:

```text
CONTATOS & EMPRESAS

[ Empresas ] [ Pessoas ]

Buscar...
Filtros

EMPRESA    RELAÇÃO       PESSOAS  OPORT.  SERVIÇOS  OWNER
NovaTech   Oportunidade  3        2        —         Scott
Acme       Cliente       5        1        2         Mayara
```

Clicar abre detalhe/drawer/página.

Não criar um dashboard de KPIs desnecessário no topo.

---

## 28. Critérios de aceite

### Empresa sem Pessoa

```text
Criar/importar Empresa
↓
0 pessoas
↓
Empresa persiste e aparece no diretório
↓
posteriormente enriquecer/adicionar Pessoa
```

### Pessoa sem Empresa

```text
Mensagem WhatsApp / criação manual
↓
Pessoa existe sem empresa
↓
Atendimento funciona
↓
Associar depois a Empresa existente
ou
Criar Empresa e associar
```

### Criar Lead

```text
Empresa existente
↓
Criar Lead
↓
Lead nasce em Pré-vendas / Novo
↓
Empresa não é duplicada
```

### Criar oportunidade

```text
Empresa existente
↓
Criar oportunidade
↓
Família obrigatória
↓
Pipeline / Entrada
↓
Empresa não é duplicada
```

### Cliente

```text
OpportunityWon
↓
Cliente/Service
↓
Empresa passa a derivar relacionamento Cliente
↓
Pessoas continuam Pessoas
```

### Deduplicação

```text
Tentar criar Empresa com CNPJ já existente
↓
não criar duplicata silenciosa
↓
reutilizar ou alertar
```

### Persistência

Após reload:

```text
dados
vínculos
relacionamentos
ações
```

permanecem corretos.

---

## 29. Coisas explicitamente proibidas

```text
❌ Pessoa ser tratada como Lead
❌ Pessoa ser tratada como Cliente
❌ Empresa ser criada automaticamente como Lead
❌ Pessoa ser criada automaticamente como Lead
❌ Bloquear Pessoa sem Empresa em Atendimento
❌ Bloquear Empresa sem Pessoa em Prospecção
❌ Duplicar Empresa por módulo/processo
❌ Duplicar Pessoa por contexto
❌ Permitir alterar manualmente “Cliente” como status solto
❌ Usar tags como fonte da verdade de fatos críticos
❌ Criar um diretório exclusivo de Vendas desconectado do resto do ONFACE
```

---

# Estado do bloco

## CONTATOS & EMPRESAS: CONCEITUALMENTE FECHADO


---

# Fechamento — Módulo 01: Vendas

**Status:** ESPECIFICAÇÃO FUNCIONAL FECHADA

O Módulo 01 — Vendas passa a ser composto por:

```text
VENDAS
│
├── Pré-vendas
├── Pipeline / Oportunidades
├── Propostas
├── Prospecção
└── Contatos & Empresas
```

`Campanhas` foi removido deste módulo.

Campanhas, Cadências, Follow-ups, Agentes e Execuções pertencem à frente de **Automações**, ainda que Vendas utilize esses recursos.

---

## Jornada macro oficial

```text
AQUISIÇÃO / OUTBOUND
        ↓
EMPRESA + PESSOA + TOUCHPOINT
        ↓
PRÉ-VENDAS
Novo
→ Em Contato
→ Qualificação
→ Qualificado
→ Oportunidade
        ↓
PIPELINE
Entrada
→ Diagnóstico
→ Proposta
→ Negociação
        ↓
FECHAMENTO
Pagamento ou Contrato
        ↓
WON
        ↓
CLIENTE + SERVICE
        ↓
ONBOARDING
        ↓
quando aplicável:
IMPLANTAÇÃO
```

Prospecção pode entrar por dois caminhos:

```text
PROSPECÇÃO
├── Pré-qualificado → Pré-vendas / Novo
└── Oportunidade direta → Pipeline / Entrada
```

---

## Regras transversais canônicas

### Identidade

```text
Empresa = organização
Pessoa = humano
Lead = processo de Pré-vendas
Oportunidade = processo de venda
Cliente = relação pós-Won da Empresa
Service = unidade econômica/serviço vendido
```

### Empresa-first

Nos fluxos B2B do Módulo Vendas:

```text
Lead formal exige Empresa
Oportunidade exige Empresa
Proposta exige Oportunidade
```

Pessoa é contato associado, nunca substituto da Empresa.

### Família

Toda oportunidade possui exatamente uma família:

```text
CALLFACE_AI
PABX
WHITE_LABEL
```

Novas oportunidades não devem nascer `UNKNOWN`.

Mais de uma família:

```text
→ oportunidades irmãs
→ mesmo bundleId
```

### Valores

Não tratar toda venda como MRR.

Usar composição por natureza econômica:

```text
MRR
SETUP
PROJECT
ONE_TIME
USAGE
HARDWARE
```

Pipeline usa conceito genérico de `Valor`.

Proposta detalha a composição real.

### Etapas vs eventos

Etapas de Pipeline:

```text
Entrada
Diagnóstico
Proposta
Negociação
Won
Lost
```

Não são etapas:

```text
reunião
trial
no-show
contrato pendente
pagamento pendente
```

São eventos/estados/substatus.

### Qualificado vs Oportunidade

```text
Qualificado
≠
Oportunidade
```

Qualificado é resultado da qualificação.

Oportunidade só existe após comando explícito de criação.

### Proposta

```text
1 oportunidade
→ 1 família
→ N propostas históricas
→ 1 vigente por vez
```

Catálogo sempre filtrado pela família da oportunidade.

### Won

Won nunca é um drag livre.

É consequência do gate comercial.

```text
CALLFACE_AI / checkout
→ pagamento confirmado

CALLFACE_AI / contrato
→ contrato assinado

PABX
→ contrato/aditivo assinado

WHITE_LABEL inicial
→ contrato assinado

WHITE_LABEL adicional
→ conforme modo comercial definido
```

### Pós-Won

Toda venda ganha entra primeiro em:

```text
Onboarding
```

Depois:

```text
Callface AI
→ conclui ativação no Onboarding

PABX
→ Onboarding/Kickoff
→ Implantação PABX

White Label
→ Onboarding/Kickoff
→ Implantação White Label
```

---

# Diretriz para implementação pelo Claude

```text
Implementar exclusivamente esta SpecDrive.

Se encontrar um problema fora do Módulo Vendas, registrar como dependência
e continuar.

Não refatorar módulos adjacentes salvo quando for estritamente necessário
para cumprir esta especificação.

Não trabalhar limpeza histórica do legado.

Não expandir escopo.

Legado é fonte de dados a ser preservada.
Legado NÃO define a nova regra de negócio.

Reaproveitar lógica, serviços, endpoints, componentes, integrações,
históricos e testes existentes sempre que estiverem sólidos.

Novas entradas e novos fluxos devem obedecer ao domínio definido aqui.

A UI deve seguir o novo padrão visual ONFACE/CRM2 e o Design System existente.
Não recriar sidebar global.
Usar a Topbar global já definida.

Prioridade:
1. funcionamento ponta a ponta;
2. persistência;
3. consequências operacionais;
4. coerência de domínio;
5. UX;
6. polimento visual.

Nenhum CTA deve ser apenas decorativo.
```

---

# Estratégia de implementação

Antes de alterar código:

```text
1. Ler esta SpecDrive inteira
2. Mapear o que já existe no branch dev
3. Classificar:
   - reaproveitar
   - ajustar
   - substituir semanticamente
   - criar
4. Implementar bloco por bloco
5. Não migrar histórico sem necessidade
6. Garantir compatibilidade de leitura quando necessário
7. Fazer novas entradas nascerem no modelo correto
```

Ordem recomendada:

```text
1. Domain model / bridges mínimos
2. Contatos & Empresas base
3. Pré-vendas
4. Pipeline / Oportunidades
5. Propostas
6. Prospecção
7. Integrações entre os cinco blocos
8. Smoke tests completos
```

A ordem técnica pode ser ajustada se dependências reais do repositório exigirem, sem alterar as regras de negócio.

---

# Critérios de aceite do Módulo Vendas

O módulo só pode ser considerado concluído quando estes caminhos funcionarem ponta a ponta.

## Jornada inbound

```text
Form inbound
→ Empresa/Pessoa
→ Lead / Novo
→ Em Contato
→ Qualificação
→ Qualificado
→ Criar oportunidade
→ Pipeline / Entrada
→ Diagnóstico
→ Criar/enviar proposta
→ Proposta
→ Negociação
→ gate comercial
→ Won
→ Cliente + Service
→ Onboarding
```

## Jornada outbound via Pré-vendas

```text
Prospecção
→ Cadência
→ Respondeu
→ Pré-qualificado
→ Pré-vendas / Novo
→ Qualificação
→ Oportunidade
→ Pipeline
→ fechamento
```

## Jornada outbound direta

```text
Prospecção
→ Criar oportunidade
→ Família
→ Pipeline / Entrada
→ fechamento
```

## Jornada multi-família

```text
Empresa
→ AI + PABX
→ 2 oportunidades irmãs
→ mesmo bundle
→ propostas separadas por família
→ fechamento independente
```

## No-show

```text
Oportunidade
→ reunião
→ no-show
→ mesma oportunidade preservada
→ Lead volta Qualificado
→ reagendamento
→ mesma oportunidade reativada
```

## Proposta contratual AI

```text
Oportunidade AI
→ proposta CONTRACT
→ validar dados jurídicos
→ enviar
→ aceitar
→ contrato
→ assinatura
→ Won
→ cobrança pode permanecer pendente
→ Cliente + Service + Onboarding
```

## Pessoa sem Empresa

```text
Pessoa entra por Atendimento
→ persiste sem Empresa
→ associar/criar Empresa depois
```

## Empresa sem Pessoa

```text
Empresa entra por Prospecção
→ persiste sem Pessoas
→ enriquecer posteriormente
```

---

# Testes mínimos esperados

O Claude deve adaptar aos testes/frameworks existentes no repositório, cobrindo minimamente:

```text
- deduplicação Empresa/Pessoa
- inbound não cria oportunidade automaticamente
- Qualificado não cria oportunidade automaticamente
- criação de oportunidade exige Empresa + Família
- multi-família cria oportunidades irmãs
- oportunidade sem reunião é válida
- drag de Pipeline persiste e registra histórico
- Proposta sem proposta real não permite estágio Proposta
- Negociação não entra sem proposta
- catálogo de proposta respeita família
- proposta substituída não pode ser aceita
- contrato exige dados jurídicos
- AI checkout só ganha com pagamento
- AI contract ganha com assinatura
- PABX/WL respeitam gate de contrato
- Won dispara Cliente + Service + Onboarding
- no-show reutiliza mesma oportunidade
- Pré-qualificado outbound cria Lead / Novo
- oportunidade outbound direta não finge passagem por Pré-vendas
- Pessoa pode existir sem Empresa
- Empresa pode existir sem Pessoa
- Cliente deriva da Empresa, nunca da Pessoa
```

---

# Fora do escopo deste módulo

```text
Campanhas
Motor completo de Cadências
Configuração completa de Agentes / NEXO
Atendimento omnichannel
Onboarding detalhado
Implantação detalhada
Customer Success
Financeiro
Cliente 360 completo
Home
Insights completos
Merge avançado de duplicados históricos
Limpeza completa do legado
```

As integrações necessárias com esses módulos podem existir apenas no nível mínimo para cumprir a jornada de Vendas.

---

# Resultado esperado

Ao final, o Módulo Vendas deve funcionar como uma única cadeia coerente:

```text
Empresa/Pessoa
→ demanda
→ qualificação
→ oportunidade
→ proposta
→ fechamento
→ cliente/service
→ onboarding
```

sem duplicar entidades, sem usar status como atalho para eventos, sem deixar ações apenas visuais e sem depender da semântica antiga do legado para novas operações.

