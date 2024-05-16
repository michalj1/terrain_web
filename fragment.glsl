#version 300 es
precision highp float;
in vec3 fnormal;
uniform vec3 color;
uniform vec3 lightdir;
out vec4 fragColor;
void main() {
    float lambert = max(dot(lightdir, fnormal), 0.0);
    fragColor = vec4(0.8 * lambert * color + 0.2 * color, 1.0);
}