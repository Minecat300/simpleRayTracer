import { xyz, rgb, rgba, Material } from "./classes.js";
import { setupRayTracer, renderRayTracerFrame } from "./raytracerMain.js";
import s from "./settings.js";

let lastFrameTime = 0;
let fpsList = [];
let smearFrames = false;
const fpsText = document.getElementById("fpsText");

(async () => {
    await setupRayTracer(s);
    requestAnimationFrame(frame);
})();

function frame() {
    renderRayTracerFrame(s, smearFrames);
    // --- Update FPS ---
    const now = performance.now();
    const dt = now - lastFrameTime;
    lastFrameTime = now;
    fpsList.push(1000 / dt);
    if (fpsList.length > 5) fpsList.shift();
    fpsText.innerText = "FPS: " + Math.floor(fpsList.reduce((a,b)=>a+b,0)/fpsList.length);

    // --- Camera movement ---
    const delta = dt / 144;
    if (!smearFrames) {
        if (keyPress.w) { s.camPos.z += Math.cos(s.camDir.x)*s.moveSpeed*delta; s.camPos.x += Math.sin(s.camDir.x)*s.moveSpeed*delta; }
        if (keyPress.s) { s.camPos.z -= Math.cos(s.camDir.x)*s.moveSpeed*delta; s.camPos.x -= Math.sin(s.camDir.x)*s.moveSpeed*delta; }
        if (keyPress.d) { s.camPos.z -= Math.sin(s.camDir.x)*s.moveSpeed*delta; s.camPos.x += Math.cos(s.camDir.x)*s.moveSpeed*delta; }
        if (keyPress.a) { s.camPos.z += Math.sin(s.camDir.x)*s.moveSpeed*delta; s.camPos.x -= Math.cos(s.camDir.x)*s.moveSpeed*delta; }
        if (keyPress.space) s.camPos.y += s.moveSpeed*delta;
        if (keyPress.shift) s.camPos.y -= s.moveSpeed*delta;
        if (keyPress.upArrow) s.camDir.y += s.rotateSpeed*delta;
        if (keyPress.downArrow) s.camDir.y -= s.rotateSpeed*delta;
        if (keyPress.rightArrow) s.camDir.x += s.rotateSpeed*delta;
        if (keyPress.leftArrow) s.camDir.x -= s.rotateSpeed*delta;
    }
    s.camDir.y = Math.max(-Math.PI/2+0.00001, Math.min(Math.PI/2-0.00001, s.camDir.y));

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

function bindElement(obj, key, elementId) {
    const el = document.getElementById(elementId);
    const display = document.getElementById(elementId + "_value");

    function updateDisplay(val) {
        if (display) {
        display.textContent = val;
        }
    }

        if (el.type === "checkbox") {
        updateDisplay(obj[key]);
        el.checked = obj[key];
    } else {
        updateDisplay(obj[key]);
        el.value = obj[key];
    }

    Object.defineProperty(obj, key, {
        get: () => (el.type === "checkbox" ? el.checked : Number(el.value)),
        set: (val) => {
            if (el.type === "checkbox") {
                el.checked = Boolean(val);
                updateDisplay(el.checked);
            } else {
                el.value = Number(val);
                updateDisplay(el.value);
            }
        },
        configurable: true
    });

    const syncFromUI = () => {
        obj[key] = el.type === "checkbox" ? el.checked : Number(el.value);
    };
    el.addEventListener("input", syncFromUI);
    el.addEventListener("change", syncFromUI);
}

bindElement(s, "previewMaxBounceCount", "previewMaxBounceCountSlider");
bindElement(s, "previewNumRayPerPixel", "previewNumRayPerPixelSlider");
bindElement(s, "rendersMaxBounceCount", "rendersMaxBounceCountSlider");
bindElement(s, "rendersNumRayPerPixel", "rendersNumRayPerPixelSlider");

bindElement(s, "divergeStrength", "divergeStrengthSlider");
bindElement(s, "defocusStrength", "defocusStrengthSlider");
bindElement(s, "planeDist", "planeDistSlider");

bindElement(s, "camFov", "camFovSlider");