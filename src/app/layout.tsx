import type { Metadata } from "next";
import { Geist_Mono, Nunito, Pixelify_Sans } from "next/font/google";
import "./globals.css";

/** Texto corrido: arredondada e amigável. */
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Fonte pixel da identidade do Lero, só para textos principais (classe `font-display`). */
const pixelify = Pixelify_Sans({
  variable: "--font-pixelify",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Lero",
  description: "Conversa séria para quem não se leva tão a sério",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${nunito.variable} ${geistMono.variable} ${pixelify.variable} h-full antialiased`}
    >
      <body className="h-full bg-carbon font-sans">{children}</body>
    </html>
  );
}
