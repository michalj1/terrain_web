const rad = Math.PI / 180;
const IlliniBlue = new Float32Array([0.075, 0.16, 0.292, 1]);
const DiagChunks = 15;

/**
 * Given the source code of a vertex and fragment shader, compiles them,
 * and returns the linked program.
 */
function compileAndLinkGLSL(vs_source, fs_source) {
    let vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, vs_source);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(vs));
        throw Error("Vertex shader compilation failed");
    }

    let fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fs_source);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(fs));
        throw Error("Fragment shader compilation failed");
    }

    let program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(program));
        throw Error("Linking failed");
    }
    
    return program;
}

/**
 * Sends per-vertex data to the GPU and connects it to a VS input
 * 
 * @param data    a 2D array of per-vertex data (e.g. [[x,y,z,w],[x,y,z,w],...])
 * @param program a compiled and linked GLSL program
 * @param vsIn    the name of the vertex shader's `in` attribute
 * @param mode    (optional) gl.STATIC_DRAW, gl.DYNAMIC_DRAW, etc
 * 
 * @returns the ID of the buffer in GPU memory; useful for changing data later
 */
function supplyDataBuffer(data, program, vsIn, mode) {
    if (mode === undefined) mode = gl.STATIC_DRAW;
    
    let buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    let f32 = new Float32Array(data.flat());
    gl.bufferData(gl.ARRAY_BUFFER, f32, mode);
    
    let loc = gl.getAttribLocation(program, vsIn);
    gl.vertexAttribPointer(loc, data[0].length, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(loc);
    
    return buf;
}

/**
 * Creates a Vertex Array Object and puts into it all of the data in the given
 * JSON structure, which should have the following form:
 * 
 * ````
 * {"triangles": a list of of indices of vertices
 * ,"attributes":
 *  {name_of_vs_input_1: a list of 1-, 2-, 3-, or 4-vectors, one per vertex
 *  ,name_of_vs_input_2: a list of 1-, 2-, 3-, or 4-vectors, one per vertex
 *  }
 * }
 * ````
 * 
 * @returns an object with four keys:
 *  - mode = the 1st argument for gl.drawElements
 *  - count = the 2nd argument for gl.drawElements
 *  - type = the 3rd argument for gl.drawElements
 *  - vao = the vertex array object for use with gl.bindVertexArray
 */
function setupGeomery(geom) {
    var triangleArray = gl.createVertexArray();
    gl.bindVertexArray(triangleArray);

    for(let name in geom.attributes) {
        let data = geom.attributes[name];
        supplyDataBuffer(data, program, name);
    }

    var indices = new Uint16Array(geom.triangles.flat());
    var indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    return {
        mode: gl.TRIANGLES,
        count: indices.length,
        type: gl.UNSIGNED_SHORT,
        vao: triangleArray
    };
}

/** Draw one frame */
function draw() {
    gl.clearColor(...IlliniBlue); // f(...[1,2,3]) means f(1,2,3)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(program);

    gl.bindVertexArray(geom.vao);

    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'v'), false, view);
    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'p'), false, projection);
    gl.uniform3fv(gl.getUniformLocation(program, 'lightdir'), normalize(light));

    for (let j = 0; j < terrainGrid.length; j += 1) {
        let color = terrainGrid[j].color;
        gl.uniformMatrix4fv(gl.getUniformLocation(program, 'm'), false, terrainGrid[j].model);
        gl.uniform3fv(gl.getUniformLocation(program, 'color'), color);

        gl.drawElements(geom.mode, geom.count, geom.type, 0);
    }

}

/** Modify view matrix to move camera */
function moveCamera() {
    // Translation
    if (keysBeingPressed['w']) {
        window.eye = add(window.eye, div([...facing, 0], 8));
    }
    if (keysBeingPressed['a']) {
        window.eye = add(window.eye, div([-facing[1], facing[0], 0], 8));
    }
    if (keysBeingPressed['s']) {
        window.eye = sub(window.eye, div([...facing, 0], 8));
    }
    if (keysBeingPressed['d']) {
        window.eye = add(window.eye, div([facing[1], -facing[0], 0], 8));
    }

    // Rotation
    if (keysBeingPressed['ArrowUp']) {
        window.angle += 5;
        if (angle > 90) {
            window.angle = 90;
        }
    }
    if (keysBeingPressed['ArrowLeft']) {
        let old_angle = Math.acos(facing[0]) / rad;
        if (facing[1] < 0) {
            old_angle = -old_angle + 360;
        }
        window.facing = [Math.cos((old_angle + 10) * rad), Math.sin((old_angle + 10) * rad)];
    }
    if (keysBeingPressed['ArrowDown']) {
        window.angle -= 5;
        if (angle < 5) {
            window.angle = 5;
        }
    }
    if (keysBeingPressed['ArrowRight']) {
        let old_angle = Math.acos(facing[0]) / rad;
        if (facing[1] < 0) {
            old_angle = -old_angle + 360;
        }
        window.facing = [Math.cos((old_angle - 10) * rad), Math.sin((old_angle - 10) * rad)];
    }

    // Zoom
    if (keysBeingPressed['wheel'] != 0) {
        if (keysBeingPressed['wheel'] < 0) {
            // Zoom in
            window.eye[2] -= 0.2;
            if (window.eye[2] < 0.1) {
                window.eye[2] = 0.1;
            }
        } else {
            // Zoom out
            window.eye[2] += 0.2;
            if (window.eye[2] > 10) {
                window.eye[2] = 10;
            }
        }
        keysBeingPressed['wheel'] = 0;
    }

    let direction = normalize([...mul(facing, Math.sin(angle * rad)), -Math.cos(angle * rad)])
    let center = add(eye, direction);
    window.view = m4view(eye, center, up);
}

/** Compute any time-varying or animated aspects of the scene */
function timeStep(milliseconds) {
    let seconds = milliseconds / 1000;
    if (Math.floor(seconds) > lastSecond) {
        erode(terrainGrid, DiagChunks);
        lastSecond = Math.floor(seconds);
    }

    moveCamera();
    draw();
    requestAnimationFrame(timeStep);
}

/** Resizes the canvas to completely fill the screen */
function fillScreen() {
    let canvas = document.querySelector('canvas');
    document.body.style.margin = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    canvas.style.width = '';
    canvas.style.height = '';
    if (window.gl) {
        gl.viewport(0,0, canvas.width, canvas.height);
        window.projection = m4perspNegZ(0.01, 100, 1.5, canvas.width, canvas.height);
    }
}

function flattenedChunks(grid) {
    let newGrid = Array(DiagChunks**2 * ChunkSize**2);
    for (let i = 0; i < DiagChunks**2; i += 1) {
        for (let j = 0; j < ChunkSize**2; j += 1) {
            const point = grid[i][j];
            const chunkRow = Math.floor(i / DiagChunks);
            const chunkCol = i % DiagChunks;
            const pointRow = Math.floor(j / ChunkSize);
            const pointCol = j % ChunkSize;

            const chunkOffset = (chunkRow * ChunkSize**2 * DiagChunks) + (chunkCol * ChunkSize)
            const pointOffset = (pointRow * ChunkSize * DiagChunks) + pointCol;
            const newIndex = chunkOffset + pointOffset;
            newGrid[newIndex] = point;
        }
    }
    return newGrid;
}

/** Compile, link, set up geometry */
async function setup(event) {
    console.log("SETUP");
    window.gl = document.querySelector('canvas').getContext('webgl2',
        // optional configuration object: see https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext
        {antialias: false, depth:true, preserveDrawingBuffer:true}
    );
    let vs = await fetch('vertex.glsl').then(res => res.text());
    let fs = await fetch('fragment.glsl').then(res => res.text());
    window.program = compileAndLinkGLSL(vs, fs);
    gl.enable(gl.DEPTH_TEST);

    window.eye = [0, 0, DiagChunks + 1];
    window.facing = normalize([0, 1]);
    window.angle = 5;
    let direction = normalize([...facing, -Math.cos(angle * rad)])
    let center = add(eye, direction);
    window.up = [0, 0, 1];
    window.view = m4view(eye, center, up);
    // window.view = m4view([1, 1, 1], [0, 0, 0], up)
    window.projection = m4perspNegZ(0.01, 10, 1.5, 500, 500);
    window.light = [1, 1, 1];

    fillScreen();
    window.addEventListener('resize', fillScreen);

    window.keysBeingPressed = {}
    window.addEventListener('keydown', event => keysBeingPressed[event.key] = true);
    window.addEventListener('keyup', event => keysBeingPressed[event.key] = false);
    window.addEventListener('wheel', event => keysBeingPressed['wheel'] = event.deltaY);

    console.log("CREATING CHUNKS");
    window.terrainGrid = [];
    window.centerChunk = [0, 0];
    for (let i = 0; i < DiagChunks; i += 1) {
        for (let j = 0; j < DiagChunks; j += 1) {
            let hexGrid = createChunk(i * DiagChunks + j, DiagChunks);
            generateTerrain(hexGrid, [i - Math.floor(DiagChunks / 2), j - Math.floor(DiagChunks / 2)]);
            terrainGrid.push(hexGrid);
        }
    }
    window.terrainGrid = flattenedChunks(window.terrainGrid);
    erode(terrainGrid, DiagChunks);

    window.geom = setupGeomery(HexGeom);

    window.lastSecond = 0;
    requestAnimationFrame(timeStep);
}

window.addEventListener('load',setup);
