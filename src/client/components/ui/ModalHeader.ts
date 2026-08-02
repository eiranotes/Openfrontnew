import { html, TemplateResult } from "lit";

export interface ModalHeaderProps {
  title?: string | TemplateResult;
  titleContent?: TemplateResult;
  onBack: (event: MouseEvent) => void;
  ariaLabel?: string;
  rightContent?: TemplateResult;
  leftClassName?: string;
  buttonClassName?: string;
  titleClassName?: string;
  padded?: boolean;
  showDivider?: boolean;
}

const DEFAULT_WRAPPER_CLASS =
  "flex min-h-14 shrink-0 flex-wrap items-center gap-2 bg-[#0d1318]";
const DEFAULT_DIVIDER_CLASS = "border-b border-white/10";
const DEFAULT_PADDING_CLASS =
  "px-3 py-2 pt-[calc(8px+env(safe-area-inset-top))] sm:px-4 sm:pt-2";
const DEFAULT_LEFT_CLASS = "flex min-w-0 flex-1 items-center gap-3";
const DEFAULT_BUTTON_CLASS =
  "group flex h-10 w-10 shrink-0 items-center justify-center rounded-md " +
  "border border-white/10 bg-[#10161c] text-white/60 " +
  "transition-[background-color,border-color,color,transform] duration-150 " +
  "hover:border-white/20 hover:bg-[#1b252e] hover:text-white active:translate-y-px";
const DEFAULT_TITLE_CLASS =
  "min-w-0 break-words text-lg font-semibold leading-tight text-white sm:text-xl";

const withClasses = (...classes: Array<string | undefined>) =>
  classes.filter(Boolean).join(" ");

export const modalHeader = ({
  title,
  titleContent,
  onBack,
  ariaLabel = "Back",
  rightContent,
  leftClassName,
  buttonClassName,
  titleClassName,
  padded = true,
  showDivider = true,
}: ModalHeaderProps): TemplateResult => {
  const wrapperClass = withClasses(
    DEFAULT_WRAPPER_CLASS,
    showDivider ? DEFAULT_DIVIDER_CLASS : undefined,
    padded ? DEFAULT_PADDING_CLASS : undefined,
  );
  const leftClass = withClasses(DEFAULT_LEFT_CLASS, leftClassName);
  const buttonClass = withClasses(DEFAULT_BUTTON_CLASS, buttonClassName);
  const resolvedTitleClass = withClasses(DEFAULT_TITLE_CLASS, titleClassName);

  return html`
    <div class=${wrapperClass}>
      <div class=${leftClass}>
        <button @click=${onBack} class=${buttonClass} aria-label=${ariaLabel}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
        </button>
        ${titleContent ?? html`<span class=${resolvedTitleClass}>${title}</span>`}
      </div>
      ${rightContent ?? ""}
    </div>
  `;
};
