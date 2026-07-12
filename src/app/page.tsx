import GameClient from "./components/GameClient";

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">
          Infinite Crafting RPG
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Fight enemies for loot, then drag one item onto another to forge
          something new. Every combination is resolved once, then cached for
          everyone.
        </p>
      </header>
      <GameClient />
    </main>
  );
}
