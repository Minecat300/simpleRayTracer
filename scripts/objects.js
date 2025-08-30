function parseOBJ(objText) {
    const vertices = [];
    const normals = [];
    const triangles = [];

    const lines = objText.split('\n');

    for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length === 0) continue;

        switch (parts[0]) {
            case 'v': // vertex
                vertices.push({ x: parseFloat(parts[1]), y: parseFloat(parts[2]), z: parseFloat(parts[3]) });
                break;
            case 'vn': // normal
                normals.push({ x: parseFloat(parts[1]), y: parseFloat(parts[2]), z: parseFloat(parts[3]) });
                break;
            case 'f': // face
                if (parts.length !== 4) {
                    console.warn('Skipping non-triangle face:', parts);
                    continue;
                }

                // OBJ indices start at 1
                const verts = parts.slice(1).map(p => p.split('/'));
                triangles.push({
                    posA: vertices[parseInt(verts[0][0]) - 1],
                    posB: vertices[parseInt(verts[1][0]) - 1],
                    posC: vertices[parseInt(verts[2][0]) - 1],
                    normalA: verts[0][2] ? normals[parseInt(verts[0][2]) - 1] : {x:0,y:0,z:0},
                    normalB: verts[1][2] ? normals[parseInt(verts[1][2]) - 1] : {x:0,y:0,z:0},
                    normalC: verts[2][2] ? normals[parseInt(verts[2][2]) - 1] : {x:0,y:0,z:0},
                });
                break;
        }
    }

    return triangles;
}

function vec3Add(a, b) {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function vec3Sub(a, b) {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function vec3Mul(a, scalar) {
    return { x: a.x * scalar, y: a.y * scalar, z: a.z * scalar };
}

function vec3Cross(a, b) {
    return {
        x: a.y*b.z - a.z*b.y,
        y: a.z*b.x - a.x*b.z,
        z: a.x*b.y - a.y*b.x
    };
}

function vec3Normalize(v) {
    const len = Math.hypot(v.x, v.y, v.z) || 1;
    return { x: v.x/len, y: v.y/len, z: v.z/len };
}

function rotateVec3(v, rotation) {
    // rotation: {x:rx, y:ry, z:rz} in radians
    let p = {...v};

    // Rotate X
    let cosX = Math.cos(rotation.x), sinX = Math.sin(rotation.x);
    let y1 = p.y*cosX - p.z*sinX;
    let z1 = p.y*sinX + p.z*cosX;
    p.y = y1; p.z = z1;

    // Rotate Y
    let cosY = Math.cos(rotation.y), sinY = Math.sin(rotation.y);
    let x2 = p.x*cosY + p.z*sinY;
    let z2 = -p.x*sinY + p.z*cosY;
    p.x = x2; p.z = z2;

    // Rotate Z
    let cosZ = Math.cos(rotation.z), sinZ = Math.sin(rotation.z);
    let x3 = p.x*cosZ - p.y*sinZ;
    let y3 = p.x*sinZ + p.y*cosZ;
    p.x = x3; p.y = y3;

    return p;
}

function transformTriangles(tris, options) {
    // options = {translate:{x,y,z}, rotate:{x,y,z}, scale:{x,y,z}}
    const t = options.translate || {x:0, y:0, z:0};
    const r = options.rotate || {x:0, y:0, z:0};
    const s = options.scale || {x:1, y:1, z:1};

    return tris.map(tri => {
        const transformVec = v => {
            // Apply rotation
            let scaled = {
                x: v.x * s.x,
                y: v.y * s.y,
                z: v.z * s.z
            };
            let rotated = rotateVec3(scaled, r);
            // Apply per-axis scale

            // Apply translation
            return vec3Add(rotated, t);
        };

        return {
            posA: transformVec(tri.posA),
            posB: transformVec(tri.posB),
            posC: transformVec(tri.posC),
            normalA: vec3Normalize(rotateVec3(tri.normalA, r)),
            normalB: vec3Normalize(rotateVec3(tri.normalB, r)),
            normalC: vec3Normalize(rotateVec3(tri.normalC, r))
        };
    });
}


async function addModel(triArr, meshArr, path, material, translate, rotate, scale) {
    const response = await fetch(path);
    const objText = await response.text();
    const parsedTris = parseOBJ(objText);
    const transformedTris = transformTriangles(parsedTris, { translate, rotate, scale });
    const triArrayStartIndex = triArr.length/24;
    const triNum = transformedTris.length;
    console.log(transformedTris);

    let boundMin = {x: Infinity, y: Infinity, z: Infinity};
    let boundMax = {x: -Infinity, y: -Infinity, z: -Infinity};

    for (const tri of transformedTris) {
        const verts = [tri.posA, tri.posB, tri.posC];
        for (const v of verts) {
            boundMin.x = Math.min(boundMin.x, v.x);
            boundMin.y = Math.min(boundMin.y, v.y);
            boundMin.z = Math.min(boundMin.z, v.z);

            boundMax.x = Math.max(boundMax.x, v.x);
            boundMax.y = Math.max(boundMax.y, v.y);
            boundMax.z = Math.max(boundMax.z, v.z);
        }

        addTriangle(triArr, tri.posA, tri.posB, tri.posC, tri.normalA, tri.normalB, tri.normalC);
    }

    addMesh(meshArr, triArrayStartIndex, triNum, boundMin, boundMax, material);
}

class xyz {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
}

class rgb {
    constructor(r, g, b) {
        this.r = r/255;
        this.g = g/255;
        this.b = b/255;
    }
}

class Material {
    constructor(color = new rgb(255, 255, 255), emissionColor = new rgb(0, 0, 0), emissionStrength = 0, smoothness = 0) {
        this.color = color;
        this.emissionColor = emissionColor;
        this.emissionStrength = emissionStrength;
        this.smoothness = smoothness;
    }
}

function addTriangle(arr, pointA, pointB, pointC, normalA, normalB, normalC) {
    const i = arr.length;
    arr[i + 0] = pointA.x;
    arr[i + 1] = pointA.y;
    arr[i + 2] = pointA.z;
    arr[i + 3] = 0.0;
    arr[i + 4] = pointB.x;
    arr[i + 5] = pointB.y;
    arr[i + 6] = pointB.z;
    arr[i + 7] = 0.0;
    arr[i + 8] = pointC.x;
    arr[i + 9] = pointC.y;
    arr[i + 10] = pointC.z;
    arr[i + 11] = 0.0;
    arr[i + 12] = normalA.x;
    arr[i + 13] = normalA.y;
    arr[i + 14] = normalA.z;
    arr[i + 15] = 0.0;
    arr[i + 16] = normalB.x;
    arr[i + 17] = normalB.y;
    arr[i + 18] = normalB.z;
    arr[i + 19] = 0.0;
    arr[i + 20] = normalC.x;
    arr[i + 21] = normalC.y;
    arr[i + 22] = normalC.z;
    arr[i + 23] = 0.0;
}

function addMesh(arr, firstTriIndex, numTris, boundMin, boundMax, material = new Material()) {
    const i = arr.length;
    arr[i + 0] = firstTriIndex;
    arr[i + 1] = numTris;
    arr[i + 2] = 0.0;
    arr[i + 3] = 0.0;
    arr[i + 4] = boundMin.x;
    arr[i + 5] = boundMin.y;
    arr[i + 6] = boundMin.z;
    arr[i + 7] = 0.0;
    arr[i + 8] = boundMax.x;
    arr[i + 9] = boundMax.y;
    arr[i + 10] = boundMax.z;
    arr[i + 11] = 0.0;
    arr[i + 12] = material.color.r;
    arr[i + 13] = material.color.g;
    arr[i + 14] = material.color.b;
    arr[i + 15] = 0.0;
    arr[i + 16] = material.emissionColor.r;
    arr[i + 17] = material.emissionColor.g;
    arr[i + 18] = material.emissionColor.b;
    arr[i + 19] = material.emissionStrength;
    arr[i + 20] = material.smoothness;
    arr[i + 21] = 0.0;
    arr[i + 22] = 0.0;
    arr[i + 23] = 0.0;
}

function addSphere(arr, center, radius = 1, material = new Material()) {
    const i = arr.length;
    arr[i + 0]  = center.x;
    arr[i + 1]  = center.y;
    arr[i + 2]  = center.z;
    arr[i + 3]  = radius;
    arr[i + 4]  = material.color.r;
    arr[i + 5]  = material.color.g;
    arr[i + 6]  = material.color.b;
    arr[i + 7]  = 0.0; 
    arr[i + 8]  = material.emissionColor.r;
    arr[i + 9]  = material.emissionColor.g;
    arr[i + 10] = material.emissionColor.b;
    arr[i + 11] = material.emissionStrength; 
    arr[i + 12] = material.smoothness;
    arr[i + 13] = 0.0; 
    arr[i + 14] = 0.0; 
    arr[i + 15] = 0.0;
    arr[i + 16] = 0.0; 
    arr[i + 17] = 0.0; 
    arr[i + 18] = 0.0;
    arr[i + 19] = 0.0; 
}

export { addModel, addTriangle, addMesh, addSphere };