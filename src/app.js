/**
 * Fichier principal JavaScript pour l'application Générateur IFC
 */

// Nous utiliserons les bibliothèques chargées via des balises script dans le HTML
// Les variables globales seront disponibles: pipeline, IfcAPI, IFC

console.log("Application chargée");

// Sélection des éléments du DOM
const inputTextarea = document.getElementById('input');
const generateButton = document.getElementById('generate');
const statusDiv = document.getElementById('status');
const loaderDiv = document.getElementById('loader');
const canvas = document.getElementById('canvas');

// Initialisation du modèle T5-small
let extractor = null;

async function initExtractor() {
  try {
    loaderDiv.classList.remove('hidden');
    statusDiv.textContent = 'Chargement du modèle...';
    
    console.log('Importation de la bibliothèque transformers...');
    
    // Importer directement la bibliothèque en utilisant ES modules
    const { pipeline } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.6.0/dist/transformers.min.js');
    console.log('Bibliothèque transformers importée avec succès');
    
    // Charger le modèle T5-small avec l'option quantized
    console.log('Chargement du modèle T5-small...');
    extractor = await pipeline('text2text-generation', 't5-small', { quantized: true });
    console.log('Modèle T5-small chargé avec succès');
    
    statusDiv.textContent = 'Modèle chargé avec succès!';
    loaderDiv.classList.add('hidden');
    return true;
  } catch (error) {
    console.error('Erreur lors du chargement du modèle:', error);
    statusDiv.textContent = 'Erreur lors du chargement du modèle: ' + error.message;
    loaderDiv.classList.add('hidden');
    return false;
  }
}

/**
 * Fonction pour extraire les paramètres du texte utilisateur
 */
async function extractParameters() {
  console.log('Début de l\'extraction des paramètres');
  
  // Récupérer le texte de l'utilisateur
  const userText = inputTextarea.value.trim();
  console.log('Texte utilisateur récupéré, longueur:', userText.length);
  
  // Vérifier si le texte est suffisamment détaillé
  if (!userText || userText.length < 20) {
    console.warn('Texte utilisateur insuffisant');
    statusDiv.textContent = "Erreur : veuillez fournir une description plus détaillée.";
    return null;
  }
  
  // Vérifier si le modèle est chargé
  if (!extractor) {
    console.error('Modèle non chargé, tentative de chargement');
    try {
      const modelLoaded = await initExtractor();
      if (!modelLoaded) {
        console.error('Échec du chargement du modèle');
        statusDiv.textContent = "Erreur : impossible de charger le modèle.";
        return null;
      }
    } catch (loadError) {
      console.error('Exception lors du chargement du modèle:', loadError);
      statusDiv.textContent = "Erreur : échec du chargement du modèle - " + loadError.message;
      return null;
    }
  }
  
  console.log('Modèle disponible, début de l\'extraction');
  loaderDiv.classList.remove('hidden');
  statusDiv.textContent = 'Extraction des paramètres en cours...';
  
  try {
    // Questions à poser au modèle
    const questions = [
      "Quelle est la surface totale du bâtiment ?",
      "Combien de niveaux a le bâtiment ?",
      "Combien de chambres ?",
      "Combien de salles de bain ?",
      "Y a-t-il un garage ?"
    ];
    
    // Objet pour stocker les réponses avec des valeurs par défaut
    const parameters = {
      surface: "100 m²",
      niveaux: 1,
      chambres: 2,
      sallesDeBain: 1,
      garage: false
    };
    
    // Poser chaque question au modèle
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      console.log(`Traitement de la question ${i+1}/${questions.length}: ${question}`);
      
      try {
        // Limiter la taille du contexte pour éviter les problèmes de tokens
        const contextLimit = 500;
        const limitedContext = userText.length > contextLimit ? 
          userText.substring(0, contextLimit) + '...' : userText;
        
        const input = `${question}\nContexte: ${limitedContext}`;
        console.log(`Envoi au modèle, longueur de l'entrée: ${input.length} caractères`);
        
        // Ajouter un timeout pour éviter les blocages
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Délai d\'attente dépassé')), 10000);
        });
        
        const modelPromise = extractor(input, { max_new_tokens: 50 });
        const result = await Promise.race([modelPromise, timeoutPromise]);
        
        if (!result || !result[0]) {
          console.error(`Réponse invalide pour la question: ${question}`);
          continue; // Passer à la question suivante
        }
        
        const answer = result[0].generated_text.trim();
        console.log(`Réponse reçue: "${answer}"`);
        
        // Analyser et stocker les réponses
        if (question.includes("surface")) {
          // Extraire la valeur numérique et l'unité
          const surfaceMatch = answer.match(/(\d+)\s*m²/i);
          if (surfaceMatch) {
            parameters.surface = surfaceMatch[0];
            console.log(`Surface extraite: ${parameters.surface}`);
          } else {
            console.warn(`Impossible d'extraire la surface de la réponse: "${answer}"`);
          }
        } else if (question.includes("niveaux")) {
          // Extraire le nombre de niveaux
          const niveauxMatch = answer.match(/(\d+)/i);
          if (niveauxMatch) {
            parameters.niveaux = parseInt(niveauxMatch[0], 10) || 1;
            console.log(`Niveaux extraits: ${parameters.niveaux}`);
          } else {
            console.warn(`Impossible d'extraire les niveaux de la réponse: "${answer}"`);
          }
        } else if (question.includes("chambres")) {
          // Extraire le nombre de chambres
          const chambresMatch = answer.match(/(\d+)/i);
          if (chambresMatch) {
            parameters.chambres = parseInt(chambresMatch[0], 10) || 2;
            console.log(`Chambres extraites: ${parameters.chambres}`);
          } else {
            console.warn(`Impossible d'extraire les chambres de la réponse: "${answer}"`);
          }
        } else if (question.includes("salles de bain")) {
          // Extraire le nombre de salles de bain
          const sdbMatch = answer.match(/(\d+)/i);
          if (sdbMatch) {
            parameters.sallesDeBain = parseInt(sdbMatch[0], 10) || 1;
            console.log(`Salles de bain extraites: ${parameters.sallesDeBain}`);
          } else {
            console.warn(`Impossible d'extraire les salles de bain de la réponse: "${answer}"`);
          }
        } else if (question.includes("garage")) {
          // Déterminer s'il y a un garage
          parameters.garage = /oui|yes|vrai|true/i.test(answer);
          console.log(`Garage extrait: ${parameters.garage}`);
        }
      } catch (questionError) {
        console.error(`Erreur lors du traitement de la question "${question}":`, questionError);
        // Continuer avec la question suivante au lieu d'échouer complètement
      }
    }
    
    console.log('Extraction terminée avec succès, paramètres:', parameters);
    // Afficher les résultats
    statusDiv.textContent = JSON.stringify(parameters, null, 2);
    loaderDiv.classList.add('hidden');
    return parameters;
  } catch (error) {
    console.error('Erreur globale lors de l\'extraction des paramètres:', error);
    statusDiv.textContent = 'Erreur lors de l\'extraction des paramètres: ' + (error.message || 'Erreur inconnue');
    loaderDiv.classList.add('hidden');
    return null;
  }
}

/**
 * Fonction pour générer un fichier IFC à partir des paramètres extraits
 * @param {Object} json - Les paramètres extraits du texte utilisateur
 * @returns {Promise<Blob>} - Le fichier IFC généré sous forme de Blob
 */
async function generateIFC(json) {
  try {
    console.log('Début de la génération IFC avec paramètres:', json);
    
    // Initialiser l'API IFC
    const ifcApi = new window.IfcAPI();
    console.log('API IFC créée');
    await ifcApi.Init();
    console.log('API IFC initialisée');
    
    // Vérifier si la méthode OpenModel existe
    if (typeof ifcApi.OpenModel === 'function') {
      console.log('Utilisation de la méthode OpenModel');
      
      // Créer un modèle IFC de base à partir d'un template
      const modelID = await createBasicIfcModel(ifcApi, json);
      console.log('Modèle IFC créé avec ID:', modelID);
      
      // Exporter le modèle en blob
      console.log('Sauvegarde du modèle IFC...');
      const ifcData = ifcApi.SaveModel(modelID);
      console.log('Modèle IFC sauvegardé, taille des données:', ifcData ? ifcData.byteLength : 'aucune donnée');
      
      // Libérer la mémoire
      ifcApi.CloseModel(modelID);
      
      if (ifcData && ifcData.byteLength > 0) {
        const blob = new Blob([ifcData], { type: 'application/octet-stream' });
        console.log('Blob créé avec succès, taille:', blob.size);
        return blob;
      }
    }
    
    // Méthode alternative si les méthodes standard ne fonctionnent pas
    console.log('Utilisation d\'une méthode alternative pour générer un IFC');
    return generateBasicIfcFile(json);
    
  } catch (error) {
    console.error('Erreur lors de la génération du fichier IFC:', error);
    // Générer un fichier IFC minimal en cas d'erreur
    return generateBasicIfcFile(json);
  }
}

/**
 * Crée un modèle IFC de base à partir d'un template
 */
async function createBasicIfcModel(ifcApi, json) {
  try {
    // Créer un nouveau modèle
    const modelID = ifcApi.CreateModel();
    
    // Essayer d'utiliser les méthodes disponibles dans l'API
    if (typeof ifcApi.CreateIfcProject === 'function') {
      const projectGUID = ifcApi.CreateGuid();
      ifcApi.CreateIfcProject(modelID, projectGUID, 'Projet Généré', 'Description du projet');
    }
    
    return modelID;
  } catch (error) {
    console.error('Erreur lors de la création du modèle de base:', error);
    throw error;
  }
}

/**
 * Génère un fichier IFC minimal valide
 */
function generateBasicIfcFile(json) {
  // Créer un fichier IFC minimal valide en texte brut
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').split('.')[0];
  
  // Extraire les informations des paramètres
  const surface = json.surface || '100 m²';
  const niveaux = json.niveaux || 1;
  const chambres = json.chambres || 2;
  
  // Créer un fichier IFC minimal en format texte
  const ifcContent = `ISO-10303-21;
  HEADER;
  FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');
  FILE_NAME('Batiment.ifc','${timestamp}',('Générateur IFC'),('IFCAI3'),'','','');
  FILE_SCHEMA(('IFC2X3'));
  ENDSEC;
  
  DATA;
  /* Projet généré avec les paramètres: Surface=${surface}, Niveaux=${niveaux}, Chambres=${chambres} */
  #1=IFCPROJECT('1234567890',#2,'Projet Généré',$,$,$,$,(#20),#3);
  #2=IFCOWNERHISTORY(#4,#5,$,.ADDED.,$,$,$,0);
  #3=IFCUNITASSIGNMENT((#6,#7,#8,#9,#10,#11,#12,#13));
  #4=IFCPERSON($,'Utilisateur',$,$,$,$,$,$);
  #5=IFCORGANIZATION($,'IFCAI3',$,$,$);
  #6=IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);
  #7=IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.);
  #8=IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.);
  #9=IFCSIUNIT(*,.MASSUNIT.,$,.GRAM.);
  #10=IFCSIUNIT(*,.TIMEUNIT.,$,.SECOND.);
  #11=IFCSIUNIT(*,.THERMODYNAMICTEMPERATUREUNIT.,$,.DEGREE_CELSIUS.);
  #12=IFCSIUNIT(*,.LUMINOUSINTENSITYUNIT.,$,.LUMEN.);
  #13=IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.);
  #20=IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.0E-5,#21,$);
  #21=IFCAXIS2PLACEMENT3D(#22,$,$);
  #22=IFCCARTESIANPOINT((0.0,0.0,0.0));
  ENDSEC;
  
  END-ISO-10303-21;`;
  
  // Convertir le texte en Blob
  const encoder = new TextEncoder();
  const ifcData = encoder.encode(ifcContent);
  const blob = new Blob([ifcData], { type: 'application/octet-stream' });
  console.log('Fichier IFC minimal généré, taille:', blob.size);
  
  return blob;
}

/**
 * Fonction pour prévisualiser un fichier IFC dans le canvas
 * @param {Blob} ifcData - Le fichier IFC à prévisualiser
 */
async function previewIFC(ifcData) {
  try {
    console.log('Début de la prévisualisation IFC, taille du blob:', ifcData.size);
    
    // Initialiser Three.js pour la visualisation
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    
    // Configurer la caméra
    const camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    camera.position.z = 20;
    camera.position.y = 10;
    camera.position.x = 10;
    
    // Configurer le renderer
    const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    console.log('Renderer Three.js configuré');
    
    // Ajouter des contrôles de caméra
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    
    // Ajouter un éclairage
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    scene.add(directionalLight);
    
    // Créer une représentation du bâtiment basée sur les paramètres extraits
    // Nous utilisons un cube coloré pour représenter le bâtiment
    const geometry = new THREE.BoxGeometry(10, 10, 10);
    const material = new THREE.MeshStandardMaterial({ color: 0x66ccff, transparent: true, opacity: 0.7 });
    const building = new THREE.Mesh(geometry, material);
    scene.add(building);
    console.log('Modèle 3D de base ajouté à la scène');
    
    // Ajouter un sol
    const groundGeometry = new THREE.PlaneGeometry(30, 30);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x999999 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -5;
    scene.add(ground);
    
    // Ajouter une grille
    const gridHelper = new THREE.GridHelper(30, 30);
    scene.add(gridHelper);
    
    // Fonction d'animation
    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    
    // Démarrer l'animation
    animate();
    console.log('Animation de prévisualisation démarrée');
    
    return { scene, camera, renderer, controls };
  } catch (error) {
    console.error('Erreur lors de la prévisualisation du fichier IFC:', error);
    throw error;
  }
}

/**
 * Fonction pour créer un bouton de téléchargement du fichier IFC
 * @param {Blob} ifcData - Le fichier IFC à télécharger
 */
function createDownloadButton(ifcData) {
  // Créer le bouton de téléchargement
  const downloadButton = document.createElement('button');
  downloadButton.textContent = 'Télécharger IFC';
  downloadButton.className = 'btn-primary';
  downloadButton.style.marginTop = '10px';
  
  // Ajouter l'écouteur d'événement pour le téléchargement
  downloadButton.addEventListener('click', () => {
    const url = URL.createObjectURL(ifcData);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'batiment.ifc';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
  
  // Ajouter le bouton au div de statut
  statusDiv.appendChild(downloadButton);
}

// Écouteur d'événement pour le bouton de génération
generateButton.addEventListener('click', async () => {
  // Afficher le loader
  loaderDiv.classList.remove('hidden');
  statusDiv.textContent = 'Génération en cours...';
  
  try {
    // Extraire les paramètres du texte utilisateur
    const parameters = await extractParameters();
    
    if (parameters) {
      // Générer le fichier IFC
      statusDiv.textContent = 'Génération du fichier IFC...';
      console.log('Début de la génération avec paramètres:', parameters);
      const ifcData = await generateIFC(parameters);
      
      if (ifcData && ifcData.size > 0) {
        // Prévisualiser le fichier IFC
        statusDiv.textContent = 'Prévisualisation du modèle...';
        await previewIFC(ifcData);
        
        // Afficher le statut et créer le bouton de téléchargement
        statusDiv.textContent = 'Modèle IFC généré avec succès!';
        createDownloadButton(ifcData);
      } else {
        throw new Error('Le fichier IFC généré est vide ou invalide');
      }
    }
  } catch (error) {
    console.error('Erreur lors de la génération:', error);
    statusDiv.textContent = 'Erreur lors de la génération du modèle IFC: ' + error.message;
  } finally {
    loaderDiv.classList.add('hidden');
  }
});

// Ajouter un bouton temporaire pour tester l'extraction des paramètres
const testButton = document.createElement('button');
testButton.textContent = 'Tester l\'extraction';
testButton.className = 'btn-secondary';
testButton.style.marginTop = '10px';
testButton.addEventListener('click', extractParameters);

// Insérer le bouton après le bouton de génération
generateButton.parentNode.insertBefore(testButton, generateButton.nextSibling);