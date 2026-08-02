import fs from "node:fs";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import {
  DragEvent,
  InputHandler,
  TouchEvent,
} from "../src/client/InputHandler";
import { UIState } from "../src/client/UIState";
import { GameView } from "../src/client/view";
import { EventBus } from "../src/core/EventBus";

class MockPointerEvent {
  button: number;
  clientX: number;
  clientY: number;
  x: number;
  y: number;
  pointerId: number;
  type: string;
  pointerType: string;
  preventDefault = vi.fn();

  constructor(type: string, init: PointerEventInit & { clientX: number; clientY: number }) {
    this.type = type;
    this.button = init.button ?? 0;
    this.clientX = init.clientX;
    this.clientY = init.clientY;
    this.x = init.clientX;
    this.y = init.clientY;
    this.pointerId = init.pointerId ?? 1;
    this.pointerType = init.pointerType ?? "touch";
  }
}

const NativePointerEvent = globalThis.PointerEvent;

describe("touch selection and map-first country UI", () => {
  let inputHandler: InputHandler;
  let eventBus: EventBus;

  beforeAll(() => {
    globalThis.PointerEvent = MockPointerEvent as unknown as typeof PointerEvent;
  });

  afterAll(() => {
    globalThis.PointerEvent = NativePointerEvent;
  });

  beforeEach(() => {
    eventBus = new EventBus();
    inputHandler = new InputHandler(
      {
        inSpawnPhase: () => false,
        myPlayer: () => ({ isAlive: () => true }),
      } as GameView,
      {
        attackRatio: 0.2,
        ghostStructure: null,
        rocketDirectionUp: true,
      } as UIState,
      document.createElement("canvas"),
      eventBus,
    );
  });

  afterEach(() => inputHandler.destroy());

  test("accepts normal finger jitter as one tap without panning", () => {
    const emit = vi.spyOn(eventBus, "emit");
    inputHandler["onPointerDown"](
      new PointerEvent("pointerdown", {
        button: 0,
        clientX: 100,
        clientY: 100,
        pointerId: 1,
        pointerType: "touch",
      }),
    );
    inputHandler["onPointerMove"](
      new PointerEvent("pointermove", {
        button: 0,
        clientX: 113,
        clientY: 113,
        pointerId: 1,
        pointerType: "touch",
      }),
    );
    inputHandler["onPointerUp"](
      new PointerEvent("pointerup", {
        button: 0,
        clientX: 113,
        clientY: 113,
        pointerId: 1,
        pointerType: "touch",
      }),
    );

    expect(emit.mock.calls.some(([event]) => event instanceof TouchEvent)).toBe(true);
    expect(emit.mock.calls.some(([event]) => event instanceof DragEvent)).toBe(false);
  });

  test("turns a deliberate finger movement into a pan instead of a tap", () => {
    const emit = vi.spyOn(eventBus, "emit");
    inputHandler["onPointerDown"](
      new PointerEvent("pointerdown", {
        button: 0,
        clientX: 100,
        clientY: 100,
        pointerId: 1,
        pointerType: "touch",
      }),
    );
    inputHandler["onPointerMove"](
      new PointerEvent("pointermove", {
        button: 0,
        clientX: 128,
        clientY: 128,
        pointerId: 1,
        pointerType: "touch",
      }),
    );
    inputHandler["onPointerUp"](
      new PointerEvent("pointerup", {
        button: 0,
        clientX: 128,
        clientY: 128,
        pointerId: 1,
        pointerType: "touch",
      }),
    );

    expect(emit.mock.calls.some(([event]) => event instanceof DragEvent)).toBe(true);
    expect(emit.mock.calls.some(([event]) => event instanceof TouchEvent)).toBe(false);
  });

  test("uses immediate selection feedback and a pointer-pass-through dock", () => {
    const input = fs.readFileSync("src/client/InputHandler.ts", "utf8");
    const menu = fs.readFileSync("src/client/hud/layers/MainRadialMenu.ts", "utf8");
    const panel = fs.readFileSync("src/client/hud/layers/PlayerPanel.ts", "utf8");
    const css = fs.readFileSync("src/client/styles/command-ui.css", "utf8");

    expect(input).toContain("TOUCH_TAP_SLOP_PX = 22");
    expect(menu).toContain("this.playerPanel.beginSelection(tile)");
    expect(menu).toContain("selectionRequest");
    expect(panel).toContain("public beginSelection(tile: TileRef)");
    expect(panel).toContain('aria-modal="false"');
    expect(css).toMatch(/\.command-player-layer\s*\{[^}]*pointer-events:\s*none/s);
    expect(css).toMatch(/\.command-player-dock\s*\{[^}]*pointer-events:\s*auto/s);
  });
});
