import { addModel, addTriangle, addMesh, addSphere } from "./objectsHandler.js";
import { xyz, xy, rgb, rgba, Material } from "./classes.js";

export async function addObjects(meshArr, triArr, sphereArr) {
    
    addModel(
        triArr, meshArr,
        "assets/Quad.obj",
        new Material(
            new rgb(0, 127, 255)
        ),
        new xyz(),
        new xyz(Math.PI*0.5),
        new xyz(100, 100, 0)
    )

    /*
    await addModel(
        triArr, meshArr,
        "assets/Knight.obj",
        new Material(
            new rgba(255, 255, 255, 1),
            new rgb(0, 0, 0),
            0, 1, 0.2
        ),
        new xyz(0, 0.1, 0),
        new xyz(0, Math.PI*0.8, 0),
        new xyz(0.01, 0.01, 0.01)
    );
    */
    await addRoom(
        meshArr, triArr, new xyz(0, 3.1, 0), new xyz(3, 3, 8),
        new Material(new rgba(255, 0, 0, 1)),
        new Material(new rgba(0, 76, 255, 1)),
        new Material(new rgba(58, 58, 58, 1)),
        new Material(new rgba(189, 22, 227, 1)),
        new Material(new rgba(43, 185, 0, 1)),
        new Material(),
        true,
        new xy(0.2, 0.7),
        new Material(new rgb(0, 0, 0), new rgba(255, 255, 255, 1), 10)
    );

    
    addSphere(
        sphereArr, new xyz(0, 2.1, -6), 1,
        new Material(new rgb(255, 255, 255), new rgb(0, 0, 0), 0, 1, 1)
    );

    addSphere(
        sphereArr, new xyz(0, 2.1, -3), 1,
        new Material(new rgb(255, 255, 255), new rgb(0, 0, 0), 0, 1, 0.4)
    );

    addSphere(
        sphereArr, new xyz(0, 2.1, -0), 1,
        new Material(new rgb(255, 255, 255), new rgb(0, 0, 0), 0, 1, 0.25)
    );

    addSphere(
        sphereArr, new xyz(0, 2.1, 3), 1,
        new Material(new rgb(255, 255, 255), new rgb(0, 0, 0), 0, 1, 0.15)
    );

    addSphere(
        sphereArr, new xyz(0, 2.1, 6), 1,
        new Material(new rgb(255, 255, 255), new rgb(0, 0, 0), 0, 1, 0.02)
    );
    

    const whiteGlowMaterial = new Material(new rgb(0, 0, 0), new rgba(255, 255, 255, 1), 25);
    const diffuseMaterial = new Material(new rgba(255, 48, 48, 1), new rgb(0, 0, 0), 0, 1, 0.1);
    const mirrorMaterial = new Material(new rgba(176, 176, 176, 1), new rgb(0, 0, 0), 0, 0.9);

    //addSphere(sphereArr, new xyz(0, 0, 0), 1, diffuseMaterial);
    //addSphere(sphereArr, new xyz(0, 6, 0), 1, mirrorMaterial);
    //addSphere(sphereArr, new xyz(0, -40, 0), 1, whiteGlowMaterial);

    for (let i = 0; i < 0; i++) {
        addSphere(
            sphereArr,
            new xyz(
                Math.random() * 10 - 5,
                Math.random() * 4 + 1,
                Math.random() * 10 - 5
            ),
            0.5 + Math.random(),
            new Material(
                new rgb(
                    Math.random()*255,
                    Math.random()*255,
                    Math.random()*255
                )
            )
        );
    }
}

async function addRoom(
        meshArr, triArr,
        pos = new xyz(), size = new xyz(2, 2, 2),
        leftMat = new Material(),
        rightMat = new Material(),
        backMat = new Material(),
        frontMat = new Material(),
        floorMat = new Material(),
        ceilMat = new Material(),
        hasLight = true, lightSize =  new xy(0.2, 0.3),
        lightMaterial = new Material(new rgb(0, 0, 0), new rgb(255, 255, 255), 15)
    ) {
    
    await addModel(
        triArr, meshArr,
        "assets/Cube.obj",
        floorMat,
        new xyz(pos.x, pos.y - size.y, pos.z),
        new xyz(),
        new xyz(size.x + 0.1, 0.1, size.z + 0.1)
    )

    await addModel(
        triArr, meshArr,
        "assets/Cube.obj",
        backMat,
        new xyz(pos.x - size.x, pos.y, pos.z),
        new xyz(),
        new xyz(0.1, size.y - 0.1, size.z + 0.1)
    )

    await addModel(
        triArr, meshArr,
        "assets/Cube.obj",
        leftMat,
        new xyz(pos.x + 0.1, pos.y, pos.z - size.z),
        new xyz(),
        new xyz(size.x, size.y - 0.1, 0.1)
    )

    await addModel(
        triArr, meshArr,
        "assets/Cube.obj",
        rightMat,
        new xyz(pos.x + 0.1, pos.y, pos.z + size.z),
        new xyz(),
        new xyz(size.x, size.y - 0.1, 0.1)
    )

    await addModel(
        triArr, meshArr,
        "assets/Cube.obj",
        ceilMat,
        new xyz(pos.x, pos.y + size.y, pos.z),
        new xyz(),
        new xyz(size.x + 0.1, 0.1, size.z + 0.1)
    )

    await addModel(
        triArr, meshArr,
        "assets/Quad.obj",
        frontMat,
        new xyz(pos.x + size.x + 0.1, pos.y, pos.z),
        new xyz(0, Math.PI*0.5),
        new xyz(size.z - 0.1, size.y - 0.1, 1)
    )

    if (hasLight) {
        await addModel(
            triArr, meshArr,
            "assets/Cube.obj",
            lightMaterial,
            new xyz(pos.x, pos.y + size.y - 0.1, pos.z),
            new xyz(),
            new xyz((size.x - 0.1) * lightSize.x, 0.02, (size.z - 0.1) * lightSize.y)
        )
    }
}