/**
 * Ingestão do conhecimento do Agent Studio.
 *
 * Documentos não são instruções do agente: são fontes sujeitas a governança.
 * - Sem execução de HTML/JS e sem ler arquivos do servidor.
 * - URL HTTPS pública, DNS validado e IP FIXADO na conexão TLS (evita rebinding).
 * - Sem redirects automáticos, protocolos alternativos nem tamanho ilimitado.
 * - PDF/DOCX extraídos como texto; os binários não entram no contexto do modelo.
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request } from "node:https";
import { createRequire } from "node:module";
import sanitizeHtml from "sanitize-html";

const requirePkg = createRequire(import.meta.url);
export const LIMITE_ARQUIVO = 6 * 1024 * 1024;
export const LIMITE_TEXTO = 140_000;
const LIMITE_SITE = 1_200_000;

export class FonteRecusada extends Error {
  constructor(message: string) { super(message); this.name = "FonteRecusada"; }
}

const numeroV4 = (ip: string) => ip.split(".").map(Number);
export function ipPublico(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) {
    const [a, b, c] = numeroV4(ip);
    if ([0, 10, 127].includes(a) || a >= 224) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && (b === 168 || b === 0 || b === 88)) return false;
    if (a === 198 && (b === 18 || b === 19)) return false;
    if (a === 198 && b === 51 && c === 100) return false;
    if (a === 203 && b === 0 && c === 113) return false;
    return true;
  }
  if (kind === 6) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return ipPublico(v.slice(7));
    if (v === "::" || v === "::1" || v.startsWith("fe") || v.startsWith("fc") || v.startsWith("fd")) return false;
    if (v.startsWith("2001:db8") || v.startsWith("2001:0db8")) return false;
    if (v.startsWith("ff")) return false;
    return true;
  }
  return false;
}

export function validarUrlFonte(value: string): URL {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new FonteRecusada("Endereço inválido. Informe a URL HTTPS completa do site."); }
  if (url.protocol !== "https:" || url.port || url.username || url.password || !url.hostname || url.hash) {
    throw new FonteRecusada("Use uma URL HTTPS pública, sem porta, credenciais ou fragmentos.");
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (isIP(host) || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new FonteRecusada("Endereços locais e IPs diretos não podem ser importados.");
  }
  return url;
}

function htmlEmTexto(body: string): string {
  const semScripts = body.replace(/<(script|style|noscript|svg|iframe|form)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ");
  const comQuebras = semScripts.replace(/<\/?(p|div|h[1-6]|li|tr|section|article|br|td|th)\b[^>]*>/gi, "\n");
  return sanitizeHtml(comQuebras, { allowedTags: [], allowedAttributes: {} })
    .replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n").trim();
}

export function textoDoDocumento(raw: string, html = false): string {
  const texto = (html ? htmlEmTexto(raw) : raw).replace(/\0/g, "").trim();
  if (!texto || texto.length < 20) throw new FonteRecusada("Não foi encontrado texto suficiente nesta fonte.");
  if (texto.length > LIMITE_TEXTO) throw new FonteRecusada("O texto é muito longo. Divida a fonte em arquivos menores.");
  return texto;
}

export async function extrairArquivo(file: File): Promise<{ conteudo: string; mimeType: string; nome: string }> {
  if (file.size === 0 || file.size > LIMITE_ARQUIVO) throw new FonteRecusada("O arquivo deve ter até 6 MB.");
  const nome = file.name.trim().slice(0, 150);
  const ext = nome.split(".").pop()?.toLowerCase();
  const supported = ["txt", "md", "markdown", "csv", "json", "html", "htm", "pdf", "docx"];
  if (!ext || !supported.includes(ext)) throw new FonteRecusada("Formato não suportado. Use PDF, DOCX, TXT, MD, CSV, JSON ou HTML.");
  const buffer = Buffer.from(await file.arrayBuffer());
  let conteudo: string;
  try {
    if (ext === "pdf") {
      const parser = requirePkg("pdf-parse") as (buf: Buffer, options?: object) => Promise<{ text: string }>;
      conteudo = (await parser(buffer, { max: 70 })).text;
    } else if (ext === "docx") {
      const mammoth = requirePkg("mammoth") as { extractRawText: (v: { buffer: Buffer }) => Promise<{ value: string }> };
      conteudo = (await mammoth.extractRawText({ buffer })).value;
    } else conteudo = buffer.toString("utf8");
  } catch {
    throw new FonteRecusada("Não foi possível extrair o texto. Confira se o documento está íntegro e não exige senha.");
  }
  const mimeType = ext === "pdf" ? "application/pdf" : ext === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : ext === "html" || ext === "htm" ? "text/html" : "text/plain";
  return { conteudo: textoDoDocumento(conteudo, ext === "html" || ext === "htm"), mimeType, nome };
}

/** Uma requisição isolada em que o IP público é selecionado e FIXADO na conexão TLS. */
async function requisitarSite(url: URL): Promise<{ body: string; redirect: string | null }> {
  const ips = (await lookup(url.hostname, { all: true, verbatim: true })).filter((a) => ipPublico(a.address));
  if (!ips.length) throw new FonteRecusada("O domínio não possui endereço público permitido.");
  // Nunca usar DNS implícito depois da validação. Endereço escolhido é preso ao socket TLS.
  const alvo = ips[0];
  return new Promise((resolve, reject) => {
    const req = request({
      hostname: url.hostname, port: 443, path: url.pathname + url.search, method: "GET",
      headers: { "user-agent": "OnFace-Knowledge/1.0", accept: "text/html, text/plain", "accept-encoding": "identity" },
      lookup: (_host, options, cb) => {
        // Node moderno usa autoSelectFamily e solicita vários endereços (all=true).
        // Ambos os formatos retornam apenas o IP público previamente validado.
        if (options.all) cb(null, [{ address: alvo.address, family: alvo.family }]);
        else cb(null, alvo.address, alvo.family);
      },
      timeout: 9000,
    }, (res) => {
      const code = res.statusCode ?? 0;
      if ([301, 302, 303, 307, 308].includes(code)) {
        res.resume();
        resolve({ body: "", redirect: res.headers.location ?? null });
        return;
      }
      const contentType = res.headers["content-type"] ?? "";
      if (code !== 200 || !/^(text\/html|text\/plain|application\/xhtml\+xml)/i.test(contentType)) {
        res.resume(); reject(new FonteRecusada("O site não retornou uma página HTML ou texto pública.")); return;
      }
      const length = Number(res.headers["content-length"] ?? 0);
      if (length > LIMITE_SITE) { res.destroy(); reject(new FonteRecusada("Página acima do limite de 1,2 MB.")); return; }
      let used = 0;
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => {
        used += chunk.length;
        if (used > LIMITE_SITE) { res.destroy(new FonteRecusada("Página acima do limite de 1,2 MB.")); return; }
        chunks.push(chunk);
      });
      res.on("end", () => resolve({ body: Buffer.concat(chunks).toString("utf8"), redirect: null }));
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new FonteRecusada("O site demorou demais para responder.")));
    req.on("error", reject);
    req.end();
  });
}

export async function importarSite(input: string): Promise<{ urlFinal: string; conteudo: string }> {
  let url = validarUrlFonte(input);
  const vistos = new Set<string>();
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    if (vistos.has(url.href)) throw new FonteRecusada("Redirecionamentos em ciclo.");
    vistos.add(url.href);
    const resp = await requisitarSite(url);
    if (resp.redirect === null) return { urlFinal: url.href, conteudo: textoDoDocumento(resp.body, true) };
    url = validarUrlFonte(new URL(resp.redirect, url).href);
  }
  throw new FonteRecusada("O site excedeu o limite de redirecionamentos.");
}
