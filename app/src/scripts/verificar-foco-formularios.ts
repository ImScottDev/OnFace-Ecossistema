/**
 * Prova no navegador que digitar num formulário NÃO tira o foco do campo.
 *
 * O defeito: um componente declarado dentro de outro (ex.: `const Rot = ...`
 * dentro do render) ganha identidade nova a cada tecla, o React desmonta e
 * remonta o <input>, e o foco some depois de cada letra. Tipo-checagem, build e
 * teste unitário não enxergam isso; só o teclado de verdade.
 *
 * Para cada formulário: clica no campo, digita a frase TECLA A TECLA conferindo
 * `document.activeElement` depois de cada uma, salva, RECARREGA a página e relê o
 * valor pela mesma tela. Falha (exit 1) se o foco se perder uma vez ou se o valor
 * relido não for o digitado. Restaura o valor original ao final.
 *
 * Precisa do Next (3000) e da API de pé, banco local. Chrome real, não o MCP do
 * Playwright (trava).
 *
 *   npx tsx --env-file=.env src/scripts/verificar-foco-formularios.ts
 *   BASE=http://localhost:3000 FOCO_EVIDENCIAS=.tmp-foco/depois npx tsx --env-file=.env src/scripts/verificar-foco-formularios.ts
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { sessaoDeSmoke } from "./_sessao-de-smoke";

const BASE = process.env.BASE || "http://localhost:3000";
const EVIDENCIAS = process.env.FOCO_EVIDENCIAS || ".tmp-foco";
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PW = process.env.PLAYWRIGHT_CORE || join(homedir(), ".npm/_npx/e41f203b7505f1fb/node_modules/playwright-core");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { chromium } = createRequire(`${process.cwd()}/`)(PW) as any;

/* eslint-disable @typescript-eslint/no-explicit-any */
interface Campo { rotulo: string; texto: string; esperado?: string }
interface Caso {
  nome: string;
  caminho: string;
  /** Deixa o formulário visível (abrir <details>, aba, modal). Roda de novo após recarregar. */
  abrir: (page: any) => Promise<void>;
  /** Localiza o input de um campo pelo rótulo visível. */
  campo: (page: any, rotulo: string) => any;
  campos: Campo[];
  salvar: (page: any) => Promise<void>;
  /** Guarda o estado atual para devolver ao final. */
  lerOriginal?: (page: any) => Promise<unknown>;
  restaurar?: (page: any, original: unknown) => Promise<void>;
}

const CASOS: Caso[] = [
  {
    nome: "Ajustes > Contratos > Parâmetros do contrato",
    caminho: "/ajustes/contratos",
    abrir: async (page) => {
      const resumo = page.locator("summary", { hasText: "Parâmetros do contrato" });
      await resumo.waitFor({ timeout: 20000 });
      if (!(await page.locator("details[open] summary", { hasText: "Parâmetros do contrato" }).count())) await resumo.click();
      await page.locator("label", { hasText: "Multa rescisória" }).locator("input").waitFor();
      // espera o useEffect copiar o dado da API para o formulário
      await page.waitForTimeout(600);
    },
    campo: (page, rotulo) => page.locator("details label", { hasText: rotulo }).locator("input").first(),
    campos: [
      { rotulo: "Multa rescisória", texto: "12,5" },
      { rotulo: "Limite de armazenamento", texto: "Até 90 dias corridos após o encerramento do contrato" },
      { rotulo: "Representante da Callface", texto: "Maria Fernanda de Albuquerque Souza" },
      { rotulo: "E-mail do representante", texto: "maria.fernanda@exemplo.com.br" },
    ],
    salvar: async (page) => {
      const resp = page.waitForResponse((r: any) => r.url().includes("/api/contrato-parametros") && r.request().method() === "PUT");
      await page.getByRole("button", { name: "Salvar parâmetros" }).click();
      const r = await resp;
      if (!r.ok()) throw new Error(`PUT /api/contrato-parametros devolveu ${r.status()}`);
    },
    lerOriginal: async (page) => page.evaluate(async () => (await fetch("/api/contrato-parametros")).json()),
    restaurar: async (page, original) => {
      await page.evaluate(async (o: any) => {
        await fetch("/api/contrato-parametros", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(o) });
      }, original);
    },
  },
];

let falhas = 0;
const ok = (cond: unknown, msg: string) => {
  console.log(`  ${cond ? "\x1b[32mok\x1b[0m   " : "\x1b[31mFALHA\x1b[0m"} ${msg}`);
  if (!cond) falhas++;
};

async function main() {
  mkdirSync(EVIDENCIAS, { recursive: true });
  const sessao = await sessaoDeSmoke({ role: "admin" });
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 1000 } });
  await ctx.addCookies([{ name: "authjs.session-token", value: sessao.cookie.split("=").slice(1).join("="), url: BASE }]);
  const page = await ctx.newPage();

  for (const caso of CASOS) {
    console.log(`\n${caso.nome}`);
    await page.goto(BASE + caso.caminho, { waitUntil: "networkidle" });
    await caso.abrir(page);
    const original = caso.lerOriginal ? await caso.lerOriginal(page) : null;

    try {
      for (const c of caso.campos) {
        const el = caso.campo(page, c.rotulo);
        await el.click();
        await el.press("ControlOrMeta+a");
        await el.press("Backspace");
        let perdas = 0;
        let primeiraPerda = -1;
        for (let i = 0; i < c.texto.length; i++) {
          await page.keyboard.type(c.texto[i]);
          const mantem = await el.evaluate((n: Element) => n === document.activeElement).catch(() => false);
          if (!mantem) { perdas++; if (primeiraPerda < 0) primeiraPerda = i + 1; }
        }
        const valor = await el.inputValue().catch(() => "<campo desmontado>");
        ok(perdas === 0, `"${c.rotulo}": foco mantido nas ${c.texto.length} teclas${perdas ? ` (perdeu em ${perdas}; primeira na tecla ${primeiraPerda})` : ""}`);
        ok(valor === c.texto, `"${c.rotulo}": valor digitado completo (${JSON.stringify(valor)})`);
      }
      await page.screenshot({ path: join(EVIDENCIAS, `digitado.png`) });

      await caso.salvar(page);
      await page.reload({ waitUntil: "networkidle" });
      await caso.abrir(page);
      for (const c of caso.campos) {
        const valor = await caso.campo(page, c.rotulo).inputValue();
        ok(valor === (c.esperado ?? c.texto), `"${c.rotulo}": persistiu e voltou na recarga (${JSON.stringify(valor)})`);
      }
      await page.screenshot({ path: join(EVIDENCIAS, `recarregado.png`) });
    } finally {
      if (caso.restaurar && original) await caso.restaurar(page, original);
    }
  }

  await browser.close();
  console.log(falhas ? `\n${falhas} falha(s)` : "\nfoco mantido em todos os formulários");
  process.exit(falhas ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
