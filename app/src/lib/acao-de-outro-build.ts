/**
 * O erro de quem estava com a página aberta quando saiu um deploy.
 *
 * O Next assina cada Server Action com um hash do build. Quem clica num botão
 * de um build anterior recebe um erro cujo texto varia conforme a versão e o
 * lado (servidor ou cliente) — e em todas elas o significado é o mesmo: a ação
 * não existe mais, NADA foi gravado, e recarregar resolve.
 *
 * Fonte única das três formas conhecidas, porque quem precisa reconhecê-las
 * são dois: o aviso global (`AvisoVersaoNova`, para o erro que sobe sozinho) e
 * o envio da proposta (que captura o erro e nunca chegava ao aviso).
 *
 * A terceira forma — "was not found on the server" — veio da tela em 15/10/2026,
 * no envio de uma proposta, com o detector cego para ela.
 */
export function ehAcaoDeOutroBuild(motivo: unknown): boolean {
  const texto =
    motivo instanceof Error ? `${motivo.name}: ${motivo.message}` : String(motivo ?? "");
  return /Failed to find Server Action/i.test(texto)
    || /from an older or newer deployment/i.test(texto)
    || /Server Action .*(was not found|not found on the server)/i.test(texto);
}
