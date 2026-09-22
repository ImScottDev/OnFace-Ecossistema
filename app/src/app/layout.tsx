import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

/**
 * Plus Jakarta Sans é a ÚNICA família do produto.
 *
 * A UX-EXECUTION-SPEC §1.1 nomeia a fonte ("Plus Jakarta Sans") e proíbe o
 * retorno a Inter/Manrope. Medido no navegador em 22/09, antes desta mudança,
 * a casca renderizava 131 elementos em Inter, 14 em Manrope e 9 em Plus
 * Jakarta: `--font-onface-ui` apontava para `--font-cf2-ui`, que era Inter.
 * O produto inteiro estava na fonte que a spec bane, e a fonte oficial só
 * pegava os títulos.
 *
 * Em vez de caçar as ocorrências em 30 arquivos CSS, as seis variáveis que já
 * existiam (`--font-body`, `--font-heading`, `--font-cf2-*`, `--font-onface-*`)
 * passam a apontar todas para a mesma família. Quem consome continua lendo a
 * variável que sempre leu, e o resultado é uma fonte só em toda superfície.
 *
 * Efeito colateral desejado: cinco downloads de webfont a menos (Noto Sans,
 * Poppins, Manrope, Geist, Inter). O peso 900 que o Noto trazia não existe em
 * Plus Jakarta; 800 é o topo da família e assume o lugar.
 */
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-onface",
});

/** As variáveis legadas viram apelidos da família única. Mantê-las é o que
 * permite trocar a fonte sem tocar nos 15 mil linhas de CSS que as consomem. */
const ALIASES_DE_FONTE = [
  "--font-body",
  "--font-heading",
  "--font-cf2-ui",
  "--font-cf2-nav",
  "--font-cf2-heading",
  "--font-onface-ui",
  "--font-onface-display",
]
  .map((nome) => `${nome}: var(--font-onface);`)
  .join("");

export const metadata: Metadata = {
  title: "ONFACE",
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
    <html lang="pt-BR" suppressHydrationWarning className={jakarta.variable}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: `:root{${ALIASES_DE_FONTE}}` }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
