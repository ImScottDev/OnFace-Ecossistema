---
slug: playbook-sdr-inbound
nome: Playbook SDR Inbound
categoria: playbook_sdr
governanca: aprovado
origem: vault:02_PROJETOS/Callface/CRM/produto/playbook-sdr.md
nota: v1 de 07/07/2026, playbook de SDR inbound com matriz de qualificação
gerado_em: 2026-10-12
---

# Playbook SDR Inbound — Callface.ai

> Manual operacional do SDR de **inbound**: lead que já levantou a mão (anúncio Meta/Google ou formulário no site via RD Station). O SDR **qualifica e agenda** com o closer, não fecha.
> O **BDR** (prospecção fria, motor RFB) tem playbook próprio (a construir). Ver prospeccao-outbound.
> Conecta com: icp-publico · icp-callface · posicionamento · brand-book · callface

---

## 0. As 3 regras que não se quebram

1. **Lidera por CONTROLE, nunca por "IA".** A promessa de entrada é *"saiba exatamente o que seu time fala no telefone"*. A IA é o motivo de ficar e expandir, não o de entrar. Quem lidera por "IA de conversação" enche o funil de curioso que não paga.
2. **O "aha" é ver a primeira ligação real transcrita e pontuada.** Toda conversa empurra pra esse momento (na demo/trial com o closer). É ali que o lead compra.
3. **Callface.ai na frente, PABX roteado.** O SDR sempre abre pela dor/controle (Callface.ai). Se o lead se revelar telefonia pura (liga pouco, só quer ramal/operadora, zero apetite de análise), ele **marca como PABX** pro closer decidir. Nunca descarta um lead PABX, e nunca força IA em quem não pediu.

---

## 1. O papel do SDR (e o que sucesso significa)

O SDR inbound é a primeira voz humana da Callface. Ele pega o lead que veio do marketing, **entende o cenário**, decide se é ICP, e entrega ao closer uma reunião agendada com o dever de casa feito.

| O SDR FAZ | O SDR NÃO faz |
|---|---|
| Responde rápido, qualifica pela matriz, agenda demo/trial | Não fecha venda, não negocia preço |
| Alimenta o CRM em cada toque | Não deixa lead sem registro (o gargalo histórico) |
| Roteia PABX e desqualifica anti-ICP com honestidade | Não empurra Callface.ai pra quem não tem dor |
| Cria o compromisso do horário e reduz no-show | Não faz demo técnica (isso é do closer) |

**Definição de sucesso (o que conta como entrega):** uma **SQL agendada** = reunião marcada com o closer, lead ICP confirmado pela matriz, e o CRM com CNPJ, segmento, tamanho do time, CRM atual, volume de ligações, gatilho, dor principal e produto sugerido preenchidos. Reunião sem dever de casa não conta.

---

## 2. Onde o SDR vive no funil

```
Anúncio (Meta/Google) ou Formulário no site
        ↓
RD Station (nutrição) → CRM (lead entra, origem=inbound)
        ↓
► SDR: responde em minutos, qualifica, agenda ◄
        ↓
   ┌────────────┬─────────────┬──────────────┐
 Qualificado   Sinal PABX   Anti-ICP / sem retorno
 (ICP Callface.ai)  (marca p/ closer)  (desqualifica c/ motivo)
        ↓            ↓
   Closer: demo + trial 7 dias / apresentação PABX
```

Gargalo histórico que este playbook mata: *"SDR não alimenta o CRM corretamente, dados se perdem no funil"*. A seção 11 é regra, não sugestão.

---

## 3. ICP em uma tela + matriz de qualificação

**ICP certo:** empresa onde **o telefone é a fábrica de receita** (intensidade de telefone > setor). Ponta de lança: **Seguros, Crédito/correspondente, Contabilidade**. Dois tiers: Tier 1 (dono-operador solo, 1 a 4 seats) e Tier 2 (time comercial estruturado, 5 a 15, comprador ≠ usuário).

**Matriz verde/vermelho** (a espinha da qualificação, some enquanto o lead fala):

| Sinal | Verde (empurra pra demo) | Vermelho (rota alternativa) |
|---|---|---|
| Volume de ligações/dia | Alto, telefone é o canal central | Esporádico / receptivo |
| Consequência já sentida | Já perdeu venda por algo dito no telefone | "Só curiosidade sobre IA" |
| Decisor | Dono/gestor que compra | Indefinido |
| CRM | Agendor, Ploomes, Pipedrive, HubSpot, Kommo | Nenhum / planilha sem processo |
| Tipo de operação | Vendas / inside sales ativo | SAC / atendimento receptivo puro |
| Sensibilidade a preço | Compara com custo da venda perdida | Compara só com WhatsApp grátis |

**Regra de decisão:** 4+ verdes = crava demo/trial com energia. 2+ vermelhos = ver ramais (seção 9). Sinal PABX forte = marca PABX e passa pro closer.

---

## 4. A cadência inbound (o fluxo, dia a dia)

A briga do inbound é **velocidade** e **persistência**. Lead respondido em 5 minutos converte muito mais que em 1 hora. E a maioria desiste no 2º toque, quando a conexão acontece por volta do 6º. A cadência abaixo mistura ligação, WhatsApp e email ao longo de ~14 dias. WhatsApp é o canal principal do inbound (o lead pediu contato), ligação é o de maior conversão, email é o de reforço.

| # | Quando | Canal | Objetivo | Referência |
|---|---|---|---|---|
| 1 | 0 a 5 min | **Ligação** | Contato imediato (maior taxa de conexão) | Script §6 |
| 2 | 0 a 5 min (se não atende) | **WhatsApp** | Msg 1, abre pela dor | §7 Msg 1 |
| 3 | +3h | WhatsApp | Follow-up 1 (reforço da dor) | §7 FU1 |
| 4 | Fim do dia 0 | Email | Email 1 (dor) | §8 Email 1 |
| 5 | Dia 1, manhã | **Ligação** | 2ª tentativa, horário diferente | Script §6 |
| 6 | Dia 1, tarde | WhatsApp | Follow-up 2 (o "aha", prova) | §7 FU2 |
| 7 | Dia 2 | Email | Email 2 (prova / mini-case) | §8 Email 2 |
| 8 | Dia 3, tarde | **Ligação** | 3ª tentativa, outro horário | Script §6 |
| 9 | Dia 3 | WhatsApp | Follow-up 3 (facilidade / quebra de atrito) | §7 FU3 |
| 10 | Dia 5 | Email | Email 3 (quebra de objeção) | §8 Email 3 |
| 11 | Dia 7 | WhatsApp | Follow-up 4 (última chamada, honesto) | §7 FU4 |
| 12 | Dia 7 | Email | Email 4 (ROI) | §8 Email 4 |
| 13 | Dia 10 | Email | Email 5 (break-up, alta resposta) | §8 Email 5 |

**Regras da cadência:**
- **Speed-to-lead:** primeira ligação em até 5 minutos. Se o lead entrou fora do horário comercial, WhatsApp na hora e ligação na primeira hora do dia seguinte.
- **Tentativas de conexão:** no mínimo 6 ligações em horários variados (manhã/almoço/fim de tarde) nos primeiros 3 dias. Alternar horário é o que muda a taxa de conexão.
- **Respondeu?** sai da cadência automática e entra a conversa 1:1 (qualifica pelo §5, agenda). A cadência é só pra quem não responde.
- **Esquentou e sumiu?** entra no reengajamento (§7, variações A/B/C) conforme o ponto onde parou.
- **Fim da régua sem resposta:** marca no CRM como "sem retorno", motivo registrado, e para. Não fica caçando pra sempre.

---

## 5. As 5 perguntas de qualificação (refinadas)

As 5 que já existiam no funil, agora embutidas de forma natural na conversa (não como interrogatório):

1. **Como o time liga hoje?** (celular, sistema, WhatsApp) + *quantas ligações por dia, mais ou menos?* → volume.
2. **Essa decisão passa por você ou tem mais alguém junto?** → decisor.
3. **Me passa o CNPJ pra eu já deixar teu acesso preparado do jeito certo.** → CNPJ (pedido como preparo, não burocracia; vira micro-compromisso).
4. **Onde vocês registram os contatos? Usa Agendor, Ploomes, Pipedrive, ou tá mais no manual?** → CRM.
5. **Quantas pessoas ficam no telefone vendendo aí? Você junto com o time, ou só gerencia?** → tamanho + Tier + comprador vs usuário.

---

## 6. Script de ligação (framework CLOSER adaptado)

> Esta call qualifica e agenda. O único "sim" a arrancar é o do **horário**.

### CLOSER mapeado à qualificação inbound

| Letra | O que o SDR faz nesta call |
|---|---|
| **C — Clarify** | Confirma que foi ele que pediu contato e descobre **o que o trouxe** (o gatilho real). |
| **L — Label** | Devolve a dor em uma frase, no idioma dele. O problema vira dele. |
| **O — Overview** | Descobre o status quo manual (gravação na mão, CRM que ninguém preenche). Aqui entram as 5 perguntas + a matriz. |
| **S — Sell the result** | Vende o **próximo passo** (demo/trial) como veículo pro resultado. Ancora no aha. |
| **E — Explain concerns** | Trata objeções com reframe curto, sem debater. |
| **R — Reinforce** | Crava dia e hora, micro-compromisso (CNPJ + CRM antes), reduz no-show reforçando o ganho dele. |

### Abertura

> "Oi, é o {nome}? Aqui é o {seu_nome}, da Callface. Você deixou seu contato pra gente falar sobre as ligações do time, lembra? Peguei aqui na hora pra não te deixar esperando. Você tem uns 5 minutinhos agora ou prefere que eu te ligue mais tarde?"

Se topar:

> "Fechou. Vou ser direto pra respeitar teu tempo. Antes de eu te explicar qualquer coisa, quero entender o teu cenário, porque a Callface serve muito pra um tipo de operação e nada pra outro. Assim eu te falo com honestidade se faz sentido pra você. Pode ser?"

### Descoberta (Clarify → Label → Overview)

**Clarify (gatilho):**
> "Me conta uma coisa. O que fez você parar no anúncio e deixar o contato? Tem algo específico incomodando na operação de vendas hoje?"

**Pergunta 1 (como liga / volume):**
> "E hoje, como o time liga? Celular, algum sistema, WhatsApp? E, por baixo, quantas ligações o time faz por dia mais ou menos?"

**Label (nomeia a dor):**
> "Deixa eu ver se entendi. Hoje, quando um vendedor desliga o telefone, você não tem como saber o que ele realmente falou, o que prometeu, se seguiu o processo. Você fica na palavra dele. É isso?"

(silêncio, deixa confirmar) e aprofunda:
> "E já aconteceu de perder uma venda e não saber por quê? Ou de descobrir que um follow-up importante não foi feito porque ninguém anotou?"

**Pergunta 5 (tamanho):**
> "Quantas pessoas ficam no telefone vendendo aí? É você junto com o time, ou você só gerencia?"

**Pergunta 4 (CRM):**
> "E onde vocês registram os contatos hoje? Usa algum CRM tipo Agendor, Ploomes, Pipedrive, ou tá mais no controle manual?"

**Pergunta 2 (decisor):**
> "E uma decisão dessas, de colocar uma ferramenta pro time, passa por você ou tem mais alguém junto?"

**Pergunta 3 (CNPJ, como preparo):**
> "Perfeito. Pra eu já deixar teu acesso preparado do jeito certo, me passa o CNPJ da empresa? Assim quando você entrar já tá tudo pronto pro teu cenário."

### Transição (Sell the result, ancorada no aha)

> "Olha, pelo que você me falou, faz muito sentido a gente conversar direito. Você tem {X} pessoas ligando todo dia e hoje tá no escuro sobre o que rola nessas ligações. É exatamente o buraco que a Callface tapa.
>
> E eu não quero te vender no telefone. Quero te **mostrar**. Numa conversa de uns 30 minutos com nosso especialista, a gente pega uma ligação real do seu time, e ali na tua frente ela vira texto, com um resumo do que foi falado, uma nota de 0 a 100 de como foi conduzida, e já o próximo passo daquele cliente. Você vê, pela primeira vez, o que acontece dentro das suas ligações.
>
> A maioria dos gestores, quando lê a primeira ligação do próprio time na tela, tem o mesmo susto: 'eu não fazia ideia que era assim que a gente vendia'. É esse momento que eu quero te dar."

### Agendamento (Reinforce)

Alternativa fechada, nunca "quando você pode?":
> "Tenho a agenda do especialista amanhã de manhã e quinta no fim da tarde. O que encaixa melhor pra você?"

Aperta:
> "Fechou, quinta às 16h então. Vou bloquear no nome dele pra você. É uma conversa de uns 30 minutos, de vídeo, você consegue estar num computador? Ajuda porque você vai ver a tela."

Micro-compromisso:
> "E faz o seguinte pra gente aproveitar o tempo: me manda até lá o CNPJ e, se puder, o nome do CRM que vocês usam. Aí a gente já chega com o teu cenário montado, em vez de perder tempo configurando na hora."

### Confirmação

> "Então ficou: quinta, 16h, com o {closer}, por vídeo. Vou te mandar o convite agora no WhatsApp e no email com o link. Me confirma quando receber, só pra eu saber que chegou? Qualquer coisa de última hora, me avisa que a gente remarca. Mas garante esse horário, porque é o momento que você vai finalmente ver por dentro das suas ligações. Combinado?"

---

## 7. Sequência de WhatsApp (canal principal)

Placeholders: `{primeiro_nome}` `{empresa}` `{origem_do_lead}` `{seu_nome}` `{segmento}` `{link_agenda}` `{data_hora}`.

**Msg 1 (primeiro contato, minutos após levantar a mão):**
> Oi {primeiro_nome}, aqui é o {seu_nome}, da Callface.
>
> Vi que você veio pelo {origem_do_lead} e deixou seu contato pra saber mais. Antes de te empurrar qualquer coisa, me conta uma coisa rápida: hoje você consegue saber o que cada vendedor da {empresa} fala nas ligações, ou isso fica meio no escuro?

**Msg 1, variação (lead deu contexto no formulário):**
> Oi {primeiro_nome}, {seu_nome} da Callface por aqui.
>
> Vi seu contato pelo {origem_do_lead}. Você trabalha com {segmento}, então imagino que o telefone seja o motor da operação aí. Deixa eu entender o cenário antes de falar de plano: quantos vendedores da {empresa} vivem no telefone hoje?

**Follow-up 1 (+3h, reforço da dor):**
> {primeiro_nome}, só pra não te deixar no vácuo.
>
> A pergunta que quase todo gestor trava quando escuto é essa: "meu vendedor diz que ligou, mas será que ligou, e será que falou certo?". Se isso passa pela sua cabeça de vez em quando, é exatamente o que a gente resolve. Faz sentido a gente trocar duas ideias?

**Follow-up 2 (+1 dia, o aha):**
> {primeiro_nome}, uma ideia pra te mostrar na prática em vez de ficar no papo.
>
> A gente pega uma ligação real da sua operação, transcreve, resume e dá uma nota de 0 a 100 pro atendimento. Você lê em 30 segundos o que levaria meia hora de gravação pra entender. É a forma mais rápida de você ver se isso serve pra {empresa}. Quer que eu te mostre com uma call sua?

**Follow-up 3 (+3 dias, facilidade):**
> {primeiro_nome}, imagino que a rotina tá corrida aí.
>
> Só pra tirar o medo de dor de cabeça: não tem hardware, não tem instalação, roda no navegador e o CRM que você já usa se atualiza sozinho no fim da ligação. Dá pra ver funcionando numa call de 30 minutos, sem compromisso. Te mando dois horários?

**Follow-up 4 (+7 dias, última chamada):**
> {primeiro_nome}, vou parar de te chamar pra não virar chato.
>
> Se agora não é a hora, tá tudo certo, é só me falar. Se ainda faz sentido entender o que rola nas ligações da {empresa} sem depender do que o vendedor conta, me responde aqui que eu te organizo em 5 minutos. Deixo a porta aberta.

**Reengajamento (lead que sumiu no meio):**
- *A (sumiu depois de interesse):* "{primeiro_nome}, a gente tava conversando e a vida engoliu, acontece. Ainda quer ver aquela ligação sua transcrita e pontuada? Se sim, me fala um dia dessa semana que eu seguro pra você."
- *B (sumiu depois do horário):* "{primeiro_nome}, aqueles horários já venceram, mas remarco fácil. Me diz só: melhor de manhã ou de tarde pra você? Eu acho o encaixe."
- *C (sumiu depois de objeção):* "{primeiro_nome}, fiquei pensando na sua dúvida de outro dia. Não precisa decidir nada agora. Que tal a gente só olhar uma ligação real da {empresa} junto? Você vê o que a ferramenta enxerga e decide depois com dado na mão. Topa 30 minutos?"

**Agendamento confirmado:**
> Fechado, {primeiro_nome}. Marquei pra {data_hora}.
>
> Vou te mandar o link aqui e no seu email. Pra call render, faz um favor: separa 1 ligação recente do time que você gostaria de entender melhor. A gente passa ela na ferramenta ao vivo e você já sai da call vendo a transcrição, o resumo e a nota. É aí que a coisa faz sentido de verdade.
>
> Link: {link_agenda}

**Lembrete no dia:**
> Bom dia, {primeiro_nome}. Nossa call é hoje às {data_hora}, tô confirmado do meu lado. Lembra de deixar aquela ligação separada. Nos vemos daqui a pouco. Link: {link_agenda}

---

## 8. Sequência de Email (canal secundário)

**Email 1 (dia 0, dor) — Assunto: o que seu time fala nas ligações**
> Oi {primeiro_nome},
>
> Aqui é o {seu_nome}, da Callface. Você deixou seu contato pelo {origem_do_lead}, então vou direto ao ponto.
>
> A maioria dos gestores com quem falo sabe quanto gasta em anúncio e quantos leads entram, mas não sabe o que o vendedor realmente fala quando o telefone toca. A ligação acontece, e o conhecimento evapora.
>
> A Callface transcreve cada ligação, dá uma nota de 0 a 100 para o atendimento e joga o resumo no seu CRM sozinha. Você para de depender do que o vendedor conta.
>
> Vale 30 minutos pra eu te mostrar com uma ligação real da {empresa}?
>
> {seu_nome}

**Email 2 (dia 2, prova) — Assunto: meia hora de gravação em 30 segundos**
> {primeiro_nome},
>
> Um exemplo do que a ferramenta faz na prática.
>
> Corretoras e escritórios que ligam o dia inteiro tinham o mesmo problema: pra saber se uma venda foi bem trabalhada, alguém precisava ouvir a gravação inteira. Ninguém tinha tempo, então ninguém ouvia.
>
> Com a Callface, a ligação chega pronta: transcrita, resumida, com nota e com o próximo passo já virando uma tarefa. O que levava meia hora de áudio você lê em 30 segundos.
>
> Posso te mostrar isso com uma call sua. Você me diz um horário e eu preparo.
>
> {seu_nome}

**Email 3 (dia 5, objeção) — Assunto: "meu CRM já faz isso"**
> {primeiro_nome},
>
> Toda vez que falo de Callface, ouço uma dessas três: "meu CRM já faz", "já tenho gravação" ou "meu PABX resolve". Justo. Vou ser honesto com cada uma.
>
> O CRM registra o que o vendedor digita. A Callface registra o que ele fala, e preenche o CRM sozinha.
>
> A gravação você ainda tem que ouvir. Aqui já vem transcrita, com resumo, nota e próximo passo.
>
> O PABX faz a ligação acontecer. Ele não te diz se foi boa, não qualifica o lead e não atualiza nada depois.
>
> Se alguma dessas é a sua dúvida, é exatamente o que eu queria te mostrar numa call de 30 minutos, com uma ligação real da {empresa}.
>
> {seu_nome}

**Email 4 (dia 7, ROI) — Assunto: uma venda recuperada**
> {primeiro_nome},
>
> Uma conta simples pra fechar o raciocínio.
>
> Quanto vale pra {empresa} uma única venda que hoje se perde porque o follow-up foi esquecido, ou porque ninguém percebeu que a ligação foi mal conduzida?
>
> A Callface custa a partir de R$89 por mês. Recupere uma venda por mês e ela já se pagou várias vezes. E o mais importante: você passa a enxergar onde o dinheiro entra e onde escapa, sem microgerenciar ninguém.
>
> Fica de pé meu convite: 30 minutos, uma ligação sua, você decide depois com dado na mão. Que dia podemos falar?
>
> {seu_nome}

**Email 5 (dia 10, break-up) — Assunto: fecho o assunto por aqui?**
> {primeiro_nome},
>
> Te escrevi algumas vezes e não quero encher sua caixa de entrada.
>
> Vou entender que agora não é a hora e paro por aqui. Se em algum momento você quiser saber exatamente o que acontece nas ligações da {empresa}, sem depender do que o time conta, é só responder este email, vai ser um prazer falar com você.
>
> Sucesso na operação!
>
> {seu_nome}

---

## 9. Ramais de decisão

### Ramal PABX (telefonia pura, sem apetite de IA)
Sintomas: só quer preço de linha/minuto, reclama de queda, pergunta de ramal e portabilidade, não engaja em "saber o que foi falado", ou operação grande de infraestrutura.

**Não descarta, não força IA, marca PABX pro closer.**
> "Entendi. Pelo que você tá me falando, tua prioridade agora é a telefonia funcionar redonda, estável, com bom custo, mais do que analisar as conversas, é isso? A gente resolve os dois lados. vou te passar para o especialista da área, que vai te mostrar a opção que encaixa no teu momento. Consigo te agendar para amanhã, pode ser?"

No CRM: interesse = PABX, registra o que pediu, passa o bastão.

### Ramal anti-ICP (SAC puro, liga pouco, sem decisor)
Desqualifica com honestidade (a marca preza isso), porta aberta:
> "Vou ser 100% honesto pra te poupar tempo. A Callface é excelente para time que vende ativo por telefone, com bastante ligação por dia, e quer enxergar o que acontece nessas conversas. Pelo que você me contou, a tua operação é mais [receptiva / de WhatsApp / de pouco volume], e a gente provavelmente não seria o melhor investimento pro teu momento. Se isso mudar, me chama que eu te mostro na hora. Pode ser?"

No CRM: desqualificado com motivo.

---

## 10. Objeções (reframe curto) + comprador vs usuário

**Snippets de objeção (chat ou ligação):**
- **"Meu CRM já faz isso"** → O CRM registra o que o vendedor **digita**. A Callface registra o que ele **fala**, e preenche o CRM sozinha.
- **"Já tenho gravação"** → Gravação você ainda tem que **ouvir**. Aqui a ligação chega transcrita, resumida, com nota e próximo passo. Você lê, não escuta.
- **"Meu PABX resolve"** → Ele faz a ligação acontecer, e é bom nisso. Mas não diz se foi boa, não qualifica o lead e não atualiza o CRM.
- **"É caro"** → A partir de R$89 por mês. Quanto vale pra você **uma** venda perdida por follow-up esquecido? Recupera uma no mês e já se pagou.
- **"Meu vendedor não vai usar"** → Ele não precisa fazer nada, é automático. Na real **tira** trabalho (o CRM se preenche sozinho). O placar não é vigilância, é ferramenta dele bater meta.

**Comprador ≠ usuário (mesma verdade, dois ângulos):**
- **Gestor/dono (controle):** *"Você para de decidir no escuro. Vê num painel quem conduz bem e quem precisa de ajuda, sem ouvir gravação nem cobrar relatório. Sai às 18h sabendo onde a venda ganhou e onde perdeu."*
- **Vendedor/operador (facilidade):** *"Do teu lado é de boa: liga pelo navegador, o CRM se preenche sozinho, acaba a chatice de anotar. A nota não é pra te vigiar, é tua ferramenta pra bater meta mais fácil."*

Nunca posicionar o scorecard como Big Brother pro usuário, ou a adoção morre e a conta cancela.

---

## 11. Higiene de CRM (regra, não sugestão)

O gargalo histórico da Callface é lead que se perde porque o SDR não registra. **Todo toque atualiza o CRM.** Antes de passar pro closer, o lead precisa ter:

| Campo | Preenchido com |
|---|---|
| CNPJ | coletado na qualificação |
| Segmento | seguros / crédito / contábil / outro |
| Tamanho do time | nº de pessoas no telefone + Tier (1 ou 2) |
| CRM atual | Agendor / Ploomes / Pipedrive / nenhum |
| Volume de ligações | alto / médio / baixo |
| Gatilho | o que o trouxe (contratou SDR, perdeu venda, time cresceu) |
| Dor principal | qual das dores top pegou |
| Produto sugerido | Callface.ai ou PABX |
| Qualificação | nº de verdes / vermelhos, veredito |
| Próximo passo | reunião agendada (data/hora/closer) ou motivo de desqualificação |

Sem isso, a reunião não conta como SQL e o closer chega no escuro.

---

## 12. Guardrails de tom (checklist antes de mandar)

- [ ] **Sem travessão "—".** Vírgula, ponto ou parágrafo.
- [ ] Sem "rapidão / rapidinho".
- [ ] Sem "IA que vende sozinha" e sem "IA" solta. A IA sempre **faz** algo (transcreve, pontua, preenche o CRM, sugere o próximo passo).
- [ ] Começa pela dor/situação, não pelo produto.
- [ ] Tom consultivo e humano ("a gente te mostra"), não vendedor. Frase curta.
- [ ] Sem "Analisei sua empresa", sem "Tem 15 min?" seco, sem listinha de features jogada no lead.
- [ ] Sem jargão de telecom (PABX, ramal) ao descrever valor de Callface.ai.
- [ ] Lidera por controle. O aha é ver a 1ª ligação transcrita.

---

## 13. Métricas do SDR

| Métrica | Alvo de partida | Por quê |
|---|---|---|
| SLA de 1º toque | < 5 min | Velocidade é o que mais move conversão inbound |
| Tentativas de conexão | 6+ em 3 dias, horários variados | Conexão costuma vir no 6º toque |
| Taxa de conexão | medir baseline | Quantos leads o SDR consegue falar |
| Contato → qualificado (MQL→SQL) | medir baseline, subir | Coração do trabalho |
| Taxa de agendamento | medir baseline | Reuniões cravadas com closer |
| No-show | < 25% | Micro-compromisso (CNPJ+CRM) e lembrete reduzem |
| Higiene de CRM | 100% dos campos §11 | Mata o gargalo histórico |

> A referência de "trial → pago ~20%" e "~85 trials/mês" vem do icp-callface. O trabalho do SDR alimenta esse funil com lead qualificado de verdade, não com curioso.

---

## 14. Cheat sheet de bolso

```
LIDERA POR: controle do que o time fala no telefone. NUNCA a palavra "IA".
AHA: ler a 1ª ligação real transcrita + nota 0-100 na tela dele.
MEU SIM: só o horário da demo. Não fecho, agendo.

5 PERGUNTAS: como liga / decisor? / CNPJ / qual CRM / tamanho do time.
VERDE: liga muito · já perdeu venda no tel · decide · CRM de mercado · vende ativo.
VERMELHO: SAC · liga pouco · WhatsApp/rua · sem decisor · só curioso.
SINAL PABX = marco PABX, passo pro closer (não descarto).
ANTI-ICP = desqualifico honesto, porta aberta.

SPEED: 1º toque < 5 min. 6+ ligações em 3 dias, horário variado.
CRM: todo toque registra. Sem os 10 campos, não é SQL.
TOM: dor primeiro, frase curta, "a gente te mostra". Sem hype, sem travessão.
```

---

## 15. Pendências / o que validar

- **Tensão PABX vs marketing:** este playbook resolve no operacional (lidera Callface.ai, roteia PABX). Vale alinhar com o Filipe se o comercial quer o SDR inbound roteando PABX ou se PABX entra por outra porta.
- **Preços e planos:** confirmar Full R$179,90 / Agente IA R$679 / Lite R$89,90 como vigentes antes de imprimir.
- **VOC real:** as dores e frases vieram do ICP (parte marcada como hipótese). Validar em 2 ligações com cliente de uso pesado (Auvo, DSA) afia as headlines.
- **Ferramenta de cadência:** definir onde a cadência roda (CRM Callface, RD, ou manual) e se dá pra automatizar os toques de email.
- **Próximos entregáveis:** playbook do BDR (outbound) e a apresentação comercial (deck do SDR/closer).

---

## Log

### 2026-07-07
- Playbook de SDR **inbound** construído. Decisões do Scott: SDR = inbound / BDR = outbound; SDR lidera Callface.ai e roteia PABX; construído convocando hormozi-closer (script de ligação, framework CLOSER) + copy-squad (WhatsApp/email no tom da marca).
- Sintetizado por cima de icp-publico, icp-callface, posicionamento (v3) e brand-book. Cadência multicanal de 13 toques em ~14 dias costurando ligação + WhatsApp + email.
- Guardrails de tom aplicados (zero travessão, sem "rapidão", IA sempre concreta, tom consultivo).
- Próximos: playbook BDR (outbound) e apresentação comercial.
</content>
</invoke>
