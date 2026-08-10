import type { Metadata } from "next";
import { Noto_Sans, Poppins, Manrope, Geist, Inter } from "next/font/google";
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
    <html lang="pt-BR">
      <body
        className={`${notoSans.variable} ${poppins.variable} ${manrope.variable} ${geist.variable} ${inter.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
