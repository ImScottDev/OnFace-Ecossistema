import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

/**
 * Três famílias, e cada uma tem um trabalho — handoff "OnFace — Casca +
 * Pré-vendas", 22/09/2026, declarado versão final pelo Scott.
 *
 * Isto SUBSTITUI a regra de família única que valia até hoje de manhã. A
 * UX-EXECUTION-SPEC §1.1 mandava Plus Jakarta em tudo e proibia Inter; o
 * handoff volta a separar os papéis, e a separação é o que dá hierarquia sem
 * gastar tamanho:
 *
 * - **Plus Jakarta Sans** (600/700/800): título, nome de coluna, número
 *   grande. É a voz da marca, e ela fala pouco.
 * - **Inter** (400/500/600/700): todo o resto. Texto de interface denso em
 *   Jakarta fica largo e a linha some mais cedo.
 * - **IBM Plex Mono**: só atalho de teclado. ⌘K e ⌘J precisam ler como tecla.
 *
 * As variáveis legadas continuam existindo e cada uma aponta para o papel
 * certo: quem consome `--font-cf2-ui` (corpo) recebe Inter, quem consome
 * `--font-onface-display` (título) recebe Jakarta. Ninguém precisa mudar de
 * variável.
 */
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
  variable: "--font-onface-titulo",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-onface-corpo",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-onface-mono",
});

/** Cada variável legada aponta para o papel que ela sempre teve. Mantê-las é o
 * que permite mudar a tipografia sem tocar nas 15 mil linhas de CSS que as
 * consomem. */
const ALIASES_DE_FONTE = [
  ["--font-body", "--font-onface-corpo"],
  ["--font-cf2-ui", "--font-onface-corpo"],
  ["--font-cf2-nav", "--font-onface-corpo"],
  ["--font-onface-ui", "--font-onface-corpo"],
  ["--font-heading", "--font-onface-titulo"],
  ["--font-cf2-heading", "--font-onface-titulo"],
  ["--font-onface-display", "--font-onface-titulo"],
  // `--font-onface` era o nome da família única; ainda há CSS lendo ele.
  ["--font-onface", "--font-onface-corpo"],
]
  .map(([apelido, papel]) => `${apelido}: var(${papel});`)
  .join("");

export const metadata: Metadata = {
  // Template em vez de string: cada rota passa só o nome da tela e o produto
  // completa. Antes havia três padrões vivos ao mesmo tempo — "Pipeline |
  // Callface" (marca anterior, em 5 rotas), "Início | ONFACE" e o "ONFACE"
  // pelado em 12 rotas, que deixava a aba sem dizer onde a pessoa está.
  title: { default: "ONFACE", template: "%s | ONFACE" },
  description: "Sistema operacional comercial: aquisição, venda, entrega e relacionamento.",
  icons: {
    icon: "/onface/figma-logo.svg",
    apple: "/onface/figma-logo.svg",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ONFACE",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // As variáveis de fonte ficam no <html>, não no <body> (correção 31/08).
    // Motivo: as cascas marcam `data-onface-theme`/`data-cf2-theme` no <html>, e
    // é nesse escopo que `--cf2-font-ui: var(--font-cf2-ui), …` é calculada. Com
    // as vars só no body, o var() ficava vazio, a declaração inteira virava
    // inválida e o browser caía no SERIF padrão dentro de portais.
    //
    // `suppressHydrationWarning`: as cascas marcam o tema no próprio elemento
    // antes da hidratação. O servidor não emite esses atributos, então o React
    // acusa divergência num atributo que é intencionalmente definido no cliente.
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${jakarta.variable} ${inter.variable} ${plexMono.variable}`}
    >
      <head>
        <style dangerouslySetInnerHTML={{ __html: `:root{${ALIASES_DE_FONTE}}` }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
