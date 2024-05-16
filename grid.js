const ChunkSize = 64;
const NumOctaves = 3;
const WaterLevel = 0.05;

const CarryingCapacity = 0.1;
const DepositionRate = 0.1;
const SoilSoftness = 0.3;
const Evaporation = 0.1;
const RainCycle = 15;
const Retention = 0.1;
const Iterations = 150;

const HexGeom = {
    "attributes" : {
        "position" : [
            [Math.cos(Math.PI / 6), Math.sin(Math.PI / 6), 0],
            [Math.cos(Math.PI / 2), Math.sin(Math.PI / 2), 0],
            [Math.cos(5 * Math.PI / 6), Math.sin(5 * Math.PI / 6), 0],
            [Math.cos(-5 * Math.PI / 6), Math.sin(-5 * Math.PI / 6), 0],
            [Math.cos(-Math.PI / 2), Math.sin(-Math.PI / 2), 0],
            [Math.cos(-Math.PI / 6), Math.sin(-Math.PI / 6), 0]
        ],
        "normal" : [
            [0, 0, 1],
            [0, 0, 1],
            [0, 0, 1],
            [0, 0, 1],
            [0, 0, 1],
            [0, 0, 1]
        ]
    },
    "triangles" : [
        [0, 1, 2],
        [0, 2, 3],
        [0, 3, 5],
        [3, 4, 5]
    ]
}
const HexCenterGeom = {
    "attributes" : {
        "position" : [
            [0, 0, 0],
            [Math.cos(Math.PI / 6), Math.sin(Math.PI / 6), 0],
            [Math.cos(Math.PI / 2), Math.sin(Math.PI / 2), 0],
            [Math.cos(5 * Math.PI / 6), Math.sin(5 * Math.PI / 6), 0],
            [Math.cos(-5 * Math.PI / 6), Math.sin(-5 * Math.PI / 6), 0],
            [Math.cos(-Math.PI / 2), Math.sin(-Math.PI / 2), 0],
            [Math.cos(-Math.PI / 6), Math.sin(-Math.PI / 6), 0]
        ],
        "normal" : [
            [0, 0, 1],
            [0, 0, 1],
            [0, 0, 1],
            [0, 0, 1],
            [0, 0, 1],
            [0, 0, 1],
            [0, 0, 1]
        ]
    },
    "triangles" : [
        [0, 1, 2],
        [0, 2, 3],
        [0, 3, 4],
        [0, 4, 5],
        [0, 5, 6],
        [0, 6, 1]
    ]
}

/**
 * Creates a new pointy top grid with the first row offset to the left
 */
function createChunk() {
    let hexGrid = [];

    for (let i = 0; i < ChunkSize; i += 1) {
        for (let j = 0; j < ChunkSize; j += 1) {
            let cubeCoord = offsetToCube(i, j);
            let hex = {
                x : i,
                y : j,
                q : cubeCoord[0],
                r : cubeCoord[1],
                s : cubeCoord[2]
            };
            hex.alt = 0;
            hexGrid.push(hex);
        }
    }
    return hexGrid;
}

function generateTerrain(hexGrid, chunkPos, seed=0) {
    /**
     * Corners of Perlin grid will be defined as
     * upper left lies at the upper left corner of the upper left hex,
     * lower right lies at the bottom corner of the lower right hex,
     * upper right lies at the upper right corner of the upper right hex,
     * and lower left lies outside the grid in line with the others.
     */
    initVectors(chunkPos, NumOctaves, seed);
    for (let i = 0; i < ChunkSize; i += 1) {
        for (let j = 0; j < ChunkSize; j += 1) {
            let hex = hexGrid[i * ChunkSize + j]
            if (i % 2 == 0) {
                var x0 = 1/ChunkSize * i + 1/ChunkSize/2;
            } else {
                var x0 = 1/ChunkSize * i + 1/ChunkSize;
            }
            var y0 = (1/ChunkSize * j + 1/ChunkSize/3);

            for (let octave = 0; octave < NumOctaves; octave += 1) {
                let multiplier = 2**octave;
                let x = multiplier * x0;
                var y = multiplier * y0;
                let noise = perlin(x, y, octave);
                hex.alt += noise / multiplier;
            }

            hex.alt = hex.alt * 2/3 + 0.5;
            hex.precip = Math.max(perlin(x0, y0, 0) + 0.5, 0);
            hex.water = hex.precip * Retention;
            hex.incomingWater = 0;
            hex.outgoingWater = 0;
            hex.sediment = 0;
            hex.altChange = 0;
            hex.sedimentChange = 0;
        }
    }

    erode(hexGrid);

    for (let i = 0; i < ChunkSize; i += 1) {
        for (let j = 0; j < ChunkSize; j += 1) {
            let hex = hexGrid[i * ChunkSize + j];
            let alt = hex.alt;
            let water = hex.water;
            if (water >= 2 * WaterLevel) {
                hex.color = [0, 0, 0.5];
            } else if (water >= WaterLevel) {
                hex.color = [0, 0, 0.7];
            } else if (alt < 0.1) {
                hex.color = [0.6, 0.9, 0.6];
            } else if (alt < 0.2) {
                hex.color = [0.5, 0.8, 0.5];
            } else if (alt < 0.3) {
                hex.color = [0.4, 0.7, 0.4];
            } else if (alt < 0.4) {
                hex.color = [0.3, 0.6, 0.3];
            } else if (alt < 0.5) {
                hex.color = [0.2, 0.5, 0.2];
            } else if (alt < 0.6) {
                hex.color = [0.3, 0.3, 0.3];
            } else if (alt < 0.7) {
                hex.color = [0.5, 0.5, 0.5];
            } else if (alt < 0.8) {
                hex.color = [0.7, 0.7, 0.7];
            } else if (alt < 0.9) {
                hex.color = [1, 1, 1];
            } else {
                hex.color = [0.5, 0.8, 1];
            }
        }
    }
    generateGeometry(hexGrid, chunkPos);
}

/**
 * Execute grid-based hydraulic erosion on the given chunk
 */
function erode(hexGrid) {
    for (let iter = 0; iter < Iterations; iter += 1) {
        if (iter % RainCycle == 0) {
            rain(hexGrid);
        }
        calculateErosion(hexGrid);
        applyErosion(hexGrid);
    }
}

function rain(hexGrid) {
    for (let i = 0; i < ChunkSize; i += 1) {
        for (let j = 0; j < ChunkSize; j += 1) {
            hexGrid[i * ChunkSize + j].water += hexGrid[i * ChunkSize + j].precip * Retention;
        }
    }
}

function calculateErosion(hexGrid) {
    for (let i = 0; i < ChunkSize; i += 1) {
        for (let j = 0; j < ChunkSize; j  += 1) {
            // Find valid neighbors
            let hex = hexGrid[i * ChunkSize + j];
            let cubeNeighbors = neighborsCube(hex.q, hex.r, hex.s);
            let neighbors = [];
            for (let k = 0; k < cubeNeighbors.length; k += 1) {
                let offset = cubeToOffset(...cubeNeighbors[k]);
                if (offset[0] >= 0 && offset[0] < ChunkSize && offset[1] >= 0 && offset[1] < ChunkSize) {
                    neighbors.push(offset);
                }
            }

            // Calculate water level difference with all neighbors
            let waterLevel = hex.water + hex.alt;
            let waterDiffs = [];
            for (let k = 0; k < neighbors.length; k += 1) {
                let other = hexGrid[neighbors[k][0] * ChunkSize + neighbors[k][1]]
                let otherWater = other.water + other.alt;
                waterDiffs.push(Math.min(hex.water / 6, waterLevel - otherWater));
            }
            // waterDiffs = div(waterDiffs, 6);

            // Calculate sediment change in a sink
            let dWater = sum(waterDiffs);
            if (dWater <= 0) {
                hex.altChange += DepositionRate * hex.sediment;
                hex.sedimentChange -= DepositionRate * hex.sediment;
            }

            // Calculate outgoing water
            for (let k = 0; k < neighbors.length; k += 1) {
                let other = hexGrid[neighbors[k][0] * ChunkSize + neighbors[k][1]]
                if (waterDiffs[k] > 0) {
                    other.incomingWater += waterDiffs[k];
                    hex.outgoingWater += waterDiffs[k];
                    let capacity = waterDiffs[k] * CarryingCapacity;
                    if (hex.sediment > capacity) {
                        other.sedimentChange += capacity;
                        hex.altChange += DepositionRate * (hex.sediment - capacity);
                        hex.sedimentChange -= DepositionRate * (hex.sediment - capacity);
                    } else {
                        other.sedimentChange += hex.sediment / 6 + SoilSoftness * (capacity - hex.sediment / 6);
                        hex.altChange -= SoilSoftness * (capacity - hex.sediment / 6);
                        hex.sedimentChange -= hex.sediment / 6;
                    }
                }
            }
        }
    }
}

function applyErosion(hexGrid) {
    for (let i = 0; i < ChunkSize; i += 1) {
        for (let j = 0; j < ChunkSize; j  += 1) {
            let hex = hexGrid[i * ChunkSize + j];
            hex.water = (hex.water + hex.incomingWater - hex.outgoingWater) * (1 - Evaporation);
            hex.incomingWater = 0;
            hex.outgoingWater = 0;
            hex.alt += hex.altChange;
            hex.altChange = 0;
            hex.sediment += hex.sedimentChange;
            hex.sedimentChange = 0;
        }
    }
}

/**
 * Generates a model matrix for every hex in the grid
 */
function generateGeometry(hexGrid, chunkPos) {
    let width = Math.sqrt(3);
    let height = 2;
    let scale = 2 / (ChunkSize * Math.sqrt(3));
    let x = chunkPos[0] * ChunkSize * width;
    let y = chunkPos[1] * ChunkSize * height * 3/4;
    for (let i = 0; i < hexGrid.length; i += 1) {
        let hex = hexGrid[i];
        let dx = width * hex.x + width / 2 * (hex.y % 2);
        let dy = 3/4 * height * hex.y;
        hexGrid[i].model = m4mult(m4scale(scale, scale, scale), m4translate(dx + x, dy + y, 0));
    }
}

function neighborsOffset(x, y) {
    let cube = offsetToCube(x, y);
    let neighbors = neighborsCube(...cube);
    for (let i = 0; i < neighbors.length; i += 1) {
        neighbors[i] = cubeToOffset(...neighbors[i]);
    }
    return neighbors;
}

function neighborsCube(q, r, s) {
    return [[q + 1, r - 1, s], [q + 1, r, s - 1], [q - 1, r + 1, s], [q, r + 1, s - 1], [q - 1, r, s + 1], [q - 1, r, s + 1]]
}

function cubeToOffset(q, r, s) {
    let mod = r % 2;
    if (mod < 0) {
        mod += 2;
    }
    let col = q + (r - mod) / 2
    let row = r
    return [col, row]
}

function offsetToCube(x, y) {
    let mod = y % 2;
    if (mod < 0) {
        mod += 2;
    }
    let q = x - (y - mod) / 2
    let r = y
    return [q, r, -q-r]
}