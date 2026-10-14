# Noite de 13→14/10 — o que está pronto, o que depende de você

Tudo abaixo está em **homologação** (`https://dev.crm.callface.io`), no sha `aaa5918`.
**Produção continua em `541f8cd`** e nada foi promovido, conforme sua determinação.

---

## 1. Decida isto antes de qualquer promoção para produção

### 1.1 Os cinco admins perdem a caixa de conversas que usam hoje

A correção de segurança vale para toda a superfície do Atendimento, e **cargo deixou
de conceder acesso**. Medido no banco:

| Pessoa | Cargo | Antes | Depois |
|---|---|---:|---:|
| Aline Aragão, Felipe Merencio, Filipe Nascimento, Growth (backup), Marcus Rodrigues | admin | 2.047 | **34** |
| Kauã Scott | super_admin | 2.047 | 1.727 |
| Scott Ferraz | super_admin | 2.047 | 1.763 |

O que os admins perdem é sobretudo a caixa da Mayra Schincariol (872) e da Mayara
Anjos (820). Se eles trabalham nessas conversas, **precisam de supervisão explícita
antes do deploy** — a tabela `whatsapp_supervisao` nasce vazia de propósito, porque
o contrário seria manter o vazamento com outro nome.

Não há tela para conceder. Existe a rota `POST /api/whatsapp/supervisao` (só super
admin, auditada). Diga quem supervisiona quem e eu concedo, ou faço a tela.

### 1.2 Confira os seis números marcados como pessoais

O backfill marcou como privado o número pessoal de quem tem papel de gestão:

- Scott Corp e Scott Growth (você)
- Corporativo - Alisson (Alisson Santos)
- Jenifer Ferreira (Jenifer Matos)
- Lucas Oliveira (Lucas Pereira)
- Callface - Onboarding (Fernando Finisguerra)

**Os quatro últimos podem ser números de trabalho**, não pessoais. Número privado só
o dono e quem ele compartilhou veem.

### 1.3 O super admin pode abrir o seu número privado

Hoje o Kauã, como super admin, abre uma conversa do seu número privado **por id**, e
isso fica registrado em `audit_log` com quem, quando e qual conversa. É a política
que você descreveu ("super admin excepcional, com rastro"). Se quiser que nem ele
abra, a mudança é pequena: número privado só com compartilhamento explícito seu.

---

## 2. Produção ainda tem o defeito do aviso de pagamento

A correção está comprovada em homologação, e **produção está em `541f8cd`, que não a
tem**. Enquanto isso, 42 de 93 avisos do Stripe voltam 499 em produção, e aviso que
cai o bastante faz o Stripe **desativar o endereço** — aí nenhuma venda paga chega ao
CRM.

Comprovação em homologação, reenviando um evento real assinado no próprio servidor:

| Medida | Valor |
|---|---|
| Resposta ao Stripe | **HTTP 202 em 0,24s** |
| Trabalho real, agora no worker | **16,0s** |
| Estado final do evento | `processed` |

**Efeito colateral a aceitar:** o pagamento confirmado passa a aparecer segundos
depois da cobrança, em vez de no mesmo instante.

**Ganho seguinte que eu não fiz de propósito:** cada evento ainda roda o sincronismo
completo da conta (224 assinaturas, 257 faturas) — é de onde vêm os 16s. Mexer agora
arriscaria a cadeia pagamento → ganho → faturamento que acabou de ser comprovada.

---

## 3. Três contratos estão assinados com você nos dois lados

Você disse: *"na hora de assinar eu tava assinando em dois cantos, como se eu fosse
duas pessoas"*. O dado de homologação mostrou o tamanho real: **dez contratos com a
mesma pessoa em dois papéis, e um com três** (contratante + representante legal +
testemunha). Três deles estão `signed` assim.

Corrigido: uma pessoa vale uma assinatura. Nos papéis da Callface que perdem o
e-mail, o nome continua impresso no contrato — a pessoa aparece no documento e não
assina duas vezes.

**Decisão sua:** o que fazer com os três contratos já assinados desse jeito. Eu não
toquei em nenhum.

---

## 4. O que você precisa olhar na tela (não consigo provar sem você)

### Proposta e PDF
- `/p/<id>` de uma proposta vigente, em 1280px e em 390px. Veja o bloco "Por que a
  Callface" com o conteúdo da família certa (uma PABX, uma Callface AI, uma White
  Label). Clique em Aceitar, Pedir ajuste e Recusar.
- Proposta com mensal **e** anual: o bloco de investimento deve listar cada período,
  sem somar mensalidade com anuidade.
- Na ficha da proposta, o bloco **PDF da proposta**: cada modelo tem um "ver" que
  abre sem gravar. Compare os quatro e escolha.
- O PDF de sempre mudou em dois pontos: a coluna Recorrência dizia "Mensal" para item
  trimestral, e a data recuava um dia (13/10 saía "12 de outubro").

### Contratos
- `/ajustes/contratos`: abra 2 ou 3 dos 57 modelos, incluindo um em texto puro, e
  confirme que salvar sem editar não muda o conteúdo. Digite `{{foo}}` e veja o aviso
  antes de salvar. Teste "Prévia com proposta".
- Em **Parâmetros do contrato**, cadastre o Filipe Nascimento como primeiro
  representante legal: é assim que ele vira o padrão.

### Ajustes
- A navegação foi reorganizada em Organização, Comercial, Comunicação, Automação e
  Técnico. Nenhuma tela foi apagada.
- **As telas que gravam e ninguém lê deixaram de ficar escondidas** e aparecem com a
  marca "só registro": ICP, Handover, Notificações, Tracking e Enriquecimento. Se
  você preferir que continuem escondidas, eu escondo — foi escolha minha mostrar, para
  ninguém mais salvar ali esperando efeito.

---

## 5. Travado esperando você

| O que | O que falta |
|---|---|
| **Evento real do ONFACE no n8n** | Homologação não tem `ONFACE_BARRAMENTO_URL` nem `_TOKEN`. Produção tem. As chaves do n8n estão na lista de rotacionar, então o certo é gerar a nova e colocar nos dois ambientes. |
| **Reconciliação do legado** | 313 ganhos sem documento (contrato antigo vale como evidência?), 613 propostas classificadas por nome (Cold Calling é Callface AI ou PABX?), 50 nomes sem família, e um ganho de projeto de R$ 17.000 (é setup?). |
| **Franquia de minutos** | Vendida em prosa na descrição do plano; 1 de 21 planos tem o campo preenchido. Sem isso não existe cobrança de excedente. |
| **Preço por licença do White Label** | Recomendo: a plataforma cobra, o Stripe documenta a oferta. |
| **Recebível** | Você disse "recebível junto da mensalidade com o setup". Mantive uma linha por natureza no mesmo grupo. Se era uma linha só, somando, eu mudo. |
| **Rotacionar segredos — um a mais, por erro meu** | A senha do admin da Callface, as duas chaves do n8n e o `AUTH_SECRET` passaram por chat em 13/10. **Acrescente a isso o usuário do banco do SaaS Callface AI (`CALLFACE_AI_DATABASE_URL`, usuário `lucas_vasconcelos` no RDS de produção).** Eu rodei um script com rastreio ligado (`bash -x`) para depurar, e o rastreio imprimiu a URL inteira, com senha, na sessão. Nada foi escrito naquele banco (a consulta era `information_schema`, e nem chegou a rodar), mas a credencial está num transcript de chat agora e precisa ser trocada. |

---

## 6. Uma fragilidade que vai voltar a te morder

O portão caiu uma vez esta noite **sem culpa do código**: a construção da imagem não
conseguiu baixar as fontes do Google (`next/font/google`). Repetir o job resolveu.

Ou seja: **o deploy do ONFACE depende de baixar fonte da internet na hora de
construir a imagem.** Toda vez que o Google Fonts tossir, o deploy para por um motivo
que não tem nada a ver com o que escrevemos. Dá para resolver trazendo as fontes para
dentro do repositório — é mudança visível na casca, então é sua.

---

## 7. O que entrou, em ordem

| Commit | O que |
|---|---|
| `ee32dc8` | Aviso de pagamento do Stripe responde na hora |
| `a5ac16b` | **P0:** conversa de WhatsApp só por número próprio, atribuição ou supervisão explícita |
| `ad805f3` | Proposta: trimestral deixa de virar mensal; venda feita não muda quando o catálogo muda; corrida na retomada do aceite; e-mail que falhou para de aparecer como enviado |
| `799a00b` | Ajustes órfãos ligados + sincronismo do Callface AI com caminho único |
| `ac8bb9b` | Página pública premium, três modelos de PDF, editor de modelo de contrato, signatários configuráveis, Ajustes reorganizados |
| `60127f9` | Uma pessoa, uma assinatura |
| `aaa5918` | Upgrade soma, cross-sell soma, uma venda é um board, etapa cumprida nasce cumprida, renovação não duplica |

`c77d23e` e `ce8e00f` (central de comando do Início) são de outra frente e entraram
no mesmo trem; não passaram por mim.

Detalhe de cada defeito: [`matriz-jornada-comercial.md`](./matriz-jornada-comercial.md).
