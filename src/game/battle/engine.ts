// SWAPPABLE MODULE: battle logic. Milestone 1 is an auto-resolving duel — the
// player and enemy trade blows automatically, player first. Pure functions only,
// so BattleScreen stays a thin renderer and this can be replaced wholesale.

export interface Combatant {
  attack: number; // attack power (drives damage)
  defense: number; // higher defense -> higher chance to BLOCK an incoming hit
  luck: number; // higher luck -> higher chance to CRIT
}

export interface Enemy extends Combatant {
  name: string;
  glyph: string;
  level: number;
  maxHp: number;
  hp: number;
}

export interface HitResult {
  damage: number;
  crit: boolean;
  blocked: boolean;
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
    defense: 1 + level,
    luck: level,
  };
}

export function damageEnemy(enemy: Enemy, amount: number): Enemy {
  return { ...enemy, hp: Math.max(0, enemy.hp - amount) };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

// A small random spread around `power` so hits feel varied.
export function rollDamage(power: number): number {
  const min = Math.max(1, Math.floor(power * 0.6));
  const max = Math.floor(power * 1.2) + 1;
  return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * Resolve one attacker -> defender hit.
 *
 * - BLOCK chance scales primarily with the DEFENDER's defense, with a bonus
 *   when defense outpaces the attacker's attack. A block negates the hit.
 * - CRIT chance scales with the ATTACKER's luck, with a bonus when their luck
 *   beats the defender's luck. A crit deals ~1.8x damage.
 */
export function resolveHit(attacker: Combatant, defender: Combatant): HitResult {
  const blockChance = clamp(
    0.02 + defender.defense * 0.011 + Math.max(0, defender.defense - attacker.attack) * 0.007,
    0,
    0.32
  );
  if (Math.random() < blockChance) {
    return { damage: 0, crit: false, blocked: true };
  }

  const critChance = clamp(
    0.05 + attacker.luck * 0.02 + Math.max(0, attacker.luck - defender.luck) * 0.025,
    0,
    0.75
  );
  const crit = Math.random() < critChance;

  let damage = rollDamage(attacker.attack);
  if (crit) damage = Math.round(damage * 1.8);

  return { damage, crit, blocked: false };
}
