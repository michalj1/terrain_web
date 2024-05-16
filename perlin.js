var altVectors = []

/** Initializes vectors for octaves 0-2 of perlin noise */
function initVectors(chunkPos, octaves, seed) {
    altVectors = [];
    for (let o = 0; o < octaves; o += 1) {
        let vector = [];
        for (let i = 0; i < 2**o + 2; i += 1) {
            vector.push([]);
            for (let j = 0; j < 2**o + 2; j += 1) {
                let x = (chunkPos[0] * 2**o + i);
                let y = (chunkPos[1] * 2**o + j);
                let string = "x" + x.toString() + "y" + y.toString() + "s" + seed.toString();
                let vals = getVals(string);
                vector[i].push([Math.cos(vals[0] / 2**8 * 2 * Math.PI), Math.sin(vals[0] / 2**8 * 2 * Math.PI)]);
            }
        }
        altVectors.push(vector);
    }
}

/** Calculates the perlin value  */
function perlin(x, y, o) {
    let x0 = Math.floor(x);
    let x1 = x0 + 1;
    let y0 = Math.floor(y);
    let y1 = y0 + 1;

    let dx = x - x0;
    let dy = y - y0;

    let n0 = dot(altVectors[o][x0][y0], [dx, dy]);
    let n1 = dot(altVectors[o][x1][y0], [1 - dx, dy]);
    var i1 = interpolate(n0, n1, dx);

    n0 = dot(altVectors[o][x0][y1], [dx, 1 - dy]);
    n1 = dot(altVectors[o][x1][y1], [1 - dx, 1 - dy]);
    var i2 = interpolate(n0, n1, dx);
  
    return interpolate(i1, i2, dy);
}

function interpolate(n0, n1, p) {
    return (n1 - n0) * ((p * (p * 6.0 - 15.0) + 10.0) * p * p * p) + n0
}

function getVals(string) {
    let hash = md5(string);
    let list = [];
    for (let i = 0; i < hash.length / 2; i += 1) {
        let val = parseInt(hash.slice(2 * i, 2 * (i + 1)), 16)
        list.push(val)
    }
    return list;
}