"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  createEnemy,
  resolveHit,
  PLAYER_MAX_HP,
  type Enemy,
  type HitResult,
} from "@/game/battle/engine";
import type { InventoryItem } from "@/game/types";

export interface PlayerStats {
  attack: number;
  defense: number;
  luck: number;
}

interface BattleScreenProps {
  playerId: string;
  // Derived from inventory so the loosely-coupled systems still interact.
  playerStats: PlayerStats;
  onLoot: (loot: InventoryItem[]) => void;
}

type Side = "player" | "enemy";
type Status = "fighting" | "victory" | "defeat";

interface Fx {
  id: number;
  attacker: Side;
  target: Side; // who got hit
  kind: "hit" | "crit" | "block";
  text: string;
}

interface BattleState {
  level: number;
  playerHp: number;
  enemy: Enemy;
  whose: Side; // whose turn it is to attack
  status: Status;
  paused: boolean;
  fx: Fx | null;
  log: string[];
}

// Timing (ms). Player hits first, impact resolves, then a 0.5s beat before the reply.
const SHAKE_MS = 300;
const TURN_DELAY = 500;
const RESPAWN_DELAY = 700;
const DEFEAT_DELAY = 900;

function makeInitialState(): BattleState {
  return {
    level: 1,
    playerHp: PLAYER_MAX_HP,
    enemy: createEnemy(1),
    whose: "player",
    status: "fighting",
    paused: false,
    fx: null,
    log: ["A wild enemy appears!"],
  };
}

function HpBar({ hp, max, color }: { hp: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (hp / max) * 100));
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-slate-800">
      <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function shakeClass(fx: Fx | null, side: Side): string {
  if (!fx || fx.target !== side) return "";
  if (fx.kind === "crit") return "animate-shakeHard";
  if (fx.kind === "block") return "animate-block";
  return "animate-shake";
}

function attackClass(fx: Fx | null, side: Side): string {
  if (!fx || fx.attacker !== side) return "";
  return side === "player" ? "animate-strikeRight" : "animate-strikeLeft";
}

function fxColor(kind: Fx["kind"]): string {
  if (kind === "crit") return "text-amber-300";
  if (kind === "block") return "text-sky-300";
  return "text-rose-300";
}

function CombatantPanel({
  side,
  glyph,
  name,
  hp,
  maxHp,
  hpColor,
  stats,
  active,
  fx,
}: {
  side: Side;
  glyph: string;
  name: string;
  hp: number;
  maxHp: number;
  hpColor: string;
  stats: PlayerStats;
  active: boolean;
  fx: Fx | null;
}) {
  return (
    <div className="relative flex-1">
      {/* floating combat text */}
      {fx && fx.target === side && (
        <div
          key={fx.id}
          className={`pointer-events-none absolute left-1/2 top-6 z-10 -translate-x-1/2 animate-floatUp text-sm font-bold ${fxColor(
            fx.kind
          )}`}
        >
          {fx.text}
        </div>
      )}
      <div className="flex flex-col items-center gap-2">
        <div
          className={[
            "grid h-20 w-20 place-items-center rounded-2xl border text-5xl transition",
            active ? "border-emerald-400/70 bg-slate-800" : "border-slate-700 bg-slate-800/60",
            attackClass(fx, side),
          ].join(" ")}
        >
          <span className={["inline-block", shakeClass(fx, side)].join(" ")}>{glyph}</span>
        </div>
        <div className="w-full text-center">
          <div className="truncate text-sm font-medium">{name}</div>
          <div className="mb-1 text-xs text-slate-400">
            {hp}/{maxHp}
          </div>
          <HpBar hp={hp} max={maxHp} color={hpColor} />
          <div className="mt-1 text-[11px] text-slate-500">
            ⚔️{stats.attack} 🛡️{stats.defense} 🍀{stats.luck}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BattleScreen({ playerId, playerStats, onLoot }: BattleScreenProps) {
  // The battle runs on an imperative timer loop; we keep state in a ref and
  // force re-renders so timeout callbacks always read the latest values.
  const stRef = useRef<BattleState>(makeInitialState());
  const [, forceRender] = useReducer((c: number) => c + 1, 0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fxCounter = useRef(0);

  // Mirror props into a ref so the loop reads live values (loot changes stats).
  const propsRef = useRef({ playerId, playerStats, onLoot });
  propsRef.current = { playerId, playerStats, onLoot };

  const paint = useCallback(() => forceRender(), []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const pushLog = useCallback((line: string) => {
    const st = stRef.current;
    st.log = [line, ...st.log].slice(0, 6);
  }, []);

  const onVictory = useCallback(async () => {
    const st = stRef.current;
    const defeated = st.enemy;
    pushLog(`You defeated the ${defeated.name}!`);
    paint();

    try {
      const res = await fetch("/api/battle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: propsRef.current.playerId, level: defeated.level }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.loot) && data.loot.length > 0) {
        const names = data.loot
          .map((l: InventoryItem) => `${l.glyph} ${l.name}${l.quantity > 1 ? ` ×${l.quantity}` : ""}`)
          .join(", ");
        pushLog(`Loot: ${names}`);
        propsRef.current.onLoot(data.loot);
      }
    } catch {
      pushLog("The loot slipped away (network error).");
    }

    // Respawn a tougher enemy and heal up.
    const nextLevel = defeated.level + 1;
    st.level = nextLevel;
    st.enemy = createEnemy(nextLevel);
    st.playerHp = PLAYER_MAX_HP;
    st.whose = "player";
    st.status = "fighting";
    st.fx = null;
    paint();
    if (!st.paused) timerRef.current = setTimeout(runTurnRef.current, RESPAWN_DELAY);
  }, [paint, pushLog]);

  const onDefeat = useCallback(() => {
    const st = stRef.current;
    pushLog("You were defeated! Regrouping…");
    paint();
    timerRef.current = setTimeout(() => {
      st.enemy = createEnemy(st.level);
      st.playerHp = PLAYER_MAX_HP;
      st.whose = "player";
      st.status = "fighting";
      st.fx = null;
      paint();
      if (!st.paused) timerRef.current = setTimeout(runTurnRef.current, RESPAWN_DELAY);
    }, DEFEAT_DELAY);
  }, [paint, pushLog]);

  const runTurn = useCallback(() => {
    const st = stRef.current;
    if (st.status !== "fighting" || st.paused) return;

    const ps = propsRef.current.playerStats;
    const playerC = { attack: ps.attack, defense: ps.defense, luck: ps.luck };
    const whose = st.whose;
    const attacker = whose === "player" ? playerC : st.enemy;
    const defender = whose === "player" ? st.enemy : playerC;

    const res: HitResult = resolveHit(attacker, defender);
    const targetSide: Side = whose === "player" ? "enemy" : "player";

    if (whose === "player") {
      st.enemy = { ...st.enemy, hp: Math.max(0, st.enemy.hp - res.damage) };
    } else {
      st.playerHp = Math.max(0, st.playerHp - res.damage);
    }

    st.fx = {
      id: ++fxCounter.current,
      attacker: whose,
      target: targetSide,
      kind: res.blocked ? "block" : res.crit ? "crit" : "hit",
      text: res.blocked ? "BLOCK" : res.crit ? `CRIT ${res.damage}` : `${res.damage}`,
    };

    const who = whose === "player" ? "You" : `The ${st.enemy.name}`;
    const target = whose === "player" ? `the ${st.enemy.name}` : "you";
    pushLog(
      res.blocked
        ? `${who} attacked — ${whose === "player" ? "blocked!" : "you blocked!"}`
        : `${who} hit ${target} for ${res.damage}${res.crit ? " (CRIT!)" : ""}.`
    );
    paint();

    // After the shake, clear the fx and either end the fight or hand off the turn.
    timerRef.current = setTimeout(() => {
      st.fx = null;
      const defenderDead = whose === "player" ? st.enemy.hp <= 0 : st.playerHp <= 0;
      if (defenderDead) {
        if (whose === "player") {
          st.status = "victory";
          paint();
          void onVictory();
        } else {
          st.status = "defeat";
          paint();
          onDefeat();
        }
        return;
      }
      st.whose = whose === "player" ? "enemy" : "player";
      paint();
      if (!st.paused) timerRef.current = setTimeout(runTurnRef.current, TURN_DELAY);
    }, SHAKE_MS);
  }, [paint, pushLog, onVictory, onDefeat]);

  // Stable indirection so timeouts always call the latest runTurn.
  const runTurnRef = useRef(runTurn);
  runTurnRef.current = runTurn;

  // Kick off the loop on mount; clean up timers on unmount.
  useEffect(() => {
    timerRef.current = setTimeout(() => runTurnRef.current(), 400);
    return () => clearTimer();
  }, [clearTimer]);

  const togglePause = useCallback(() => {
    const st = stRef.current;
    st.paused = !st.paused;
    clearTimer();
    if (!st.paused && st.status === "fighting") {
      timerRef.current = setTimeout(() => runTurnRef.current(), 200);
    }
    paint();
  }, [clearTimer, paint]);

  const st = stRef.current;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Battle</h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">Depth level {st.level}</span>
          <button
            onClick={togglePause}
            className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700"
          >
            {st.paused ? "Resume" : "Pause"}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <CombatantPanel
          side="player"
          glyph="🧙"
          name="You"
          hp={st.playerHp}
          maxHp={PLAYER_MAX_HP}
          hpColor="bg-emerald-500"
          stats={propsRef.current.playerStats}
          active={st.status === "fighting" && st.whose === "player"}
          fx={st.fx}
        />

        <div className="shrink-0 px-1 text-2xl text-slate-500">⚔️</div>

        <CombatantPanel
          side="enemy"
          glyph={st.enemy.glyph}
          name={st.enemy.name}
          hp={st.enemy.hp}
          maxHp={st.enemy.maxHp}
          hpColor="bg-rose-500"
          stats={{ attack: st.enemy.attack, defense: st.enemy.defense, luck: st.enemy.luck }}
          active={st.status === "fighting" && st.whose === "enemy"}
          fx={st.fx}
        />
      </div>

      <ul className="mt-5 space-y-1 text-xs text-slate-400">
        {st.log.map((line, i) => (
          <li key={`${i}-${line}`}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
