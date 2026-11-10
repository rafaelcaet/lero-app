import Image from "next/image";
import Link from "next/link";
import { AuthNav } from "@/components/auth/AuthNav";
import { OfficeScene } from "@/components/auth/OfficeScene";
import logo from "../../../public/lero-logo.png";

/**
 * Moldura das telas de login e cadastro: o escritório em pixel art desfocado ao
 * fundo e, por cima, um cartão com a cena nítida à direita e o formulário à esquerda.
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative h-dvh overflow-y-auto bg-carbon text-white">
      {/* Fundo: a mesma cena, ampliada e desfocada. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <OfficeScene animated={false} className="h-full w-full scale-110 object-cover blur-md" />
        <div className="absolute inset-0 bg-carbon/70" />
      </div>

      <div className="relative flex min-h-full items-center justify-center p-3 sm:p-6 lg:p-10">
        <div className="relative flex min-h-[min(680px,calc(100dvh-3rem))] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-white/15 bg-grape-900 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]">
          {/* Cena nítida, alinhada à direita; no celular fica atrás do formulário. */}
          <div aria-hidden className="absolute inset-0 overflow-hidden">
            <OfficeScene className="animate-scene-drift h-full w-full object-cover object-[70%_40%]" />
          </div>
          {/* Degradê que dá leitura ao formulário sobre a cena. */}
          <div
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(90deg,var(--color-grape-900)_0%,color-mix(in_oklab,var(--color-grape-900)_92%,transparent)_34%,color-mix(in_oklab,var(--color-grape-900)_40%,transparent)_58%,transparent_78%)] max-md:bg-grape-900/85"
          />
          <div aria-hidden className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-grape-900/80 to-transparent" />

          <header className="relative z-10 flex items-center justify-between gap-4 px-5 pt-5 sm:px-10 sm:pt-7 lg:px-14">
            <Link href="/login" aria-label="Lero — início" className="shrink-0">
              <Image src={logo} alt="Lero" preload className="h-7 w-auto sm:h-8" />
            </Link>
            <AuthNav />
          </header>

          <main className="relative z-10 flex flex-1 items-center px-5 py-8 sm:px-10 lg:px-14">
            <div className="w-full max-w-sm">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
