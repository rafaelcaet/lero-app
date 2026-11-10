import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Criar conta · Lero" };

export default function SignupPage() {
  return (
    <>
      <h1 className="font-display text-[28px] font-semibold uppercase leading-[1.15] tracking-wide text-white drop-shadow-[0_2px_0_rgba(0,0,0,0.35)] sm:text-[32px]">
        Um escritório divertido com <span className="text-pearl">gente incrível</span>
      </h1>
      <p className="mb-7 mt-3 text-[15px] text-grape-300">Crie sua conta e monte seu personagem.</p>
      <SignupForm />
    </>
  );
}
