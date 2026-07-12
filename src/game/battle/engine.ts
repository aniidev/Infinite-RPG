// SWAPPABLE MODULE: battle logic. Milestone 1 is a deliberate placeholder —
// click-to-attack with HP bars. Pure functions only, so the UI (BattleScreen)
// stays a thin renderer and this can be replaced with turn order, abilities,
// status effects, etc. without touching anything else.

export interface Enemy {
  name: string;
  glyph: string;
  level: number;
  maxHp: number;
  hp: number;
  attack: number;
}

const ROSTER: ReadonlyArray<{ name: string; glyph: string }> = [
  { name: "Slime", glyph: "🟢" },
  { name: "Goblin", glyph: "👺" },
  { name: "Cave Bat", glyph: "🦇" },
  { name: "Skeleton", glyph: "💀" },
  { name: "Dire Wolf", glyph: "🐺" },
  { name: "Imp", glyph: "😈" },
  { name: "Ogre", glyph: "👹" },
  { name: "Wraith", glyph: "👻" },
];

export const PLAYER_MAX_HP = 100;

export function createEnemy(level: number): Enemy {
  const base = ROSTER[(level - 1) % ROSTER.length];
  const maxHp = 18 + level * 12;
  return {
    name: `${base.name} (Lv ${level})`,
    glyph: base.glyph,
    level,
    maxHp,
    hp: maxHp,
    attack: 4 + level * 2,
  };
}

export function damageEnemy(enemy: Enemy, amount: number): Enemy {
  return { ...enemy, hp: Math.max(0, enemy.hp - amount) };
}

// A small random spread around `power` so hits feel varied.
export function rollDamage(power: number): number {
  const min = Math.max(1, Math.floor(power * 0.6));
  const max = Math.floor(power * 1.2) + 1;
  return min + Math.floor(Math.random() * (max - min + 1));
}
