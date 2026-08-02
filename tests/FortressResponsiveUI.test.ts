import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(path, "utf8");
}

describe("Fortress responsive command interface", () => {
  it("exposes military, training, administration, and income details", () => {
    const controlPanel = source("src/client/hud/layers/ControlPanel.ts");
    expect(controlPanel).toContain("행정 효율");
    expect(controlPanel).toContain("총 금 수입");
    expect(controlPanel).toContain("훈련 병력");
    expect(controlPanel).toContain("군사 개혁 완료");
    expect(controlPanel).toContain('aria-expanded=${this._developmentExpanded}');
  });

  it("provides a touch-first mobile build sheet", () => {
    const display = source("src/client/hud/layers/UnitDisplay.ts");
    expect(display).toContain("건설 시설 선택");
    expect(display).toContain("min-h-16");
    expect(display).toContain("min-h-11");
  });

  it("shows opponent quality and selected-city development on the map overlay", () => {
    const overlay = source("src/client/hud/layers/PlayerInfoOverlay.ts");
    expect(overlay).toContain("상대 전투력");
    expect(overlay).toContain("선택한 도시 발전 정보");
    expect(overlay).toContain("cityUpgradePreview");
  });

  it("previews city economy and military effects before construction", () => {
    const buildMenu = source("src/client/hud/layers/BuildMenu.ts");
    expect(buildMenu).toContain("도시 발전 미리보기");
    expect(buildMenu).toContain("전체 도시 생산");
    expect(buildMenu).toContain("훈련 수용량");
    expect(buildMenu).toContain("행정 수용량");
    expect(buildMenu).toContain("최대 병력");
    expect(buildMenu).toContain("cityUpgradePreview");
  });

  it("renders city development bands directly on the map", () => {
    const structurePass = source(
      "src/client/render/gl/passes/StructurePass.ts",
    );
    const vertexShader = source(
      "src/client/render/gl/shaders/structure/structure.vert.glsl",
    );
    const fragmentShader = source(
      "src/client/render/gl/shaders/structure/structure.frag.glsl",
    );
    expect(structurePass).toContain("developmentBand");
    expect(structurePass).toContain("unit.level");
    expect(vertexShader).toContain("developmentScale");
    expect(fragmentShader).toContain("City development is visible directly");
  });

  it("removes generic hover scaling from renovated surfaces", () => {
    const files = [
      "src/client/components/baseComponents/Button.ts",
      "src/client/components/baseComponents/Modal.ts",
      "src/client/components/GameConfigSettings.ts",
      "src/client/GameModeSelector.ts",
      "src/client/hud/layers/BuildMenu.ts",
    ];
    for (const file of files) {
      const text = source(file);
      expect(text, file).not.toMatch(/hover:scale|transition-all/);
    }
  });
});
