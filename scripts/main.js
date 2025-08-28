const canvas = document.getElementById("gpuCanvas");
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();
const context = canvas.getContext("webgpu");

console.log("Vendor:", adapter.info.vendor);
console.log("Architecture:", adapter.info.architecture);
console.log("Limits:", adapter.limits);
console.log("Features:", adapter.features);

const fpsText = document.getElementById("fpsText");

const format = navigator.gpu.getPreferredCanvasFormat();
context.configure({ device, format, alphaMode: "opaque" });

const width = canvas.width;
const height = canvas.height;

class xyz {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
}

class rgb {
    constructor(r, g, b) {
        this.r = r;
        this.g = g;
        this.b = b;
    }
}

const maxBounceCount = 3;
const numRayPerPixel = 5;

const renderConfig = new Uint32Array([
    maxBounceCount,
    numRayPerPixel,
    0,
    0
]);

function addSphere(xyz, r, rgb, emissionRgb, emissionStrength) {
    const i = sphereData.length;
    sphereData[i + 0]  = xyz.x;
    sphereData[i + 1]  = xyz.y;
    sphereData[i + 2]  = xyz.z;
    sphereData[i + 3]  = r;
    sphereData[i + 4]  = rgb.r;
    sphereData[i + 5]  = rgb.g;
    sphereData[i + 6]  = rgb.b;
    sphereData[i + 7]  = 0.0; 
    sphereData[i + 8]  = emissionRgb.r;
    sphereData[i + 9]  = emissionRgb.g;
    sphereData[i + 10] = emissionRgb.b;
    sphereData[i + 11] = emissionStrength; 
    sphereData[i + 12] = 0.0;
    sphereData[i + 13] = 0.0; 
    sphereData[i + 14] = 0.0; 
    sphereData[i + 15] = 0.0; 
}

const sphereData = [];
addSphere(new xyz(0, -100, 0), 100, new rgb(1, 1, 1), new rgb(0, 0, 0), 0);
//addSphere(new xyz(0, 4, 0), 1, new rgb(0, 0, 0), new rgb(1, 1, 1), 15);

for (let i = 0; i < 20; i++) {
    addSphere(new xyz(
        Math.random() * 10 - 5,
        Math.random() * 4 + 1,
        Math.random() * 10 - 5
    ), 0.5 + Math.random(),
    new rgb(
        Math.random(),
        Math.random(),
        Math.random()
    ), new rgb(
        0.0,
        0.0,
        0.0
    ), 0.0
    );
}

const skyData = new Float32Array([
    // SkyColourHorizon
    1.0, 1.0, 1.0,
    0.0,
    // SkyColourZenith
    0.4, 0.6, 1.0,
    0.0,
    // GroundColour
    0.67, 0.63, 0.57,
    0.0,
    // SunLightDirection (normalized)
     0.3, 0.8, 0.5,
    // SunFocus
    400.0,
    // SunIntensity
    50.0,
]);

const skyBuffer = device.createBuffer({
    size: 16 * 8, // 6 vec4 slots = 96 bytes
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
});

const rotateSpeed = 0.5;
const moveSpeed = 1;

// --- Camera buffer (pos + target + screen size) ---
const cameraBuffer = device.createBuffer({
    size: 32, // two vec3 (pos+target) + vec2(width,height)
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
});

const renderConfigBuffer = device.createBuffer({
    size: 32,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
});

const spheresBuffer = device.createBuffer({
    size: sphereData.length * 4, // length in floats * 4 bytes
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
});

// --- GPU texture for compute shader output ---
let frameCount = 0;

const frameCountBuffer = device.createBuffer({
    size: 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
});

let oldTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format: "rgba16float",
    usage: GPUTextureUsage.TEXTURE_BINDING |
           GPUTextureUsage.STORAGE_BINDING |
           GPUTextureUsage.COPY_SRC |
           GPUTextureUsage.COPY_DST, // <-- add this
});

let newTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format: "rgba16float",
    usage: GPUTextureUsage.STORAGE_BINDING |
           GPUTextureUsage.TEXTURE_BINDING |
           GPUTextureUsage.COPY_SRC |
           GPUTextureUsage.COPY_DST, // <-- add this
});

// --- Compute pipeline ---
const computeShaderCode = await (await fetch("shaders/compute.wgsl")).text();
const computeModule = device.createShaderModule({ code: computeShaderCode });

const computePipeline = device.createComputePipeline({
    layout: "auto",
    compute: { module: computeModule, entryPoint: "main" }
});

// Bind group for compute: texture + camera
const computeBindGroup = device.createBindGroup({
    layout: computePipeline.getBindGroupLayout(0),
    entries: [
        // old frame (read-only)
        { binding: 0, resource: oldTexture.createView() },
        // new frame (write-only)
        { binding: 1, resource: newTexture.createView() },
        // other uniforms/buffers
        { binding: 2, resource: { buffer: cameraBuffer } },
        { binding: 3, resource: { buffer: spheresBuffer } },
        { binding: 4, resource: { buffer: renderConfigBuffer } },
        { binding: 5, resource: { buffer: skyBuffer } },
        { binding: 6, resource: { buffer: frameCountBuffer } }, // for progressive blending
    ],
});

// --- Fullscreen quad pipeline ---
const quadShaderCode = await (await fetch("shaders/quad.wgsl")).text();
const quadModule = device.createShaderModule({ code: quadShaderCode });

const sampler = device.createSampler({ magFilter: "linear", minFilter: "linear" });

const renderPipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: { module: quadModule, entryPoint: "vs" },
    fragment: { module: quadModule, entryPoint: "fs", targets: [{ format }] },
    primitive: { topology: "triangle-list" },
});

const quadBindGroup = device.createBindGroup({
    layout: renderPipeline.getBindGroupLayout(0),
    entries: [
        { binding: 0, resource: newTexture.createView() },
        { binding: 1, resource: sampler }
    ],
});

// --- Write camera + resolution ---
let camX = 0.0, camY = 0.0, camZ = 0.0;
let pitch = 0.0, yaw = 0.0;

let lastFrameTime = new Date().getTime();
const fpsList = [];

let smearFrames = false;

const cameraData = new Float32Array(8);
const spheresArray = new Float32Array(sphereData); 
const renderConfigArray = renderConfig; // Already Uint32Array
const skyArray = skyData; // Already Float32Array
const frameCountArray = new Uint32Array(1);

const zeroTextureData = new Float32Array(canvas.width * canvas.height * 4);

function frame() {
    // --- Update dynamic data ---
    cameraData.set([camX, camY, camZ, pitch, yaw, 0.0, 0.0, 0.0]);
    device.queue.writeBuffer(cameraBuffer, 0, cameraData);
    spheresArray.set(sphereData);
    device.queue.writeBuffer(spheresBuffer, 0, spheresArray);
    device.queue.writeBuffer(renderConfigBuffer, 0, renderConfigArray);
    device.queue.writeBuffer(skyBuffer, 0, skyArray);
    frameCountArray[0] = frameCount;
    device.queue.writeBuffer(frameCountBuffer, 0, frameCountArray);

    // --- Encode GPU work ---
    const encoder = device.createCommandEncoder();

    // Compute pass
    const computePass = encoder.beginComputePass();
    computePass.setPipeline(computePipeline);
    computePass.setBindGroup(0, computeBindGroup);
    computePass.dispatchWorkgroups(Math.ceil(width/8), Math.ceil(height/8));
    computePass.end();

    // Render pass
    const renderPass = encoder.beginRenderPass({
        colorAttachments: [{
            view: context.getCurrentTexture().createView(),
            loadOp: "clear",
            storeOp: "store",
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
        }]
    });
    renderPass.setPipeline(renderPipeline);
    renderPass.setBindGroup(0, quadBindGroup);
    renderPass.draw(6);
    renderPass.end();

    device.queue.submit([encoder.finish()]);

    // Submit everything at once
    if (smearFrames) {
        const copyEncoder = device.createCommandEncoder();
        copyEncoder.copyTextureToTexture(
            { texture: newTexture },
            { texture: oldTexture },
            [canvas.width, canvas.height, 1]
        );
        device.queue.submit([copyEncoder.finish()]);
        frameCount++;
    } else {
        // No copy needed; just reset frame count
        frameCount = 0;
    }

    // --- Update FPS ---
    const now = performance.now();
    const dt = now - lastFrameTime;
    lastFrameTime = now;
    fpsList.push(1000 / dt);
    if (fpsList.length > 5) fpsList.shift();
    fpsText.innerText = "FPS: " + Math.floor(fpsList.reduce((a,b)=>a+b,0)/fpsList.length);

    // --- Camera movement ---
    const delta = dt / 144;
    if (keyPress.w) { camZ += Math.cos(yaw)*moveSpeed*delta; camX += Math.sin(yaw)*moveSpeed*delta; }
    if (keyPress.s) { camZ -= Math.cos(yaw)*moveSpeed*delta; camX -= Math.sin(yaw)*moveSpeed*delta; }
    if (keyPress.d) { camZ -= Math.sin(yaw)*moveSpeed*delta; camX += Math.cos(yaw)*moveSpeed*delta; }
    if (keyPress.a) { camZ += Math.sin(yaw)*moveSpeed*delta; camX -= Math.cos(yaw)*moveSpeed*delta; }
    if (keyPress.space) camY += moveSpeed*delta;
    if (keyPress.shift) camY -= moveSpeed*delta;
    if (keyPress.upArrow) pitch += rotateSpeed*delta;
    if (keyPress.downArrow) pitch -= rotateSpeed*delta;
    if (keyPress.rightArrow) yaw += rotateSpeed*delta;
    if (keyPress.leftArrow) yaw -= rotateSpeed*delta;
    pitch = Math.max(-Math.PI/2+0.00001, Math.min(Math.PI/2-0.00001, pitch));

    requestAnimationFrame(frame);
}

const keyPress = {
    w: false,
    a: false,
    s: false,
    d: false,
    upArrow: false,
    downArrow: false,
    leftArrow: false,
    rightArrow: false,
    space: false,
    shift: false
}

function updateKeyboard(event, state) {
    switch (event.key.toLowerCase()) {
        case "w":
            keyPress.w = state;
            break;
        case "a":
            keyPress.a = state;
            break;
        case "s":
            keyPress.s = state;
            break;
        case "d":
            keyPress.d = state;
            break;
        case "arrowup":
            keyPress.upArrow = state;
            break;
        case "arrowdown":
            keyPress.downArrow = state;
            break;
        case "arrowleft":
            keyPress.leftArrow = state;
            break;
        case "arrowright":
            keyPress.rightArrow = state;
            break;
        case " ":
            keyPress.space = state;
            break;
        case "shift":
            keyPress.shift = state;
            break;
        case "x":
            if (state) {
                smearFrames = !smearFrames;
            }
            break;
    }
}

window.addEventListener("keydown", function(event){updateKeyboard(event, true)}, true);
window.addEventListener("keyup", function(event){updateKeyboard(event, false)}, true);

requestAnimationFrame(frame);