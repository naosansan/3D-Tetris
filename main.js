import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- UI Elements ---
const scoreElement = document.getElementById('score');
const linesElement = document.getElementById('lines');
const nextBlockContainer = document.getElementById('next-block-container');
const modalOverlay = document.getElementById('modal-overlay');
const startModal = document.getElementById('start-modal');
const gameoverModal = document.getElementById('gameover-modal');
const finalScoreElement = document.getElementById('final-score');
const startButton = document.getElementById('start-button');
const restartButton = document.getElementById('restart-button');

// --- Scene setup ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// --- Lighting ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 20, 5);
scene.add(directionalLight);

// --- Camera and Controls ---
camera.position.set(8, 22, 14);
const controls = new OrbitControls(camera, renderer.domElement);
const FIELD_HEIGHT = 20;
controls.target.set(0, FIELD_HEIGHT / 2, 0);

// --- Game Field ---
const FIELD_WIDTH = 6;
const FIELD_DEPTH = 6;
const gridHelper = new THREE.GridHelper(FIELD_WIDTH, FIELD_WIDTH);
scene.add(gridHelper);
const boxGeom = new THREE.BoxGeometry(FIELD_WIDTH, FIELD_HEIGHT, FIELD_DEPTH);
const edgesGeom = new THREE.EdgesGeometry(boxGeom);
const lineMat = new THREE.LineBasicMaterial({ color: 0x888888 });
const fieldBox = new THREE.LineSegments(edgesGeom, lineMat);
fieldBox.position.set(0, FIELD_HEIGHT / 2, 0);
scene.add(fieldBox);

// --- Blocks Definition ---
const BLOCKS = {
    'I': { shape: [[0,0,0], [-1,0,0], [1,0,0], [2,0,0]], color: 0x00ffff },
    'L': { shape: [[0,0,0], [-1,0,0], [1,0,0], [1,-1,0]], color: 0xffa500 },
    'J': { shape: [[0,0,0], [-1,0,0], [1,0,0], [-1,-1,0]], color: 0x0000ff },
    'T': { shape: [[0,0,0], [-1,0,0], [1,0,0], [0,-1,0]], color: 0x800080 },
    'S': { shape: [[0,0,0], [-1,0,0], [0,-1,0], [1,-1,0]], color: 0x00ff00 },
    'Z': { shape: [[0,0,0], [1,0,0], [0,-1,0], [-1,-1,0]], color: 0xff0000 },
    'O': { shape: [[0,0,0], [1,0,0], [0,-1,0], [1,-1,0]], color: 0xffff00 }
};
const BLOCK_TYPES = Object.keys(BLOCKS);
const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });

// --- Game State ---
let gameState = 'start'; // 'start', 'playing', 'gameover'
let currentBlock = null;
let ghostBlock = null; // New variable for the ghost piece
let nextBlockType = null;
const placedCubes = new THREE.Group();
scene.add(placedCubes);
let score = 0;
let lines = 0;

function createBlock(type, isGhost = false) {
    const blockData = BLOCKS[type];
    const block = new THREE.Group();
    let material;
    if (isGhost) {
        material = new THREE.MeshStandardMaterial({ color: blockData.color, transparent: true, opacity: 0.2 }); // Semi-transparent
    } else {
        material = new THREE.MeshStandardMaterial({ color: blockData.color, transparent: true, opacity: 0.9 });
    }

    blockData.shape.forEach(pos => {
        const cube = new THREE.Mesh(cubeGeometry, material);
        const edges = new THREE.EdgesGeometry(cube.geometry);
        const line = new THREE.LineSegments(edges, edgeMaterial);
        cube.add(line);
        cube.position.set(pos[0], pos[1], pos[2]);
        block.add(cube);
    });
    block.userData.type = type;
    return block;
}

// --- Next Block Preview ---
const nextScene = new THREE.Scene();
const nextCamera = new THREE.PerspectiveCamera(75, nextBlockContainer.clientWidth / nextBlockContainer.clientHeight, 0.1, 1000);
nextCamera.position.set(2, 2, 3);
nextCamera.lookAt(0, 0, 0);
const nextRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
nextRenderer.setSize(nextBlockContainer.clientWidth, nextBlockContainer.clientHeight);
nextBlockContainer.appendChild(nextRenderer.domElement);
nextScene.add(new THREE.AmbientLight(0xffffff, 1.0));
let nextBlock = null;

function updateNextBlockView() {
    if (nextBlock) nextScene.remove(nextBlock);
    nextBlock = createBlock(nextBlockType);
    nextScene.add(nextBlock);
}

function spawnNewBlock() {
    if (gameState !== 'playing') return;
    currentBlock = createBlock(nextBlockType);
    currentBlock.position.set(0.5, FIELD_HEIGHT - 1.5, 0.5);
    scene.add(currentBlock);

    // Create ghost block
    if (ghostBlock) scene.remove(ghostBlock); // Remove previous ghost if any
    ghostBlock = createBlock(nextBlockType, true); // Create as ghost
    scene.add(ghostBlock);

    nextBlockType = BLOCK_TYPES[Math.floor(Math.random() * BLOCK_TYPES.length)];
    updateNextBlockView();
    updateGhostBlockPosition(); // Update ghost position immediately after spawning
}

// --- Axis Indicator ---
const axisGroup = new THREE.Group();
scene.add(axisGroup);

// Helper function to create a text sprite
CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
};

function makeTextSprite(message, parameters) {
    if (parameters === undefined) parameters = {};
    const fontface = parameters.hasOwnProperty("fontface") ? parameters["fontface"] : "Arial";
    const fontsize = parameters.hasOwnProperty("fontsize") ? parameters["fontsize"] : 40;
    const borderThickness = parameters.hasOwnProperty("borderThickness") ? parameters["borderThickness"] : 4;
    const borderColor = parameters.hasOwnProperty("borderColor") ? parameters["borderColor"] : { r: 0, g: 0, b: 0, a: 1.0 };
    const backgroundColor = parameters.hasOwnProperty("backgroundColor") ? parameters["backgroundColor"] : { r: 0, g: 0, b: 0, a: 1.0 };
    const textColor = parameters.hasOwnProperty("textColor") ? parameters["textColor"] : { r: 255, g: 255, b: 255, a: 1.0 };

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = "Bold " + fontsize + "px " + fontface;
    const metrics = context.measureText(message);
    const textWidth = metrics.width;

    canvas.width = textWidth + borderThickness * 2;
    canvas.height = fontsize + borderThickness * 2;

    context.font = "Bold " + fontsize + "px " + fontface;
    context.textAlign = "center";
    context.textBaseline = "middle";

    context.fillStyle = "rgba(" + backgroundColor.r + "," + backgroundColor.g + "," + backgroundColor.b + "," + backgroundColor.a + ")";
    context.strokeStyle = "rgba(" + borderColor.r + "," + borderColor.g + "," + borderColor.b + "," + borderColor.a + ")";

    context.lineWidth = borderThickness;
    context.roundRect(0, 0, canvas.width, canvas.height, 6);
    context.fill();
    context.stroke();

    context.fillStyle = "rgba(" + textColor.r + ", " + textColor.g + ", " + textColor.b + ", 1.0)";
    context.fillText(message, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(canvas.width * 0.03, canvas.height * 0.03, 1); 
    return sprite;
}

// +X (Right) Arrow and Text
const plusXArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(FIELD_WIDTH / 2 - 1, 0.1, 0), 1, 0xff0000);
const plusXText = makeTextSprite("+X (→)");
plusXText.position.set(FIELD_WIDTH / 2 + 0.5, 0.1, 0);
axisGroup.add(plusXArrow);
axisGroup.add(plusXText);

// -X (Left) Arrow and Text
const minusXArrow = new THREE.ArrowHelper(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(-FIELD_WIDTH / 2 + 1, 0.1, 0), 1, 0xff0000);
const minusXText = makeTextSprite("-X (←)");
minusXText.position.set(-FIELD_WIDTH / 2 - 0.5, 0.1, 0);
axisGroup.add(minusXArrow);
axisGroup.add(minusXText);

// +Z (Backward/Arrow Down) Arrow and Text
const plusZArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0.1, FIELD_DEPTH / 2 - 1), 1, 0x0000ff);
const plusZText = makeTextSprite("+Z (↓)");
plusZText.position.set(0, 0.1, FIELD_DEPTH / 2 + 0.5);
axisGroup.add(plusZArrow);
axisGroup.add(plusZText);

// -Z (Forward/Arrow Up) Arrow and Text
const minusZArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0.1, -FIELD_DEPTH / 2 + 1), 1, 0x0000ff);
const minusZText = makeTextSprite("-Z (↑)");
minusZText.position.set(0, 0.1, -FIELD_DEPTH / 2 - 0.5);
axisGroup.add(minusZArrow);
axisGroup.add(minusZText);

// --- Game Logic ---
const clock = new THREE.Clock();
let fallAccumulator = 0;
let isSoftDropping = false;

function updateUI() {
    scoreElement.textContent = score;
    linesElement.textContent = lines;
}

// Helper to get grid coordinates from world position
function getGridCoords(worldPos) {
    return new THREE.Vector3(
        Math.round(worldPos.x - 0.5),
        Math.round(worldPos.y - 0.5),
        Math.round(worldPos.z - 0.5)
    );
}

function isValidPosition(block, testPosition) {
    // Temporarily apply the test position to the block for world position calculation
    const originalPosition = block.position.clone();
    block.position.copy(testPosition);

    let valid = true;
    for (const cube of block.children) {
        const worldPos = cube.getWorldPosition(new THREE.Vector3());
        const gridCoords = getGridCoords(worldPos);

        // Wall collision
        if (gridCoords.x < -FIELD_WIDTH / 2 || gridCoords.x >= FIELD_WIDTH / 2) { valid = false; break; }
        if (gridCoords.z < -FIELD_DEPTH / 2 || gridCoords.z >= FIELD_DEPTH / 2) { valid = false; break; }
        // Floor collision
        if (gridCoords.y < 0) { valid = false; break; }
        // Ceiling collision (for game over check, though handled in lockBlock)
        // if (gridCoords.y >= FIELD_HEIGHT) { valid = false; break; }

        // Placed cubes collision
        for (const placed of placedCubes.children) {
            const placedGridCoords = getGridCoords(placed.position);
            if (gridCoords.equals(placedGridCoords)) {
                valid = false;
                break;
            }
        }
        if (!valid) break;
    }

    // Revert block's position
    block.position.copy(originalPosition);
    return valid;
}

function updateGhostBlockPosition() {
    if (!currentBlock || !ghostBlock) return;

    // Copy current block's rotation and initial position
    ghostBlock.rotation.copy(currentBlock.rotation);
    ghostBlock.position.copy(currentBlock.position);

    // Find the lowest valid position for the ghost block
    let testPosition = ghostBlock.position.clone();
    let foundPosition = false;
    while (testPosition.y >= 0) { // Check down to the floor
        testPosition.y -= 1;
        if (!isValidPosition(currentBlock, testPosition)) { // Use currentBlock's shape with testPosition
            ghostBlock.position.copy(testPosition).add(new THREE.Vector3(0, 1, 0)); // Move back up one step
            foundPosition = true;
            break;
        }
    }
    if (!foundPosition) { // Fallback if it somehow goes through the floor
        ghostBlock.position.copy(testPosition).add(new THREE.Vector3(0, 1, 0));
    }
}

function checkAndClearLayers() {
    const CUBES_PER_LAYER = FIELD_WIDTH * FIELD_DEPTH;
    let layersCleared = 0;
    for (let y = 0; y < FIELD_HEIGHT; y++) {
        const cubesInLayer = placedCubes.children.filter(c => getGridCoords(c.position).y === y);
        if (cubesInLayer.length === CUBES_PER_LAYER) {
            layersCleared++;
            // Remove the cubes of the cleared layer
            cubesInLayer.forEach(c => placedCubes.remove(c));

            // Move down all cubes above the cleared layer
            placedCubes.children.forEach(c => {
                if (getGridCoords(c.position).y > y) {
                    c.position.y -= 1;
                }
            });
            // Decrement y to re-check the current layer index, as new cubes have moved into it
            y--; 
        }
    }
    if (layersCleared > 0) {
        score += (layersCleared * 500) - 400; 
        lines += layersCleared;
        updateUI();
    }
}

function lockBlock() {
    const cubesToMove = [];
    let isGameOver = false;
    currentBlock.children.forEach(cube => {
        const newCube = cube.clone();
        cube.getWorldPosition(newCube.position);
        newCube.position.copy(getGridCoords(newCube.position).add(new THREE.Vector3(0.5, 0.5, 0.5))); // Snap to grid center
        
        if (getGridCoords(newCube.position).y >= FIELD_HEIGHT - 1) { // Check if block is too high
            isGameOver = true;
        }
        cubesToMove.push(newCube);
    });
    scene.remove(currentBlock);
    currentBlock = null;

    if (ghostBlock) { // Remove ghost block when current block locks
        scene.remove(ghostBlock);
        ghostBlock = null;
    }

    cubesToMove.forEach(cube => placedCubes.add(cube));
    
    if (isGameOver) {
        gameOver();
        return;
    }

    score += 10;
    updateUI();
    checkAndClearLayers();
    spawnNewBlock();
}

function gameOver() {
    gameState = 'gameover';
    finalScoreElement.textContent = score;
    modalOverlay.style.display = 'flex';
    gameoverModal.style.display = 'block';
    startModal.style.display = 'none';
    controls.enabled = false;
}

function resetGame() {
    score = 0;
    lines = 0;
    updateUI();
    while(placedCubes.children.length > 0) placedCubes.remove(placedCubes.children[0]);
    if (currentBlock) scene.remove(currentBlock);
    currentBlock = null;
    if (ghostBlock) scene.remove(ghostBlock); // Remove ghost block on reset
    ghostBlock = null;
}

function startGame() {
    gameState = 'playing';
    resetGame();
    modalOverlay.style.display = 'none';
    controls.enabled = true;
    nextBlockType = BLOCK_TYPES[Math.floor(Math.random() * BLOCK_TYPES.length)];
    spawnNewBlock();
    updateGhostBlockPosition(); // Initial ghost position
}

// --- Event Listeners ---
startButton.addEventListener('click', startGame);
restartButton.addEventListener('click', startGame);

document.addEventListener('keydown', (event) => {
    if (gameState !== 'playing' || !currentBlock) return;

    let moved = false; // Flag to check if block moved/rotated
    switch (event.key) {
        case 'ArrowLeft':
            currentBlock.position.x -= 1;
            if (!isValidPosition(currentBlock, currentBlock.position)) currentBlock.position.x += 1;
            else moved = true;
            break;
        case 'ArrowRight':
            currentBlock.position.x += 1;
            if (!isValidPosition(currentBlock, currentBlock.position)) currentBlock.position.x -= 1;
            else moved = true;
            break;
        case 'ArrowUp':
            currentBlock.position.z -= 1;
            if (!isValidPosition(currentBlock, currentBlock.position)) currentBlock.position.z += 1;
            else moved = true;
            break;
        case 'ArrowDown':
            currentBlock.position.z += 1;
            if (!isValidPosition(currentBlock, currentBlock.position)) currentBlock.position.z -= 1;
            else moved = true;
            break;
        case 'a':
            currentBlock.rotateY(Math.PI / 2);
            if (!isValidPosition(currentBlock, currentBlock.position)) currentBlock.rotateY(-Math.PI / 2);
            else moved = true;
            break;
        case 's':
            currentBlock.rotateY(-Math.PI / 2);
            if (!isValidPosition(currentBlock, currentBlock.position)) currentBlock.rotateY(Math.PI / 2);
            else moved = true;
            break;
        case 'w':
            currentBlock.rotateX(Math.PI / 2);
            if (!isValidPosition(currentBlock, currentBlock.position)) currentBlock.rotateX(-Math.PI / 2);
            else moved = true;
            break;
        case 'q':
            currentBlock.rotateX(-Math.PI / 2);
            if (!isValidPosition(currentBlock, currentBlock.position)) currentBlock.rotateX(Math.PI / 2);
            else moved = true;
            break;
        case 'x':
            currentBlock.rotateZ(Math.PI / 2);
            if (!isValidPosition(currentBlock, currentBlock.position)) currentBlock.rotateZ(-Math.PI / 2);
            else moved = true;
            break;
        case 'z':
            currentBlock.rotateZ(-Math.PI / 2);
            if (!isValidPosition(currentBlock, currentBlock.position)) currentBlock.rotateZ(Math.PI / 2);
            else moved = true;
            break;
        case ' ': // Space
            isSoftDropping = true;
            break;
    }
    if (moved) {
        updateGhostBlockPosition();
    }
});

document.addEventListener('keyup', (event) => {
    if (event.key === ' ') { // Space
        isSoftDropping = false;
    }
});

// --- Main Loop ---
function animate() {
    requestAnimationFrame(animate);

    if (gameState === 'playing') {
        const deltaTime = clock.getDelta();
        fallAccumulator += deltaTime;
        const fallInterval = isSoftDropping ? 0.05 : 1.0;

        if (currentBlock && fallAccumulator >= fallInterval) {
            fallAccumulator = 0;
            // Test if moving down is valid
            const testPosition = currentBlock.position.clone();
            testPosition.y -= 1;
            if (isValidPosition(currentBlock, testPosition)) {
                currentBlock.position.y -= 1;
                updateGhostBlockPosition(); // Update ghost after current block moves
            } else {
                lockBlock();
            }
        }
    }

    controls.update();
    renderer.render(scene, camera);
    nextRenderer.render(nextScene, nextCamera);
    if (nextBlock) nextBlock.rotation.y += 0.01;
}
animate();

// --- Window Resize ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    nextCamera.aspect = nextBlockContainer.clientWidth / nextBlockContainer.clientHeight;
    nextCamera.updateProjectionMatrix();
    nextRenderer.setSize(nextBlockContainer.clientWidth, nextBlockContainer.clientHeight);
});

