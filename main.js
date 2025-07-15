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
let nextBlockType = null;
const placedCubes = new THREE.Group();
scene.add(placedCubes);
let score = 0;
let lines = 0;

function createBlock(type) {
    const blockData = BLOCKS[type];
    const block = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color: blockData.color, transparent: true, opacity: 0.9 });
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
    nextBlockType = BLOCK_TYPES[Math.floor(Math.random() * BLOCK_TYPES.length)];
    updateNextBlockView();
}

// --- Axis Indicator ---
const axisGroup = new THREE.Group();
const arrowLength = FIELD_WIDTH / 2 + 1;
const xAxisArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(-arrowLength / 2, 0.1, 0), arrowLength, 0xff0000);
const zAxisArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0.1, -arrowLength / 2), arrowLength, 0x0000ff);
axisGroup.add(xAxisArrow);
axisGroup.add(zAxisArrow);
scene.add(axisGroup);

// --- Game Logic ---
const clock = new THREE.Clock();
let fallAccumulator = 0;
let isSoftDropping = false;

function updateUI() {
    scoreElement.textContent = score;
    linesElement.textContent = lines;
}

function isValidPosition(block) {
    for (const cube of block.children) {
        const worldPos = cube.getWorldPosition(new THREE.Vector3());
        if (worldPos.x < -FIELD_WIDTH / 2 + 0.4 || worldPos.x > FIELD_WIDTH / 2 - 0.4) return false;
        if (worldPos.z < -FIELD_DEPTH / 2 + 0.4 || worldPos.z > FIELD_DEPTH / 2 - 0.4) return false;
        if (worldPos.y < 0.4) return false;
        for (const placed of placedCubes.children) {
            if (worldPos.distanceTo(placed.position) < 0.5) return false;
        }
    }
    return true;
}

function checkAndClearLayers() {
    const CUBES_PER_LAYER = FIELD_WIDTH * FIELD_DEPTH;
    let layersCleared = 0;
    for (let y = 0; y < FIELD_HEIGHT; y++) {
        const cubesInLayer = placedCubes.children.filter(c => Math.round(c.position.y - 0.5) === y);
        if (cubesInLayer.length === CUBES_PER_LAYER) {
            layersCleared++;
            cubesInLayer.forEach(c => placedCubes.remove(c));
            placedCubes.children.forEach(c => { if (c.position.y > y) c.position.y -= 1; });
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
        newCube.position.x = Math.round(newCube.position.x - 0.5) + 0.5;
        newCube.position.y = Math.round(newCube.position.y - 0.5) + 0.5;
        newCube.position.z = Math.round(newCube.position.z - 0.5) + 0.5;
        if (newCube.position.y >= FIELD_HEIGHT - 0.5) {
            isGameOver = true;
        }
        cubesToMove.push(newCube);
    });
    scene.remove(currentBlock);
    currentBlock = null;
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
}

function startGame() {
    gameState = 'playing';
    resetGame();
    modalOverlay.style.display = 'none';
    controls.enabled = true;
    nextBlockType = BLOCK_TYPES[Math.floor(Math.random() * BLOCK_TYPES.length)];
    spawnNewBlock();
}

// --- Event Listeners ---
startButton.addEventListener('click', startGame);
restartButton.addEventListener('click', startGame);

document.addEventListener('keydown', (event) => {
    if (gameState !== 'playing' || !currentBlock) return;
    switch (event.key) {
        case 'ArrowLeft': currentBlock.position.x -= 1; if (!isValidPosition(currentBlock)) currentBlock.position.x += 1; break;
        case 'ArrowRight': currentBlock.position.x += 1; if (!isValidPosition(currentBlock)) currentBlock.position.x -= 1; break;
        case 'ArrowUp': currentBlock.position.z -= 1; if (!isValidPosition(currentBlock)) currentBlock.position.z += 1; break;
        case 'ArrowDown': currentBlock.position.z += 1; if (!isValidPosition(currentBlock)) currentBlock.position.z -= 1; break;
        case 'a': currentBlock.rotateY(Math.PI / 2); if (!isValidPosition(currentBlock)) currentBlock.rotateY(-Math.PI / 2); break;
        case 's': currentBlock.rotateY(-Math.PI / 2); if (!isValidPosition(currentBlock)) currentBlock.rotateY(Math.PI / 2); break;
        case 'w': currentBlock.rotateX(Math.PI / 2); if (!isValidPosition(currentBlock)) currentBlock.rotateX(-Math.PI / 2); break;
        case 'q': currentBlock.rotateX(-Math.PI / 2); if (!isValidPosition(currentBlock)) currentBlock.rotateX(Math.PI / 2); break;
        case 'x': currentBlock.rotateZ(Math.PI / 2); if (!isValidPosition(currentBlock)) currentBlock.rotateZ(-Math.PI / 2); break;
        case 'z': currentBlock.rotateZ(-Math.PI / 2); if (!isValidPosition(currentBlock)) currentBlock.rotateZ(Math.PI / 2); break;
        case ' ': isSoftDropping = true; break;
    }
});
document.addEventListener('keyup', (event) => { if (event.key === ' ') isSoftDropping = false; });

// --- Main Loop ---
function animate() {
    requestAnimationFrame(animate);

    if (gameState === 'playing') {
        const deltaTime = clock.getDelta();
        fallAccumulator += deltaTime;
        const fallInterval = isSoftDropping ? 0.05 : 1.0;

        if (currentBlock && fallAccumulator >= fallInterval) {
            fallAccumulator = 0;
            currentBlock.position.y -= 1;
            if (!isValidPosition(currentBlock)) {
                currentBlock.position.y += 1;
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
