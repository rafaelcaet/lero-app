import type { Metadata } from "next";
import { Fredoka, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Fonte da identidade do Lero, só para textos principais (classe `font-display`).
 * A "Fredoka One" virou a Fredoka variável no Google Fonts; o peso 600 equivale a ela.
 */
const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lero",
  description: "Conversa séria para quem não se leva tão a sério",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} ${fredoka.variable} h-full antialiased`}
    >
      <body className="h-full font-sans">{children}</body>
    </html>
  );
}
