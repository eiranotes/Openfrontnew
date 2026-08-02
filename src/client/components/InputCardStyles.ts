export const ACTIVE_CARD =
  "bg-[#17232d] border-malibu-blue text-white";
export const INACTIVE_CARD =
  "bg-[#11171e] border-white/10 text-white/70 hover:border-white/25 hover:bg-[#171e27]";
export const INPUT_CLASS =
  "fortress-control w-full min-h-10 rounded-[4px] bg-[#0d1116] px-2 text-center text-sm font-semibold text-white tabular-nums border border-white/15 outline-none focus-visible:border-malibu-blue focus-visible:ring-2 focus-visible:ring-malibu-blue/25";
export const CARD_LABEL_CLASS =
  "text-sm font-medium leading-tight break-words hyphens-auto";

export function cardClass(active: boolean, extra = ""): string {
  return `fortress-control relative w-full h-full overflow-hidden rounded-[4px] border cursor-pointer transition-[color,background-color,border-color,opacity,transform] duration-150 active:translate-y-px ${extra} ${active ? ACTIVE_CARD : INACTIVE_CARD}`;
}
