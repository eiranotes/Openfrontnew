import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("main-layout")
export class MainLayout extends LitElement {
  private _initialChildren: Node[] = [];

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    if (this._initialChildren.length === 0 && this.childNodes.length > 0) {
      this._initialChildren = Array.from(this.childNodes);
    }
    super.connectedCallback();
  }

  render() {
    return html`
      <main
        class="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#080c10] [.in-game_&]:hidden"
      >
        <div
          class="mx-auto flex min-h-0 w-full max-w-[1440px] flex-1 flex-col overflow-y-auto overflow-x-hidden px-0 pb-0 pt-0 sm:px-4 sm:pb-4 lg:px-6 lg:pb-5 lg:pt-4"
        >
          ${this._initialChildren}
        </div>
      </main>
    `;
  }
}
