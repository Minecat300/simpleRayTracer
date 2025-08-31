import { addModel, addTriangle, addMesh, addSphere } from "./objectsHandler.js";
import { xyz, rgb, rgba, Material } from "./classes.js";
import { addObjects } from "./objects.js";
import { createClearPipeline, clearTexture } from "./clear.js";

function liftXYtoXYZ(nx, ny, originalLenXY, originalZPositive = true) {
    const x = nx * originalLenXY;
    const y = ny * originalLenXY;
    const zSquare = 1 - x*x - y*y;
    const z = Math.sqrt(Math.max(0, zSquare));
    return originalZPositive ? new xyz(x, y, z) : new xyz(x, y, -z);
}

let cameraData;
let spheresArray; 
let triangleArray;
let meshArray;
let renderConfigArray;
let skyArray;
let frameInfoArray;

let skyBuffer;
let cameraBuffer;
let renderConfigBuffer;
let spheresBuffer;
let triangleBuffer;
let meshBuffer;
let frameInfoBuffer;

let triangleData;
let meshData;
let sphereData;

let computeBindGroup;
let quadBindGroup;

let computePipeline;
let renderPipeline;
let clearPipeline;

let oldTexture;
let newTexture;

const originalLenXY = Math.sqrt(0.3*0.3 + 0.8*0.8);

let frameCount;

const canvas = document.getElementById("gpuCanvas");
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();
const context = canvas.getContext("webgpu");

console.log("Vendor:", adapter.info.vendor);
console.log("Architecture:", adapter.info.architecture);
console.log("Limits:", adapter.limits);
console.log("Features:", adapter.features);

export async function setupRayTracer(s) {
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: "opaque" });

    canvas.width = s.resolution.x;
    canvas.height = s.resolution.y;

    clearPipeline = await createClearPipeline(device);

    triangleData = [];
    meshData = [];
    sphereData = [];

    //dummy objects to allow not having a mesh/sphere.
    addMesh(meshData, 0, 0, new xyz(), new xyz());
    addTriangle(triangleData, new xyz(), new xyz(), new xyz(), new xyz(), new xyz(), new xyz());
    addSphere(sphereData, new xyz());

    //add actual objects.
    await addObjects(meshData, triangleData, sphereData);

    skyBuffer = device.createBuffer({
        size: 16 * 9, // 6 vec4 slots = 96 bytes
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    cameraBuffer = device.createBuffer({
        size: 32, // two vec3 (pos+target) + vec2(width,height)
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    renderConfigBuffer = device.createBuffer({
        size: 32,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    spheresBuffer = device.createBuffer({
        size: sphereData.length * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });

    triangleBuffer = device.createBuffer({
        size: triangleData.length * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });

    meshBuffer = device.createBuffer({
        size: meshData.length * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });

    frameInfoBuffer = device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    // --- GPU texture for compute shader output ---

    oldTexture = device.createTexture({
        size: [canvas.width, canvas.height],
        format: "rgba16float",
        usage: GPUTextureUsage.TEXTURE_BINDING |
            GPUTextureUsage.STORAGE_BINDING |
            GPUTextureUsage.COPY_SRC |
            GPUTextureUsage.COPY_DST, // <-- add this
    });

    newTexture = device.createTexture({
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

    computePipeline = device.createComputePipeline({
        layout: "auto",
        compute: { module: computeModule, entryPoint: "main" }
    });

    // Bind group for compute: texture + camera
    computeBindGroup = device.createBindGroup({
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
            { binding: 6, resource: { buffer: frameInfoBuffer } },
            { binding: 7, resource: { buffer: triangleBuffer } },
            { binding: 8, resource: { buffer: meshBuffer }}
        ],
    });

    // --- Fullscreen quad pipeline ---
    const quadShaderCode = await (await fetch("shaders/quad.wgsl")).text();
    const quadModule = device.createShaderModule({ code: quadShaderCode });

    const sampler = device.createSampler({ magFilter: "linear", minFilter: "linear" });

    renderPipeline = device.createRenderPipeline({
        layout: "auto",
        vertex: { module: quadModule, entryPoint: "vs" },
        fragment: { module: quadModule, entryPoint: "fs", targets: [{ format }] },
        primitive: { topology: "triangle-list" },
    });

    quadBindGroup = device.createBindGroup({
        layout: renderPipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: newTexture.createView() },
            { binding: 1, resource: sampler },
            { binding: 2, resource: { buffer: frameInfoBuffer } },
        ],
    });

    frameCount = 0;

    cameraData = new Float32Array(8);
    spheresArray = new Float32Array(sphereData); 
    triangleArray = new Float32Array(triangleData);
    meshArray = new Float32Array(meshData);
    renderConfigArray = new Uint32Array(4);
    skyArray = new Float32Array(18);
    frameInfoArray = new Uint32Array(4);
}

export async function renderRayTracerFrame(s, smearFrames) {
    // --- Update dynamic data ---

    cameraData.set([s.camPos.x, s.camPos.y, s.camPos.z, s.camDir.y, s.camDir.x, s.planeDist, s.camFov, 0.0]);

    const sunDir = liftXYtoXYZ(s.sky.sunDir.x, s.sky.sunDir.y, originalLenXY);
    skyArray.set([
        s.sky.horizonColor.r, s.sky.horizonColor.g, s.sky.horizonColor.b, 0.0,
        s.sky.zenithColor.r, s.sky.zenithColor.g, s.sky.zenithColor.b, 0.0,
        s.sky.groundColor.r, s.sky.groundColor.g, s.sky.groundColor.b, 0.0,
        sunDir.x, sunDir.y, sunDir.z, s.sky.sunFocus, s.sky.sunIntensity, s.sky.disable
    ]);

    if (smearFrames) {
        renderConfigArray.set([s.rendersMaxBounceCount, s.rendersNumRayPerPixel, s.divergeStrength, s.defocusStrength]);
    } else {
        renderConfigArray.set([s.previewMaxBounceCount, s.previewNumRayPerPixel, s.divergeStrength, s.defocusStrength]);
    }

    device.queue.writeBuffer(cameraBuffer, 0, cameraData);
    spheresArray.set(sphereData);
    device.queue.writeBuffer(spheresBuffer, 0, spheresArray);
    device.queue.writeBuffer(triangleBuffer, 0, triangleArray);
    device.queue.writeBuffer(meshBuffer, 0, meshArray);
    device.queue.writeBuffer(renderConfigBuffer, 0, renderConfigArray);
    device.queue.writeBuffer(skyBuffer, 0, skyArray);
    frameInfoArray.set([frameCount, smearFrames, s.resolution.x, s.resolution.y]);
    device.queue.writeBuffer(frameInfoBuffer, 0, frameInfoArray);

    // --- Encode GPU work ---
    const encoder = device.createCommandEncoder();

    // Compute pass
    const computePass = encoder.beginComputePass();
    computePass.setPipeline(computePipeline);
    computePass.setBindGroup(0, computeBindGroup);
    computePass.dispatchWorkgroups(Math.ceil(s.resolution.x/8), Math.ceil(s.resolution.y/8));
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
        frameCount = 0;
        clearTexture(device, clearPipeline, oldTexture, canvas.width, canvas.height);
    }

    if (Number.isInteger(frameCount / 100) && frameCount <= 2000 && frameCount != 0) {
        console.log("Frame num: " + frameCount);
    }
}