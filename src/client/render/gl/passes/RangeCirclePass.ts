/** Tactical range renderer with dual nuclear rings. */
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
