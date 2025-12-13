// ----------------------------------------------------------------------------------------------
// Global variables and helper functions
// ----------------------------------------------------------------------------------------------
let prevTx = null;
let prevTy = null;

// canvas size
let canvasX = 800;
let canvasY = 700;
let iconLayer;
let keysLayer;

// initialize terrain
let terrainLayer;
let heightmap = [];

// map key parameters
let bleed = 10;
let size = 300;
let offset;
let rOffset;
let myFont;

// controls functionality
let brushSlider;
let sensitivitySlider;
let usingSlider = false;
let mode = "raise";  // "raise" or "lower"
let saveArea = { x:169.5 + offset, y:58.2 * bleed, w:70, h:59 };

// brush settings
let radius;
let sensitivity;

// store information around which key is active
let keys = [];
let currentTool = ''; // currently selected tool
let drawRiver = false;
let drawRoad = false;

// draw river parameters
let currentWeight = 1;
let growthRate = 0.15;
let maxWeight = 7;

// information about map labels
let input;
let texts = []; // each element: {x, y, text}
let editingIndex = -1; // track which text is being edited
let inputX = -100;
let inputY = -100;

// information about map title
let mapTitle = "";
let editingTitle = false;
let titleInput;
let titleHeight = 70;

// handle double tap
let tapNum = 0;

// terrain class 
class TerrainType {
  constructor(minHeight, maxHeight, minColor, maxColor, lerpAdjustment = 0) {
    this.minHeight = minHeight;
    this.maxHeight = maxHeight;

    // Precompute raw RGB
    this.minRGB = [red(minColor), green(minColor), blue(minColor)];
    this.maxRGB = [red(maxColor), green(maxColor), blue(maxColor)];

    this.lerpAdjustment = lerpAdjustment;
  }
}

// terrain objects
let waterTerrain, sandTerrain, grassTerrain, treesTerrain;
let terrains = [];

// load font
function preload() {
  myFont = loadFont('Trajan Pro Regular.ttf');
}


// ----------------------------------------------------------------------------------------------
// Setup function
// ----------------------------------------------------------------------------------------------

function setup() {
  // create canvas and graphic layers
  createCanvas(max(windowWidth - 30, size * 3), max(windowHeight - 30, 680));
  
  iconLayer       = createGraphics(width, height);
  iconLayer.colorMode(HSB);
  
  keysLayer       = createGraphics(width, height);
  keysLayer.noFill();
  keysLayer.strokeWeight(2);

  // setup font
  textFont(myFont);
  
  // define offset for the map key location
  offset = width - size + bleed;
  rOffset = width - size + (bleed * 15);
  
  // define all key rectangles
  keys = [
    {name:"Village", x:4, y:9.4, w:110, h:20, fixed: true},
    {name:"Town", x:4, y:11.9, w:110, h:20, fixed: true},
    {name:"City", x:4, y:14.4, w:110, h:20, fixed: true},
    {name:"Port", x:4, y:16.9, w:110, h:20, fixed: true},
    {name:"Castle", x:135, y:9.4, w:130, h:20, fixed: true},
    {name:"X mark", x:135, y:11.9, w:130, h:20, fixed: true},
    {name:"Waypoint", x:135, y:14.4, w:130, h:20, fixed: true},
    {name:"Road", x:135, y:16.9, w:130, h:20, fixed: true},
    
    {name:"Tree One", x:4, y:24.4, w:110, h:22, fixed: true},
    {name:"Hill", x:4, y:26.9, w:110, h:20, fixed: true},
    {name:"Cave", x:4, y:29.4, w:110, h:20, fixed: true},
    
    {name:"Tree Two", x:135, y:24.4, w:130, h:22, fixed: true},
    {name:"Mountain", x:135, y:26.9, w:130, h:20, fixed: true},
    {name:"River", x:135, y:29.4, w:130, h:20, fixed: true},
    
    {name:"Landmass", x:20, y:31.6, w:240, h:28, fixed: false},
    {name:"Water", x:20, y:28.6, w:240, h:28, fixed: false},
    {name:"Labels", x:20, y:25.6, w:240, h:28, fixed: false},
    {name:"Title", x:20, y:22.6, w:240, h:28, fixed: false},
    {name:"Eraser", x:20, y:19.6, w:240, h:28, fixed: false},
    
    {name:"Save", x:169.5, y:9.3, w:70, h:59, fixed: false},
    {name:"Outside", x:0, y:0, w:0, h:0, fixed: true}
  ];
  
  
  // create sliders
  // brush size
  brushSlider = createSlider(5, 150); // LIMIT BRUSH SIZE?
  brushSlider.position(offset + 20, height - bleed * 13);
  brushSlider.size(80);
  
  brushSlider.input(() => {
    usingSlider = true;
  });
  
  // brush sensitivity
  sensitivitySlider = createSlider(5, 50);
  sensitivitySlider.position(offset + 25 + 135, height - bleed * 13);
  sensitivitySlider.size(80);
  
  sensitivitySlider.input(() => {
    usingSlider = true;
  });
  
  // eraser size
  eraserSlider = createSlider(5, 200);
  eraserSlider.position(offset + 20, height - bleed * 6);
  eraserSlider.size(80);
  
  eraserSlider.input(() => {
    usingSlider = true;
  });
  
  
  // initialize heightmap
  const W = width;   // cache width
  const H = height;  // cache height

  for (let y = 0; y < H; y++) {
    heightmap[y] = [];
    const hmRow = heightmap[y];
    for (let x = 0; x < W; x++) {
      hmRow[x] = 0.0;
    }
  }

  // terrain color definitions
  waterTerrain =
    new TerrainType(0.0, 0.5, color(30, 176, 251), color(40, 255, 255));
  sandTerrain  =
    new TerrainType(0.5, 0.65, color(215, 192, 158), color(255, 246, 193), 0.3);
  grassTerrain =
    new TerrainType(0.65, 0.9, color(118, 239, 124), color(2, 166, 155));
  treesTerrain =
    new TerrainType(0.9, 1.0, color(10, 145, 113), color(20, 155, 120), -0.5);

  terrains = [waterTerrain, sandTerrain, grassTerrain, treesTerrain];
  terrainLayer = createImage(width, height);
  
  terrainLayer.loadPixels();
  let c = color(30, 176, 251);
  for (let i = 0; i < terrainLayer.pixels.length; i += 4) {
    terrainLayer.pixels[i] = red(c);
    terrainLayer.pixels[i+1] = green(c);
    terrainLayer.pixels[i+2] = blue(c);
    terrainLayer.pixels[i+3] = 255;
  }
  terrainLayer.updatePixels();
  
  
  // setup input for labels
  textSize(16);
  input = createInput();
  input.position(-100, -100); // hidden initially
  input.hide();

  // commit the text on Enter
  input.elt.addEventListener('keydown', e => {
    if (e.key === 'Enter') commitText();
  });
  
  // setup input for title
  titleInput = createInput("");
  titleInput.hide();

  titleInput.input(() => {
    mapTitle = titleInput.value();
  });

  titleInput.elt.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      finishTitleEditing();
    }
  });
}

// ----------------------------------------------------------------------------------------------
// Draw function
// ----------------------------------------------------------------------------------------------

function draw() {
  // draw layers of the background
  background(200);  
  image(terrainLayer, 0, 0);
  image(iconLayer, 0, 0);
  
  // draw all current labels
  noStroke();
  fill(0);
  for (let t of texts) {
    push();
    textAlign(CENTER, CENTER);
    text(t.text, t.x, t.y);
    pop();
  }
  
  // draw title when turned on
  drawMapTitle();
  
  // show preview of the brush size if the draw tools are selected
  if (currentTool === "Landmass" || currentTool === "Water") {
    drawBrushPreview(brushSlider, 1.5);
  }
  else if (currentTool === "Eraser") {
    drawBrushPreview(eraserSlider, 1);
  }
  
// paint terrain if the draw tools are selected, avoid sliders and raise/lower selection key rectangle
  if (touches.length > 0 &&
      (currentTool === "Landmass" || currentTool === "Water") &&
      !touchInRect(offset + 3, bleed * 6.8, 118, 42, false) && 
      !touchInRect(offset + 3, bleed * 13.8, 118, 42, false) &&
      !touchInRect(offset + 143, bleed * 13.8, 118, 42, false) &&
      !touchInRect(offset + 25, bleed * 32.5, 230, 75, false)) {
    
    if (touches.length > 0) {
      let tx = touches[0].x;
      let ty = touches[0].y;

      paintTerrain(tx, ty);
      updateTerrainRegion(tx, ty);
    }
  }

  // erase icons if eraser tool selected, avoid sliders
  if (touches.length > 0 &&
      currentTool === "Eraser" &&
      !touchInRect(width - size - 10, bleed - 10, size - bleed + 20, 320 + 20, true) &&
      !touchInRect(offset + 3, bleed * 6.8, 118, 42, false) && 
      !touchInRect(offset + 3, bleed * 13.8, 118, 42, false) &&
      !touchInRect(offset + 143, bleed * 13.8, 118, 42, false) &&
      !touchInRect(offset + 25, bleed * 20, 230, 34, false)) {

    useEraser();
  }
  
  // draw map key and controls
  rectMode(CORNER);
  createMapKey();
  createControls();

  // draw highlight only for the currently selected key
  image(keysLayer, 0, 0);
  
  
  for (let k of keys) {
    if (currentTool === k.name) {
      keysLayer.noErase();
      keysLayer.stroke(0);
    }
    else {
      keysLayer.erase();
    }
    drawKeySelection(k.x, k.y, k.w, k.h, k.fixed);
  }
  stroke(0);
  
  
  // continuous tools
  drawRiverTool();
  drawRoadTool();
  
  if (touches.length > 0) {
    let tx = touches[0].x;
    let ty = touches[0].y;

    // update previous touch AFTER your drawing tools run
    prevTx = tx;
    prevTy = ty;
  }
}

// ----------------------------------------------------------------------------------------------
// Mouse press functionality
// ----------------------------------------------------------------------------------------------

function touchStarted() {
  // if no touch exists, stop immediately (prevents errors)
  if (touches.length === 0) return;

  let tx = touches[0].x;
  let ty = touches[0].y;

  // reset having clicked key
  let clickedKey = false;

  // Check if a key was tapped
  for (let k of keys) {
    if (touchInRect(offset + k.x, bleed * k.y, k.w, k.h, k.fixed)) {
      currentTool = k.name;
      clickedKey = true;

      drawRiver = (k.name === 'River');
      drawRoad  = (k.name === 'Road');
      break;
    }
  }

  // if sliders are tapped, do nothing
  if (touchInRect(offset + 3, bleed * 6.8, 118, 42, false) || 
      touchInRect(offset + 3, bleed * 13.8, 118, 42, false) ||
      touchInRect(offset + 143, bleed * 13.8, 118, 42, false)) {
    return;
  }

  // if a key was NOT clicked but tap occurred inside the key map area → deselect
  if (!clickedKey && touchInRect(width - size - 10, bleed - 10, size - bleed + 20, 320 + 20, true)) {
    currentTool = "Outside";
    drawRiver = false;
    drawRoad  = false;
    return; // avoid drawing icons underneath
  }
  
  // if the save rect was pressed, save the canvas
  if (touchInRect(169.5 + offset, 9.3 * bleed, 70, 59, false)) {
    tapNum += 1;
    if (tapNum == 2) {
      saveCanvasWithLayers();
      tapNum = 0;
    }
  }

  // Otherwise, user tapped the map → draw icons
  if (!clickedKey && !touchInRect(width - size - 10, bleed - 10, size - bleed + 20, 320 + 20, true)) {

    const choice = currentTool;

    if (!choice) return; // safety

    // Draw the selected icon (if not River/Road)
    if (choice !== 'River' && choice !== 'Road') {

      if (choice === 'Village')   drawVillage(tx, ty);
      else if (choice === 'Town') drawTown(tx, ty);
      else if (choice === 'City') drawCity(tx, ty);
      else if (choice === 'Port') drawPort(tx, ty);
      else if (choice === 'Castle') drawCastle(tx, ty);
      else if (choice === 'X mark') drawX(tx, ty);
      else if (choice === 'Waypoint') drawWaypoint(tx, ty);

      else if (choice === 'Tree One') drawTreeOne(tx, ty);
      else if (choice === 'Tree Two') drawTreeTwo(tx, ty);
      else if (choice === 'Hill') drawHill(tx, ty);
      else if (choice === 'Mountain') drawMountain(tx, ty);
      else if (choice === 'Cave') drawCave(tx, ty);

      else if (choice === 'Labels') drawLabel(tx, ty);
      else if (choice === 'Title') startTitleEditing();

      else if (choice === 'Landmass') mode = "raise";
      else if (choice === 'Water')   mode = "lower";
    }
  }
}


// boolean function for determining if the mouse is within a specific rectangle
function touchInRect(x, y, w, h, fixed) {
  if (touches.length === 0) return false;

  let tx = touches[0].x;
  let ty = touches[0].y;

  if (fixed) {
    return tx >= x && tx <= x + w &&
           ty >= y && ty <= y + h;    
  } else {
    return tx >= x && tx <= x + w &&
           ty >= height - y && ty <= height - y + h;
  }
}


// draw boxes around keys if they are selected
function drawKeySelection(x, y, w, h, fixed) {
  if (fixed) {
    keysLayer.rect(offset + x, bleed * y, w, h);
  } else {
    keysLayer.rect(offset + x, height - bleed * y, w, h);
  }
  
}

// for the river function, reset brush width back to 1 if mouse is released
function touchEnded() {
  prevTx = null;
  prevTy = null;
  currentWeight = 1;   // your original behavior
}



// ----------------------------------------------------------------------------------------------
// Functions for drawing Icons
// ----------------------------------------------------------------------------------------------

function drawVillage(x, y) {
  iconLayer.push();
  iconLayer.stroke(0);
  iconLayer.strokeWeight(3);
  iconLayer.circle(x, y, 3);
  iconLayer.pop();
}

function drawTown(x, y) {
  iconLayer.push();
  iconLayer.fill(255);
  iconLayer.strokeWeight(1);
  iconLayer.stroke(0);
  iconLayer.circle(x, y, 10);
  
  iconLayer.strokeWeight(3);
  iconLayer.circle(x, y, 3);
  iconLayer.pop();
}

function drawCity(x, y) {
  iconLayer.push();
  iconLayer.strokeWeight(2);
  iconLayer.stroke(color("#7F0B1D"));
  iconLayer.fill(255);

  iconLayer.beginShape();
  for (let i = 0; i < 5; i++) {
    const angle = TWO_PI * i / 5 + (-PI / 2);
    const px = x + cos(angle) * 7;
    const py = y + sin(angle) * 7;
    iconLayer.vertex(px, py);
  }
  iconLayer.endShape(CLOSE);
  iconLayer.pop();
}

function drawPort(x, y) {
  iconLayer.push();
  iconLayer.strokeWeight(2);
  iconLayer.stroke(0);
  iconLayer.noFill();
  iconLayer.line(x, y - 2, x, y + 3);
  iconLayer.circle(x, y - 6, 4);
  iconLayer.arc(x, y, 10, 10, 0, PI);
  iconLayer.pop();
}

function drawCastle(x, y) {
  iconLayer.push();
  iconLayer.strokeWeight(2);
  iconLayer.stroke(0);
  iconLayer.line(x - 3, y + 1, x - 5, y + 6);
  iconLayer.line(x - 5, y - 5, x - 3, y + 1);
  
  iconLayer.line(x - 5, y - 5, x - 4, y - 5);
  iconLayer.line(x - 4, y - 3, x - 4, y - 5);
  iconLayer.line(x - 4, y - 3, x - 0.5, y - 3);
  
  iconLayer.line(x - 0.5, y - 3, x - 0.5, y - 5);
  iconLayer.line(x - 0.5, y - 5, x + 0.5, y - 5);
  iconLayer.line(x + 0.5, y - 3, x + 0.5, y - 5);
  
  iconLayer.line(x + 0.5, y - 3, x + 4, y - 3);
  iconLayer.line(x + 4, y - 3, x + 4, y - 5);
  iconLayer.line(x + 5, y - 5, x + 4, y - 5);
  
  iconLayer.line(x + 5, y - 5, x + 3, y + 1);
  iconLayer.line(x + 3, y + 1, x + 5, y + 6);
  iconLayer.pop();
}

function drawCave(x, y) {
  iconLayer.push();
  iconLayer.strokeWeight(2);
  iconLayer.stroke(0);
  iconLayer.noFill();
  iconLayer.line(x - 6, y, x - 9, y);
  iconLayer.line(x + 6, y, x + 9, y);
  iconLayer.arc(x, y, 10, 10, PI, 0);
  iconLayer.pop();
}

function drawX(x, y) {
  iconLayer.push();
  iconLayer.strokeWeight(2);
  iconLayer.stroke(0);
  iconLayer.line(x - 3, y - 3, x + 3, y + 3);
  iconLayer.line(x - 3, y + 3, x + 3, y - 3);
  iconLayer.pop();
}

function drawWaypoint(x, y) {
  iconLayer.push();
  
  iconLayer.stroke(0);
  iconLayer.strokeWeight(2);
  iconLayer.fill(0);
  iconLayer.circle(x, y - 2, 2);
  iconLayer.noFill();
  
  iconLayer.arc(x, y - 2, 10, 10, PI, 0);
  iconLayer.line(x - 5, y - 2, x, y + 7);
  iconLayer.line(x + 5, y - 2, x, y + 7);
  iconLayer.pop();
}

function drawTreeOne(x, y) {
  iconLayer.push();
  iconLayer.strokeWeight(2);
  iconLayer.stroke(color("#4F2F1B"));
  iconLayer.strokeCap(ROUND);
  iconLayer.noFill();
  iconLayer.line(x, y - 10, x, y + 10);
  
  iconLayer.stroke("#1B4A12");
  iconLayer.line(x, y - 10, x - 4, y - 2);
  iconLayer.line(x, y - 5, x - 5, y + 3);
  iconLayer.line(x, y, x - 5, y + 8);
  
  iconLayer.line(x, y - 10, x + 4, y - 2);
  iconLayer.line(x, y - 5, x + 5, y + 3);
  iconLayer.line(x, y, x + 5, y + 8);
  iconLayer.pop();  
}

function drawTreeTwo(x, y) {
  iconLayer.push();
  iconLayer.strokeWeight(2);
  iconLayer.stroke(color("#4F2F1B"));
  iconLayer.noFill();
  iconLayer.line(x, y + 1, x, y + 10);
  
  iconLayer.stroke("#1B4A12");
  iconLayer.fill("#245B19");
  iconLayer.circle(x, y - 2, 10);
  
  iconLayer.pop();    
}


function drawHill(x, y) {
  iconLayer.push();
  iconLayer.strokeWeight(2);
  iconLayer.stroke(0);
  iconLayer.noFill();
  
  iconLayer.arc(x, y, 15, 13, PI, 0);
  
  iconLayer.pop();   
}

function drawMountain(x, y) {
  iconLayer.push();
  iconLayer.strokeWeight(2);
  iconLayer.stroke(0);
  iconLayer.noFill();
  
  let mSize = random(3, 8);
  let mSlope = random(5, 10);
  
  iconLayer.line(x, y - mSize, x - mSlope, y + mSize);
  iconLayer.line(x, y - mSize, x + mSlope, y + mSize);
  
  iconLayer.pop();   
}

// continuous tools
function drawRiverTool() {
  if (drawRiver &&
      touches.length > 0 &&
      !touchInRect(width - size - 10, bleed - 10, size - bleed + 20, 320 + 20)) {

    let tx = touches[0].x;
    let ty = touches[0].y;

    // we can only draw a line if prev touch exists
    if (prevTx !== null && prevTy !== null) {
      push();
      iconLayer.colorMode(RGB);
      iconLayer.stroke(40, 255, 255);

      currentWeight += growthRate;
      currentWeight = constrain(currentWeight, 1, maxWeight);
      iconLayer.strokeWeight(currentWeight);

      iconLayer.line(prevTx, prevTy, tx, ty);
      pop();
    }
  }
}

function drawRoadTool() {
  if (drawRoad &&
      touches.length > 0 &&
      !touchInRect(width - size - 10, bleed - 10, size - bleed + 20, 320 + 20)) {

    let tx = touches[0].x;
    let ty = touches[0].y;

    if (prevTx !== null && prevTy !== null) {
      iconLayer.stroke(0);
      iconLayer.strokeWeight(2);
      iconLayer.line(prevTx, prevTy, tx, ty);
    }
  }
}


// ----------------------------------------------------------------------------------------------
// Functions for drawing permanent icons on the base canvas layer
// (not the icon layer)
// ----------------------------------------------------------------------------------------------

function drawVillagePerm(x, y) {
  push();
  stroke(0);
  strokeWeight(3);
  circle(x, y, 3);
  pop();
}

function drawTownPerm(x, y) {
  push();
  fill(255);
  strokeWeight(1);
  stroke(0);
  circle(x, y, 10);
  
  strokeWeight(3);
  circle(x, y, 3);
  pop();
}

function drawCityPerm(x, y) {
  push();
  strokeWeight(2);
  stroke(color("#7F0B1D"));
  fill(255);

  beginShape();
  for (let i = 0; i < 5; i++) {
    const angle = TWO_PI * i / 5 + (-PI / 2);
    const px = x + cos(angle) * 7;
    const py = y + sin(angle) * 7;
    vertex(px, py);
  }
  endShape(CLOSE);
  pop();
}

function drawPortPerm(x, y) {
  push();
  strokeWeight(2);
  stroke(0);
  noFill();
  line(x, y - 2, x, y + 3);
  circle(x, y - 6, 4);
  arc(x, y, 10, 10, 0, PI);
  pop();
}

function drawCastlePerm(x, y) {
  push();
  strokeWeight(2);
  stroke(0);
  line(x - 3, y + 1, x - 5, y + 6);
  line(x - 5, y - 5, x - 3, y + 1);
  
  line(x - 5, y - 5, x - 4, y - 5);
  line(x - 4, y - 3, x - 4, y - 5);
  line(x - 4, y - 3, x - 0.5, y - 3);
  
  line(x - 0.5, y - 3, x - 0.5, y - 5);
  line(x - 0.5, y - 5, x + 0.5, y - 5);
  line(x + 0.5, y - 3, x + 0.5, y - 5);
  
  line(x + 0.5, y - 3, x + 4, y - 3);
  line(x + 4, y - 3, x + 4, y - 5);
  line(x + 5, y - 5, x + 4, y - 5);
  
  line(x + 5, y - 5, x + 3, y + 1);
  line(x + 3, y + 1, x + 5, y + 6);
  pop();
}

function drawCavePerm(x, y) {
  push();
  strokeWeight(2);
  stroke(0);
  noFill();
  line(x - 6, y, x - 9, y);
  line(x + 6, y, x + 9, y);
  arc(x, y, 10, 10, PI, 0);
  pop();
}

function drawXPerm(x, y) {
  push();
  strokeWeight(2);
  stroke(0);
  line(x - 3, y - 3, x + 3, y + 3);
  line(x - 3, y + 3, x + 3, y - 3);
  pop();
}

function drawWaypointPerm(x, y) {
  push();
  
  stroke(0);
  strokeWeight(2);
  fill(0);
  circle(x, y - 2, 2);
  noFill();
  
  arc(x, y - 2, 10, 10, PI, 0);
  line(x - 5, y - 2, x, y + 7);
  line(x + 5, y - 2, x, y + 7);
  pop();
}

function drawTreeOnePerm(x, y) {
  push();
  strokeWeight(2);
  stroke(color("#4F2F1B"));
  strokeCap(ROUND);
  noFill();
  line(x, y - 10, x, y + 10);
  
  stroke("#1B4A12");
  line(x, y - 10, x - 4, y - 2);
  line(x, y - 5, x - 5, y + 3);
  line(x, y, x - 5, y + 8);
  
  line(x, y - 10, x + 4, y - 2);
  line(x, y - 5, x + 5, y + 3);
  line(x, y, x + 5, y + 8);
  pop();  
}

function drawTreeTwoPerm(x, y) {
  push();
  strokeWeight(2);
  stroke(color("#4F2F1B"));
  noFill();
  line(x, y + 1, x, y + 10);
  

  stroke("#1B4A12");
  fill("#245B19");
  circle(x, y - 2, 10); 
  pop();    
}

function drawHillPerm(x, y) {
  push();
  strokeWeight(2);
  stroke(0);
  noFill();
  
  arc(x, y, 15, 13, PI, 0);
  
  pop();   
}

function drawMountainPerm(x, y) {
  push();
  strokeWeight(2);
  stroke(0);
  noFill();
  
  let mSize = 5;
  let mSlope = 6;
  
  line(x, y - mSize, x - mSlope, y + mSize);
  line(x, y - mSize, x + mSlope, y + mSize);
  
  pop();   
}

// ----------------------------------------------------------------------------------------------
// Eraser tool
// ----------------------------------------------------------------------------------------------

function useEraser() {
  if (touches.length === 0) return; // safety check

  let tx = touches[0].x;
  let ty = touches[0].y;

  iconLayer.push();
  iconLayer.erase();
  iconLayer.noStroke();
  iconLayer.circle(tx, ty, eraserSlider.value());
  iconLayer.noErase();
  iconLayer.pop();
}

// ----------------------------------------------------------------------------------------------
// Draw the map key with text and permanent icons
// ----------------------------------------------------------------------------------------------

function createMapKey() {
  rectMode(CORNER);
  stroke(0);
  fill(255);
  strokeWeight(2);
  rect(width - size, bleed, size - bleed, 320);
  
  fill(0);
  noStroke();
  textSize(27);
  
  textAlign(CENTER);
  text("Map Key", width - size / 2, bleed * 5);
  
  textAlign(LEFT);
  textSize(20);
  text("Infrastructure", offset, bleed * 8);
  
  textSize(16);
  text("Village", offset + 10, bleed * 11);
  drawVillagePerm(offset + 100, bleed * 10.5);
  
  text("Town", offset + 10, bleed * 13.5);
  drawTownPerm(offset + 100, bleed * 13);
  
  text("City", offset + 10, bleed * 16);
  drawCityPerm(offset + 100, bleed * 15.5);
  
  text("Port", offset + 10, bleed * 18.5);
  drawPortPerm(offset + 100, bleed * 18);
  
  text("Castle", rOffset, bleed * 11);
  drawCastlePerm(rOffset + 110, bleed * 10.5);
  
  text("Landmark", rOffset, bleed * 13.5);
  drawXPerm(rOffset + 110, bleed * 13);
  
  text("Waypoint", rOffset, bleed * 16);
  drawWaypointPerm(rOffset + 110, bleed * 15.5);
  
  text("Road", rOffset, bleed * 18.5);
  stroke(0);
  line(rOffset + 105, bleed * 18, rOffset + 115, bleed * 18);
  noStroke();
  
  textSize(20);
  text("Nature", offset, bleed * 23);
  
  textSize(16);
  text("Tree (1)", offset + 10, bleed * 26);
  drawTreeOnePerm(offset + 100, bleed * 25.5);
  
  text("Tree (2)", rOffset, bleed * 26);
  drawTreeTwoPerm(rOffset + 110, bleed * 25.35);
  
  text("Hill", offset + 10, bleed * 28.5);
  drawHillPerm(offset + 100, bleed * 28.2);
  
  text("Mountain", rOffset, bleed * 28.5);
  drawMountainPerm(rOffset + 110, bleed * 28);
  
  text("Cave", offset + 10, bleed * 31);
  drawCavePerm(offset + 100, bleed * 30.5);
  
  text("River", rOffset, bleed * 31);
  push();
  colorMode(HSB);
  stroke(200, 100, 70);
  line(rOffset + 105, bleed * 30.5, rOffset + 115, bleed * 30.5);
  pop();
}

// ----------------------------------------------------------------------------------------------
// Draw the controls
// ----------------------------------------------------------------------------------------------

function createControls() {
  textAlign(CENTER);
  textSize(27);
  text("Controls", offset + 140, height - bleed * 33);
  
  textSize(20);
  text("Raise landmass", offset + 140, height - bleed * 29.5);
  text("Lower landmass", offset + 140, height - bleed * 26.5);
  text("Add and edit labels", offset + 140, height - bleed * 23.5);
  text("Add and edit title", offset + 140, height - bleed * 20.5);
  text("Eraser (Icons)", offset + 140, height - bleed * 17.5);
  
  textSize(20);
  textAlign(LEFT);
  text("Brush Size", offset, height - bleed * 13.8);
  text("Sensitivity", rOffset, height - bleed * 13.8);
  text("Eraser Size", offset, height - bleed * 6.8);
  
  push();
  colorMode(RGB);
  fill(220);
  
  rect(rOffset + 29.5, height - bleed * 9.3, 70, bleed * 5.9);
  
  colorMode(HSB);
  fill(0);
  noStroke();
  
  text("Save", rOffset + 40, height - bleed * 7);
  text("Map", rOffset + 41.5, height - bleed * 4.5);
  
  textSize(13);
  text("(Double tap)", rOffset + 17.5, height - bleed * 1.5);
  pop();
}

// ----------------------------------------------------------------------------------------------
// Labels and Title functionality
// ----------------------------------------------------------------------------------------------

// draw the labels on the map
function drawLabel(x, y) {
    if (input.elt.offsetParent !== null) {  // means input is shown
    const r = input.elt.getBoundingClientRect();
    if (x >= r.left && x <= r.right &&
        y >= r.top  && y <= r.bottom) {
      return;  // ignore click inside the input box
    }
  }

  let clickedIndex = getClickedTextIndex(x, y);

  if (clickedIndex >= 0) {
    // edit existing text
    editingIndex = clickedIndex;
    let t = texts[clickedIndex];

    inputX = t.x;
    inputY = t.y;

    input.value(t.text);
    input.position(inputX, inputY - 16);
    input.show();
    input.elt.focus();

  } else {
    // new text
    editingIndex = -1;

    // store desired p5 coords
    inputX = x; 
    inputY = y;

    input.value('');
    input.position(inputX, inputY - 16);
    input.show();
    input.elt.focus();
  }
}

// insert user input into the label field and the new text into an array
function commitText() {
  let val = input.value().trim();

  if (editingIndex >= 0) {

    if (val === '') {
      texts.splice(editingIndex, 1);
    } else {
      texts[editingIndex].text = val;
      texts[editingIndex].x = inputX;
      texts[editingIndex].y = inputY;
    }

  } else {

    if (val !== '') {
      texts.push({ x: inputX, y: inputY, text: val });
    }
  }

  input.hide();
  editingIndex = -1;
}

// make sure the correct pre-existing label is clicked to be edited
function getClickedTextIndex(mx, my) {
  for (let i = texts.length - 1; i >= 0; i--) {
    let t = texts[i];
    let w = textWidth(t.text);
    let h = 16;
    if (mx >= t.x && mx <= t.x + w &&
        my >= t.y - h && my <= t.y) {
      return i;
    }
  }
  return -1;
}

// draw the map title on set coordinates
function drawMapTitle() {
  if (mapTitle === "") return;

  push();
  textAlign(CENTER, CENTER);
  textSize(48);            // big title
  fill(0);
  noStroke();
  text(mapTitle, (width - size - 2 * bleed) / 2, titleHeight);
  pop();
}

// enter edit title mode if it's clicked on again
function startTitleEditing() {
  editingTitle = true;

  titleInput.value(mapTitle);
  titleInput.show();

  // place the input *below* the title
  let w = 300;
  let h = 24;

  titleInput.size(w, h);

  titleInput.position(
    (width - size - 2 * bleed) / 2 - w/2,   // center horizontally
    titleHeight + 40                        // just below the title 
  );

  titleInput.elt.select(); // focus
}

// end edit mode for the title
function finishTitleEditing() {
  editingTitle = false;
  titleInput.hide();
}


// ----------------------------------------------------------------------------------------------
// Terrain painting functionality
// ----------------------------------------------------------------------------------------------

// create the brush with a falloff for the values to differentiate terrains
function paintTerrain(cx, cy) {
  cx = floor(cx);
  cy = floor(cy);

  radius = brushSlider.value();
  sensitivity = sensitivitySlider.value() * 0.005;

  const r = radius;
  const r2 = r * r;
  const pi = PI;
  const W = width, H = height;

  for (let j = -r; j <= r; j++) {
    const y = cy + j;
    if (y < 0 || y >= H) continue;

    for (let i = -r; i <= r; i++) {
      const x = cx + i;
      if (x < 0 || x >= W) continue;

      const dist2 = i*i + j*j;
      if (dist2 > r2) continue;

      const dist = sqrt(dist2);
      const falloff = (cos((dist / r) * pi) + 1) * 0.5;
      const delta = sensitivity * falloff * (mode === "raise" ? 1 : -1);

      heightmap[y][x] = constrain(heightmap[y][x] + delta, 0.0, 1.0);
    }
  }
}


// update the heightMap by mapping terrain colors
function updateTerrainRegion(cx, cy) {
  cx = floor(cx);
  cy = floor(cy);
  
  const r = brushSlider.value();
  const r2 = r * r;
  const W = width, H = height;

  terrainLayer.loadPixels();
  const pix = terrainLayer.pixels;

  const xMin = max(0, cx - r);
  const xMax = min(W - 1, cx + r);
  const yMin = max(0, cy - r);
  const yMax = min(H - 1, cy + r);

  for (let y = yMin; y <= yMax; y++) {
    const hmRow = heightmap[y];   // cache heightmap hmRow
    for (let x = xMin; x <= xMax; x++) {

      const dx = x - cx;
      const dy = y - cy;
      if (dx*dx + dy*dy > r2) continue;

      const h = hmRow[x];         // hmRow lookup is faster than heightmap[y][x]
      const t = getTerrainForHeight(h);
      const rgb = getLerpedTerrainRGB(t, h);

      const idx = 4 * (y * W + x);
      pix[idx] = rgb[0];
      pix[idx+1] = rgb[1];
      pix[idx+2] = rgb[2];
      pix[idx+3] = 255;
    }
  }

  terrainLayer.updatePixels();
}


// ----------------------------------------------------------------------------------------------
// Terrain Selection + Color Interp
// ----------------------------------------------------------------------------------------------

function getTerrainForHeight(h) {
  if (h < 0.5) return waterTerrain;
  if (h < 0.65) return sandTerrain;
  if (h < 0.9) return grassTerrain;
  return treesTerrain;
}

function getLerpedTerrainRGB(t, h) {
  const minH = t.minHeight;
  const maxH = t.maxHeight;

  let f = (h - minH) / (maxH - minH);
  f = constrain(f + t.lerpAdjustment * f * (1 - f), 0, 1);

  const minRGB = t.minRGB;   // cache arrays
  const maxRGB = t.maxRGB;

  return [
    minRGB[0] + (maxRGB[0] - minRGB[0]) * f,
    minRGB[1] + (maxRGB[1] - minRGB[1]) * f,
    minRGB[2] + (maxRGB[2] - minRGB[2]) * f
  ];
}

// -----------------------------------------------
// Brush preview
// -----------------------------------------------

function drawBrushPreview(slider, inc) {
  if (!touchInside()) return;

  let tx = touches[0].x;
  let ty = touches[0].y;

  noFill();
  stroke(255, 200);
  strokeWeight(2);
  circle(tx, ty, slider.value() * inc);
}

function touchInside() {
  if (touches.length === 0) return false;

  let tx = touches[0].x;
  let ty = touches[0].y;

  return tx >= 0 && tx < width && ty >= 0 && ty < height;
}


// ----------------------------------------------------------------------------------------------
// Save canvas
// ----------------------------------------------------------------------------------------------

// double click on the save rectangle to save the canvas
/*
function doubleClicked() {
  if (touchInRect(169.5 + offset, 9.3 * bleed, 70, 59, false)) {
    saveCanvasWithLayers();
    // rect(169.5 + offset, 58.2 * bleed, 70, 59);
  }
}
*/

// combine terrain, icons, labels, and map key for the canvas and save it
// (controls and sliders will not be drawn)
function saveCanvasWithLayers() {
  // redraw layers onto the main canvas before saving
  image(terrainLayer, 0, 0);
  image(iconLayer, 0, 0);
  
  // draw all current labels
  noStroke();
  for (let t of texts) {
    push();
    textAlign(CENTER, CENTER);
    text(t.text, t.x, t.y);
    pop();
  }
  
  // draw title if applicable, and the map key
  drawMapTitle();
  createMapKey();
  
  let region = get(0, 0, width, height);
  save(region, "myMap.png");
}
