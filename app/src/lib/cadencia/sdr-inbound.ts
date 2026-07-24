// ─────────────────────────────────────────────────────────────────────────────
// Cadência SDR Inbound — Callface.ai
// Conteúdo literal do playbook (vault: callface/playbook-sdr.md §6, §7, §8, §14).
// Os 13 toques da régua inbound (ligação + WhatsApp + email) em ~14 dias.
//
// Placeholders resolvidos server-side na rota: {primeiro_nome} {empresa} {seu_nome}.
// O SDR ajusta o texto (editável) antes de enviar.
// ─────────────────────────────────────────────────────────────────────────────

export type CadenciaCanal = "whatsapp" | "email" | "ligacao";

export interface CadenciaToque {
  ordem: number;
  canal: CadenciaCanal;
  dia: string;
  rotulo: string;
  assunto?: string; // só email
  conteudo: string;
}

// Script da ligação. Usado nos toques de ligação (ordem 1, 5, 8).
// Roteiro simples pro SDR ler durante a call.
const SCRIPT_LIGACAO = `ABERTURA
"Oi, é o {primeiro_nome}? Aqui é o {seu_nome}, da Callface. Você deixou seu contato pra saber mais sobre a Callface, lembra? Peguei aqui na hora pra não te deixar esperando. Você tem uns 5 minutinhos agora?"

Se ele puder falar:
"Fechou. Antes de eu te explicar qualquer coisa, quero entender teu cenário, porque a Callface serve muito pra um tipo de operação e nada pra outro. Assim eu já te falo com sinceridade se faz sentido pra você. Pode ser?"

DESCOBERTA (pergunte com calma, uma de cada vez)
1. O que fez você se interessar pela Callface? Tem algo incomodando na operação de vendas hoje?
2. Como o time liga hoje, é pelo celular, algum sistema? E quantas ligações por dia, mais ou menos?
3. Quando um vendedor desliga o telefone, você consegue saber o que ele falou e o que prometeu, ou fica na palavra dele?
4. Já aconteceu de perder uma venda e não saber por quê?
5. Quantas pessoas ficam no telefone vendendo aí? Você vende junto ou só gerencia?
6. Onde vocês registram os contatos hoje, usam algum CRM (Agendor, Pipedrive, Ploomes) ou é mais no manual?
7. Uma decisão dessas passa por você ou tem mais alguém junto?

TRANSIÇÃO
"Pelo que você me falou, faz sentido a gente conversar direito. Eu não quero te vender no telefone, quero te mostrar. Numa conversa de uns 30 minutos, a gente pega uma ligação real do seu time e, na sua frente, ela vira texto, com resumo, uma nota de 0 a 100 e o próximo passo. Você vê pela primeira vez o que acontece dentro das suas ligações."

AGENDAMENTO
"Tenho a agenda amanhã de manhã e quinta no fim da tarde. O que encaixa melhor pra você?"
Feche o horário e peça o CNPJ e o nome do CRM, pra já deixar o acesso preparado.

CONFIRMAÇÃO
"Fechou, [dia] às [hora]. Vou te mandar o convite no WhatsApp e no email. Me confirma quando receber?"`;

export const CADENCIA_SDR_INBOUND: CadenciaToque[] = [
  // ── Toque 1 — Ligação 1 (imediata) ─────────────────────────────────────────
  {
    ordem: 1,
    canal: "ligacao",
    dia: "0 a 5 min",
    rotulo: "Ligação · 1ª tentativa",
    conteudo: SCRIPT_LIGACAO,
  },
  // ── Toque 2 — WhatsApp 1 (primeiro contato) — §7 Msg 1 ──────────────────────
  {
    ordem: 2,
    canal: "whatsapp",
    dia: "0 a 5 min",
    rotulo: "WhatsApp · Primeiro contato",
    conteudo: `Oi {primeiro_nome}, aqui é o {seu_nome}, da Callface.

Vi que você se interessou pela Callface e deixou seu contato pra saber mais. Antes de falar sobre nossas soluções, me conta uma coisa: hoje você consegue saber o que cada vendedor da {empresa} fala nas ligações, ou isso fica meio no escuro?`,
  },
  // ── Toque 3 — WhatsApp FU1 (reforço da dor) — §7 Follow-up 1 ────────────────
  {
    ordem: 3,
    canal: "whatsapp",
    dia: "+3h",
    rotulo: "WhatsApp · Follow-up 1",
    conteudo: `Oii {primeiro_nome}, tudo bem?

A pergunta que quase todo gestor já se fez é:
*meu vendedor diz que ligou, mas será que ligou, e será que falou certo?*.

Se isso já passou pela sua cabeça, é exatamente o que a gente resolve. Faz sentido a gente falar como podemos te ajudar?`,
  },
  // ── Toque 4 — Email 1 (dor) — §8 Email 1 ────────────────────────────────────
  {
    ordem: 4,
    canal: "email",
    dia: "Fim do dia 0",
    rotulo: "Email · Apresentação",
    assunto: "o que seu time fala nas ligações",
    conteudo: `Oi {primeiro_nome},

Aqui é o {seu_nome}, da Callface. Vi que você se interessou pela Callface e deixou seu contato, então vou direto ao ponto.

A maioria dos gestores com quem falo sabe quanto gasta em anúncio e quantos leads entram, mas não sabe o que o vendedor realmente fala quando o telefone toca. A ligação acontece, e o conhecimento evapora.

A Callface transcreve cada ligação, dá uma nota de 0 a 100 para o atendimento e joga o resumo no seu CRM sozinha. Você para de depender do que o vendedor conta.

Vale 30 minutos pra eu te mostrar com uma ligação real da {empresa}?

{seu_nome}`,
  },
  // ── Toque 5 — Ligação 2 (2ª tentativa) — §6 (mesmo script) ──────────────────
  {
    ordem: 5,
    canal: "ligacao",
    dia: "Dia 1, manhã",
    rotulo: "Ligação · 2ª tentativa",
    conteudo: SCRIPT_LIGACAO,
  },
  // ── Toque 6 — WhatsApp FU2 (o aha) — §7 Follow-up 2 ─────────────────────────
  {
    ordem: 6,
    canal: "whatsapp",
    dia: "Dia 1, tarde",
    rotulo: "WhatsApp · Follow-up 2",
    conteudo: `{primeiro_nome}, vi que não teve tempo para me responder, mas tive uma ideia pra te mostrar na prática como a gente pode te ajudar!

A gente pega uma ligação real da sua operação, transcreve, resume e dá uma nota de 0 a 100 para atendimento. Você lê em 30 segundos o que levaria meia hora de gravação pra entender. É a forma mais rápida de você ver se nossa solução serve pra {empresa}.

Faz sentido eu disponibilizar um teste de 7 dias para você na nossa plataforma?`,
  },
  // ── Toque 7 — Email 2 (prova) — §8 Email 2 ──────────────────────────────────
  {
    ordem: 7,
    canal: "email",
    dia: "Dia 2",
    rotulo: "Email · Prova social",
    assunto: "meia hora de gravação em 30 segundos",
    conteudo: `{primeiro_nome},

Um exemplo do que a ferramenta faz na prática.

Corretoras e escritórios que ligam o dia inteiro tinham o mesmo problema: pra saber se uma venda foi bem trabalhada, alguém precisava ouvir a gravação inteira. Ninguém tinha tempo, então ninguém ouvia.

Com a Callface, a ligação chega pronta: transcrita, resumida, com nota e com o próximo passo já virando uma tarefa. O que levava meia hora de áudio você lê em 30 segundos.

Posso te mostrar isso com uma call sua. Você me diz um horário e eu preparo.

{seu_nome}`,
  },
  // ── Toque 8 — Ligação 3 (3ª tentativa) — §6 (mesmo script) ──────────────────
  {
    ordem: 8,
    canal: "ligacao",
    dia: "Dia 3, tarde",
    rotulo: "Ligação · 3ª tentativa",
    conteudo: SCRIPT_LIGACAO,
  },
  // ── Toque 9 — WhatsApp FU3 (facilidade) — §7 Follow-up 3 ────────────────────
  {
    ordem: 9,
    canal: "whatsapp",
    dia: "Dia 3",
    rotulo: "WhatsApp · Follow-up 3",
    conteudo: `{primeiro_nome}, imagino que a rotina tá corrida aí.

Só para te contextualizar, a Callface não tem instalação, roda no navegador e o CRM que você já usa se atualiza sozinho no fim da ligação. Dá pra ver funcionando em 15min, sem compromisso. Como está sua agenda para marcarmos uma reunião?`,
  },
  // ── Toque 10 — Email 3 (objeção) — §8 Email 3 ───────────────────────────────
  {
    ordem: 10,
    canal: "email",
    dia: "Dia 5",
    rotulo: "Email · Quebra de objeção",
    assunto: '"meu CRM já faz isso"',
    conteudo: `{primeiro_nome},

Toda vez que falo de Callface, ouço uma dessas três: "meu CRM já faz", "já tenho gravação" ou "meu PABX resolve". Justo. Vou ser honesto com cada uma.

O CRM registra o que o vendedor digita. A Callface registra o que ele fala, e preenche o CRM sozinha.

A gravação você ainda tem que ouvir. Aqui já vem transcrita, com resumo, nota e próximo passo.

O PABX faz a ligação acontecer. Ele não te diz se foi boa, não qualifica o lead e não atualiza nada depois.

Se alguma dessas é a sua dúvida, é exatamente o que eu queria te mostrar numa call de 30 minutos, com uma ligação real da {empresa}.

{seu_nome}`,
  },
  // ── Toque 11 — WhatsApp FU4 (última chamada) — §7 Follow-up 4 ───────────────
  {
    ordem: 11,
    canal: "whatsapp",
    dia: "Dia 7",
    rotulo: "WhatsApp · Follow-up 4",
    conteudo: `{primeiro_nome}, vou parar de te chamar pra não ficar chato.

Se agora não é a hora, tá tudo certo!
Se ainda faz sentido entender o que acontece nas ligações da {empresa} e ter um copiloto durante todo seu processo comercial, sem depender do que o vendedor conta, me responde aqui que podemos falar um pouquinho mais sobre isso!
Deixo a porta aberta aqui pra você!😉`,
  },
  // ── Toque 12 — Email 4 (ROI) — §8 Email 4 ───────────────────────────────────
  {
    ordem: 12,
    canal: "email",
    dia: "Dia 7",
    rotulo: "Email · ROI",
    assunto: "uma venda recuperada",
    conteudo: `{primeiro_nome},

Uma conta simples pra fechar o raciocínio.

Quanto vale pra {empresa} uma única venda que hoje se perde porque o follow-up foi esquecido, ou porque ninguém percebeu que a ligação foi mal conduzida?

A Callface custa a partir de R$89 por mês. Recupere uma venda por mês e ela já se pagou várias vezes. E o mais importante: você passa a enxergar onde o dinheiro entra e onde escapa, sem microgerenciar ninguém.

Fica de pé meu convite: 30 minutos, uma ligação sua, você decide depois com dado na mão. Que dia podemos falar?

{seu_nome}`,
  },
  // ── Toque 13 — Email 5 (break-up) — §8 Email 5 ──────────────────────────────
  {
    ordem: 13,
    canal: "email",
    dia: "Dia 10",
    rotulo: "Email · Encerramento",
    assunto: "fecho o assunto por aqui?",
    conteudo: `{primeiro_nome},

Te escrevi algumas vezes e não quero encher sua caixa de entrada.

Vou entender que agora não é a hora e paro por aqui. Se em algum momento você quiser saber exatamente o que acontece nas ligações da {empresa}, sem depender do que o time conta, é só responder este email, vai ser um prazer falar com você.

Sucesso na operação!

{seu_nome}`,
  },
];

/** Resolve placeholders do lado do servidor. Deixa {origem_do_lead}, {segmento},
 *  {link_agenda}, {data_hora} intactos pro SDR preencher antes de enviar. */
export function resolveCadenciaPlaceholders(
  texto: string,
  vars: { primeiroNome: string; empresa: string; seuNome: string },
): string {
  return texto
    .replace(/\{primeiro_nome\}/g, vars.primeiroNome)
    .replace(/\{empresa\}/g, vars.empresa)
    .replace(/\{seu_nome\}/g, vars.seuNome);
}

export function getToque(ordem: number): CadenciaToque | undefined {
  return CADENCIA_SDR_INBOUND.find((t) => t.ordem === ordem);
}
