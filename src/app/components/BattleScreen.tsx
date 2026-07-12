"use client";

import { useState } from "react";
import {
  createEnemy,
  damageEnemy,
  rollDamage,
  PLAYER_MAX_HP,
  type Enemy,
} from "@/game/battle/engine";
import type { InventoryItem } from "@/game/types";

interface BattleScreenProps {
  playerId: string;
  // Derived from inventory so the loosely-coupled systems still interact.
  playerPower: number;
  onLoot: (loot: InventoryItem[]) => void;
}

function HpBar({ hp, max, color }: { hp: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (hp / max) * 100));
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-slate-800">
      <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function BattleScreen({ playerId, playerPower, onLoot }: BattleScreenProps) {
  const [level, setLevel] = useState(1);
  const [enemy, setEnemy] = useState<Enemy>(() => createEnemy(1));
  const [playerHp, setPlayerHp] = useState(PLAYER_MAX_HP);
  const [log, setLog] = useState<string[]>(["A wild enemy appears!"]);
  const [busy, setBusy] = useState(false);

  function pushLog(line: string) {
    setLog((prev) => [line, ...prev].slice(0, 6));
  }

  async function handleVictory(defeated: Enemy) {
    pushLog(`You defeated the ${defeated.name}!`);
    setBusy(true);
    try {
      const res = await fetch("/api/battle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, level: defeated.level }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.loot) && data.loot.length > 0) {
        const names = data.loot
          .map((l: InventoryItem) => `${l.glyph} ${l.name}${l.quantity > 1 ? ` ×${l.quantity}` : ""}`)
          .join(", ");
        pushLog(`Loot: ${names}`);
        onLoot(data.loot);
      }
    } catch {
      pushLog("The loot slipped away (network error).");
    } finally {
      // Advance to a tougher enemy and heal up for the next fight.
      const nextLevel = defeated.level + 1;
      setLevel(nextLevel);
      setEnemy(createEnemy(nextLevel));
      setPlayerHp(PLAYER_MAX_HP);
      setBusy(false);
    }
  }

  function handleAttack() {
    if (busy || playerHp <= 0) return;

    const playerHit = rollDamage(playerPower);
    const afterEnemy = damageEnemy(enemy, playerHit);
    pushLog(`You hit the ${enemy.name} for ${playerHit}.`);

    if (afterEnemy.hp <= 0) {
      setEnemy(afterEnemy);
      void handleVictory(afterEnemy);
      return;
    }

    // Enemy strikes back.
    const enemyHit = rollDamage(enemy.attack);
    const newPlayerHp = Math.max(0, playerHp - enemyHit);
    pushLog(`The ${enemy.name} hits you for ${enemyHit}.`);

    setEnemy(afterEnemy);
    setPlayerHp(newPlayerHp);

    if (newPlayerHp <= 0) {
      pushLog("You were defeated! Regrouping...");
      setEnemy(createEnemy(enemy.level));
      setPlayerHp(PLAYER_MAX_HP);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Battle</h2>
        <span className="text-xs text-slate-400">Depth level {level}</span>
      </div>

      {/* Enemy */}
      <div className="mb-4 flex items-center gap-4">
        <div className="grid h-16 w-16 place-items-center rounded-xl bg-slate-800 text-4xl">
          {enemy.glyph}
        </div>
        <div className="flex-1">
          <div className="mb-1 flex justify-between text-sm">
            <span className="font-medium">{enemy.name}</span>
            <span className="text-slate-400">
              {enemy.hp}/{enemy.maxHp}
            </span>
          </div>
          <HpBar hp={enemy.hp} max={enemy.maxHp} color="bg-rose-500" />
        </div>
      </div>

      {/* Player */}
      <div className="mb-4 flex items-center gap-4">
        <div className="grid h-16 w-16 place-items-center rounded-xl bg-slate-800 text-4xl">
          🧙
        </div>
        <div className="flex-1">
          <div className="mb-1 flex justify-between text-sm">
            <span className="font-medium">You</span>
            <span className="text-slate-400">
              {playerHp}/{PLAYER_MAX_HP}
            </span>
          </div>
          <HpBar hp={playerHp} max={PLAYER_MAX_HP} color="bg-emerald-500" />
          <div className="mt-1 text-[11px] text-slate-500">Attack power {playerPower}</div>
        </div>
      </div>

      <button
        onClick={handleAttack}
        disabled={busy}
        className="w-full rounded-xl bg-emerald-600 py-2.5 font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Collecting loot..." : "Attack"}
      </button>

      <ul className="mt-4 space-y-1 text-xs text-slate-400">
        {log.map((line, i) => (
          <li key={`${i}-${line}`}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
