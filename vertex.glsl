#version 300 es
in vec4 position;
in vec4 normal;
uniform mat4 m;
uniform mat4 v;
uniform mat4 p;
out vec3 fnormal;
void main() {
    gl_Position = p * v * m * position;
    fnormal = normal.xyz;
}