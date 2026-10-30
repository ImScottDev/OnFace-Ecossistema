/**
 * Verificação de ambiente — roda ANTES do deploy, não depois.
 *
 * Duas checagens:
 *
 *  1. DOCUMENTAÇÃO: toda variável que o código lê precisa estar no
 *     `.env.example`. Em 14/09 havia 42 variáveis usadas e não documentadas,
 *     incluindo `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY` e
 *     `AI_CREDENTIALS_ENCRYPTION_KEY` — subir um ambiente novo a partir do
 *     exemplo produzia metade das integrações desligada em silêncio.
 *
 *  2. AMBIENTE ATUAL (só com --ambiente): as variáveis obrigatórias estão
 *     preenchidas de fato? Os webhooks são fail-closed de propósito, então
 *     segredo faltando não é aviso — é lead, mensagem e pagamento que não entram.
 *
 * Uso:
 *   npm run check:env                 # só a documentação (roda sem .env, serve em CI)
 *   npm run check:env -- --ambiente   # + confere o ambiente carregado
 *   npm run check:env -- --homolog    # + homologação não toca cliente nem dado real
 */
import fs from "node:fs";
import path from "node:path";

const HOMOLOG = process.argv.includes("--homolog");
const CONFERIR_AMBIENTE = HOMOLOG || process.argv.includes("--ambiente");

function acharRaiz(): string {
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(dir, ".env.example"))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error("raiz do repositório não encontrada");
}
const RAIZ = acharRaiz();

/**
 * Onde o código mora. `packages/` entra, e essa é a metade que faltava.
 *
 * Varrendo só `app/src`, o verificador marcou **23 variáveis como candidatas a
 * remoção**, e entre elas estavam as sete da Meta — inclusive
 * `META_CAPI_ACCESS_TOKEN`, cuja entrega o CP57 tinha acabado de provar que
 * funciona. Quem seguisse o conselho tiraria do `.env.example` a credencial que
 * o produto usa.
 *
 * O repositório virou monorepo em algum ponto e este script não acompanhou. É o
 * mesmo formato dos outros: a ferramenta olha onde o código estava.
 */
const PASTAS = [path.join(RAIZ, "app/src"), path.join(RAIZ, "packages")]
  .filter((d) => fs.existsSync(d));

/** Variáveis que o código lê de verdade. */
function variaveisDoCodigo(): Map<string, string[]> {
  const achadas = new Map<string, string[]>();
  const pilha = [...PASTAS];
  while (pilha.length) {
    const dir = pilha.pop()!;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== "node_modules" && e.name !== "dist") pilha.push(p);
        continue;
      }
      if (!/\.tsx?$/.test(e.name)) continue;
      // Comentário não conta. O próprio cabeçalho deste arquivo cita
      // `env.VAR` como exemplo, e a primeira versão do padrão novo se acusou.
      const src = fs.readFileSync(p, "utf8")
        .split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
      // Três formas, porque o código usa as três. `packages/integrations/meta/
      // src/config.ts` lê `env.META_CAPI_ACCESS_TOKEN` de um objeto recebido, e
      // o padrão que exigia `process.env.` colado não via nenhuma das sete
      // variáveis da Meta.
      //
      // Casar `env.VAR` genérico pode marcar como usada uma variável que não é
      // — e esse é o erro seguro: o custo de marcar a mais é zero, e o de
      // marcar a menos é alguém apagar credencial em uso.
      for (const m of src.matchAll(/(?:process\.env|\benv)\.([A-Z_0-9]{3,})|process\.env\[["']([A-Z_0-9]{3,})["']\]/g)) {
        const nome = m[1] ?? m[2];
        if (!nome) continue;
        const lista = achadas.get(nome) ?? [];
        const rel = path.relative(RAIZ, p);
        if (!lista.includes(rel)) lista.push(rel);
        achadas.set(nome, lista);
      }
    }
  }
  // Infraestrutura também lê variável, e o `.env.example` documenta as duas
  // coisas. Sem isto, `DB_USER`, `APP_PORT`, `HONO_API_PORT` e
  // `COMPOSE_PROJECT_NAME` apareciam como "candidatas a remoção" — e removê-las
  // quebraria o `docker-compose` sem que nada em TypeScript acusasse.
  for (const arq of composeEDockerfile()) {
    const src = fs.readFileSync(arq, "utf8");
    for (const m of src.matchAll(/\$\{?([A-Z_0-9]{3,})\}?/g)) {
      const lista = achadas.get(m[1]) ?? [];
      const rel = path.relative(RAIZ, arq);
      if (!lista.includes(rel)) lista.push(rel);
      achadas.set(m[1], lista);
    }
  }
  return achadas;
}

/** Os arquivos de infraestrutura que interpolam variável de ambiente. */
function composeEDockerfile(): string[] {
  const achados: string[] = [];
  const pilha = [RAIZ];
  while (pilha.length) {
    const dir = pilha.pop()!;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!["node_modules", ".git", ".next", "dist"].includes(e.name)) pilha.push(p);
        continue;
      }
      if (/^(docker-)?compose.*\.ya?ml$/.test(e.name) || /^Dockerfile/.test(e.name)) achados.push(p);
    }
  }
  return achados;
}

function variaveisDocumentadas(): Set<string> {
  const texto = fs.readFileSync(path.join(RAIZ, ".env.example"), "utf8");
  return new Set([...texto.matchAll(/^([A-Z_0-9]+)=/gm)].map((m) => m[1]));
}

/**
 * Obrigatórias por jornada. Faltando qualquer uma, a jornada correspondente
 * não acontece — e falha em silêncio ou com 503 do lado do provedor.
 */
type Jornada = {
  nome: string;
  /** Tudo que esta jornada exige. */
  todas?: string[];
  /** Pelo menos uma destas alternativas precisa existir. */
  umaDelas?: string[];
};

// Cada entrada corresponde a uma porta ou uma capacidade independente. Juntar
// rotas novas e legadas aqui mascara um fluxo pronto como se estivesse desligado
// (ou o inverso). Stripe tambem tem duas chaves com papeis distintos: a
// restricted read-only e a secret de escrita; checkout aceita qualquer uma
// porque o provider suporta ambos os nomes.
const OBRIGATORIAS: Jornada[] = [
  { nome: "núcleo (sobe o sistema)", todas: ["DATABASE_URL", "REDIS_URL", "NEXTAUTH_SECRET", "NEXTAUTH_URL"] },
  { nome: "lead por RD Station (ponte legada)", todas: ["RD_WEBHOOK_SECRET"] },
  { nome: "Meta Lead Ads (entrada direta)", todas: ["META_LEADS_ACCESS_TOKEN", "META_APP_SECRET", "META_PAGE_ID", "META_WEBHOOK_VERIFY_TOKEN"] },
  { nome: "Meta IDs por n8n (ponte legada)", todas: ["META_LEADIDS_WEBHOOK_SECRET"] },
  { nome: "Meta Conversions API", todas: ["META_CAPI_ACCESS_TOKEN"], umaDelas: ["META_PIXEL_ID", "META_DATASET_ID"] },
  { nome: "atendimento por WhatsApp", todas: ["UAZAPI_WEBHOOK_SECRET", "UAZAPI_BASE_URL"] },
  { nome: "telefonia", todas: ["CALLFACE_WEBHOOK_SECRET"] },
  { nome: "Stripe (sincronizar catálogo e billing)", todas: ["STRIPE_API_KEY"] },
  { nome: "Stripe (checkout ou alteração de assinatura)", umaDelas: ["STRIPE_SECRET_KEY", "STRIPE_API_KEY"] },
  { nome: "Stripe (webhook de ciclo de vida)", todas: ["STRIPE_WEBHOOK_SECRET"] },
  // Sem este segredo a rota /api/webhooks/resend responde 500 e nenhum estado de
  // entrega de e-mail (entregue, devolvido, reclamado) chega ao CRM. Estava faltando
  // em produção em 26/10/2026 sem ninguém perceber.
  { nome: "Resend (webhook de entrega de e-mail)", todas: ["RESEND_WEBHOOK_SECRET"] },
  { nome: "assinatura de contrato", todas: ["DOCUMENSO_API_URL", "DOCUMENSO_API_TOKEN", "DOCUMENSO_WEBHOOK_SECRET"] },
  { nome: "e-mail", todas: ["EMAIL_ENCRYPTION_KEY"] },
  { nome: "Microsoft 365 (OAuth de agenda)", todas: ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET"] },
  { nome: "Callface AI (sincronização de dados)", todas: ["CALLFACE_AI_DATABASE_URL"] },
];

let problemas = 0;

console.log("Conferência de ambiente — Callface CRM\n");

// ── 1. documentação ──────────────────────────────────────────────────────────
const codigo = variaveisDoCodigo();
const documentadas = variaveisDocumentadas();

const naoDocumentadas = [...codigo.keys()].filter((v) => !documentadas.has(v)).sort();
if (naoDocumentadas.length > 0) {
  problemas += naoDocumentadas.length;
  console.log(`✘ ${naoDocumentadas.length} variável(is) lida(s) pelo código e ausente(s) do .env.example:`);
  for (const v of naoDocumentadas) console.log(`    ${v}  (${codigo.get(v)!.slice(0, 2).join(", ")})`);
} else {
  console.log(`✔ .env.example cobre as ${codigo.size} variáveis que o código lê`);
}

const obsoletas = [...documentadas].filter((v) => !codigo.has(v)).sort();
if (obsoletas.length > 0) {
  console.log(`\n⚠ ${obsoletas.length} documentada(s) que o código não lê mais (candidatas a remoção):`);
  console.log(`    ${obsoletas.join(", ")}`);
}

// ── 2. ambiente carregado ────────────────────────────────────────────────────
if (CONFERIR_AMBIENTE) {
  console.log("\nAmbiente carregado:");
  for (const grupo of OBRIGATORIAS) {
    const faltando = (grupo.todas ?? []).filter((v) => !process.env[v]);
    const temAlternativa = !grupo.umaDelas || grupo.umaDelas.some((v) => Boolean(process.env[v]));
    if (faltando.length === 0 && temAlternativa) {
      console.log(`  ✔ ${grupo.nome}`);
    } else {
      problemas += faltando.length + (temAlternativa ? 0 : 1);
      const detalhes = [...faltando, ...(temAlternativa ? [] : [`uma de: ${grupo.umaDelas!.join(" | ")}`])];
      console.log(`  ✘ ${grupo.nome} — faltando: ${detalhes.join(", ")}`);
    }
  }
  console.log(
    "\n  Os webhooks são fail-closed: sem o segredo eles respondem 503 e o evento\n" +
    "  do provedor NÃO entra. Configure antes de apontar Stripe, RD, Meta,\n" +
    "  Documenso, Apollo e wuzapi pro ambiente."
  );
}

// ── 3. homologação isolada (D10) ─────────────────────────────────────────────
// Medido em 27/10/2026: a homologação usava a MESMA chave live do Stripe, do
// Resend e da Meta que a produção, sem código de teste da Conversions API.
// WhatsApp e e-mail já tinham trava; pagamento e evento de anúncio não.
if (HOMOLOG) {
  console.log("\nHomologação isolada:");
  const travas: Array<[string, boolean]> = [
    ["WHATSAPP_ALLOWLIST preenchida (envio só para números de teste)", !!process.env.WHATSAPP_ALLOWLIST],
    ["EMAIL_ALLOWED_DOMAINS preenchida (e-mail só para domínios de teste)", !!process.env.EMAIL_ALLOWED_DOMAINS],
    ["Stripe em modo teste (sk_test_/rk_test_, sem STRIPE_CHECKOUT_MODE=live)",
      ![process.env.STRIPE_API_KEY, process.env.STRIPE_SECRET_KEY].some((k) => /_live_/.test(k ?? ""))
      && process.env.STRIPE_CHECKOUT_MODE !== "live"],
    ["Meta CAPI desligada ou com META_CAPI_TEST_EVENT_CODE", !process.env.META_CAPI_ACCESS_TOKEN || !!process.env.META_CAPI_TEST_EVENT_CODE],
  ];
  for (const [nome, ok] of travas) {
    if (!ok) problemas++;
    console.log(`  ${ok ? "✔" : "✘"} ${nome}`);
  }
}

console.log(problemas === 0 ? "\nTudo certo." : `\n${problemas} problema(s).`);
process.exit(problemas > 0 ? 1 : 0);
