const ChunkSize = 16;
const NumOctaves = 3;
const WaterLevel = 1;

const CarryingCapacity = 0.1;
const DepositionRate = 0.1;
const SoilSoftness = 0.3;
const Evaporation = 0.1;
const RainCycle = 15;
const Retention = 0.2;
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
function createChunk(chunkIndex = 0, diagChunks = 1) {
    let hexGrid = [];

    if (chunkIndex >= diagChunks**2) {
        throw new Error("Invalid arguments");
    }

    const chunkRow = Math.floor(chunkIndex / diagChunks);
    const chunkCol = chunkIndex % diagChunks;

    for (let i = 0; i < ChunkSize; i += 1) {
        for (let j = 0; j < ChunkSize; j += 1) {
            let offsetCoord = [chunkRow * ChunkSize + i, chunkCol * ChunkSize + j];
            let cubeCoord = offsetToCube(...offsetCoord);
            let hex = {
                x : offsetCoord[0],
                y : offsetCoord[1],
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
    initializeTerrain(hexGrid);
    generateGeometry(hexGrid);
}

function initializeTerrain(hexGrid) {
    let minPerlin = 1000;
    let maxPerlin = -1000;
    for (let i = 0; i < ChunkSize; i += 1) {
        for (let j = 0; j < ChunkSize; j += 1) {
            // Calculate pixel position
            let hex = hexGrid[i * ChunkSize + j]
            if (i % 2 == 0) {
                var x0 = 1/ChunkSize * i + 1/ChunkSize/2;
            } else {
                var x0 = 1/ChunkSize * i + 1/ChunkSize;
            }
            var y0 = (1/ChunkSize * j + 1/ChunkSize/3);

            // Find perlin value
            for (let octave = 0; octave < NumOctaves; octave += 1) {
                let multiplier = 2**octave;
                let x = multiplier * x0;
                let y = multiplier * y0;
                let noise = perlin(x, y, octave);
                hex.alt += noise / multiplier;
            }

            // Initialize default values for given point
            hex.alt = hex.alt + 0.5;
            hex.precip = Math.max(perlin(x0, y0, 0) + 0.5, 0);
            hex.water = hex.precip * Retention;
            hex.incomingWater = 0;
            hex.outgoingWater = 0;
            hex.sediment = 0;
            hex.altChange = 0;
            hex.sedimentChange = 0;
        }
    }
}

/**
 * Execute grid-based hydraulic erosion on the given grid
 */
function erode(hexGrid, diagChunks) {
    const sideLength = diagChunks * ChunkSize;
    for (let iter = 0; iter < Iterations; iter += 1) {
        if (iter % RainCycle == 0) {
            rain(hexGrid);
        }
        calculateErosion(hexGrid, sideLength);
        applyErosion(hexGrid);
    }
    assignColor(hexGrid);
}

function assignColor(hexGrid) {
    for (let i = 0; i < hexGrid.length; i += 1) {
        let hex = hexGrid[i];
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
        // hex.color = [0, 0, hex.precip];
    }
}

function rain(hexGrid) {
    for (let i = 0; i < hexGrid.length; i += 1) {
        hexGrid[i].water += hexGrid[i].precip * Retention;
    }
}

function calculateErosion(hexGrid, sideLength = ChunkSize) {
    for (let i = 0; i < hexGrid.length; i += 1) {
        // Find valid neighbors
        let hex = hexGrid[i];
        let cubeNeighbors = neighborsCube(hex.q, hex.r, hex.s);
        let neighbors = [];
        for (let k = 0; k < cubeNeighbors.length; k += 1) {
            let offset = cubeToOffset(...cubeNeighbors[k]);
            if (offset[0] >= 0 && offset[0] < sideLength && offset[1] >= 0 && offset[1] < sideLength) {
                neighbors.push(offset);
            }
        }

        // Calculate water level difference with all neighbors
        let waterLevel = hex.water + hex.alt;
        let waterDiffs = [];
        for (let k = 0; k < neighbors.length; k += 1) {
            let other = hexGrid[neighbors[k][0] * sideLength + neighbors[k][1]]
            let otherWater = other.water + other.alt;
            // Only take into account water flowing out
            waterDiffs.push(Math.min(hex.water / 6, waterLevel - otherWater));
        }

        // Calculate outgoing water
        for (let k = 0; k < neighbors.length; k += 1) {
            let other = hexGrid[neighbors[k][0] * sideLength + neighbors[k][1]]
            if (waterDiffs[k] > 0) {
                other.incomingWater += waterDiffs[k];
                hex.outgoingWater += waterDiffs[k];
                const capacity = waterDiffs[k] * CarryingCapacity;
                const lostSediment = waterDiffs[k] / hex.water * hex.sediment;
                const erodedSediment = Math.min(capacity - lostSediment, waterDiffs[k] * SoilSoftness);
                other.sedimentChange += lostSediment + erodedSediment;
                hex.sedimentChange -= lostSediment;
                hex.altChange -= erodedSediment;
            }
        }
    }
}

function applyErosion(hexGrid) {
    for (let i = 0; i < hexGrid.length; i += 1) {
        let hex = hexGrid[i];

        // Update water
        hex.water = (hex.water + hex.incomingWater - hex.outgoingWater) * (1 - Evaporation);
        hex.incomingWater = 0;
        hex.outgoingWater = 0;

        // Update soil
        hex.alt += hex.altChange;
        hex.altChange = 0;
        hex.sediment += hex.sedimentChange;
        hex.sedimentChange = 0;

        // Calculate deposition and sedimentation
        const deposition = DepositionRate * hex.sediment;
        const sedimentation = SoilSoftness * CarryingCapacity * hex.water;
        hex.alt += deposition - sedimentation;
        hex.sediment += sedimentation - deposition;
    }
}

/**
 * Generates a model matrix for every hex in the grid
 */
function generateGeometry(hexGrid) {
    let width = Math.sqrt(3);
    let height = 2;
    let scale = 2 / (ChunkSize * Math.sqrt(3));
    for (let i = 0; i < hexGrid.length; i += 1) {
        let hex = hexGrid[i];
        let dx = width * hex.x + width / 2 * (hex.y % 2);
        let dy = 3/4 * height * hex.y;
        // hexGrid[i].model = m4mult(m4scale(scale, scale, scale), m4translate(dx + x, dy + y, 0));
        hexGrid[i].model = m4mult(m4scale(scale, scale, scale), m4translate(dx, dy, 0));
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