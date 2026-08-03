import { Gold, Tick } from "./Game";

export const COORDINATED_ATTACK_DELAY_TICKS = 50;
export const MIN_ALLIANCE_GOLD_RESERVE = 125_000n;
export const ALLIANCE_GOLD_RESERVE_DIVISOR = 5n;
export const ALLIANCE_GOLD_TRANSFER_DIVISOR = 5n;
export const ALLIANCE_TROOP_RESERVE_RATIO = 0.55;

export function coordinatedAttackTick(currentTick: Tick): Tick {
  return currentTick + COORDINATED_ATTACK_DELAY_TICKS;
}

export function allianceGoldSupportAmount(gold: Gold): Gold {
  const proportionalReserve = gold / ALLIANCE_GOLD_RESERVE_DIVISOR;
  const reserve =
    proportionalReserve > MIN_ALLIANCE_GOLD_RESERVE
      ? proportionalReserve
      : MIN_ALLIANCE_GOLD_RESERVE;
  const available = gold - reserve;
  return available > 0n
    ? available / ALLIANCE_GOLD_TRANSFER_DIVISOR
    : 0n;
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
