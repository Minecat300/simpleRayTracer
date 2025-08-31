@group(0) @binding(0) var tex : texture_2d<f32>;
@group(0) @binding(1) var samp : sampler;

@vertex
fn vs(@builtin(vertex_index) vertexIndex : u32) -> @builtin(position) vec4<f32> {
    var positions = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>( 1.0, -1.0),
        vec2<f32>(-1.0,  1.0),
        vec2<f32>(-1.0,  1.0),
        vec2<f32>( 1.0, -1.0),
        vec2<f32>( 1.0,  1.0)
    );
    return vec4<f32>(positions[vertexIndex], 0.0, 1.0);
}

struct FrameInfo {
    frameCount  : u32,
    smearFrames : u32,
    width       : u32,
    height      : u32,
}

@group(0) @binding(2) var<uniform> frameInfo : FrameInfo;

@fragment
fn fs(@builtin(position) fragCoord : vec4<f32>) -> @location(0) vec4<f32> {
    let uv = fragCoord.xy / vec2<f32>(f32(frameInfo.width), f32(frameInfo.height));
    let sumColor = textureSample(tex, samp, uv).rgb;

    let _dummy = frameInfo;
    var finalColor = sumColor;

    return vec4<f32>(finalColor, 1.0);
}
