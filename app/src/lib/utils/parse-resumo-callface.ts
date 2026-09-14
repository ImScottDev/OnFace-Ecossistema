/**
 * Parser do `summarization` que a Callface manda no webhook de ligação.
 *
 * Formato observado em produção (não documentado publicamente): markdown com
 * seções marcadas por emoji fixo, ex: "🎯 Interesses:", "🌡️ Urgência: medium",
 * "🔑 Palavras-chave da ligação:". As seções são OPCIONAIS (uma ligação curta
 * pode só ter Urgência + Resumo). O painel nativo da Callface (app.callface.ai)
 * mostra ainda um bloco "Performance da Call" com pontuação por categoria
 * (Estrutura/Descoberta/Objeções/Próximos Passos) — esse dado NÃO vem no
 * webhook (11 de 2.752 resumos citam "performance", nenhum com a pontuação
 * estruturada), então não é parseado nem exibido aqui pra não inventar número
 * que a IA não nos deu. A "Chance de Fechar Negócio", essa sim, vem — e desde
 * 09/09/2026 é devolvida em `chanceFechamento` em vez de ser descartada.
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
  /**
   * "🤝 Chance de Fechar Negócio: 40%." — probabilidade que a IA atribui ao
   * fechamento, 0 a 100. O marcador já era recortado do texto e depois
   * DESCARTADO: 348 das 2.752 ligações com resumo traziam o número e nenhuma
   * tela do CRM o mostrava (achado de 09/09/2026).
   */
  chanceFechamento: number | null;
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

  // Só aceita 0-100: se a IA mudar o formato, é melhor não mostrar nada do
  // que mostrar um número que não é probabilidade.
  const chanceMatch = (secoes.chance || "").match(/(\d{1,3})\s*%/);
  const chanceBruta = chanceMatch ? Number(chanceMatch[1]) : null;
  const chanceFechamento = chanceBruta != null && chanceBruta >= 0 && chanceBruta <= 100 ? chanceBruta : null;

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
    chanceFechamento,
    objecoes: secoes.objecoes || null,
    resumoNarrativo: secoes.resumo ? secoes.resumo.replace(/^Callface Resume:\s*/i, "") : null,
    palavrasChave,
    proximasAcoes,
  };
}

/**
 * Cor do rótulo de urgência. Os valores eram do tema escuro do CRM 1: "Baixa"
 * saía em `rgba(255,255,255,0.35)` — branco translúcido, literalmente
 * invisível no card claro do Atendimento — e "Alta"/"Média" usavam vermelho e
 * âmbar puros, que como TEXTO dão 3.8:1 e 2.2:1. Agora usa os tokens
 * semânticos, que já passam no contraste mínimo.
 */
export function urgenciaInfo(u: "low" | "medium" | "high" | null): { label: string; color: string } {
  if (u === "high") return { label: "Alta", color: "var(--cf2-danger-text)" };
  if (u === "medium") return { label: "Média", color: "var(--cf2-warning-text)" };
  if (u === "low") return { label: "Baixa", color: "var(--cf2-text-secondary)" };
  return { label: "—", color: "var(--cf2-text-tertiary)" };
}
