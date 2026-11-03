import Image from "next/image";
import { GameRoot } from "@/components/game/GameRoot";
import logo from "../../public/lero-logo.png";

const kbd = "rounded border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 font-mono text-xs text-neutral-300";

export default function Home() {
  return (
    <main className="flex h-dvh flex-col items-center gap-3 overflow-hidden bg-neutral-950 px-3 pb-3 pt-3 text-neutral-200 sm:px-5 sm:pb-5">
      <header className="flex w-full max-w-[1600px] shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <h1 className="m-0">
          <Image src={logo} alt="Lero" preload className="h-7 w-auto sm:h-8" />
        </h1>
        <p className="hidden text-sm text-neutral-400 sm:block">
          <kbd className={kbd}>WASD</kbd> ou <kbd className={kbd}>setas</kbd> para andar ·{" "}
          <kbd className={kbd}>E</kbd> para sentar
        </p>
      </header>
      <section className="relative flex min-h-0 w-full max-w-[1600px] flex-1 overflow-hidden rounded-xl border border-neutral-800 bg-[#1b1d27] shadow-2xl">
        <GameRoot />
      </section>
    </main>
  );
}
