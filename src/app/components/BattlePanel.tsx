"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  createEnemy,
  resolveHit,
  winsForLevel,
  type Enemy,
  type HitResult,
} from "@/game/battle/engine";
import type { InventoryItem } from "@/game/types";

export interface PlayerStats {
  attack: number;
  defense: number;
  luck: number;
  maxHp: number; // 100 base + summed health of everything equipped
}

// Level-up progress the panel reports upward so the equipped column can draw the
// player's level and its progress bar.
export interface LevelProgress {
  level: number;
  winsIntoLevel: number;
  winsNeeded: number;
}

interface BattlePanelProps {
  playerId: string;
  playerStats: PlayerStats;
  initialLevel: number;
  onLoot: (loot: InventoryItem[]) => void;
  onProgress: (progress: LevelProgress) => void;
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
  winsIntoLevel: number;
  playerHp: number;
  enemy: Enemy;
  whose: Side;
  status: Status;
  fx: Fx | null;
  log: string[];
}

const SHAKE_MS = 450;
const TURN_DELAY = 850;

// Knock the 3D emoji back into the flat paper world (matches ItemCard). One
// place here, removable in one line.
const GLYPH_FILTER = { filter: "saturate(0.65) contrast(1.05) sepia(0.15)" } as const;

function makeInitialState(level: number, maxHp: number): BattleState {
  const enemy = createEnemy(level);
  return {
    level,
    winsIntoLevel: 0,
    playerHp: maxHp,
    enemy,
    whose: "player",
    status: "idle",
    fx: null,
    log: [`A ${enemy.name} blocks your path.`],
  };
}

// Flat rust fill in an ink trough: no gradient, no glow, no rounded ends.
function HpBar({ hp, max }: { hp: number; max: number }) {
  const pct = Math.max(0, Math.min(100, (hp / max) * 100));
  return (
    <div className="h-3.5 w-full overflow-hidden border-2 border-ink bg-stone-950">
      <div className="h-full bg-rust transition-[width] duration-150" style={{ width: `${pct}%` }} />
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
  if (kind === "crit") return "text-brass";
  if (kind === "block") return "text-steel";
  return "text-rust";
}

function CombatantPanel({
  side,
  glyph,
  name,
  hp,
  maxHp,
  stats,
  active,
  fx,
}: {
  side: Side;
  glyph: string;
  name: string;
  hp: number;
  maxHp: number;
  stats: { attack: number; defense: number; luck: number };
  active: boolean;
  fx: Fx | null;
}) {
  return (
    <div className="relative flex-1">
      {fx && fx.target === side && (
        <div
          key={fx.id}
          className={`pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 animate-floatUp font-display text-sm tabular-nums ${fxColor(
            fx.kind
          )}`}
        >
          {fx.text}
        </div>
      )}
      <div className="flex flex-col items-center gap-2">
        <div
          className={[
            "grid h-24 w-24 place-items-center rounded-paper border-2 border-ink text-6xl transition",
            active ? "bg-stone-600 outline outline-2 outline-brass outline-offset-2" : "bg-stone-700",
            attackClass(fx, side),
          ].join(" ")}
        >
          <span style={GLYPH_FILTER} className={["inline-block", shakeClass(fx, side)].join(" ")}>
            {glyph}
          </span>
        </div>
        <div className="w-full max-w-[220px] text-center">
          <div className="truncate font-display text-sm tracking-wide text-primary">{name}</div>
          <div className="mb-1 font-body text-xs tabular-nums text-secondary">
            {hp}/{maxHp}
          </div>
          <HpBar hp={hp} max={maxHp} />
          <div className="mt-1 flex justify-center gap-2 font-body text-[11px] tabular-nums text-secondary">
            <span>
              <span className="font-display text-[9px] tracking-wide">ATK</span> {stats.attack}
            </span>
            <span>
              <span className="font-display text-[9px] tracking-wide">DEF</span> {stats.defense}
            </span>
            <span>
              <span className="font-display text-[9px] tracking-wide">LCK</span> {stats.luck}
            </span>
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
  const stRef = useRef<BattleState>(makeInitialState(initialLevel, playerStats.maxHp));
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
    const defeatedLevel = defeated.level;
    pushLog(`You defeated the ${defeated.name}!`);
    st.status = "idle";

    // Count the win; level up once enough wins are banked for this level.
    st.winsIntoLevel += 1;
    if (st.winsIntoLevel >= winsForLevel(st.level)) {
      st.level += 1;
      st.winsIntoLevel = 0;
      pushLog(`You reached level ${st.level}!`);
    }
    propsRef.current.onProgress({
      level: st.level,
      winsIntoLevel: st.winsIntoLevel,
      winsNeeded: winsForLevel(st.level),
    });
    paint();

    try {
      const res = await fetch("/api/battle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: propsRef.current.playerId,
          level: defeatedLevel, // loot scales with the enemy just defeated
          playerLevel: st.level, // persist the player's (possibly new) level
        }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.loot) && data.loot.length > 0) {
        propsRef.current.onLoot(data.loot);
      }
    } catch {
      pushLog("The loot slipped away (network error).");
    }

    // Next enemy tracks the player's current level (only bumped on level-up).
    st.enemy = createEnemy(st.level);
    st.playerHp = propsRef.current.playerStats.maxHp;
    st.whose = "player";
    st.fx = null;
    paint();
  }, [paint, pushLog]);

  const onDefeat = useCallback(() => {
    const st = stRef.current;
    st.status = "idle";
    st.playerHp = propsRef.current.playerStats.maxHp;
    st.enemy = createEnemy(st.level);
    st.whose = "player";
    st.fx = null;
    paint();
  }, [paint]);

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
  }, [paint, onVictory, onDefeat]);

  const runTurnRef = useRef(runTurn);
  runTurnRef.current = runTurn;

  useEffect(() => () => clearTimer(), [clearTimer]);

  const startFight = useCallback(() => {
    const st = stRef.current;
    if (st.status !== "idle") return;
    st.status = "fighting";
    st.whose = "player";
    st.playerHp = propsRef.current.playerStats.maxHp; // start full with current gear
    st.fx = null;
    paint();
    clearTimer();
    timerRef.current = setTimeout(() => runTurnRef.current(), 250);
  }, [clearTimer, paint]);

  const st = stRef.current;
  const playerMaxHp = playerStats.maxHp;
  // While idle the player stands at full health (reflects the current gear's HP).
  const playerHpShown = st.status === "idle" ? playerMaxHp : st.playerHp;

  return (
    <div className="panel flex flex-col px-4 py-2.5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-display text-lg tracking-wide text-primary">Battle</h2>
      </div>

      <div className="flex items-start justify-center gap-4">
        <CombatantPanel
          side="player"
          glyph="🧙"
          name="You"
          hp={playerHpShown}
          maxHp={playerMaxHp}
          stats={playerStats}
          active={st.status === "fighting" && st.whose === "player"}
          fx={st.fx}
        />
        <div className="mt-8 shrink-0 text-2xl text-secondary">⚔️</div>
        <CombatantPanel
          side="enemy"
          glyph={st.enemy.glyph}
          name={st.enemy.name}
          hp={st.enemy.hp}
          maxHp={st.enemy.maxHp}
          stats={{ attack: st.enemy.attack, defense: st.enemy.defense, luck: st.enemy.luck }}
          active={st.status === "fighting" && st.whose === "enemy"}
          fx={st.fx}
        />
      </div>

      <button
        onClick={startFight}
        disabled={st.status === "fighting"}
        className="press mx-auto mt-3 w-full max-w-sm rounded-paper border-2 border-ink bg-brass py-2.5 font-display uppercase tracking-wide text-ink disabled:cursor-not-allowed"
      >
        {st.status === "fighting" ? "Fighting…" : "Fight"}
      </button>
    </div>
  );
}
