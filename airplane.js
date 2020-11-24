var canvas, gl, program;

var ratio;
var airplaneCenter = {x: 0, y: 0, z: 0}, airplaneRotation = {x: 0, y: 0, z: 0}, floorBorders = {l: 0, f: 0, r: 0, b: 0};
var rollAngle = 0, yawAngle = 0, pitchAngle = 0, propellersAngle = 0, wheelsAngle = 0;
var currentSpeed = 0;
var floorEdgeSize = 800, floorMargin = 300;
var cameraPosition = "none", followCamera;
var rollRight = false, rollLeft = false, yawRight = false, yawLeft = false, pitchUp = false, pitchDown = false, moveForward = false, moveBackward = false;
var filled = true;

var mProjectionLoc, mModelLoc, mViewLoc, applyTextureLoc;
var mProjection, mModel, mView;

var matrixStack;

// Stack related operations
function pushMatrix() {
    var m =  mat4(mModel[0], mModel[1],
           mModel[2], mModel[3]);
    matrixStack.push(m);
}
function popMatrix() {
    mModel = matrixStack.pop();
}
// Append transformations to mModel
function multMatrix(m) {
    mModel = mult(mModel, m);
}
function multTranslation(t) {
    mModel = mult(mModel, translate(t));
}
function multScale(s) { 
    mModel = mult(mModel, scalem(s)); 
}
function multRotationX(angle) {
    mModel = mult(mModel, rotateX(angle));
}
function multRotationY(angle) {
    mModel = mult(mModel, rotateY(angle));
}
function multRotationZ(angle) {
    mModel = mult(mModel, rotateZ(angle));
}

function fit_canvas_to_window() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    ratio = canvas.width / canvas.height;
    gl.viewport(0, 0, canvas.width, canvas.height);
}

window.onresize = function () {
    fit_canvas_to_window();
}

window.onload = function() {
    // Event Listeners
    document.addEventListener("keydown", function() { keyboardDown(event.which); });
    document.addEventListener("keyup", function() { keyboardUp(event.which); });

    canvas = document.getElementById('gl-canvas');

    gl = WebGLUtils.setupWebGL(document.getElementById('gl-canvas'));
    fit_canvas_to_window();

    gl.clearColor(1.0, 1.0, 1.0, 1.0);

    gl.enable(gl.DEPTH_TEST);

    program = initShaders(gl, 'default-vertex', 'default-fragment');

    gl.useProgram(program);

    mProjectionLoc = gl.getUniformLocation(program, "mProjection");
    mModelLoc = gl.getUniformLocation(program, "mModel");
    mViewLoc = gl.getUniformLocation(program, "mView");
    applyTextureLoc = gl.getUniformLocation(program, "applyTexture");

    cameraPosition = "follow";

    cylinderInit(gl);
    coneInit(gl);
    cubeInit(gl);
    
    setupTexture();

    render();
}

// Camera positions
function camera() {
    followCamera = false;
    switch (cameraPosition) {
        case("top"): mView = lookAt([0, 1, 0], [0, 0, 0], [0, 0, -1]); break;
        case("side"): mView = lookAt([1, 0, 0], [0, 0, 0], [0, 1, 0]); break;
        case("front"): mView = lookAt([0, 0, -1], [0, 0, 0], [0, 1, 0]); break;
        case("follow"): mView = lookAt([0, 30, 50], [0, 0, -30], [0, 1, 0]); followCamera = true; break;
    }
}

// Keyboard events
function keyboardDown(event) {
    switch (event) {
        case(81): /* KEY Q */ yawLeft = true; break;
        case(69): /* KEY E */ yawRight = true; break;
        case(87): /* KEY W */ pitchUp = true; break;
        case(83): /* KEY S */ pitchDown = true; break;
        case(65): /* KEY A */ rollLeft = true; break;
        case(68): /* KEY D */ rollRight = true; break;
        case(82): /* KEY R */ moveForward = true; break;
        case(70): /* KEY F */ moveBackward = true; break;
        case(49): /* KEY 1 */ cameraPosition = "top"; break;
        case(50): /* KEY 2 */ cameraPosition = "side"; break;
        case(51): /* KEY 3 */ cameraPosition = "front"; break;
        case(48): /* KEY 0 */ cameraPosition = "follow"; break;
        case(79): /* KEY O */ filled = !filled; break;
    }
}

function keyboardUp(event) {
    switch (event) {
        case(81): /* KEY Q */ yawLeft = false; break;
        case(69): /* KEY E */ yawRight = false; break;
        case(87): /* KEY W */ pitchUp = false; break;
        case(83): /* KEY S */ pitchDown = false; break;
        case(65): /* KEY A */ rollLeft = false; break;
        case(68): /* KEY D */ rollRight = false; break;
        case(82): /* KEY R */ moveForward = false; break;
        case(70): /* KEY F */ moveBackward = false; break;
    }
}

// Yaw
function yawMove() {
    if (yawLeft && yawAngle < 45) { yawAngle += 1; }
    if (yawRight && yawAngle > -45) { yawAngle -= 1; }
    if (!yawLeft && !yawRight) {
        if (yawAngle <= 45 && yawAngle > 0) { yawAngle -= 1; }
        if (yawAngle >= -45 && yawAngle < 0) { yawAngle += 1; }
    }
    airplaneRotation.y += yawAngle * 0.005;
}

// Pitch
function pitchMove() {
    if (pitchUp && pitchAngle < 45) { pitchAngle += 1; }
    if (pitchDown && pitchAngle > -45) { pitchAngle -= 1; }
    if (!pitchUp && !pitchDown) {
        if (pitchAngle <= 45 && pitchAngle > 0) { pitchAngle -= 1; }
        if (pitchAngle >= -45 && pitchAngle < 0) { pitchAngle += 1; }
        if (pitchAngle == 0) {
            if (airplaneRotation.x <= 45 && airplaneRotation.x > 0) { airplaneRotation.x -= 0.1; }
            else if (airplaneRotation.x >= -45 && airplaneRotation.x < 0) { airplaneRotation.x += 0.1; }
        }
    }
    if (currentSpeed > 0) {
        airplaneRotation.x += pitchAngle * 0.005;
        airplaneRotation.x = airplaneRotation.x > 45 ? 45 : airplaneRotation.x;
        airplaneRotation.x = airplaneRotation.x < -45 ? -45 : airplaneRotation.x;
    }
}

// Roll
function rollMove() {
    if (rollLeft && rollAngle < 30) { rollAngle += 1; }
    if (rollRight && rollAngle > -30) { rollAngle -= 1; }
    if (!rollLeft && !rollRight) {
        if (rollAngle <= 30 && rollAngle > 0) { rollAngle -= 1; }
        if (rollAngle >= -30 && rollAngle < 0) { rollAngle += 1; }
        if (rollAngle == 0) {
            if (airplaneRotation.z <= 30 && airplaneRotation.z > 0) { airplaneRotation.z -= 0.1; }
            else if (airplaneRotation.z >= -30 && airplaneRotation.z < 0) { airplaneRotation.z += 0.1; }
        }
    }
    if (airplaneCenter.y > 0) {
        airplaneRotation.z += rollAngle * 0.005;
        airplaneRotation.z = airplaneRotation.z > 30 ? 30 : airplaneRotation.z;
        airplaneRotation.z = airplaneRotation.z < -30 ? -30 : airplaneRotation.z;
        airplaneRotation.y += airplaneRotation.z * 0.005;
    }
}

// Airplane movement
function airplaneMove() {
    if (moveForward && currentSpeed < 0.65) { currentSpeed += 0.01; }
    if (moveBackward && currentSpeed > 0) { currentSpeed -= 0.01; }
    propellersAngle += currentSpeed * 100;
    if (airplaneCenter.y == 0)
        wheelsAngle -= currentSpeed * 100;
    airplaneCenter.x += (-Math.sin(radians(airplaneRotation.y)) + (-Math.sin(radians(airplaneRotation.z)))) * currentSpeed;
    airplaneCenter.y = airplaneCenter.y < 0 ? 0 : airplaneCenter.y + Math.sin(radians(airplaneRotation.x)) * currentSpeed;
    airplaneCenter.z += -Math.cos(radians(airplaneRotation.y)) * currentSpeed;
}

function moveAirplaneAndAilerons() {
    pitchMove();
    yawMove();
    rollMove();
    airplaneMove();
}

function moveCamera() {
    mView = mult(mView, rotateY(-airplaneRotation.y));
    mView = mult(mView, translate([-airplaneCenter.x, -airplaneCenter.y, -airplaneCenter.z]));
}

function render() {
    requestAnimFrame(render);
    
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    if (!followCamera)
        mProjection = ortho(-20 * ratio, 20 * ratio, -20, 20, -50, 50);
    else
        mProjection = perspective(45, ratio, 5, -10);
    camera();
    mModel = mat4();
    matrixStack = [];

    moveAirplaneAndAilerons();
    moveCamera();
    pushMatrix();
        // floor
        drawFloor();
    popMatrix();
        // airplane
        drawAirplane();
}

function drawFloor() {
    // to initialize
    if (floorBorders.l == 0 && floorBorders.f == 0 && floorBorders.r == 0 && floorBorders.b == 0)
        floorBorders = {l: -floorEdgeSize/2, f: -floorEdgeSize/2, r: floorEdgeSize/2, b: floorEdgeSize/2};
    // add blocks to left
    if (airplaneCenter.x < floorBorders.l + floorMargin)
        floorBorders = {l: floorBorders.l - floorEdgeSize, f: floorBorders.f, r: floorBorders.r, b: floorBorders.b};
    // add blocks to front
    if (airplaneCenter.z < floorBorders.f + floorMargin)
        floorBorders = {l: floorBorders.l, f: floorBorders.f - floorEdgeSize, r: floorBorders.r, b: floorBorders.b};
    // add blocks to right
    if (airplaneCenter.x > floorBorders.r - floorMargin)
        floorBorders = {l: floorBorders.l, f: floorBorders.f, r: floorBorders.r + floorEdgeSize, b: floorBorders.b};
    // add blocks to back
    if (airplaneCenter.z > floorBorders.b - floorMargin)
        floorBorders = {l: floorBorders.l, f: floorBorders.f, r: floorBorders.r, b: floorBorders.b + floorEdgeSize};
    
    // delete blocks from left
    if (airplaneCenter.x > floorBorders.l + floorEdgeSize + floorMargin)
        floorBorders = {l: floorBorders.l + floorEdgeSize, f: floorBorders.f, r: floorBorders.r, b: floorBorders.b};
    // delete blocks from front
    if (airplaneCenter.z > floorBorders.f + floorEdgeSize + floorMargin)
        floorBorders = {l: floorBorders.l, f: floorBorders.f + floorEdgeSize, r: floorBorders.r, b: floorBorders.b};
    // delete blocks from right
    if (airplaneCenter.x < floorBorders.r - floorEdgeSize - floorMargin)
        floorBorders = {l: floorBorders.l, f: floorBorders.f, r: floorBorders.r - floorEdgeSize, b: floorBorders.b};
    // delete blocks from back
    if (airplaneCenter.z < floorBorders.b - floorEdgeSize - floorMargin)
        floorBorders = {l: floorBorders.l, f: floorBorders.f, r: floorBorders.r, b: floorBorders.b - floorEdgeSize};
    
    // draw floor
    gl.uniform2f(applyTextureLoc, 1, 0);
    for (var posX = floorBorders.l + floorEdgeSize/2; posX < floorBorders.r; posX += floorEdgeSize) {
        for (var posZ = floorBorders.b - floorEdgeSize/2; posZ > floorBorders.f; posZ -= floorEdgeSize) {
            mModel = mult(translate([posX, -4, posZ]), scalem([floorEdgeSize, 1, floorEdgeSize]));
            passMatrix();
            cubeDraw(gl, program, filled);
        }
    }
    gl.uniform2f(applyTextureLoc, 0, 0);
}

function drawAirplane() {
    multTranslation([airplaneCenter.x, airplaneCenter.y , airplaneCenter.z]);
    multRotationY(airplaneRotation.y);
    multRotationZ(airplaneRotation.z);
    multRotationX(airplaneRotation.x);
    pushMatrix();
        // body
        body();
    popMatrix();
    pushMatrix();
        // cockpit
        multTranslation([0, 0, -6]);
        pushMatrix();
            // cone
            cockpit();
        popMatrix();
            // propellers
            multTranslation([0, 0, -1]);
            multRotationZ(propellersAngle);
            pushMatrix();
                // horizontal propeller
                propeller("horizontal");
            popMatrix();
                // vertical propeller
                propeller("vertical");
    popMatrix();
    pushMatrix();
        // main wing
        pushMatrix();
            // panel
            mainWingPanel();
        popMatrix();
        pushMatrix();
            // left aileron
            mainWingAileron("left");
        popMatrix();
            // right aileron
            mainWingAileron("right");
    popMatrix();
    pushMatrix();
        // tail
        multTranslation([0, 0, 8]);
        pushMatrix();
            // cone
            tail();
        popMatrix();
        pushMatrix();
            // top wing
            multTranslation([0, 1.5, 2]);
            pushMatrix();
                // panel
                tailWingPanel("top");
            popMatrix();
                // aileron
                tailWingAileron("top");
        popMatrix();
        pushMatrix();
            // left wing
            multTranslation([-1.5, 0, 2]);
            pushMatrix();
                // panel
                tailWingPanel("left");
            popMatrix();
                // aileron
                tailWingAileron("left");
        popMatrix();
            // right wing
            multTranslation([1.5, 0, 2]);
            pushMatrix();
                // panel
                tailWingPanel("right");
            popMatrix();
                // aileron
                tailWingAileron("right");
    popMatrix();
    pushMatrix();
        // front wheel
        wheel("front");
    popMatrix();
    pushMatrix();
        // back left wheel
        wheel("left");
    popMatrix();
        // back right wheel
        wheel("right");
}

function body() {
    multRotationX(90);
    multScale([3, 10, 3]);
    passMatrix();
    cylinderDraw(gl, program, filled);
}

function cockpit() {
    multRotationX(-90);
    multScale([3, 2, 3]);
    passMatrix();
    coneDraw(gl, program, filled);
}

function propeller(orientation) {
    switch (orientation) {
        case("horizontal"):
            break;
        case("vertical"):
            multRotationZ(90);
            break;
    }
    multScale([3, 0.1, 0.1]);
    passMatrix();
    cubeDraw(gl, program, filled);
}

function mainWingPanel() {
    multScale([33, 0.25, 2.5]);
    passMatrix();
    cubeDraw(gl, program, filled);
}

function mainWingAileron(position) {
    switch (position) {
        case("left"):
            multTranslation([-9, 0, 1.25]);
            multRotationX(-rollAngle);
            break;
        case("right"):
            multTranslation([9, 0, 1.25]);
            multRotationX(rollAngle);
            break;
    }
    multTranslation([0, 0, 0.25]);
    multScale([15, 0.25, 0.5]);
    passMatrix();
    cubeDraw(gl, program, filled);
}

function tail() {
    multRotationX(90);
    multScale([3, 6, 3]);
    passMatrix();
    coneDraw(gl, program, filled);
}

function tailWingPanel(position) {
    var rotationAngle = 0;
    switch (position) {
        case("top"):
            rotationAngle = -90;
            break;
        case("left"):
            break;
        case("right"):
            break;
    }
    multRotationZ(rotationAngle);
    multScale([3, 0.1, 2]);
    passMatrix();
    cubeDraw(gl, program, filled);
}

function tailWingAileron(position) {
    switch (position) {
        case("top"):
            multTranslation([0, 0.25, 1]);
            multRotationZ(-90);
            multRotationX(yawAngle);
            break;
        case("left"):
            multTranslation([-0.25, 0, 1]);
            multRotationZ(0);
            multRotationX(-pitchAngle);
            break;
        case("right"):
            multTranslation([0.25, 0, 1]);
            multRotationZ(0);
            multRotationX(-pitchAngle);
            break;
    }
    multTranslation([0, 0, 0.25]);
    multScale([2.5, 0.1, 0.5]);
    passMatrix();
    cubeDraw(gl, program, filled);
}

function wheel(position) {
    switch (position) {
        case("front"):
            multTranslation([0, 0, -4]);
            break;
        case("left"):
            multTranslation([-1, 0, 4]);
            break;
        case("right"):
            multTranslation([1, 0, 4]);
            break;
    }
    pushMatrix();
        // support
        multTranslation([0, -1.25, 0]);
        multScale([0.5, 2.5, 0.5]);
        passMatrix();
        cubeDraw(gl, program, filled);

    popMatrix();
        // wheel
        multTranslation([0, -3, 0]);
        multRotationX(wheelsAngle);
        multRotationZ(90);
        multScale([1, 0.5, 1]);
        passMatrix();
        cylinderDraw(gl, program, filled);
}

function passMatrix() {
    gl.uniformMatrix4fv(mProjectionLoc, false, flatten(mProjection));
    gl.uniformMatrix4fv(mModelLoc, false, flatten(mModel));
    gl.uniformMatrix4fv(mViewLoc, false, flatten(mView));
}

function setupTexture() {
    // Create a texture.
    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // Fill the texture with a 1x1 blue pixel.
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([181, 165, 66, 255]));
    // Asynchronously load an image
    /*+var image = new Image();
    image.src = "floor.jpg";*/
    /*image.onload = function() {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        // setup of texture parameters
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.bindTexture(gl.TEXTURE_2D, null);
    };*/
    /**image.addEventListener('load', function() {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        // Now that the image has loaded make copy it to the texture.
        gl.bindTexture(gl.TEXTURE_2D, texture);
        //gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA,gl.UNSIGNED_BYTE, image);
        gl.generateMipmap(gl.TEXTURE_2D);
    });*/
}
