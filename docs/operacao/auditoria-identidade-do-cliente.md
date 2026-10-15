# Auditoria: onde o cliente se perdeu

Medido em produção (`callface_crm_mz`), no legado (`callface_crm`) e no Stripe
live em **15/10/2026**. Tudo leitura; nada foi alterado para produzir isto.

## A doença, em uma frase

**Nenhuma das três camadas tem chave única de identidade**, então o mesmo
cliente existe várias vezes — e cada carga nova e cada venda nova reabre o
buraco.

| Camada | Como o cliente se parte |
|---|---|
| **Stripe** | vários Customers para a mesma empresa (8 clientes, 18 Customers) |
| **CRM** | empresa do histórico ≠ empresa do faturamento (97 empresas sem lead) |
| **Assinatura** | sem empresa, ou presa no balde "Unresolved billing identity" |

## O caso Trevisan: um cliente em TRÊS lugares

Ele está **ativo, pagando R$ 2.248,50/mês** (`sub_1TyH38`, próxima cobrança
28/10, sincronizada hoje). O CRM mostra:

| Onde | O que tem | O que falta |
|---|---|---|
| **"Unresolved billing identity"** | a assinatura ATIVA de R$ 2.248,50 | tudo |
| **"Trevisan"** `82b8979a` | lead, pessoa, 4 negócios, 2 propostas aceitas, 7 faturas pagas (R$ 5.247) | a assinatura ativa; o serviço está CHURNED |
| **"Fabio Trevisani"** `a8dd7c18` | serviço do ledger, `canonical_product` VAZIO | leads, pessoas, negócios, assinaturas |

**São o mesmo cliente**, e a prova está na evidência do próprio serviço do
ledger: `"Spedy exact R$2248.50"` — exatamente o valor da proposta nº 1154
aceita por ele em 28/07. O CPF da casca (24947528842) é o dele.

**O estado real é ATIVO.** O `CHURNED` da empresa certa veio da assinatura
pequena (R$ 150) cancelada em 05/10; a grande continua correndo.

## As 97 empresas com serviço ativo e nenhum lead

**MRR total: R$ 61.213,81.** Origem: LEDGER_JULHO 77 (R$ 46.931,91),
STRIPE 15 (R$ 14.281,90), MARCO_ZERO 5 (R$ 0). Tudo que veio de
`CRM_POSVENDA` (7) tem lead — **só o que veio de carga perdeu o vínculo**.

| Grupo | Empresas | MRR | O que fazer |
|---|---|---|---|
| **DUPLICATA** | 19 | R$ 11.496,13 | fundir, par a par |
| **DUVIDOSA** | 21 | R$ 21.423,05 | **decisão humana** — não fundir |
| **SÓ NO FATURAMENTO** | 57 | R$ 28.294,63 | cadastrar, ou tratar à parte |

**R$ 8.795,21 das duplicatas estão em 3 empresas:** Doptex (R$ 6.127,90, raiz
de CNPJ igual), Major Nutrição (R$ 1.591,59, CNPJ igual) e Acqualimp
(R$ 1.483,26, marca e e-mail).

**"Unresolved billing identity" sozinha é R$ 9.604,30** — 34% do grupo "só no
faturamento". Não é cliente: é o balde onde a assinatura sem dono vai parar. É
lá que está a assinatura ativa do Trevisan.

### Por que DUVIDOSA não se funde

- **Atrio (3 empresas, R$ 7.748,58):** rede hoteleira com 10+ unidades no CRM,
  mesma raiz de CNPJ. São filiais. Fundir junta hotéis diferentes.
- **Alphaville (R$ 5.227,52):** 3 candidatos, nenhum com CNPJ igual.
- **Centerval:** as duas apontam para uma empresa que **já tem serviço ativo
  próprio de R$ 2.521,48** — fundir conta a receita duas vezes.
- **Instituto Andrea Tedesco (R$ 1.079,40):** casou só pelo primeiro nome
  "Andrea" de um contato de outra empresa.

Nome não é prova. "Natural Lab" e "Natural Lab Digital" são o mesmo; dois
"Victor Prado" podem não ser.

## As 20 assinaturas ativas sem empresa (R$ 8.355,91)

Dimensionado, é bem menor do que parecia:

| Situação | Qtd | MRR | Conserto |
|---|---|---|---|
| Lead **tem** empresa | **13** | R$ 3.538,51 | **corrigido no código** (`ee9dae3`) |
| Lead sem empresa | 6 | R$ 2.658,60 | criar/vincular empresa |
| Sem lead nenhum | 1 | R$ 2.158,80 | identificar o cliente |

As 13 eram o sync achando o lead e **não copiando a empresa**: o `INSERT`
copiava, o `UPDATE` nunca tocava no vínculo. Assinatura que nasceu antes de o
cliente ter empresa ficava órfã para sempre, mesmo com o sync passando de meia
em meia hora. Elas voltam sozinhas no próximo sync.

## O que o legado tem e o novo não aproveitou

O legado mantinha o cliente inteiro por **`billing_identities`** — 224 vínculos
confirmados ligando Customer do Stripe a lead/empresa. O ONFACE **tem a tabela
com 226 linhas**, mas o resolvedor só a consulta através de
`billing_customer_aliases`, que tem **2 linhas**. Nenhuma das 20 órfãs tem
identidade correspondente, então aqui não havia atalho — mas a ponte está
subaproveitada e vale revisar.

O legado também não era perfeito: 44 assinaturas lá estão na mesma
"Unresolved billing identity", 30 ativas sem lead. **O problema veio junto na
mudança, não nasceu nela.**

## Ordem recomendada

1. **Trevisan como piloto** — mover a assinatura ativa para a empresa certa,
   descartar a casca do ledger, corrigir o CHURNED. É o caso completo e serve
   de molde.
2. **As 3 duplicatas grandes** (Doptex, Major, Acqualimp) — R$ 8.795,21, todas
   com prova de CNPJ ou marca.
3. **As 16 duplicatas restantes**, com revisão par a par.
4. **Nunca deixar o ACTIVE do ledger de julho mandar** quando o CRM tem
   cancelamento com data posterior. O ledger é foto de julho; o CRM é hoje.
5. **DUVIDOSA e SÓ NO FATURAMENTO** não entram em script.

## A causa que fica se ninguém decidir

Enquanto não existir uma chave única de cliente — CNPJ, e-mail canônico, o que
o dono escolher — consertar os 97 resolve hoje e não impede amanhã. Essa é a
única decisão desta auditoria que é de arquitetura, não de limpeza.
