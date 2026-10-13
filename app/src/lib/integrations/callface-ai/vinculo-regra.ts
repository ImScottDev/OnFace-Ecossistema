/**
 * A regra de vínculo empresa ONFACE <-> organization do Callface AI.
 * Função PURA (sem banco), para ser testável e auditável.
 *
 * LIGA SOZINHO (estado `auto`) só com evidência forte e inequívoca:
 *   - cnpj .............. CNPJ (14 dígitos) igual
 *   - stripe_customer_id  o mesmo customer Stripe
 *   - email_dono ........ e-mail de contato da empresa igual ao e-mail do dono
 *                         (usuário CREATOR) ou ao e-mail cadastral da organização
 * e SÓ quando é 1:1: o valor aponta para UMA organização, e UMA empresa o tem.
 * Sinais que apontam para organizações diferentes, ou organização disputada por
 * duas empresas, NÃO ligam: viram pendência com a razão.
 *
 * EMPRESA DUPLICADA (mesmo CNPJ de 14 dígitos no ONFACE): elege-se a canônica
 * (`vinculo-canonica.ts`) só quando uma domina as outras sem empate; a canônica
 * segue a regra normal e as duplicatas viram pendência "duplicada". Sem canônica
 * clara, todas ficam pendentes com a razão. Nunca se escolhe no escuro.
 *
 * NOME sozinho nunca liga. Nome e domínio só geram SUGESTÃO pendente.
 */
import type { OrganizacaoCallfaceAi } from "@onface/integrations-callface-ai";
import { agruparPorCnpj, elegerCanonica, type PesoEmpresa } from "./vinculo-canonica";

export type { PesoEmpresa };

export type ChaveSinal = "cnpj" | "stripe_customer_id" | "email_dono";

export interface SinalEvidente {
  chave: ChaveSinal;
  /** Valor já normalizado (CNPJ só dígitos, e-mail minúsculo). */
  valor: string;
  onface: string;
  saas: string;
}

export interface EvidenciaVinculo {
  origem: "auto" | "manual" | "confirmado";
  regra: string;
  sinais: SinalEvidente[];
  decididoEm: string;
  versaoRegra: 1;
  /** Presente quando o vínculo só foi possível por eleição de canônica entre duplicatas. */
  canonica?: { criterio: string; duplicadas: string[] };
}

export interface AlvoEmpresa {
  empresaId: string;
  nome: string;
  razaoSocial: string | null;
  cnpj: string | null;
  website: string | null;
  stripeIds: string[];
  emails: string[];
  /** O que cada empresa carrega; base da eleição de canônica entre duplicatas. Ausente = zeros. */
  peso?: PesoEmpresa;
}

/** Empresa que já tem vínculo: serve para reconhecer que a candidata é duplicata dela. */
export interface EmpresaLigada { nome: string; cnpj: string | null }

export type Decisao =
  | { tipo: "auto"; empresaId: string; orgId: string; evidencia: EvidenciaVinculo }
  | { tipo: "pendente"; empresaId: string; orgId: string; razao: string; sinal: string; score: number; evidencia: Record<string, unknown> }
  | { tipo: "sem_sugestao"; empresaId: string };

const WEBMAIL = new Set([
  "gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "yahoo.com.br", "icloud.com", "live.com",
  "uol.com.br", "bol.com.br", "terra.com.br", "msn.com", "me.com", "proton.me", "protonmail.com",
]);

export const soDigitos = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");
export const cnpjNormalizado = (v: string | null | undefined): string | null => {
  const d = soDigitos(v);
  return d.length === 14 ? d : null;
};
const emailNorm = (v: string | null | undefined) => {
  const e = (v ?? "").trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) ? e : null;
};

const SUFIXOS = new Set(["ltda", "me", "epp", "eireli", "sa", "s", "a", "ss", "mei", "cia", "de", "da", "do", "das", "dos", "e", "com", "br"]);
export function tokensDeNome(nome: string | null | undefined): string[] {
  return (nome ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ").split(/\s+/)
    .filter((t) => t.length > 1 && !SUFIXOS.has(t));
}
export function similaridadeDeNome(a: string | null | undefined, b: string | null | undefined): number {
  const ta = new Set(tokensDeNome(a)), tb = new Set(tokensDeNome(b));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / new Set([...ta, ...tb]).size;
}
export function dominioDe(v: string | null | undefined): string | null {
  const s = (v ?? "").trim().toLowerCase();
  if (!s) return null;
  const host = s.includes("@") ? s.split("@")[1] : s.replace(/^https?:\/\//, "").split(/[/?#]/)[0];
  const d = host.replace(/^www\./, "");
  return d && d.includes(".") && !WEBMAIL.has(d) ? d : null;
}

function indexar<T>(itens: T[], chaves: (i: T) => Array<string | null>): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const i of itens) for (const k of new Set(chaves(i))) if (k) m.set(k, [...(m.get(k) ?? []), i]);
  return m;
}

/**
 * @param alvos        empresas a avaliar (ainda sem vínculo)
 * @param orgs         todas as organizações do SaaS
 * @param orgsLigadas  organizationId -> empresaId já vinculados (qualquer estado)
 * @param rejeitados   "empresaId|orgId" que uma pessoa já rejeitou: não se sugere de novo
 * @param empresasLigadas empresaId -> nome/CNPJ das empresas que já têm vínculo (reconhece duplicata)
 */
export function decidirVinculos(
  alvos: AlvoEmpresa[], orgs: OrganizacaoCallfaceAi[],
  orgsLigadas: Map<string, string>, rejeitados: Set<string>, agora = new Date(),
  empresasLigadas: Map<string, EmpresaLigada> = new Map(),
): Decisao[] {
  const porDoc = indexar(orgs, (o) => [cnpjNormalizado(o.documentNumber)]);
  const porStripe = indexar(orgs, (o) => [o.stripeCustomerId]);
  const porEmail = indexar(orgs, (o) => [...o.donos.map(emailNorm), emailNorm(o.email)]);
  const quando = agora.toISOString();

  // Duplicatas por CNPJ: elege a canônica ANTES de contar 1:1. A duplicada sai
  // dos índices (a canônica passa a ser a única dona do sinal); a indecisa
  // fica neles de propósito, para o sinal seguir ambíguo e ninguém ligar.
  type Papel =
    | { tipo: "canonica"; criterio: string; duplicadas: string[] }
    | { tipo: "duplicada"; canonicaNome: string; criterio: string; cnpj: string }
    | { tipo: "indecisa"; motivo: string; cnpj: string };
  const papel = new Map<string, Papel>();
  for (const [cnpj, grupo] of agruparPorCnpj(alvos, (v) => cnpjNormalizado(v))) {
    const e = elegerCanonica(grupo.map((g) => ({ empresaId: g.empresaId, nome: g.nome, peso: g.peso })));
    if (e.tipo === "canonica") {
      const canonica = grupo.find((g) => g.empresaId === e.canonicaId)!;
      papel.set(e.canonicaId, { tipo: "canonica", criterio: e.criterio, duplicadas: e.duplicadas });
      for (const id of e.duplicadas) papel.set(id, { tipo: "duplicada", canonicaNome: canonica.nome, criterio: e.criterio, cnpj });
    } else {
      for (const g of grupo) papel.set(g.empresaId, { tipo: "indecisa", motivo: e.motivo, cnpj });
    }
  }
  const alvosEfetivos = alvos.filter((a) => papel.get(a.empresaId)?.tipo !== "duplicada");
  const alvosPorDoc = indexar(alvosEfetivos, (a) => [cnpjNormalizado(a.cnpj)]);
  const alvosPorStripe = indexar(alvosEfetivos, (a) => a.stripeIds);
  const alvosPorEmail = indexar(alvosEfetivos, (a) => a.emails.map(emailNorm));
  /** Organizações que QUALQUER sinal forte da empresa alcança (só para dar destino à pendência). */
  const orgsAlcancadas = (a: AlvoEmpresa): string[] => [...new Set([
    ...(porDoc.get(cnpjNormalizado(a.cnpj) ?? "") ?? []),
    ...a.stripeIds.flatMap((c) => porStripe.get(c) ?? []),
    ...a.emails.map(emailNorm).flatMap((e) => porEmail.get(e ?? "") ?? []),
  ].map((o) => o.id))].slice(0, 5);

  type Achado = { orgId: string; sinal: SinalEvidente };
  const decisoes: Decisao[] = [];
  const fortes = new Map<string, { empresaId: string; orgId: string; sinais: SinalEvidente[] }>();
  const naoLigou = (a: AlvoEmpresa, orgId: string, razao: string, sinal: string, evidencia: Record<string, unknown>) =>
    decisoes.push({ tipo: "pendente", empresaId: a.empresaId, orgId, razao, sinal, score: 1, evidencia });

  for (const a of alvos) {
    const eleicao = papel.get(a.empresaId);
    if (eleicao && eleicao.tipo !== "canonica") {
      const destinos = orgsAlcancadas(a).filter((id) => !rejeitados.has(`${a.empresaId}|${id}`));
      if (!destinos.length) { decisoes.push({ tipo: "sem_sugestao", empresaId: a.empresaId }); continue; }
      for (const orgId of destinos) {
        if (eleicao.tipo === "duplicada") {
          naoLigou(a, orgId, `Empresa duplicada: o ONFACE tem outra com o mesmo CNPJ ${eleicao.cnpj} (${eleicao.canonicaNome}), eleita canônica por ter ${eleicao.criterio}. O vínculo vai para a canônica; unifique ou arquive esta.`,
            "duplicada", { cnpj: eleicao.cnpj, canonica: eleicao.canonicaNome });
        } else {
          naoLigou(a, orgId, eleicao.motivo, "duplicada_indecisa", { cnpj: eleicao.cnpj });
        }
      }
      continue;
    }
    const achados: Achado[] = [];
    const ambiguos: string[] = [];
    const orgsAmbiguas = new Set<string>();

    const doc = cnpjNormalizado(a.cnpj);
    if (doc) {
      const os = porDoc.get(doc) ?? [];
      if (os.length === 1 && (alvosPorDoc.get(doc) ?? []).length === 1) {
        achados.push({ orgId: os[0].id, sinal: { chave: "cnpj", valor: doc, onface: "empresas.cnpj", saas: "organizations.document_number" } });
      } else if (os.length) {
        ambiguos.push(`cnpj ${doc} aponta para ${os.length} organização(ões) e ${(alvosPorDoc.get(doc) ?? []).length} empresa(s)`);
        os.forEach((o) => orgsAmbiguas.add(o.id));
      }
    }
    for (const cus of a.stripeIds) {
      const os = porStripe.get(cus) ?? [];
      if (os.length === 1 && (alvosPorStripe.get(cus) ?? []).length === 1) {
        achados.push({ orgId: os[0].id, sinal: { chave: "stripe_customer_id", valor: cus, onface: "empresas/assinaturas.stripe_customer_id", saas: "organizations.stripe_customer_id" } });
      } else if (os.length) {
        ambiguos.push(`stripe ${cus} aponta para ${os.length} organização(ões) e ${(alvosPorStripe.get(cus) ?? []).length} empresa(s)`);
        os.forEach((o) => orgsAmbiguas.add(o.id));
      }
    }
    for (const em of a.emails.map(emailNorm)) {
      if (!em) continue;
      const os = porEmail.get(em) ?? [];
      if (os.length === 1 && (alvosPorEmail.get(em) ?? []).length === 1) {
        achados.push({ orgId: os[0].id, sinal: { chave: "email_dono", valor: em, onface: "pessoas.email", saas: "users(CREATOR).email / organizations.email" } });
      } else if (os.length) {
        ambiguos.push(`e-mail ${em} aponta para ${os.length} organização(ões) e ${(alvosPorEmail.get(em) ?? []).length} empresa(s)`);
        os.forEach((o) => orgsAmbiguas.add(o.id));
      }
    }

    const orgsDosSinais = [...new Set(achados.map((x) => x.orgId))];
    if (orgsDosSinais.length > 1) {
      for (const orgId of orgsDosSinais) {
        naoLigou(a, orgId, `Sinais fortes discordam: ${achados.filter((x) => x.orgId === orgId).map((x) => x.sinal.chave).join("+")} aponta para esta organização e outro sinal aponta para outra.`,
          "contradicao", { sinais: achados.filter((x) => x.orgId === orgId).map((x) => x.sinal) });
      }
      continue;
    }
    if (orgsDosSinais.length === 1) {
      const orgId = orgsDosSinais[0];
      const donoAtual = orgsLigadas.get(orgId);
      if (donoAtual && donoAtual !== a.empresaId) {
        const dono = empresasLigadas.get(donoAtual);
        const cnpjA = cnpjNormalizado(a.cnpj);
        if (dono && cnpjA && cnpjNormalizado(dono.cnpj) === cnpjA) {
          naoLigou(a, orgId, `Empresa duplicada: o ONFACE tem outra com o mesmo CNPJ ${cnpjA} (${dono.nome}) que já está vinculada a esta organização. Unifique ou arquive esta.`,
            "duplicada", { cnpj: cnpjA, canonica: dono.nome, sinais: achados.map((x) => x.sinal) });
          continue;
        }
        naoLigou(a, orgId, "Esta organização já está vinculada a outra empresa do ONFACE: conflito de cadastro para decidir.", "disputada",
          { sinais: achados.map((x) => x.sinal) });
        continue;
      }
      // Uma pessoa já rejeitou/removeu exatamente este par: o sync não o refaz.
      if (rejeitados.has(`${a.empresaId}|${orgId}`)) { decisoes.push({ tipo: "sem_sugestao", empresaId: a.empresaId }); continue; }
      fortes.set(a.empresaId, { empresaId: a.empresaId, orgId, sinais: achados.map((x) => x.sinal) });
      continue;
    }

    // Sinais fortes existem mas são ambíguos (organização repetida no SaaS ou
    // sinal dividido entre empresas): pendente EXPLÍCITO com a razão, em vez de
    // seguir para sugestão por nome como se nada tivesse acontecido.
    const destinosAmbiguos = [...orgsAmbiguas].filter((id) => !rejeitados.has(`${a.empresaId}|${id}`)).slice(0, 5);
    if (destinosAmbiguos.length) {
      for (const orgId of destinosAmbiguos) {
        naoLigou(a, orgId, `Casamento ambíguo, ninguém ligado: ${ambiguos.join("; ")}. Decida qual é a organização (ou a empresa) certa.`, "ambigua",
          { ambiguidades: ambiguos });
      }
      continue;
    }

    // Sem sinal forte: sugestão por nome/domínio, SEMPRE pendente.
    const dom = dominioDe(a.website) ?? a.emails.map(dominioDe).find(Boolean) ?? null;
    const sugestoes = orgs
      .filter((o) => !orgsLigadas.has(o.id) && !o.desativadaEm && !rejeitados.has(`${a.empresaId}|${o.id}`))
      .map((o) => {
        const nome = Math.max(similaridadeDeNome(a.nome, o.nome), similaridadeDeNome(a.razaoSocial, o.nome));
        const mesmoDominio = !!dom && [o.email, ...o.donos].some((e) => dominioDe(e) === dom);
        return { o, nome, mesmoDominio, score: Math.min(1, nome + (mesmoDominio ? 0.4 : 0)) };
      })
      .filter((s) => s.score >= 0.5)
      .sort((x, y) => y.score - x.score).slice(0, 3);
    if (!sugestoes.length) {
      decisoes.push({ tipo: "sem_sugestao", empresaId: a.empresaId });
      continue;
    }
    for (const s of sugestoes) {
      const partes = [
        s.nome >= 0.5 ? `nome parecido (${Math.round(s.nome * 100)}%)` : null,
        s.mesmoDominio ? `domínio ${dom} igual` : null,
      ].filter(Boolean).join(" + ");
      decisoes.push({
        tipo: "pendente", empresaId: a.empresaId, orgId: s.o.id, score: Number(s.score.toFixed(4)),
        sinal: s.mesmoDominio ? "dominio+nome" : "nome",
        razao: `Sem CNPJ, Stripe ou e-mail do dono que fechem: sugestão por ${partes}. Nome/domínio não ligam sozinhos; confirme por uma pessoa.${ambiguos.length ? ` Sinais ambíguos: ${ambiguos.join("; ")}.` : ""}`,
        evidencia: { nomeOnface: a.nome, nomeSaas: s.o.nome, similaridadeNome: Number(s.nome.toFixed(2)), dominio: s.mesmoDominio ? dom : null },
      });
    }
  }

  // Duas empresas do lote chegando à MESMA organização: ninguém liga.
  const porOrg = new Map<string, string[]>();
  for (const f of fortes.values()) porOrg.set(f.orgId, [...(porOrg.get(f.orgId) ?? []), f.empresaId]);
  for (const f of fortes.values()) {
    if ((porOrg.get(f.orgId) ?? []).length > 1) {
      decisoes.push({
        tipo: "pendente", empresaId: f.empresaId, orgId: f.orgId, score: 1, sinal: "disputada",
        razao: "Mais de uma empresa do ONFACE chega a esta mesma organização pelos sinais fortes: decida qual é a dona.",
        evidencia: { sinais: f.sinais },
      });
      continue;
    }
    const p = papel.get(f.empresaId);
    const canonica = p?.tipo === "canonica" ? p : null;
    decisoes.push({
      tipo: "auto", empresaId: f.empresaId, orgId: f.orgId,
      evidencia: {
        origem: "auto", regra: f.sinais.map((s) => s.chave).join("+") + (canonica ? "+canonica" : ""), sinais: f.sinais,
        decididoEm: quando, versaoRegra: 1,
        ...(canonica ? { canonica: { criterio: canonica.criterio, duplicadas: canonica.duplicadas } } : {}),
      },
    });
  }
  return decisoes;
}
