import { LitElement, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import type { NewsItem } from "../../core/ApiSchemas";
import { getNews } from "../Api";
import { renderMarkdown } from "../Markdown";
import { translateText } from "../Utils";

export type { NewsItem };

const DISMISSED_NEWS_KEY = "dismissedNewsItems";
const CYCLE_INTERVAL_MS = 5000;

function getDismissedIds(): Set<string> {
  const raw = localStorage.getItem(DISMISSED_NEWS_KEY);
  if (raw) return new Set(JSON.parse(raw));
  return new Set();
}

function saveDismissedIds(ids: Set<string>): void {
  localStorage.setItem(DISMISSED_NEWS_KEY, JSON.stringify([...ids]));
}

export function getVisibleNewsItems(items: NewsItem[]): NewsItem[] {
  const dismissed = getDismissedIds();
  return items.filter((item) => !dismissed.has(item.id));
}

const typeLabelKeys: Record<string, string> = {
  tournament: "news_box.tournament",
  tutorial: "news_box.tutorial",
  announcement: "news_box.news",
  warning: "news_box.warning",
};

@customElement("news-box")
export class NewsBox extends LitElement {
  @state() private items: NewsItem[] = [];
  @state() private activeIndex = 0;
  private cycleTimer: ReturnType<typeof setInterval> | null = null;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.loadNews();
  }

  private async loadNews() {
    try {
      const allItems = await getNews();
      const visible = getVisibleNewsItems(allItems);
      if (visible.length === 0 && allItems.length > 0) {
        localStorage.removeItem(DISMISSED_NEWS_KEY);
        this.items = allItems;
      } else {
        this.items = visible;
      }
      this.startCycle();
    } catch (e) {
      console.error(e);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stopCycle();
  }

  private startCycle() {
    this.stopCycle();
    if (this.items.length > 1) {
      this.cycleTimer = setInterval(() => {
        this.activeIndex = (this.activeIndex + 1) % this.items.length;
      }, CYCLE_INTERVAL_MS);
    }
  }

  private stopCycle() {
    if (this.cycleTimer !== null) {
      clearInterval(this.cycleTimer);
      this.cycleTimer = null;
    }
  }

  private dismiss(id: string) {
    const dismissed = getDismissedIds();
    dismissed.add(id);
    saveDismissedIds(dismissed);
    this.items = this.items.filter((item) => item.id !== id);
    if (this.activeIndex >= this.items.length) this.activeIndex = 0;
    this.startCycle();
  }

  private goTo(index: number) {
    this.activeIndex = index;
    this.startCycle();
  }

  render() {
    if (this.items.length === 0) return nothing;
    const item = this.items[this.activeIndex];

    return html`
      <aside class="command-news-box" data-news-type=${item.type}>
        <span class="command-news-tag">
          ${translateText(
            typeLabelKeys[item.type] ?? typeLabelKeys["announcement"],
          )}
        </span>
        <div class="command-news-copy">
          ${item.url
            ? html`<a
                href=${item.url}
                target="_blank"
                rel="noopener noreferrer"
                class="command-news-title"
                >${item.title}</a
              >`
            : html`<span class="command-news-title">${item.title}</span>`}
          <span class="command-news-description">
            ${renderMarkdown(
              item.descriptionTranslationKey
                ? translateText(item.descriptionTranslationKey)
                : (item.description ?? ""),
            )}
          </span>
        </div>
        ${this.items.length > 1
          ? html`<div class="command-news-pagination">
              ${this.items.map(
                (_, i) => html`
                  <button
                    @click=${() => this.goTo(i)}
                    data-active=${i === this.activeIndex ? "true" : "false"}
                    aria-label=${translateText("news_box.go_to_item", {
                      num: i + 1,
                    })}
                  ></button>
                `,
              )}
            </div>`
          : nothing}
        <button
          @click=${() => this.dismiss(item.id)}
          class="command-news-dismiss"
          aria-label=${translateText("news_box.dismiss")}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
            />
          </svg>
        </button>
      </aside>
    `;
  }
}
