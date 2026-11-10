import Image from "next/image";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { logout } from "@/app/(auth)/actions";
import { GameRoot } from "@/components/game/GameRoot";
import { createGameTicket, getSession } from "@/lib/auth/session";
import logo from "../../public/lero-logo.png";

const kbd = "rounded-md border border-grape-700 border-b-2 bg-grape-800 px-1.5 py-0.5 font-mono text-xs text-grape-100";

export default function Home() {
  return (
    <main className="flex h-dvh flex-col items-center gap-3 overflow-hidden bg-carbon px-3 pb-3 pt-3 text-grape-100 sm:px-5 sm:pb-5">
      <header className="flex w-full max-w-[1600px] shrink-0 items-center justify-between gap-x-6 gap-y-2">
        <h1 className="m-0 shrink-0">
          <Image src={logo} alt="Lero" preload className="h-7 w-auto sm:h-8" />
        </h1>
        <p className="hidden text-sm text-grape-400 lg:block">
          <kbd className={kbd}>WASD</kbd> ou <kbd className={kbd}>setas</kbd> para andar ·{" "}
          <kbd className={kbd}>E</kbd> para sentar
        </p>
        <Suspense fallback={<div className="h-9 w-40" />}>
          <AccountMenu />
        </Suspense>
      </header>
      <section className="relative flex min-h-0 w-full max-w-[1600px] flex-1 overflow-hidden rounded-[22px] border border-white/10 bg-grape-900 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]">
        <Suspense fallback={<Loading />}>
          <Game />
        </Suspense>
      </section>
    </main>
  );
}

/** O jogo só abre com login: a página entrega ao navegador um ingresso para o servidor do jogo. */
async function Game() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <GameRoot name={session.name} ticket={createGameTicket(session)} />;
}

async function AccountMenu() {
  const session = await getSession();
  if (!session) return null;
  return (
    <div className="flex min-w-0 items-center gap-1 rounded-full border border-white/10 bg-grape-900 p-1 pl-4">
      <span className="truncate text-sm font-semibold text-white" title={session.name}>
        {session.name}
      </span>
      <form action={logout}>
        <button
          type="submit"
          className="ml-2 rounded-full bg-grape-700 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-grape-100 transition-colors hover:bg-grape-600 hover:text-white"
        >
          Sair
        </button>
      </form>
    </div>
  );
}

function Loading() {
  return (
    <div className="m-auto font-display text-sm uppercase tracking-widest text-grape-400" role="status">
      Abrindo o escritório…
    </div>
  );
}
