export class xyz {
    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
}

export class xy {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }
}

export class rgb {
    constructor(r, g, b) {
        this.r = r/255;
        this.g = g/255;
        this.b = b/255;
    }
}

export class rgba {
    constructor(r, g, b, a) {
        this.r = r/255;
        this.g = g/255;
        this.b = b/255;
        this.a = a;
    }
}

export class Material {
    constructor(color = new rgb(255, 255, 255), emissionColor = new rgb(0, 0, 0), emissionStrength = 0, smoothness = 0, specularProbability = Number(smoothness != 0), specularColor = new rgb(255, 255, 255)) {
        this.color = color;
        this.emissionColor = emissionColor;
        this.emissionStrength = emissionStrength;
        this.smoothness = smoothness;
        this.specularProbability = specularProbability;
        this.specularColor = specularColor;
    }
}