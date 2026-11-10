import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Entrar · Lero" };

export default function LoginPage() {
  return (
    <>
      <h1 className="font-display text-[28px] font-semibold uppercase leading-[1.15] tracking-wide text-white drop-shadow-[0_2px_0_rgba(0,0,0,0.35)] sm:text-[32px]">
        Conversa séria para quem não se leva <span className="text-pearl">tão a sério</span>
      </h1>
      <p className="mb-7 mt-3 text-[15px] text-grape-300">Entre para puxar uma cadeira no escritório.</p>
      <LoginForm />
    </>
  );
}
