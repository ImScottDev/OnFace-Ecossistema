/**
 * Parser do `summarization` que a Callface manda no webhook de ligação.
 *
 * Formato observado em produção (não documentado publicamente): markdown com
 * seções marcadas por emoji fixo, ex: "🎯 Interesses:", "🌡️ Urgência: medium",
 * "🔑 Palavras-chave da ligação:". As seções são OPCIONAIS (uma ligação curta
 * pode só ter Urgência + Resumo). O painel nativo da Callface (app.callface.ai)
 * mostra ainda um bloco "Performance da Call" com pontuação por categoria
 * (Estrutura/Descoberta/Objeções/Próximos Passos) — esse dado NÃO vem no
 * webhook (nenhum payload capturado até 22/07/2026 o inclui), então não é
 * parseado nem exibido aqui pra não inventar número que a IA não nos deu.
 *
 * Parsing é por POSIÇÃO dos marcadores no texto (não por linha fixa), então
 * lida bem com seções ausentes/fora de ordem. Campos que não são
 * inequivocamente delimitáveis (interesses, problemas, objeções — prosa
 * livre) ficam como texto corrido, não bullets forçados — evita quebrar
 * frase no meio só pra parecer lista.
 */

export interface ResumoCallfaceParsed {
  objetivo: string | null;
  contatoDetectado: string | null;
  emailDetectado: string | null;
  interesses: string | null;
  problemas: string | null;
  urgencia: "low" | "medium" | "high" | null;
  objecoes: string | null;
  resumoNarrativo: string | null;
  /** só isso é seguro dividir em tags — vem separado por vírgula no texto real */
  palavrasChave: string[];
  /** uma ação por linha no texto real (separador é quebra de linha, não vírgula) */
  proximasAcoes: string[];
}

const MARKERS: Array<{ key: string; re: RegExp }> = [
  { key: "interesses", re: /🎯\s*Interesses:\s*/ },
  { key: "problemas", re: /❌\s*Problemas:\s*/ },
  { key: "urgencia", re: /🌡️\s*Urgência:\s*/ },
  { key: "chance", re: /🤝\s*Chance de Fechar Negócio:\s*/ },
  { key: "objecoes", re: /🚨\s*Objeções:\s*/ },
  { key: "resumo", re: /📝\s*Resumo:\s*/ },
  { key: "palavrasChave", re: /🔑\s*Palavras-chave da ligação:\s*/ },
  { key: "proximasAcoes", re: /✦\s*Próximas Ações:\s*/ },
];

function limpar(s: string): string {
  return s
    .replace(/##[^#]*##/g, "") // headers "## RESUMO DA LIGAÇÃO ##" que caem dentro da fatia
    .trim()
    .replace(/\.+\s*$/, "")
    .trim();
}

function extrairSecoes(texto: string): Record<string, string> {
  const achados = MARKERS.map(({ key, re }) => {
    const m = re.exec(texto);
    return m ? { key, start: m.index, contentStart: m.index + m[0].length } : null;
  })
    .filter((x): x is { key: string; start: number; contentStart: number } => !!x)
    .sort((a, b) => a.start - b.start);

  const out: Record<string, string> = {};
  achados.forEach((m, i) => {
    const fim = i + 1 < achados.length ? achados[i + 1].start : texto.length;
    const bruto = texto.slice(m.contentStart, fim);
    const limpo = limpar(bruto);
    if (limpo) out[m.key] = limpo;
  });
  return out;
}

export function parseResumoCallface(resumo: string | null | undefined): ResumoCallfaceParsed | null {
  if (!resumo || !resumo.trim()) return null;

  const secoes = extrairSecoes(resumo);

  const objetivoMatch = resumo.match(/Objetivo da Ligação:\s*(.+?)(?:\n|$)/);
  const contatoMatch = resumo.match(/👤\s*(.+?)(?:\n|$)/);
  const emailMatch = resumo.match(/📧\s*(.+?)(?:\n|$)/);

  const urgenciaRaw = (secoes.urgencia || "").toLowerCase();
  const urgencia = (["low", "medium", "high"] as const).find((u) => urgenciaRaw.includes(u)) || null;

  const palavrasChave = (secoes.palavrasChave || "")
    .split(",")
    .map((s) => s.trim().replace(/\.$/, ""))
    .filter(Boolean);

  const proximasAcoes = (secoes.proximasAcoes || "")
    .split("\n")
    .map((s) => s.trim().replace(/\.$/, ""))
    .filter(Boolean);

  return {
    objetivo: objetivoMatch?.[1] ? limpar(objetivoMatch[1]) : null,
    contatoDetectado: contatoMatch?.[1] ? limpar(contatoMatch[1]) : null,
    emailDetectado: emailMatch?.[1]?.trim() || null,
    interesses: secoes.interesses || null,
    problemas: secoes.problemas || null,
    urgencia,
    objecoes: secoes.objecoes || null,
    resumoNarrativo: secoes.resumo ? secoes.resumo.replace(/^Callface Resume:\s*/i, "") : null,
    palavrasChave,
    proximasAcoes,
  };
}

export function urgenciaInfo(u: "low" | "medium" | "high" | null): { label: string; color: string } {
  if (u === "high") return { label: "Alta", color: "#ef4444" };
  if (u === "medium") return { label: "Média", color: "#f59e0b" };
  if (u === "low") return { label: "Baixa", color: "rgba(255,255,255,0.35)" };
  return { label: "—", color: "rgba(255,255,255,0.25)" };
}
