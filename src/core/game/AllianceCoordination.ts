import { Gold, Tick } from "./Game";

export const COORDINATED_ATTACK_DELAY_TICKS = 50;
export const ALLIANCE_GOLD_RESERVE = 20_000n;
export const ALLIANCE_TROOP_RESERVE_RATIO = 0.55;

export function coordinatedAttackTick(currentTick: Tick): Tick {
  return currentTick + COORDINATED_ATTACK_DELAY_TICKS;
}

export function allianceGoldSupportAmount(gold: Gold): Gold {
  const available = gold - ALLIANCE_GOLD_RESERVE;
  return available > 0n ? available / 5n : 0n;
}

export function allianceTroopSupportAmount(
  troops: number,
  maxTroops: number,
): number {
  const reserve = Math.ceil((maxTroops * 55) / 100);
  const available = troops - reserve;
  if (available <= 0) return 0;
  return Math.floor(Math.min(available, troops * 0.12));
}
