/**
 * Module de visualisation 3D optimisé pour les modèles IFC
 */

// Cache pour stocker les scènes 3D
const sceneCache = new Map();

/**
 * Initialise une scène Three.js pour la visualisation 3D
 * @param {HTMLCanvasElement} canvas - L'élément canvas pour le rendu
 * @returns {Object} - Les objets Three.js initialisés
 */
export function initScene(canvas) {
  // Initialiser Three.js pour la visualisation
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f0f0);
  
  // Configurer la caméra
  const camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
  camera.position.z = 20;
  camera.position.y = 10;
  camera.position.x = 10;
  
  // Configurer le renderer avec antialiasing pour une meilleure qualité
  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  
  // Ajouter des contrôles de caméra
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.25;
  controls.screenSpacePanning = false;
  controls.maxPolarAngle = Math.PI / 1.5;
  controls.minDistance = 5;
  controls.maxDistance = 50;
  
  // Ajouter un éclairage
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(10, 20, 10);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 1024;
  directionalLight.shadow.mapSize.height = 1024;
  scene.add(directionalLight);
  
  // Ajouter un sol
  const groundGeometry = new THREE.PlaneGeometry(50, 50);
  const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.8 });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.1;
  ground.receiveShadow = true;
  scene.add(ground);
  
  // Ajouter une grille
  const gridHelper = new THREE.GridHelper(50, 50, 0x444444, 0x888888);
  scene.add(gridHelper);
  
  return { scene, camera, renderer, controls };
}

/**
 * Crée un modèle 3D de bâtiment basé sur les paramètres extraits
 * @param {Object} scene - La scène Three.js
 * @param {Object} params - Les paramètres du bâtiment
 * @returns {Object} - Le groupe d'objets 3D représentant le bâtiment
 */
export function createBuildingModel(scene, params) {
  // Extraire les paramètres avec des valeurs par défaut
  const {
    surface = "100 m²",
    niveaux = 1,
    chambres = 2,
    sallesDeBain = 1,
    garage = false
  } = params;
  
  // Calculer les dimensions approximatives du bâtiment
  const surfaceValue = parseInt(surface.match(/\d+/)[0]) || 100;
  const width = Math.sqrt(surfaceValue) * 0.8;
  const depth = Math.sqrt(surfaceValue) * 0.8;
  const heightPerLevel = 3;
  const totalHeight = niveaux * heightPerLevel;
  
  // Créer un groupe pour contenir tous les éléments du bâtiment
  const buildingGroup = new THREE.Group();
  
  // Créer le corps principal du bâtiment
  const buildingGeometry = new THREE.BoxGeometry(width, totalHeight, depth);
  const buildingMaterial = new THREE.MeshStandardMaterial({
    color: 0xf5f5f5,
    roughness: 0.7,
    metalness: 0.1
  });
  const buildingMesh = new THREE.Mesh(buildingGeometry, buildingMaterial);
  buildingMesh.position.y = totalHeight / 2;
  buildingMesh.castShadow = true;
  buildingMesh.receiveShadow = true;
  buildingGroup.add(buildingMesh);
  
  // Ajouter un toit
  const roofGeometry = new THREE.ConeGeometry(Math.sqrt(width*width + depth*depth) / 1.5, 2, 4);
  const roofMaterial = new THREE.MeshStandardMaterial({ color: 0xA52A2A, roughness: 0.6 });
  const roof = new THREE.Mesh(roofGeometry, roofMaterial);
  roof.position.y = totalHeight + 1;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  buildingGroup.add(roof);
  
  // Ajouter des fenêtres
  const windowsPerLevel = chambres + sallesDeBain + 2; // +2 pour salon et cuisine
  const windowSize = 0.8;
  
  for (let level = 0; level < niveaux; level++) {
    const levelY = level * heightPerLevel + heightPerLevel / 2;
    
    // Fenêtres sur les côtés
    for (let i = 0; i < windowsPerLevel / 2; i++) {
      // Côté avant
      addWindow(buildingGroup, {
        x: (i - windowsPerLevel / 4 + 0.5) * (width / (windowsPerLevel / 2 + 1)),
        y: levelY,
        z: depth / 2 + 0.01,
        width: windowSize,
        height: windowSize * 1.5
      });
      
      // Côté arrière
      addWindow(buildingGroup, {
        x: (i - windowsPerLevel / 4 + 0.5) * (width / (windowsPerLevel / 2 + 1)),
        y: levelY,
        z: -depth / 2 - 0.01,
        width: windowSize,
        height: windowSize * 1.5,
        rotation: Math.PI
      });
    }
  }
  
  // Ajouter une porte
  const doorGeometry = new THREE.BoxGeometry(1.2, 2.2, 0.1);
  const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.8 });
  const door = new THREE.Mesh(doorGeometry, doorMaterial);
  door.position.set(0, 1.1, depth / 2 + 0.05);
  buildingGroup.add(door);
  
  // Ajouter un garage si nécessaire
  if (garage) {
    const garageWidth = Math.min(width * 0.7, 5);
    const garageDepth = Math.min(depth * 0.4, 6);
    const garageHeight = heightPerLevel * 0.8;
    
    const garageGeometry = new THREE.BoxGeometry(garageWidth, garageHeight, garageDepth);
    const garageMaterial = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, roughness: 0.7 });
    const garageMesh = new THREE.Mesh(garageGeometry, garageMaterial);
    garageMesh.position.set(-width / 2 - garageWidth / 2, garageHeight / 2, 0);
    garageMesh.castShadow = true;
    garageMesh.receiveShadow = true;
    buildingGroup.add(garageMesh);
    
    // Porte de garage
    const garagePorteGeometry = new THREE.PlaneGeometry(garageWidth * 0.8, garageHeight * 0.8);
    const garagePorteMaterial = new THREE.MeshStandardMaterial({ color: 0xA0A0A0, roughness: 0.6 });
    const garagePorte = new THREE.Mesh(garagePorteGeometry, garagePorteMaterial);
    garagePorte.position.set(-width / 2 - garageWidth, garageHeight / 2, garageDepth / 2 + 0.01);
    garagePorte.rotation.y = Math.PI;
    buildingGroup.add(garagePorte);
  }
  
  // Ajouter le groupe à la scène
  scene.add(buildingGroup);
  
  return buildingGroup;
}

/**
 * Ajoute une fenêtre au bâtiment
 * @param {Object} group - Le groupe parent
 * @param {Object} options - Options de la fenêtre
 */
function addWindow(group, options) {
  const { x, y, z, width, height, rotation = 0 } = options;
  
  const windowGeometry = new THREE.PlaneGeometry(width, height);
  const windowMaterial = new THREE.MeshStandardMaterial({
    color: 0x88ccff,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
    metalness: 0.8,
    roughness: 0.2
  });
  
  const windowMesh = new THREE.Mesh(windowGeometry, windowMaterial);
  windowMesh.position.set(x, y, z);
  
  if (rotation !== 0) {
    windowMesh.rotation.y = rotation;
  }
  
  group.add(windowMesh);
  
  // Ajouter un cadre de fenêtre
  const frameGeometry = new THREE.BoxGeometry(width + 0.1, height + 0.1, 0.05);
  const frameMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  const frame = new THREE.Mesh(frameGeometry, frameMaterial);
  frame.position.copy(windowMesh.position);
  if (rotation !== 0) {
    frame.rotation.y = rotation;
  }
  if (z > 0) {
    frame.position.z += 0.02;
  } else {
    frame.position.z -= 0.02;
  }
  
  group.add(frame);
}

/**
 * Anime la scène 3D
 * @param {Object} renderer - Le renderer Three.js
 * @param {Object} scene - La scène Three.js
 * @param {Object} camera - La caméra Three.js
 * @param {Object} controls - Les contrôles de caméra
 */
export function animateScene(renderer, scene, camera, controls) {
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  
  animate();
}

/**
 * Redimensionne le renderer quand la fenêtre change de taille
 * @param {Object} renderer - Le renderer Three.js
 * @param {Object} camera - La caméra Three.js
 * @param {HTMLElement} canvas - L'élément canvas
 */
export function handleResize(renderer, camera, canvas) {
  window.addEventListener('resize', () => {
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  });
}

/**
 * Prévisualise un modèle IFC avec les paramètres donnés
 * @param {HTMLCanvasElement} canvas - L'élément canvas pour le rendu
 * @param {Object} params - Les paramètres du bâtiment
 * @returns {Object} - Les objets Three.js initialisés
 */
export function previewBuilding(canvas, params) {
  // Générer une clé de cache basée sur les paramètres
  const cacheKey = JSON.stringify(params);
  
  // Vérifier si la scène est déjà en cache
  if (sceneCache.has(cacheKey)) {
    console.log('Utilisation de la scène en cache');
    return sceneCache.get(cacheKey);
  }
  
  // Initialiser la scène
  const sceneObjects = initScene(canvas);
  const { scene, camera, renderer, controls } = sceneObjects;
  
  // Créer le modèle du bâtiment
  createBuildingModel(scene, params);
  
  // Configurer le redimensionnement
  handleResize(renderer, camera, canvas);
  
  // Démarrer l'animation
  animateScene(renderer, scene, camera, controls);
  
  // Mettre en cache la scène
  sceneCache.set(cacheKey, sceneObjects);
  
  return sceneObjects;
}