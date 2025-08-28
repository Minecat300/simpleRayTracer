struct Ray {
    origin : vec3<f32>,
    dir    : vec3<f32>,
}

struct Camera {
    position : vec3<f32>,
    pitch    : f32,
    yaw      : f32,
}

@group(0) @binding(2)
var<uniform> camera : Camera;

struct Sphere {
    center           : vec3<f32>,
    radius           : f32,
    color            : vec3<f32>,
    emissionColor    : vec3<f32>,
    emissionStrength : f32,
    _padding         : vec3<f32>,
};

@group(0) @binding(3)
var<storage> spheres : array<Sphere>;

struct RenderConfig {
    maxBounceCount : u32,
    numRayPerPixel : u32,
}

@group(0) @binding(4)
var<uniform> renderConfig : RenderConfig;

struct SkySettings {
    SkyColorHorizon : vec3<f32>,
    SkyColorZenith  : vec3<f32>,
    GroundColor     : vec3<f32>,
    SunLightDirection: vec3<f32>,
    SunFocus         : f32,
    SunIntensity     : f32,
    _padding0        : vec2<f32>, // keep alignment 16-byte safe
};

@group(0) @binding(5)
var<uniform> sky : SkySettings;

@group(0) @binding(6) 
var<uniform> frameCount : u32;

struct Material {
    color            : vec3<f32>,
    emissionColor    : vec3<f32>,
    emissionStrength : f32,
}

struct RayTracingMaterial {
    color : vec3<f32>,
}

struct HitInfo {
    didHit   : bool,
    dst      : f32,
    hitPoint : vec3<f32>,
    normal   : vec3<f32>,
    material : Material,
};

fn RandomValue(state: ptr<function, u32>) -> f32 {
    *state = (*state * 747796405u) + 2891336453u;
    var result: u32 = ((*state >> ((*state >> 28u) + 4u)) ^ *state) * 277803737u;
    result = (result >> 22u) ^ result; return f32(result) / 4294967295.0;
}

fn RandomValueNormalDistribution(state: ptr<function, u32>) -> f32 {
    let theta = 2.0 * 3.1415926 * RandomValue(state); 
    let rho = sqrt(-2.0 * log(RandomValue(state))); 
    return rho * cos(theta); 
} 

fn RandomDirection(state: ptr<function, u32>) -> vec3<f32> { 
    let x = RandomValueNormalDistribution(state); 
    let y = RandomValueNormalDistribution(state); 
    let z = RandomValueNormalDistribution(state); 
    return normalize(vec3<f32>(x, y, z)); 
}

fn GetEnvironmentLight(ray: Ray) -> vec3<f32> {
    let skyGradientT = pow(smoothstep(0.0, 0.4, ray.dir.y), 0.35);
    let skyGradient = mix(sky.SkyColorHorizon, sky.SkyColorZenith, skyGradientT);

    // Sun contribution
    let sun = pow(max(0.0, dot(ray.dir, normalize(sky.SunLightDirection))), sky.SunFocus) * sky.SunIntensity;

    // Ground/sky blending
    let groundToSkyT = smoothstep(-0.01, 0.0, ray.dir.y);

    // Sun mask: only show sun when looking above horizon (ray.dir.y > 0)
    let sunMask = select(0.0, 1.0, ray.dir.y > 0.0);

    return mix(sky.GroundColor, skyGradient, groundToSkyT) + sun * sunMask;
    //return vec3<f32>(0.0);
}

fn CalculateRayCollision(ray: Ray) -> HitInfo {
    var closestHit: HitInfo;
    closestHit.didHit = false;
    closestHit.dst = 1e9;
    closestHit.hitPoint = vec3<f32>(0.0);
    closestHit.normal = vec3<f32>(0.0);
    closestHit.material = Material(vec3<f32>(0.0), vec3<f32>(0.0), 0.0);

    for (var i = 0u; i < arrayLength(&spheres); i = i + 1u) {
        let sphere = spheres[i];
        let hitInfo = RaySphere(ray, sphere);

        if (hitInfo.didHit && hitInfo.dst < closestHit.dst) {
            closestHit = hitInfo;
            closestHit.material = Material(sphere.color, sphere.emissionColor, sphere.emissionStrength);
        }
    }
    return closestHit;
}

fn RaySphere(ray : Ray, sphere : Sphere) -> HitInfo {
    let oc = ray.origin - sphere.center;
    let a = dot(ray.dir, ray.dir);
    let b = 2.0 * dot(oc, ray.dir);
    let c = dot(oc, oc) - sphere.radius * sphere.radius;
    let discriminant = b*b - 4.0*a*c;

    if discriminant < 0.0 {
        return HitInfo(false, -1.0, vec3<f32>(0.0), vec3<f32>(0.0),
                       Material(vec3<f32>(0.0), vec3<f32>(0.0), 0.0));
    }

    let sqrtD = sqrt(discriminant);
    let t1 = (-b - sqrtD) / (2.0 * a);
    let t2 = (-b + sqrtD) / (2.0 * a);

    var dst = -1.0;

    if t1 > 0.0 && t2 > 0.0 {
        dst = min(t1, t2);
    } else if t1 > 0.0 {
        dst = t1;
    } else if t2 > 0.0 {
        dst = t2;
    }

    if dst < 0.0 {
        return HitInfo(false, -1.0, vec3<f32>(0.0), vec3<f32>(0.0),
                       Material(vec3<f32>(0.0), vec3<f32>(0.0), 0.0));
    }

    let hitPoint = ray.origin + dst * ray.dir;
    let normal = normalize(hitPoint - sphere.center);

    // Pass the actual sphere material
    let material = Material(sphere.color, sphere.emissionColor, sphere.emissionStrength);

    return HitInfo(true, dst, hitPoint, normal, material);
}

fn trace(r: Ray, rngState: ptr<function, u32>) -> vec3<f32> {
    var ray = r;
    var incomingLight = vec3<f32>(0.0);
    var rayColor = vec3<f32>(1.0);
    for (var i = 0u; i <= renderConfig.maxBounceCount; i = i + 1u) {
        let hitInfo = CalculateRayCollision(ray);
        if (hitInfo.didHit) {
            ray.origin = hitInfo.hitPoint + 1e-4 * hitInfo.normal;
            ray.dir = normalize(hitInfo.normal + RandomDirection(rngState));

            let material = hitInfo.material;
            let emittedLight = material.emissionColor * material.emissionStrength;
            incomingLight += emittedLight * rayColor;
            rayColor *= material.color;

        } else {
            let _dummy = sky;
            incomingLight += rayColor * GetEnvironmentLight(ray);
            break;
        }
    }

    return incomingLight;
}

@group(0) @binding(0) var oldFrame : texture_2d<f32>;  // sampled
@group(0) @binding(1) var newFrame : texture_storage_2d<rgba16float, write>; // written to

@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
    let width = 1000u;
    let height = 600u;
    if (gid.x >= width || gid.y >= height) { return; }
    let aspect = f32(width) / f32(height);

    let cosPitch = cos(camera.pitch);
    let sinPitch = sin(camera.pitch);
    let cosYaw   = cos(camera.yaw);
    let sinYaw   = sin(camera.yaw);

    let forward = normalize(vec3<f32>(
        cosPitch * sinYaw,
        sinPitch,
        cosPitch * cosYaw
    ));

    let worldUp = vec3<f32>(0.0,1.0,0.0);
    let right   = normalize(cross(worldUp, forward));
    let up      = cross(forward, right);

    // UV mapping (flipped Y)
    let uv = vec2<f32>(
        (f32(gid.x)/f32(width) * 2.0 - 1.0) * aspect,
        1.0 - (f32(gid.y)/f32(height) * 2.0)
    );

    let fov = radians(90.0); // 60° vertical FOV
    let px = uv.x * tan(fov * 0.5);
    let py = uv.y * tan(fov * 0.5);
    let dir = normalize(forward + px*right + py*up);

    var ray = Ray(camera.position, dir);

    var pixelIndex = gid.y * width + gid.x;
    var rngState = pixelIndex + frameCount * 1664525u;

    /*
    trace(&ray, &rngState);
    let r = RandomValue(&rngState);
    let g = RandomValue(&rngState);
    let b = RandomValue(&rngState);
    let color = vec4<f32>(r, g, b, 1.0);
    */

    var totalIncomingLight = vec3<f32>(0.0);
    for (var rayIndex = 0u; rayIndex < renderConfig.numRayPerPixel; rayIndex = rayIndex + 1u) {
        totalIncomingLight += trace(ray, &rngState);
        rngState += 128512u;
    }

    let coords = vec2<i32>(i32(gid.x), i32(gid.y));

    // Read previous accumulated color
    let prevColor = textureLoad(oldFrame, coords, 0);

    // Compute current sample
    let pixelColor = totalIncomingLight / f32(renderConfig.numRayPerPixel);
    let color = vec4<f32>(pixelColor, 1.0);

    // Compute progressive weight
    let weight = 1.0 / f32(frameCount + 1);

    // Blend old + new
    let blended = prevColor * (1.0 - weight) + color * weight;

    // Store blended result
    textureStore(newFrame, coords, blended);
}
