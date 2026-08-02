import fs from "node:fs";
import path from "node:path";
const root = path.resolve(process.argv[2] ?? ".");
const resolve = (p) => path.join(root, p);
const read = (p) => fs.readFileSync(resolve(p), "utf8");
const write = (p, c) => fs.writeFileSync(resolve(p), c);
function replaceOnce(file, before, after, label) {
  let content = read(file);
  if (content.includes(after)) return;
  if (!content.includes(before)) throw new Error(`Range patch anchor missing: ${label}`);
  write(file, content.replace(before, after));
}
replaceOnce(
  "src/client/hud/layers/UnitDisplay.ts",
  `          @click=\${() => {
            if (selected) {
              this.uiState.ghostStructure = null;
            } else if (this.canBuild(unitType)) {
              this.uiState.ghostStructure = unitType;
            }
            this.requestUpdate();
          }}`,
  `          @click=\${() => {
            if (selected) {
              this.uiState.ghostStructure = null;
              this.eventBus?.emit(new ToggleStructureEvent(null));
            } else if (this.canBuild(unitType)) {
              this.uiState.ghostStructure = unitType;
              switch (unitType) {
                case UnitType.AtomBomb:
                case UnitType.HydrogenBomb:
                  this.eventBus?.emit(
                    new ToggleStructureEvent([
                      UnitType.MissileSilo,
                      UnitType.SAMLauncher,
                    ]),
                  );
                  break;
                case UnitType.Warship:
                  this.eventBus?.emit(new ToggleStructureEvent([UnitType.Port]));
                  break;
                default:
                  this.eventBus?.emit(new ToggleStructureEvent([unitType]));
              }
            }
            this.requestUpdate();
          }}`,
  "pin selected range",
);
replaceOnce(
  "src/client/hud/layers/UnitDisplay.ts",
  `          @mouseleave=\${() =>
            this.eventBus?.emit(new ToggleStructureEvent(null))}`,
  `          @mouseleave=\${() => {
            if (this.uiState.ghostStructure === null) {
              this.eventBus?.emit(new ToggleStructureEvent(null));
            }
          }}`,
  "persist touch range",
);
replaceOnce(
  "src/client/render/types/Renderer.ts",
  `  /** Range radius in tiles for the placement circle (0 = no circle). */
  rangeRadius: number;`,
  `  /** Inner high-damage radius for nuclear previews (0 = no inner ring). */
  innerRangeRadius?: number;
  /** Outer range radius in tiles for the placement circle (0 = no circle). */
  rangeRadius: number;`,
  "range type",
);
replaceOnce(
  "src/client/controllers/BuildPreviewController.ts",
  `    let rangeRadius = 0;
    switch (u.type) {`,
  `    let innerRangeRadius = 0;
    let rangeRadius = 0;
    switch (u.type) {`,
  "inner range init",
);
replaceOnce(
  "src/client/controllers/BuildPreviewController.ts",
  `      case UnitType.AtomBomb:
      case UnitType.HydrogenBomb:
        rangeRadius = this.game.config().nukeMagnitudes(u.type).outer;
        break;`,
  `      case UnitType.AtomBomb:
      case UnitType.HydrogenBomb: {
        const magnitude = this.game.config().nukeMagnitudes(u.type);
        innerRangeRadius = magnitude.inner;
        rangeRadius = magnitude.outer;
        break;
      }`,
  "nuclear ranges",
);
replaceOnce(
  "src/client/controllers/BuildPreviewController.ts",
  `      upgradeTargetTile,
      rangeRadius,
      rangeWarning: targetingAlly,`,
  `      upgradeTargetTile,
      innerRangeRadius,
      rangeRadius,
      rangeWarning: targetingAlly,`,
  "range result",
);
write(
  "src/client/render/gl/passes/RangeCirclePass.ts",
  `/** Tactical range renderer with dual nuclear rings. */
import type { GhostPreviewData } from "../../types";
import { createProgram } from "../utils/GlUtils";
import fragSrc from "../shaders/range-circle/range-circle.frag.glsl?raw";
import vertSrc from "../shaders/range-circle/range-circle.vert.glsl?raw";

export class RangeCirclePass {
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private uCamera: WebGLUniformLocation;
  private uCenter: WebGLUniformLocation;
  private uRadius: WebGLUniformLocation;
  private uColor: WebGLUniformLocation;
  private centerX = 0;
  private centerY = 0;
  private innerRadius = 0;
  private outerRadius = 0;
  private warning = false;

  constructor(private gl: WebGL2RenderingContext) {
    this.program = createProgram(gl, vertSrc, fragSrc);
    this.uCamera = gl.getUniformLocation(this.program, "uCamera")!;
    this.uCenter = gl.getUniformLocation(this.program, "uCenter")!;
    this.uRadius = gl.getUniformLocation(this.program, "uRadius")!;
    this.uColor = gl.getUniformLocation(this.program, "uColor")!;
    const quad = gl.createBuffer()!;
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }
  updateGhostPreview(data: GhostPreviewData | null): void {
    if (data && data.rangeRadius > 0) {
      this.centerX = data.radiusTileX;
      this.centerY = data.radiusTileY;
      this.innerRadius = data.innerRangeRadius ?? 0;
      this.outerRadius = data.rangeRadius;
      this.warning = data.rangeWarning;
    } else {
      this.innerRadius = 0;
      this.outerRadius = 0;
      this.warning = false;
    }
  }
  private drawCircle(radius: number, r: number, g: number, b: number): void {
    if (radius <= 0) return;
    this.gl.uniform1f(this.uRadius, radius);
    this.gl.uniform3f(this.uColor, r, g, b);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
  }
  draw(cameraMatrix: Float32Array): void {
    if (this.outerRadius <= 0) return;
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.uniformMatrix3fv(this.uCamera, false, cameraMatrix);
    gl.uniform2f(this.uCenter, this.centerX, this.centerY);
    gl.bindVertexArray(this.vao);
    if (this.warning) {
      this.drawCircle(this.outerRadius, 1.0, 0.15, 0.12);
    } else if (this.innerRadius > 0) {
      this.drawCircle(this.outerRadius, 1.0, 0.72, 0.1);
    } else {
      this.drawCircle(this.outerRadius, 0.95, 0.98, 1.0);
    }
    if (this.innerRadius > 0) {
      this.drawCircle(this.innerRadius, 1.0, 0.18, 0.12);
    }
  }
  dispose(): void {
    this.gl.deleteProgram(this.program);
    this.gl.deleteVertexArray(this.vao);
  }
}
`,
);
write(
  "src/client/render/gl/shaders/range-circle/range-circle.frag.glsl",
  `#version 300 es
precision highp float;
in vec2 vLocal;
uniform float uRadius;
uniform vec3 uColor;
out vec4 fragColor;
void main() {
  float dist = length(vLocal) * (uRadius + 2.0);
  float edge = uRadius;
  float fill = 1.0 - smoothstep(edge - 0.75, edge + 0.75, dist);
  float strokeInner = edge - 2.25;
  float strokeOuter = edge + 0.25;
  float stroke = smoothstep(strokeInner - 0.75, strokeInner + 0.75, dist)
               * (1.0 - smoothstep(strokeOuter - 0.75, strokeOuter + 0.75, dist));
  float alpha = fill * 0.11 + stroke * 0.82;
  if (alpha < 0.001) discard;
  fragColor = vec4(uColor, alpha);
}
`,
);
replaceOnce(
  "src/client/render/gl/render-settings.json",
  `  "samRadius": {
    "strokeWidth": 1.5,
    "dashLen": 12,
    "gapLen": 6,
    "rotationSpeed": 14,
    "alpha": 0.8,`,
  `  "samRadius": {
    "strokeWidth": 2.75,
    "dashLen": 14,
    "gapLen": 5,
    "rotationSpeed": 10,
    "alpha": 0.95,`,
  "SAM visibility",
);
console.log("Applied persistent SAM and dual nuclear ranges.");
