import { GameRoot } from "@/components/game/GameRoot";

export default function Home() {
  return (
    <main className="flex h-dvh flex-col items-center gap-3 overflow-hidden bg-neutral-950 p-4 text-neutral-200">
      <header className="flex w-full max-w-[960px] shrink-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="text-lg font-semibold tracking-tight">Lero</h1>
        <p className="text-sm text-neutral-400">
          Use <kbd className="rounded border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 font-mono text-xs">WASD</kbd> ou as{" "}
          <kbd className="rounded border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 font-mono text-xs">setas</kbd> para se movimentar ·{" "}
          <kbd className="rounded border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 font-mono text-xs">E</kbd> para sentar
        </p>
      </header>
      <section className="flex min-h-0 w-full max-w-[960px] flex-1 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900 shadow-2xl">
        <GameRoot />
      </section>
    </main>
  );
}
