import { xyz, xy, rgb, rgba, Material } from "./classes.js";

const settings = {
    resolution : new xy(900, 600),        

    previewMaxBounceCount : 3,
    previewNumRayPerPixel : 2,

    rendersMaxBounceCount : 5,
    rendersNumRayPerPixel : 6,

    divergeStrength : 2,
    defocusStrength : 0,
    planeDist       : 1,  

    camPos : new xyz(10, 3, 0),
    camDir : new xy(-Math.PI*0.5, 0),
    camFov : 60,

    moveSpeed   : 1,
    rotateSpeed : 0.5,

    sky: {
        disable      : false,
        horizonColor : new rgb(255, 255, 255),
        zenithColor  : new rgb(102, 204, 255),
        groundColor  : new rgb(171, 161, 145),
        sunDir       : new xy(0.352, 0.937),
        sunFocus     : 400,
        sunIntensity : 100,
    },
}

export default settings;