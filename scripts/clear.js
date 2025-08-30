export async function createClearPipeline(device) {
    const code = await fetch("shaders/clear.wgsl").then(r => r.text());

    const module = device.createShaderModule({ code });

    const pipeline = device.createComputePipeline({
        layout: "auto",
        compute: {
            module,
            entryPoint: "main"
        }
    });

    return pipeline;
}

export function clearTexture(device, pipeline, texture, width, height) {
    const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: texture.createView() }
        ]
    });

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(
        Math.ceil(width / 8),
        Math.ceil(height / 8)
    );
    pass.end();

    device.queue.submit([encoder.finish()]);
}