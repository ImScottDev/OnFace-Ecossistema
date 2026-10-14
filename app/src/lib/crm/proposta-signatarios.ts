/**
 * Signatários da proposta: a fonte é o que o vendedor informa no passo
 * "Contrato e pagamento". Módulo puro (sem banco): a tela, o envio e o
 * provedor de assinatura leem as mesmas regras.
 *
 * Papéis: o cliente é `contratante`; a Callface tem três lugares no documento.
 */
export const PAPEL_CLIENTE = "contratante";
export const PAPEL_TESTEMUNHA_VENDEDOR = "testemunha_vendedor";
export const PAPEL_REPRESENTANTE = "representante_legal";
export const PAPEL_TESTEMUNHA_2 = "testemunha_2";

export const PAPEIS_CALLFACE = [PAPEL_TESTEMUNHA_VENDEDOR, PAPEL_REPRESENTANTE, PAPEL_TESTEMUNHA_2] as const;

/** Âncora do bloco de assinatura de cada papel Callface no PDF do contrato. */
export const ANCORA_DO_PAPEL: Record<string, string> = {
  [PAPEL_REPRESENTANTE]: "cf-sig-contratada",
  [PAPEL_TESTEMUNHA_VENDEDOR]: "cf-sig-testemunha-1",
  [PAPEL_TESTEMUNHA_2]: "cf-sig-testemunha-2",
};

export interface Signatario {
  nome: string;
  email: string;
  papel?: string | null;
  ordem?: number | null;
  cargo?: string | null;
  cpf?: string | null;
  signingUrl?: string | null;
  [k: string]: unknown;
}

/** Texto de exemplo do campo: nunca é um e-mail de verdade. */
const PLACEHOLDER = /^email@callface\.ai$/i;

export function emailValido(valor: unknown): boolean {
  const e = String(valor ?? "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && !PLACEHOLDER.test(e);
}

export function ehPapelCallface(papel: unknown): boolean {
  return (PAPEIS_CALLFACE as readonly string[]).includes(String(papel ?? ""));
}

/** Quem assina pelo cliente: tudo que não é papel Callface nem observador. */
export function ehCliente(s: Pick<Signatario, "papel">): boolean {
  const p = String(s.papel ?? "").toLowerCase();
  return !ehPapelCallface(p) && !["cc", "viewer", "observador"].includes(p);
}

/**
 * Limpa a lista que chega da tela. O e-mail vazio ou de exemplo vira "" (nunca
 * um valor inventado); o cliente sem nome sai. A Callface mantém o nome mesmo
 * sem e-mail: a testemunha impressa no contrato não precisa assinar no sistema.
 * Ordem: cliente primeiro, depois representante, depois testemunhas.
 */
export function normalizarSignatarios(lista: unknown): Signatario[] {
  if (!Array.isArray(lista)) return [];
  const limpos: Signatario[] = [];
  for (const bruto of lista) {
    if (!bruto || typeof bruto !== "object") continue;
    const r = bruto as Record<string, unknown>;
    const nome = String(r.nome ?? r.name ?? "").trim();
    const mail = String(r.email ?? "").trim();
    const papel = String(r.papel ?? PAPEL_CLIENTE).trim() || PAPEL_CLIENTE;
    if (!nome) continue;
    const s: Signatario = { ...r, nome, email: emailValido(mail) ? mail : "", papel };
    if (!ehPapelCallface(papel) && !s.email) continue;
    limpos.push(s);
  }
  const rank = (s: Signatario) => ehCliente(s) ? 0 : ({ [PAPEL_REPRESENTANTE]: 1, [PAPEL_TESTEMUNHA_VENDEDOR]: 2, [PAPEL_TESTEMUNHA_2]: 3 }[String(s.papel)] ?? 4);
  // Uma pessoa = uma assinatura. O mesmo e-mail em dois papéis (cliente e representante/testemunha, ou duas
  // testemunhas) fazia o Documenso mostrar DOIS campos ao mesmo destinatário: "assinando como duas pessoas".
  // Vale o papel de maior peso (cliente > representante > testemunhas); nos demais, a Callface mantém o nome
  // impresso no contrato sem e-mail (não assina no sistema) e o cliente repetido some.
  const vistos = new Set<string>();
  return limpos
    .map((s, i) => ({ s, i }))
    .sort((a, b) => rank(a.s) - rank(b.s) || a.i - b.i)
    .flatMap(({ s }) => {
      const chave = s.email.toLowerCase();
      if (!chave) return [s];
      if (!vistos.has(chave)) { vistos.add(chave); return [s]; }
      return ehPapelCallface(s.papel) ? [{ ...s, email: "" }] : [];
    })
    .map((s, i) => ({ ...s, ordem: i + 1 }));
}

/** Quem pode assinar pela Callface, cadastrado em Ajustes > Contratos. A ordem do array é a ordem de oferta; o primeiro de cada papel é o padrão dele. */
export interface SignatarioCallface { nome: string; email: string; papel: string }

/** Limpa a lista vinda da tela/banco: nome obrigatório, papel Callface (senão representante), e-mail válido ou vazio, sem duplicata nome+papel. */
export function normalizarSignatariosCallface(lista: unknown): SignatarioCallface[] {
  if (!Array.isArray(lista)) return [];
  const vistos = new Set<string>();
  const saida: SignatarioCallface[] = [];
  for (const b of lista) {
    if (!b || typeof b !== "object") continue;
    const r = b as Record<string, unknown>;
    const nome = String(r.nome ?? "").trim();
    if (!nome) continue;
    const papel = ehPapelCallface(r.papel) ? String(r.papel) : PAPEL_REPRESENTANTE;
    const email = String(r.email ?? "").trim();
    const chave = `${papel}|${nome.toLowerCase()}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    saida.push({ nome, email: emailValido(email) ? email : "", papel });
  }
  return saida;
}

/** O padrão do papel: o primeiro da lista. Para o representante, só vale com e-mail (é o que `comPadraoDaPolitica` exige). */
export function padraoDoPapel(lista: SignatarioCallface[], papel: string): SignatarioCallface | null {
  return lista.find((s) => s.papel === papel && (papel !== PAPEL_REPRESENTANTE || s.email)) ?? null;
}

/**
 * Parâmetros de Ajustes > Contratos viram só o valor PADRÃO: valem quando a
 * proposta não trouxe um representante legal com e-mail. Nome e e-mail do
 * padrão entram juntos, para não misturar uma pessoa com o e-mail de outra.
 */
export function comPadraoDaPolitica(
  lista: Signatario[],
  padrao: { representanteNome?: string | null; representanteEmail?: string | null } | null | undefined,
): Signatario[] {
  const rep = lista.find((s) => s.papel === PAPEL_REPRESENTANTE);
  if (rep && emailValido(rep.email)) return lista;
  const nome = padrao?.representanteNome?.trim();
  const email = padrao?.representanteEmail?.trim();
  if (!nome || !email || !emailValido(email)) return lista;
  const entrada: Signatario = { nome, email, papel: PAPEL_REPRESENTANTE };
  return normalizarSignatarios([...lista.filter((s) => s.papel !== PAPEL_REPRESENTANTE), entrada]);
}

/** Mensagem quando falta o e-mail do representante legal; null quando está tudo certo. */
export function faltaRepresentante(lista: Signatario[]): string | null {
  const rep = lista.find((s) => s.papel === PAPEL_REPRESENTANTE);
  if (rep && emailValido(rep.email)) return null;
  // Caso que confunde: o representante existe e tem nome, mas o e-mail foi esvaziado
  // porque é o MESMO do cliente — uma pessoa não assina pelos dois lados. Dizer só
  // "falta o e-mail" manda a pessoa preencher de novo o que acabou de ser recusado.
  if (rep && !rep.email && lista.some((s) => ehCliente(s) && s.email)) {
    return `O representante legal (${rep.nome}) está com o mesmo e-mail do cliente, e uma pessoa não pode assinar pelos dois lados. Use um e-mail da Callface para quem assina por nós — em Ajustes > Contratos ou na própria proposta.`;
  }
  return "Falta o e-mail do representante legal da Callface. Informe-o na proposta (Contrato e pagamento, \"Assinam pela Callface\") ou cadastre o padrão em Ajustes > Contratos.";
}

/** Reconstrói os campos do editor a partir dos signatários gravados (fonte de verdade). */
export function editorDeSignatarios(lista: unknown): { sigs?: Array<{ nome: string; email: string }>; sigCf?: Record<string, { nome: string; email: string }>; testemunhas?: boolean } {
  const todos = normalizarSignatarios(lista);
  const sigs = todos.filter(ehCliente).map((s) => ({ nome: s.nome, email: s.email }));
  const chave: Record<string, string> = { [PAPEL_TESTEMUNHA_VENDEDOR]: "vend", [PAPEL_REPRESENTANTE]: "rep", [PAPEL_TESTEMUNHA_2]: "test2" };
  const sigCf: Record<string, { nome: string; email: string }> = {};
  for (const s of todos) if (chave[String(s.papel)]) sigCf[chave[String(s.papel)]] = { nome: s.nome, email: s.email };
  return { ...(sigs.length ? { sigs } : {}), sigCf, testemunhas: !!sigCf.test2 };
}

/* ── Endereço: o modal tem UM campo "Rua, número e complemento" ───────────── */

export function juntarEndereco(e: { logradouro?: string | null; numero?: string | null; complemento?: string | null }): string {
  return [e.logradouro, e.numero, e.complemento].map((x) => String(x ?? "").trim()).filter(Boolean).join(", ");
}

/** "Rua X, 123, Sala 4" -> {logradouro, numero, complemento}. Sem número reconhecível, o número fica vazio (o envio cobra). */
export function separarEndereco(texto: string): { logradouro: string; numero: string; complemento: string } {
  const t = String(texto ?? "").trim();
  const m = t.match(/^(.*?)[\s,]+(?:n[ºo°.]?\s*)?(\d+[A-Za-z]?|s\/?n)\s*(?:[,\-–]\s*(.*))?$/i);
  if (!m || !m[1].trim()) return { logradouro: t, numero: "", complemento: "" };
  return { logradouro: m[1].trim().replace(/[,\-–]\s*$/, ""), numero: m[2].trim(), complemento: (m[3] ?? "").trim() };
}
