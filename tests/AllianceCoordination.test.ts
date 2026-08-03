import "./LandingOperations.test";
import "./TouchSelectionUi.test";
import { describe, expect, it } from "vitest";
import {
  allianceGoldSupportAmount,
  allianceTroopSupportAmount,
  coordinatedAttackTick,
} from "../src/core/game/AllianceCoordination";

describe("alliance coordination", () => {
  it("uses a shared five-second execution tick for coordinated attacks", () => {
    expect(coordinatedAttackTick(120)).toBe(170);
  });

  it("keeps a gold reserve and sends one fifth of the surplus", () => {
    expect(allianceGoldSupportAmount(15_000n)).toBe(0n);
    expect(allianceGoldSupportAmount(120_000n)).toBe(20_000n);
  });

  it("only donates troops above the reserve and caps support at twelve percent", () => {
    expect(allianceTroopSupportAmount(50_000, 100_000)).toBe(0);
    expect(allianceTroopSupportAmount(80_000, 100_000)).toBe(9_600);
    expect(allianceTroopSupportAmount(60_000, 100_000)).toBe(5_000);
  });
});
