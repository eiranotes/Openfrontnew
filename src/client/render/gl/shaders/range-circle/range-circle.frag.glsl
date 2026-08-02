#version 300 es
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
