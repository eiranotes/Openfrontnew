import { html, TemplateResult } from "lit";

export type ButtonVariant =
  | "normal"
  | "red"
  | "green"
  | "indigo"
  | "yellow"
  | "sky";
export type ActionPriority = "primary" | "secondary" | "quiet";
export type ActionLayout = "inline" | "stacked";

export interface ActionButtonProps {
  onClick: (e: MouseEvent) => void;
  type?: ButtonVariant;
  icon: string;
  iconAlt: string;
  title: string;
  label: string;
  disabled?: boolean;
  priority?: ActionPriority;
  layout?: ActionLayout;
}

export const actionButton = (props: ActionButtonProps): TemplateResult => {
  const {
    onClick,
    type = "normal",
    icon,
    iconAlt,
    title,
    label,
    disabled = false,
    priority = "secondary",
    layout = "inline",
  } = props;

  return html`
    <button
      @click=${onClick}
      class="command-action-control"
      data-variant=${type}
      data-priority=${priority}
      data-layout=${layout}
      title=${title}
      type="button"
      aria-label=${title}
      ?disabled=${disabled}
    >
      <img src=${icon} alt=${iconAlt} aria-hidden="true" />
      <span>${label}</span>
    </button>
  `;
};
