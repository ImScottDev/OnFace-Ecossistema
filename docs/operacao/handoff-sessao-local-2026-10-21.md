# Handoff — sessão local, 21/10/2026 (03h30)

Para a próxima sessão do Scott na máquina dele. Escrito ao fim de um dia longo
em que trabalharam, ao mesmo tempo, esta sessão local, uma sessão na nuvem e o
ChatGPT. Leia também, nesta ordem:

1. `AGENTS.md` (raiz) — as regras que não se quebram.
2. `docs/operacao/handoff-nuvem-para-local.md` — a seção **9** é da noite de
   20/10 e conta a correção da Lia em produção.
3. Este arquivo.

---

## 1. Onde o sistema está agora

```
produção     https://crm.callface.io      pilha crm2-dev     → 6a57c117
homologação  https://dev.crm.callface.io  pilha crm2-homolog → 6a57c117
main         6a57c117
```

Publicar é `./deploy.sh homolog <sha>` e depois `./deploy.sh dev --versao <sha>`
(`dev` é PRODUÇÃO, não se engane com o nome). Também dá para publicar pelo botão
do GitHub: Actions → **publicar** → Run workflow, ou
`gh workflow run publicar.yml -f ambiente=homolog -f versao=<sha>`. A chave do
servidor está em `secrets.DEPLOY_SSH_KEY`; sessão em nuvem **não** consegue
disparar (403, o token dela não tem `actions: write`).

## 2. A pergunta que está em aberto agora, e como responder

**A Lia respondeu depois do deploy #9?** Ainda não dá para saber: desde
`ebfe0dd0` (00:26 UTC de 21/10) **nenhuma mensagem chegou no número dela**.
Conferido no banco de produção, zero linhas. Não é defeito — é falta de teste.

O que JÁ está provado, do banco de produção:

- **Filipe Nascimento foi respondido**, duas execuções `completed` às 23:46 de
  20/10 (atenção: é "Filipe", com i; o handoff anterior escreveu "Felipe").
- As execuções do Scott às 22:48–22:52 também saíram `completed`.
- Os dois `aborted` das 20:40 foram `taxa_maxima_hora`, o limite de 6
  mensagens/hora que já foi solto (ver §4).

**Para fechar isso:** mande uma mensagem de um número que nunca falou com ela e
confira:

```sql
SELECT r.started_at, r.status, r.abort_reason, c.nome, s.label
  FROM ai_agent_runs r JOIN ai_agents a ON a.id = r.agent_id
  LEFT JOIN contatos c ON c.id = r.contato_id
  LEFT JOIN whatsapp_sessao s ON s.id = c.sessao_id
 WHERE a.slug = 'lia-sdr' ORDER BY r.started_at DESC LIMIT 10;
```

No log do worker deve aparecer `[Agentes] número do agente, contato …`. Se não
aparecer linha nenhuma, o número não foi reconhecido como dela: conferir
`usuario_id`, `operacional` e `privado` da sessão. Se a mensagem veio de outro
número também conectado na OnFace, o worker trata como inter-sessão e nem
chega lá — comportamento antigo, ninguém mexeu.

## 3. Estado da Lia em produção

```
sessão    lia-comercial-chpd · 5511920836132 · connected · operacional=true
dono      Lia SDR — Callface (usuário tipo agente)
versão    v4 publicada · autonomia autonomous · canais {pool: operacional}
limites   60 mensagens/hora · 500/dia · 3 seguidas sem retorno
```

Os outros números da organização **não** estão operacionais (eram 15, só o dela
foi marcado). Enquanto isso, a distribuição por número e o rodízio novo não têm
pool para trabalhar.

## 4. Decisões do Scott que estão esperando, não trabalho parado

- **Soltar o limite de mensagem da Lia.** Ele pediu "sem limite", e agora
  `0 = sem limite` existe no código. A trava passou a ser o **teto de gasto**
  (§5), então dá para soltar. Não soltei sozinho: enquanto o teto não estivesse
  em produção, os 60/hora eram a única proteção que sobrava.
- **Qualificação da Lia só existe no prompt** — o QA antigo mediu `qualificacao`
  nula em 9 de 10 cenários, e o painel mostra "Qualificações 0" com 44 leads
  trabalhados. É o item que mais vale dinheiro e o mais longo.
- **Regra antiga de automação** (`gatilho = 'novo_lead'`,
  `lib/crm/automacao-engine.ts`) continua fora do barramento: só roda por
  chamada direta. Ligá-la no outbox dispararia em dobro com a rota legada.
- **`AcquisitionCreated` também nasce na reconversão** (pessoa que já teve lead
  e voltou sem aquisição aberta). Fluxo e cadência leem isso como "lead novo".
- **Cadência do tipo `contato` não tem porta manual** — decisão de produto
  antiga, não é bug.
- **Catálogo:** o produto `Callface AI - Agente IA` tem **699,90 mensal** (o
  preço novo, de 20/10) e **500 mensal + 500 avulso** ativos ao mesmo tempo. O
  Scott decidiu deixar os três. Quem monta proposta vê os três.

## 5. O que entrou em 20 e 21/10, por frente

**Infra e deploy**
- Publicar virou botão do GitHub (`.github/workflows/publicar.yml`), com a
  chave em `secrets.DEPLOY_SSH_KEY`.
- Três defeitos reais do `deploy.sh`: token do keychain em dois pontos (fora do
  Mac, `git credential fill` sai 128 e derruba o deploy, o segundo ponto DEPOIS
  de já ter enviado o código), `rsync --delete` abortando em `/backups/`, e o
  login no GHCR pelo mesmo caminho.
- Fontes do Google viraram locais (`next/font/local`): o build não depende mais
  de rede. Trava `build-sem-rede`.

**Lia e agentes**
- A Lia atende por **pool operacional**, não por número fixo (migration 0132).
- Responde qualquer pessoa que escreve no número dela, cria lead de quem não
  tem cadastro e não deixa ninguém no vácuo (`numero-do-agente.ts`).
- Número do próprio agente deixou de ser recusado como "não autorizado".
- Passo "IA: responder" passou a falar pelo número escolhido no campo
  "Falar pelo número", que o motor ignorava.
- **Custo da IA voltou a ser gravado** — era gravado como zero, sempre
  (`cost: 0` fixo no código, e o provider `claude_subscription` sem linha em
  `ai_models`). Agora existe **teto de gasto** por organização,
  **US$ 20/dia e US$ 200/mês** por padrão, que bloqueia o acionamento com
  motivo registrado (`teto_de_gasto_dia` / `teto_de_gasto_mes`). Configuração
  só por API (`PUT /automacoes/ai/usage/budgets`); não há tela.

**Números de WhatsApp — três defeitos empilhados no mesmo sintoma**
1. O telefone só era gravado na TROCA de estado: conectado com telefone vazio
   ficava vazio para sempre.
2. Número cujo dono é agente não podia ser consultado por ninguém — nem o botão
   Atualizar — porque agente não abre tela.
3. `/session/status` do wuzapi responde `loggedIn: true, jid: ""`; o número está
   no cadastro (`/admin/users`). Agora, só nesse caso, o número é lido de lá.

**Gatilhos (a auditoria com prova)**
- Cadência e agente só oferecem gatilho que de fato chega. Eram 5 mortos na
  cadência (dois com ZERO ocorrências no repositório) e 15 na tela do agente,
  onde só 4 acordam agente. As listas agora são DERIVADAS do consumidor.
- Quem já salvou gatilho morto vê o valor marcado como inválido, em vez de ele
  sumir em silêncio.
- Cadência com gatilho "Lead criado" voltou a enxergar Meta, RD, site,
  Pré-vendas e prospecção: faltava o alias `AcquisitionCreated`.
- Fluxo com "WhatsApp recebido" + "texto contém X" nunca disparava (o evento só
  leva o id da mensagem).
- `TypeError` na reentrega do relay derrubava o roteamento inteiro.

**Vendas e telas**
- Pré-vendas: as sete colunas voltaram a bater total com cartão, e "Ativos"
  conta o mesmo universo do quadro.
- Condição da cadência: Campo e Valor oferecem o que existe e seguem aceitando
  texto livre.
- Cadências perguntam antes de cancelar inscrição e param de perder rascunho.
- Teclado e leitor de tela no Design System (filtro não se anuncia como aba,
  segmento anda com seta, botão bloqueado conta o motivo).

## 6. Armadilhas que custaram tempo (não repita)

- **Crase dentro de template SQL** (`` sql`...` ``) fecha a string. Em
  comentário dentro de SQL, escreva `pe.codigo` sem crase. Caí nisso de novo.
- **Nunca `git add -A`** com agente rodando na mesma árvore: varri para um
  commit meu um arquivo que outro agente ainda editava, e aquele commit não
  compilava.
- **Nunca passe um sha que você não leu.** Inventei sha duas vezes; as duas
  falharam antes de tocar o servidor, mas custaram minutos.
- **Painel do navegador oculto** (`document.visibilityState === "hidden"`): o
  React não confirma a renderização e TODA tela fica em "Carregando". Não é
  bug do produto. Nada foi validado visualmente nesta máquina.
- **Teste que casa por nome solto** (coluna, campo) envelhece mal: uma migration
  criando o mesmo nome em outra tabela faz a trava acusar 14 arquivos
  intocados.
- **Relato de agente não é prova.** Repassei "Meta e RD não publicam evento de
  lead criado" sem conferir; era falso, e mandar consertar teria criado dois
  eventos para o mesmo fato — mensagem duplicada para lead pago.
- Testes de `lib/automacoes` e `lib/cadencia` precisam de
  `pnpm exec tsx --env-file=.env --test <arquivo>`; sem o env eles falham de
  mentira.
- `operacao.test.ts` e `agentes-fluxo.test.ts` passam isolados e podem falhar
  juntos: interferência de fixture entre arquivos, defeito do teste.

## 7. O que NÃO foi verificado

- **O gate do navegador não passou em nada de 20 e 21/10.** Tudo foi validado
  por banco, API e teste. Telas a abrir: `/automacoes/cadencias` (coluna "Entra
  quando", confirmação ao cancelar, Campo/Valor da Condição),
  `/automacoes/agentes/<id>` aba Gatilhos, `/automacoes` Execuções (o custo só
  sai de zero na próxima execução real), `/ajustes/whatsapp` (selos e o agente
  do pool), `/ajustes/leads` (caixa de entrada da captação), Pré-vendas
  (colunas e "Ativos").
- **O bloqueio por teto de gasto não foi exercitado ponta a ponta**, só a
  lógica por teste unitário.
- Duas falhas de paridade canônico×legado na suíte (relatório por pessoa,
  pipeline) já existiam antes e não têm relação com automação: divergência de
  dado na cópia local. Rodar contra o banco de homologação é a única forma de
  saber se escondem defeito.

## 8. Comandos que você vai repetir

```bash
pnpm typecheck                                              # raiz
cd app && pnpm exec tsx --test "src/lib/arquitetura/*.test.ts"   # 124, sem banco
cd app && pnpm build                                        # pega erro de Server Action
cd app && pnpm exec tsx --env-file=.env --test <arquivo>    # testes com banco
```

O banco local está carregado e o Redis de pé. Para consultar **produção**, túnel
SSH para a porta 5433 (`crm2-dev-postgres`) ou 5434 (homolog), com a
`DATABASE_URL` do `.env` do ambiente, no servidor `34.204.200.52`.
