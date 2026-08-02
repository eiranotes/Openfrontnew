export const ACTIVE_CARD =
  "is-active border-malibu-blue/70 bg-[#102a3b] text-white";
export const INACTIVE_CARD =
  "border-white/10 bg-[#10161c] text-white/60 hover:border-white/20 hover:bg-[#1b252e] hover:text-white";
export const INPUT_CLASS =
  "my-1 w-full rounded-md border border-white/15 bg-[#0b1015] p-1.5 text-center text-sm font-semibold text-white focus:border-malibu-blue focus:outline-none";
export const CARD_LABEL_CLASS =
  "text-xs font-semibold leading-tight break-words hyphens-auto";

export function cardClass(active: boolean, extra = ""): string {
  return `command-setting-card relative h-full min-h-11 w-full cursor-pointer overflow-hidden rounded-md border transition-[background-color,border-color,color,transform] duration-150 active:translate-y-px ${extra} ${active ? ACTIVE_CARD : INACTIVE_CARD}`;
}
