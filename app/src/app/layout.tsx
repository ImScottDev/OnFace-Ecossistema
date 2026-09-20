import type { Metadata } from "next";
import { Noto_Sans, Poppins, Manrope, Geist, Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Noto Sans (UI/body) + Poppins (display/headings — decisão Scott 18/jun, no lugar do Kanit).
const notoSans = Noto_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "700", "800", "900"],
});

const poppins = Poppins({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// CRM 2.0 (novo App Shell, tema claro — contrato visual do Figma, 09/08):
// tipografia própria da V2, desacoplada do style guide antigo (Kanit/Noto).
// Só adiciona variável CSS nova — não toca nada usado pelas telas legadas.
const manrope = Manrope({
  variable: "--font-cf2-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const geist = Geist({
  variable: "--font-cf2-nav",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-cf2-ui",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-onface-display",
  subsets: ["latin"],
  // 400 entra para o corpo das telas ONFACE: a referência usa a mesma família
  // em título e texto de apoio, e sem o regular o navegador sintetizava o peso.
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Callface | CRM",
  description: "CRM + SDR inteligente para inteligência comercial via voz",
  icons: {
    icon: "/brand/callface-icon.png",
    apple: "/brand/callface-icon.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Callface CRM",
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
    // Motivo: o Cf2ThemeRoot põe `data-cf2-theme` no <html>, e é lá que
    // `--cf2-font-ui: var(--font-cf2-ui), …` é calculada. Com as vars só no
    // body, `--font-cf2-ui` não existia nesse escopo, o var() ficava vazio e a
    // declaração inteira virava inválida — o browser caía no SERIF padrão.
    // Aparecia só em portal (drawer/dropdown/modal), que herda do body a
    // versão já quebrada vinda do html.
    // `suppressHydrationWarning` no <html>: as cascas marcam o tema no próprio
    // elemento antes da hidratação (`data-onface-theme` via script inline no
    // layout do ONFACE, `data-cf2-theme` via efeito no CRM 2.0). O servidor não
    // emite esses atributos, então o React acusa divergência de árvore num
    // atributo que é intencionalmente definido no cliente. Suprimir aqui é o
    // padrão para theming, e só vale para o <html>.
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${notoSans.variable} ${poppins.variable} ${manrope.variable} ${geist.variable} ${inter.variable} ${plusJakarta.variable}`}
    >
      <body
        className={`antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
