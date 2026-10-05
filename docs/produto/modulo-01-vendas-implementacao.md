# Módulo 01 — Vendas (SpecDrive)

Fonte da verdade funcional: `specdrive-modulo-01-vendas-final.md` (Kauã, 16/09/2026).
Este documento é o diagnóstico do que já existia e o registro das decisões de
implementação. Ele não substitui a spec: quando divergirem, a spec manda.

---

## 1. Diagnóstico — o que já existe no branch `dev`

O repositório já tinha ido bem longe na direção do domínio da spec. O trabalho
deste módulo é muito mais **corrigir semântica e fechar o circuito** do que
construir do zero.

### Reaproveitar sem tocar

| Peça | Onde | Por quê |
|---|---|---|
| Domain Model v2 | `empresas`, `pessoas`, `pontos_contato`, `oportunidades`, `oportunidade_itens`, `oportunidade_bundle`, `clientes` | é exatamente o modelo que a spec descreve |
| Atribuição first/last touch | `pontos_contato` | spec §16 Bloco 01 e §21 Bloco 05 pedem isso literalmente |
| Gate de Won por evidência | `comercial_evidencia` + `won_evidence_policies` + `lib/crm/won-evidence.ts` | Bloco 02 §19-20: Won é consequência de evidência, nunca drag |
| Bundle de oportunidades irmãs | `oportunidade_bundle` + `lib/crm/oportunidade-bundle.ts` | Bloco 02 §2-3 |
| Motor de cadências | `cadence_definitions/versions/enrollments` + `lib/cadencia/` | Bloco 04 §8-9: Prospecção **consome**, não reimplementa |
| Proposta pública, aceite, checkout, contrato, assinatura | `lib/crm/proposta-*.ts`, `aceitar-proposta.ts`, `checkout.ts`, `signature/` | Bloco 03 inteiro depende disso e está sólido |
| Pós-Won → Cliente/Service/Onboarding | `lib/cs/handoff.ts`, `fulfillments`, `servicos_canonicos` | Bloco 02 §22 |
| Histórico | `status_changes`, `atividades`, `audit_log`, `event_outbox`, `eventos_comerciais` | spec §17 Bloco 01: reaproveitar em vez de criar cinco sistemas |
| Bridges de dual-write | `lib/crm/sync-domain-model.ts` | spec §27 Bloco 01 cita nominalmente |

### Ajustar (semântica errada, estrutura certa)

| O que | Problema em relação à spec |
|---|---|
| Etapas do Pipeline | hoje `reuniao_agendada / reuniao_realizada / trial / proposta_apresentada / negociacao_iniciada`. Spec: `ENTRADA / DIAGNÓSTICO / PROPOSTA / NEGOCIAÇÃO`. Reunião e trial viram **evento**, não coluna |
| `no_show` como status | hoje é um status do negócio (coluna fechada). Spec §15 Bloco 01 e §12 Bloco 02: no-show é **evento**, a oportunidade é preservada e o Lead volta a QUALIFICADO |
| Conversão Lead → Oportunidade | `converter-oportunidade.ts` grava `status: "reuniao_agendada"` mesmo no caminho sem reunião (a própria spec aponta isso em §11 Bloco 01) |
| Família da oportunidade | vive só em `oportunidade_itens`. Spec: **uma oportunidade = uma família**, obrigatória na criação |
| Etapas de Pré-vendas | `crm2_pre_vendas_stage` usa `agenda_confirmada`. Spec: a quinta etapa é `OPORTUNIDADE` (handoff concluído), não "agenda confirmada" |
| Qualificado | hoje é só estágio/`sdr_status`. Spec §10 Bloco 01: precisa ser **fato estruturado** que sobrevive ao estágio atual |
| Prospecção | hoje a existência de oportunidade faz o prospect ser lido como qualificado. Spec §24 Bloco 04: são duas saídas distintas |

### Criar

- Fatos estruturados de qualificação, nutrição, desqualificação e pré-qualificação.
- Família / motion / processo de origem na oportunidade.
- Dados jurídicos e de endereço estruturados na Empresa (Bloco 03 §17).
- Estados de proposta que faltavam e o modo de fechamento escolhido antes do envio.
- Motor único de comandos de venda (`src/lib/vendas/`), usado por humano e por IA.
- As telas ONFACE dos cinco blocos.

---

## 2. Decisão de arquitetura: qual tabela é a oportunidade

**`negocios` continua sendo a tabela física da oportunidade; `oportunidades` continua
como projeção v2 via dual-write.**

Motivo: `negocios` é referenciada por propostas, contratos, fulfillment, CS,
financeiro, relatórios e reconciliação. Trocar a tabela física significaria
refatorar todos esses módulos, o que a spec proíbe explicitamente ("não
refatorar módulos adjacentes salvo quando estritamente necessário").

O que muda, e é o que a spec de fato exige: **o domínio novo passa a ser falado
pelo motor**, não pelas colunas legadas. Nenhuma tela ou rota nova lê
`negocios.status` cru: tudo passa por `src/lib/vendas/`, que traduz para as
etapas canônicas. Entradas novas nascem no vocabulário novo e o legado continua
legível.

Isso satisfaz "progressivamente tornar o Domain Model v2 a fonte da verdade"
sem a reescrita destrutiva que a própria spec veta.

---

## 3. Dependências registradas (fora do escopo, não bloqueiam)

- **Catálogo por família**: conferido no banco, não é dependência. Os 213 preços
  ativos estão todos classificados (PABX 194, Callface AI 11, White Label 8), então
  o filtro do Bloco 03 §2 funciona com o dado real. Item sem família não entra na
  lista de propósito: incluí-lo "por garantia" traria de volta a mistura que a
  regra existe para impedir.
- **Motor de cadências**: consumido como está. Passo atual/total já existem em
  `cadence_enrollments`; a configuração pertence a Automações.
- **Onboarding por família**: o handoff pós-Won já cria fulfillment. O checklist
  específico por família (Bloco 03 §27) pertence ao módulo de Onboarding.
- **Merge de duplicados históricos**: fora do escopo por decisão da própria spec.

---

## 4. O que foi construído

### Motor (`src/lib/vendas/`)

Um único conjunto de comandos de negócio, usado por humano e por agente — a
diferença é o `Ator` que chega junto (Bloco 01 §19). Nenhuma rota, tela ou
worker escreve estado comercial direto no banco.

| Arquivo | Responsabilidade |
|---|---|
| `dominio.ts` | vocabulário canônico e as traduções para o legado. É o único lugar que conhece `negocios.status` |
| `eventos.ts` | `vendas_eventos` (leitura) + `status_changes` e `atividades` (o que já existia) |
| `identidade.ts` | resolver Empresa/Pessoa sem duplicar, vínculo com papel e histórico, touchpoints, relacionamento derivado |
| `pre-vendas.ts` | criar lead, atribuir, primeiro contato, mover etapa, qualificar, nutrir, desqualificar |
| `pipeline.ts` | criar oportunidade (com irmãs), mover com gates, próxima ação, família, perder, tentar ganhar, reunião, no-show, trial |
| `propostas.ts` | catálogo por família, dados jurídicos, envio com modo e validade, ajuste, aceite, revisão, expiração, composição financeira |
| `prospeccao.ts` | adicionar, cadência, resposta, pré-qualificar, oportunidade direta, descartar |
| `consultas.ts` | leitura das cinco telas |

### Telas

`/pre-vendas`, `/pipeline`, `/propostas`, `/prospeccao`, `/contatos`, na casca
ONFACE e com o design system do produto. Todas exigem sessão.

### Verificação

```bash
npm run aceite:vendas   # 86 asserções das jornadas, contra o banco real
npm run check:vendas    # domínio e consultas contra o banco
npm test                # inclui os testes puros de lib/vendas
```

`aceite:vendas` cria tudo com o prefixo `[ACEITE-VENDAS]` e limpa no fim,
mesmo quando falha. Rodar duas vezes seguidas dá o mesmo resultado.

---

## 5. Divergências e dependências registradas

Nenhuma destas foi decidida aqui: são pontos em que a realidade do repositório
ou do produto não alcança a spec ainda.

1. **Formulário inbound sem Empresa.** Bloco 01 §3 exige Empresa em todo
   formulário. O formulário publicado em `site.callface.io` não pergunta, e
   recusar a captura perderia o lead. O webhook usa o domínio corporativo do
   e-mail quando existe; quando não existe, o lead entra sem empresa, aparece
   com "Associar empresa" e o comando de criar oportunidade continua
   bloqueado. **Depende de mudar o formulário do site**, que é outro
   repositório.

2. **`propostas.lead_id` é `NOT NULL` no schema legado.** Proposta de
   oportunidade criada sem lead (manual ou outbound direto) usa o contato mais
   antigo da empresa como referência. Quando a empresa não tem nenhum contato,
   a criação é recusada com mensagem explícita.

3. **Família nas oportunidades legadas.** 1.441 negócios estão sem
   `service_family`. Oportunidade nova sempre nasce com família; as antigas
   aparecem como "Não classificada" e o catálogo de proposta não abre para
   elas até alguém definir a família. Isso é proposital: abrir o catálogo
   inteiro traria de volta a mistura que a regra existe para impedir.

4. **Onboarding por família.** O handoff pós-Won já cria Cliente, Service e
   fulfillment. O checklist específico por família (Bloco 03 §27) pertence ao
   módulo de Onboarding e não foi tocado.

5. **Contrato e checkout** continuam sendo os fluxos existentes. O que mudou é
   que o modo de fechamento passa a ser escolhido antes do envio e guardado em
   `propostas.modo_fechamento`, em vez de derivado dos itens no momento do
   envio.
