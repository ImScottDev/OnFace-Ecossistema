# Papéis e permissões

Definido pelo Scott em 05/10/2026.

## A ideia central

**Tipo de usuário + permissões personalizadas.** O tipo já vem com um pacote
padrão; o Admin ajusta caso a caso. Não criar dezenas de papéis para cada
situação.

## Tipos de usuário do produto

| Tipo | O que faz |
|---|---|
| **SDR** | pré-vendas, leads, qualificação, cadências e reuniões |
| **Vendedor / Closer** | oportunidades, propostas, negociação e fechamento |
| **CS** | carteira, retenção, expansão, health e relacionamento |
| **Financeiro** | pagamentos, faturas, inadimplência, MRR e cobrança |
| **Operações** | automações, integrações, catálogo, processos e configuração operacional |
| **Gestão** | coordenação, gerência e diretoria: visão agregada do time e indicadores |
| **Admin** | usuários, permissões e configurações da organização |
| **SuperAdmin** | a plataforma ONFACE inteira, várias organizações |
| **Parceiro / Leitor** | acesso restrito aos módulos e relatórios liberados (ex.: gestor de tráfego) |

## O que o RBAC do código tem hoje

Oito papéis: administrador, gerente, diretoria, coordenação, operações, closer,
SDR e leitor. Mais dois nomes antigos que o sistema já normaliza:
`vendedor → closer` e `super_admin → admin`.

**Ainda não é a mesma lista.** Faltam CS, Financeiro e Parceiro como tipos, e a
camada de permissão por módulo.

## A tela: Ajustes → Usuários e Permissões

Ao clicar num usuário:

```
João Silva

Tipo de usuário     [ Vendedor ▼ ]
Escopo              [ Próprios registros ▼ ]

Módulos
☑ Pré-vendas   ☑ Comercial   ☐ CS          ☐ Financeiro
☐ Automações   ☐ Configurações            ☐ Relatórios

Permissões especiais
☑ Criar   ☑ Editar   ☐ Excluir   ☐ Gerenciar usuários   ☐ Aprovar desconto

[ Salvar alterações ]
```

Para parceiro, mais enxuto ainda:

```
Marcos — Agência XPTO

Tipo     [ Parceiro ▼ ]

Acesso
☑ Relatórios   ☑ Marketing   ☑ Aquisição
☐ Comercial    ☐ Financeiro  ☐ CS

Modo     ● Somente leitura   ○ Pode editar
```

Um "Gestor de Tráfego" é só: tipo **Parceiro**, com relatórios, marketing,
aquisição e campanhas liberados, e financeiro, contratos, CS, usuários e
configurações fechados.

## Menu do usuário

- **Minha conta** → `/perfil`: trocar senha, alterar foto, mudar nome, e as
  conexões da pessoa (e-mail, WhatsApp, agenda).
- **Ajustes** (não "Ajustes da organização") → `/ajustes`, com o conteúdo
  adaptado ao que aquele tipo de usuário pode ver.
