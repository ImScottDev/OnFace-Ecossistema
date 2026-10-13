/**
 * Importação de site para a base governada.
 * SSRF: resolução pública comprovada e IP fixado no socket (não só validado
 * antes de fetch), sem portas arbitrárias, credenciais ou redirects automáticos.
 * Apenas conteúdo textual público, com limite de bytes e tempo.
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import * as http from "node:http";
import * as https from "node:https";

export const LIMITE_CONHECIMENTO_CARACTERES = 200_000;
const MAX_BYTES = 1_000_000;
const TIMEOUT_MS = 9_000;

function ipPrivado(address: string): boolean {
  if (address.includes(":")) {
    const v = address.toLowerCase();
    if (v.startsWith("::ffff:")) return ipPrivado(v.slice(7));
    return v === "::" || v === "::1" || v.startsWith("fc") || v.startsWith("fd") ||
      /^fe[89ab]/.test(v) || v.startsWith("ff") || v.startsWith("2001:db8:") ||
      v.startsWith("2001:0:") || v.startsWith("64:ff9b:");
  }
  const o = address.split(".").map(Number);
  if (o.length !== 4 || o.some((v) => !Number.isInteger(v) || v < 0 || v > 255)) return true;
  const [a, b, c] = o;
  return a === 0 || a === 10 || a === 127 || a >= 224 || a === 169 && b === 254 ||
    a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 ||
    a === 100 && b >= 64 && b <= 127 || a === 192 && b === 0 ||
    a === 192 && b === 0 && c === 2 || a === 198 && b >= 18 && b <= 19 ||
    a === 198 && b === 51 && c === 100 || a === 203 && b === 0 && c === 113;
}

export function validarUrlDeConhecimento(raw: string): URL {
  let url: URL;
  try { url = new URL(raw.trim()); } catch { throw new Error("Informe a URL completa de um site público."); }
  if (!["https:", "http:"].includes(url.protocol) || !url.hostname || url.username || url.password ||
      (url.port && !["80", "443"].includes(url.port))) {
    throw new Error("Somente URLs HTTP/HTTPS públicas, sem credenciais nem portas especiais.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
      host.endsWith(".internal") || host.endsWith(".test") || isIP(host) && ipPrivado(host)) {
    throw new Error("Endereço interno ou privado não pode ser importado.");
  }
  url.hash = "";
  return url;
}

function textoHtml(raw: string): string {
  const t = raw.replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|iframe|form|nav|footer|header)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(?:p|div|h[1-6]|li|section|article|tr|br)>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:nbsp|ensp|emsp);/gi, " ")
    .replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Math.min(0x10ffff, Number(n))))
    .replace(/[ \t]{2,}/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();
  return t.slice(0, LIMITE_CONHECIMENTO_CARACTERES);
}

async function lerHttp(url: URL, ip: string, family: number): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const cliente = url.protocol === "https:" ? https : http;
    const req = cliente.request(url, {
      method: "GET",
      lookup: (_host, _options, cb) => cb(null, ip, family),
      headers: { Accept: "text/html, text/plain;q=0.9", "Accept-Encoding": "identity", "User-Agent": "OnFaceKnowledgeImporter/1.0" },
      timeout: TIMEOUT_MS, agent: false,
    }, (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400) {
        res.resume();
        resolve({ status, headers: res.headers, body: "" });
        return;
      }
      if (status !== 200) { res.resume(); reject(new Error("O site respondeu HTTP " + status)); return; }
      const tipo = String(res.headers["content-type"] ?? "").toLowerCase();
      const encoding = String(res.headers["content-encoding"] ?? "identity");
      if (encoding !== "identity") { res.resume(); reject(new Error("Página compactada não é suportada nesta importação.")); return; }
      if (!tipo.startsWith("text/html") && !tipo.startsWith("text/plain")) {
        res.resume(); reject(new Error("Este endereço não contém uma página de texto HTML ou TXT.")); return;
      }
      const chunks: Buffer[] = [];
      let total = 0;
      res.on("data", (chunk: Buffer) => {
        total += chunk.length;
        if (total > MAX_BYTES) { req.destroy(new Error("Página excede o limite de 1 MB.")); return; }
        chunks.push(chunk);
      });
      res.on("error", reject);
      res.on("end", () => resolve({ status, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("timeout", () => req.destroy(new Error("O site demorou demais para responder.")));
    req.on("error", reject);
    req.end();
  });
}

export async function importarSitePublico(rawUrl: string): Promise<{ url: string; texto: string }> {
  let url = validarUrlDeConhecimento(rawUrl);
  const visitados = new Set<string>();
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    if (visitados.has(url.href)) throw new Error("Redirecionamento circular.");
    visitados.add(url.href);
    const host = url.hostname.replace(/^\[|\]$/g, "");
    const ips = isIP(host) ? [{ address: host, family: isIP(host) }] : await lookup(host, { all: true, verbatim: true });
    if (!ips.length || ips.some((r) => ipPrivado(r.address))) throw new Error("O site resolve para uma rede privada ou inválida.");
    const result = await lerHttp(url, ips[0].address, ips[0].family);
    if (result.status >= 300 && result.status < 400) {
      const local = result.headers.location;
      if (!local) throw new Error("Redirecionamento sem destino.");
      url = validarUrlDeConhecimento(new URL(local, url).href);
      continue;
    }
    const contentType = String(result.headers["content-type"] ?? "").toLowerCase();
    const texto = contentType.startsWith("text/html") ? textoHtml(result.body) : result.body.trim().slice(0, LIMITE_CONHECIMENTO_CARACTERES);
    if (texto.length < 30) throw new Error("Página sem texto suficiente para indexação.");
    return { url: url.href, texto };
  }
  throw new Error("O site redirecionou vezes demais.");
}
