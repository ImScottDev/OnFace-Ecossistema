/**
 * De quem é a ligação que o agente de IA fez.
 *
 * Quando alguém disca pela Callface, o payload traz `user_email` e o dono é
 * óbvio. Quando quem liga é o **agente**, esse campo vem vazio — e o resultado
 * (atividade, próximo passo, reunião agendada) caía no rodízio de closers. Na
 * prática: a closer exportava a carteira dela, mandava o agente ligar, e o
 * trabalho voltava repartido entre outras pessoas.
 *
 * Medido em produção em 15/10/2026: 432 ligações de 7 dias sem `user_email`,
 * **226 delas com `agent_name = "Agente Mayra"`** — o nome do agente diz de
 * quem é a campanha, e ninguém lia.
 *
 * O casamento é por TOKEN EXATO, nunca por prefixo: a operação tem "Mayra
 * Schincariol" e "Mayara Anjos" ao mesmo tempo, e `startsWith` daria a ligação
 * de uma para a outra. Nome que casa com duas pessoas não casa com nenhuma —
 * errar o dono é pior do que cair no rodízio, porque ninguém percebe.
 */

/** Palavras que nomeiam o robô, não a pessoa. */
const GENERICAS = new Set([
  "agente", "agent", "assistente", "assistant", "ia", "ai", "bot", "robo", "robô",
  "de", "da", "do", "das", "dos", "e", "vendas", "venda", "comercial", "sdr", "closer",
  "callface", "call", "face", "atendimento", "pre", "pré", "prospeccao", "prospecção",
]);

function tokens(nome: string): string[] {
  return nome
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
}

/** Só o que sobra depois de tirar as palavras do robô. */
export function nomeDaPessoaNoAgente(agentName: string | null | undefined): string[] {
  if (!agentName) return [];
  return tokens(agentName).filter((t) => !GENERICAS.has(t));
}

/**
 * O usuário dono do agente, ou null quando não dá para ter certeza.
 *
 * Devolve null de propósito quando o nome casa com mais de uma pessoa — é o
 * caso de "Agente Mayra" numa equipe que tivesse duas Mayras.
 */
export function donoDoAgente(
  agentName: string | null | undefined,
  usuarios: Array<{ id: string; nome: string }>,
): string | null {
  const procurados = nomeDaPessoaNoAgente(agentName);
  if (!procurados.length) return null;

  const candidatos = usuarios.filter((u) => {
    const meus = new Set(tokens(u.nome));
    // Todo token que sobrou tem de existir no nome da pessoa, inteiro.
    return procurados.every((p) => meus.has(p));
  });

  return candidatos.length === 1 ? candidatos[0].id : null;
}
