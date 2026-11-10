"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/login", label: "Entrar" },
  { href: "/cadastro", label: "Criar conta" },
] as const;

/** Pílulas de navegação entre login e cadastro (a ativa fica destacada). */
export function AuthNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Conta" className="flex items-center gap-1 rounded-full border border-white/10 bg-carbon/50 p-1 backdrop-blur-sm">
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors sm:px-4 ${
              active ? "bg-grape-700 text-white shadow-inner" : "text-grape-300 hover:text-white"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
