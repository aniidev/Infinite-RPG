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

interface BattlePanelProps {
  playerId: string;
  // Combat stats derived from the player's EQUIPPED items (feeds the battle
  // engine exactly as the single-weapon stats did before).
  playerStats: PlayerStats;
  initialLevel: number;
  onLoot: (loot: InventoryItem[]) => void;
  onProgress: (level: number) => void;
}

type Side = "player" | "enemy";
type Status = "idle" | "fighting";

interface Fx {
  id: number;
  attacker: Side;
  target: Side;
  kind: "hit" | "crit" | "block";
  text: string;
}

interface BattleState {
  level: number;
  playerHp: number;
  enemy: Enemy;
  whose: Side;
  status: Status;
  fx: Fx | null;
  log: string[];
}

const SHAKE_MS = 450;
const TURN_DELAY = 850;

function makeInitialState(level: number): BattleState {
  const enemy = createEnemy(level);
  return {
    level,
    playerHp: PLAYER_MAX_HP,
    enemy,
    whose: "player",
    status: "idle",
    fx: null,
    log: [`A ${enemy.name} blocks your path. Press Fight when ready.`],
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
      {fx && fx.target === side && (
        <div
          key={fx.id}
          className={`pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 animate-floatUp text-sm font-bold ${fxColor(
            fx.kind
          )}`}
        >
          {fx.text}
        </div>
      )}
      <div className="flex flex-col items-center gap-2">
        <div
          className={[
            "grid h-24 w-24 place-items-center rounded-2xl border text-6xl transition",
            active ? "border-emerald-400/70 bg-slate-800" : "border-slate-700 bg-slate-800/60",
            attackClass(fx, side),
          ].join(" ")}
        >
          <span className={["inline-block", shakeClass(fx, side)].join(" ")}>{glyph}</span>
        </div>
        <div className="w-full max-w-[220px] text-center">
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

export default function BattlePanel({
  playerId,
  playerStats,
  initialLevel,
  onLoot,
  onProgress,
}: BattlePanelProps) {
  const stRef = useRef<BattleState>(makeInitialState(initialLevel));
  const [, forceRender] = useReducer((c: number) => c + 1, 0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fxCounter = useRef(0);

  const propsRef = useRef({ playerId, playerStats, onLoot, onProgress });
  propsRef.current = { playerId, playerStats, onLoot, onProgress };

  const paint = useCallback(() => forceRender(), []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const pushLog = useCallback((line: string) => {
    const st = stRef.current;
    st.log = [line, ...st.log].slice(0, 5);
  }, []);

  const onVictory = useCallback(async () => {
    const st = stRef.current;
    const defeated = st.enemy;
    pushLog(`You defeated the ${defeated.name}!`);
    st.status = "idle";
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
      if (res.ok && typeof data.lost === "number" && data.lost > 0) {
        pushLog(`Inventory full — ${data.lost} drop${data.lost > 1 ? "s" : ""} lost.`);
      }
    } catch {
      pushLog("The loot slipped away (network error).");
    }

    const nextLevel = defeated.level + 1;
    propsRef.current.onProgress(nextLevel);
    st.level = nextLevel;
    st.enemy = createEnemy(nextLevel);
    st.playerHp = PLAYER_MAX_HP;
    st.whose = "player";
    st.fx = null;
    pushLog(`Next up: Lv ${nextLevel}. Press Fight when ready.`);
    paint();
  }, [paint, pushLog]);

  const onDefeat = useCallback(() => {
    const st = stRef.current;
    pushLog("You were defeated! Regroup and try again.");
    st.status = "idle";
    st.playerHp = PLAYER_MAX_HP;
    st.enemy = createEnemy(st.level);
    st.whose = "player";
    st.fx = null;
    paint();
  }, [paint, pushLog]);

  const runTurn = useCallback(() => {
    const st = stRef.current;
    if (st.status !== "fighting") return;

    const ps = propsRef.current.playerStats;
    const whose = st.whose;
    const attacker = whose === "player" ? ps : st.enemy;
    const defender = whose === "player" ? st.enemy : ps;

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

    timerRef.current = setTimeout(() => {
      st.fx = null;
      const defenderDead = whose === "player" ? st.enemy.hp <= 0 : st.playerHp <= 0;
      if (defenderDead) {
        if (whose === "player") {
          void onVictory();
        } else {
          onDefeat();
        }
        return;
      }
      st.whose = whose === "player" ? "enemy" : "player";
      paint();
      if (st.status === "fighting") {
        timerRef.current = setTimeout(runTurnRef.current, TURN_DELAY);
      }
    }, SHAKE_MS);
  }, [paint, pushLog, onVictory, onDefeat]);

  const runTurnRef = useRef(runTurn);
  runTurnRef.current = runTurn;

  useEffect(() => () => clearTimer(), [clearTimer]);

  const startFight = useCallback(() => {
    const st = stRef.current;
    if (st.status !== "idle") return;
    st.status = "fighting";
    st.whose = "player";
    st.fx = null;
    paint();
    clearTimer();
    timerRef.current = setTimeout(() => runTurnRef.current(), 250);
  }, [clearTimer, paint]);

  const st = stRef.current;

  return (
    <div className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Battle</h2>
        <span className="text-xs text-slate-400">Depth level {st.level}</span>
      </div>

      <div className="flex items-start justify-center gap-4">
        <CombatantPanel
          side="player"
          glyph="🧙"
          name="You"
          hp={st.playerHp}
          maxHp={PLAYER_MAX_HP}
          hpColor="bg-emerald-500"
          stats={playerStats}
          active={st.status === "fighting" && st.whose === "player"}
          fx={st.fx}
        />
        <div className="mt-8 shrink-0 text-2xl text-slate-500">⚔️</div>
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

      <button
        onClick={startFight}
        disabled={st.status === "fighting"}
        className="mx-auto mt-4 w-full max-w-sm rounded-xl bg-emerald-600 py-2.5 font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {st.status === "fighting" ? "Fighting…" : `⚔️ Fight — Lv ${st.level}`}
      </button>
    </div>
  );
}
