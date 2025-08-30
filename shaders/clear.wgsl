@group(0) @binding(0) var outputTex : texture_storage_2d<rgba16float, write>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
    let dims = textureDimensions(outputTex);
    if (gid.x >= dims.x || gid.y >= dims.y) {
        return;
    }
    textureStore(outputTex, vec2<i32>(gid.xy), vec4<f32>(0.0));
}