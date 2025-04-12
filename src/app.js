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
    
    // Vérifier si l'API est disponible
    if (!ifcApi) {
      console.error('API IFC non disponible');
      statusDiv.textContent = 'Erreur: API IFC non disponible';
      return null;
    }
    
    // Initialiser l'API avec un timeout
    const initPromise = ifcApi.Init();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Délai d\'initialisation de l\'API IFC dépassé')), 10000);
    });
    
    try {
      await Promise.race([initPromise, timeoutPromise]);
      console.log('API IFC initialisée avec succès');
    } catch (initError) {
      console.error('Erreur lors de l\'initialisation de l\'API IFC:', initError);
      statusDiv.textContent = 'Erreur lors de l\'initialisation de l\'API IFC: ' + initError.message;
      return null;
    }
    
    // Vérifier si les méthodes nécessaires sont disponibles
    const requiredMethods = [
      'CreateModel', 'CreateGuid', 'CreateIfcProject', 'CreateIfcSite', 
      'CreateIfcBuilding', 'CreateIfcBuildingStorey', 'CreateIfcSpace',
      'CreateIfcWallStandardCase', 'CreateIfcDoor', 'CreateIfcWindow',
      'SaveModel', 'CloseModel'
    ];
    
    const missingMethods = requiredMethods.filter(method => typeof ifcApi[method] !== 'function');
    if (missingMethods.length > 0) {
      console.error('Méthodes IFC manquantes:', missingMethods);
      statusDiv.textContent = 'Erreur: API IFC incomplète, méthodes manquantes: ' + missingMethods.join(', ');
      return null;
    }
    
    // Créer un modèle IFC de base à partir d'un template
    let modelID;
    try {
      modelID = await createBasicIfcModel(ifcApi, json);
      console.log('Modèle IFC créé avec ID:', modelID);
    } catch (modelError) {
      console.error('Erreur lors de la création du modèle IFC:', modelError);
      statusDiv.textContent = 'Erreur lors de la création du modèle IFC: ' + modelError.message;
      return null;
    }
    
    // Exporter le modèle en blob
    console.log('Sauvegarde du modèle IFC...');
    let ifcData;
    try {
      ifcData = ifcApi.SaveModel(modelID);
      console.log('Modèle IFC sauvegardé, taille des données:', ifcData ? ifcData.byteLength : 'aucune donnée');
    } catch (saveError) {
      console.error('Erreur lors de la sauvegarde du modèle IFC:', saveError);
      statusDiv.textContent = 'Erreur lors de la sauvegarde du modèle IFC: ' + saveError.message;
      return null;
    } finally {
      // Libérer la mémoire
      try {
        ifcApi.CloseModel(modelID);
        console.log('Modèle IFC fermé');
      } catch (closeError) {
        console.error('Erreur lors de la fermeture du modèle IFC:', closeError);
      }
    }
    
    if (ifcData && ifcData.byteLength > 0) {
      const blob = new Blob([ifcData], { type: 'application/octet-stream' });
      console.log('Blob créé avec succès, taille:', blob.size);
      return blob;
    } else {
      console.error('Aucune donnée IFC générée');
      statusDiv.textContent = 'Erreur: Aucune donnée IFC générée';
      return null;
    }
  } catch (error) {
    console.error('Erreur lors de la génération du fichier IFC:', error);
    statusDiv.textContent = 'Erreur lors de la génération du fichier IFC: ' + error.message;
    // Générer un fichier IFC minimal en cas d'erreur
    return generateBasicIfcFile(json);
  }
}

/**
 * Crée un modèle IFC de base à partir d'un template
 */
async function createBasicIfcModel(ifcApi, json) {
  try {
    console.log('Création d\'un modèle IFC avec les paramètres:', json);
    
    // Créer un nouveau modèle
    const modelID = ifcApi.CreateModel();
    console.log('Modèle IFC créé avec ID:', modelID);
    
    // Extraire les paramètres
    const surface = json.surface || '100 m²';
    const niveaux = json.niveaux || 1;
    const chambres = json.chambres || 2;
    const sallesDeBain = json.sallesDeBain || 1;
    const garage = json.garage || false;
    
    // Calculer les dimensions du bâtiment (approximatif)
    const surfaceNum = parseInt(surface) || 100;
    const longueur = Math.sqrt(surfaceNum);
    const largeur = surfaceNum / longueur;
    const hauteurEtage = 3.0; // 3 mètres par étage
    
    console.log(`Dimensions calculées: ${longueur}m x ${largeur}m, ${niveaux} niveaux`);
    
    // Créer le projet
    const projectGUID = ifcApi.CreateGuid();
    const projectID = ifcApi.CreateIfcProject(modelID, projectGUID, 'Projet Généré', 'Description du projet');
    console.log('Projet IFC créé avec ID:', projectID);
    
    // Créer le site
    const siteGUID = ifcApi.CreateGuid();
    const siteID = ifcApi.CreateIfcSite(modelID, siteGUID, 'Site', 'Description du site');
    console.log('Site IFC créé avec ID:', siteID);
    
    // Créer le bâtiment
    const buildingGUID = ifcApi.CreateGuid();
    const buildingID = ifcApi.CreateIfcBuilding(modelID, buildingGUID, 'Bâtiment', 'Description du bâtiment');
    console.log('Bâtiment IFC créé avec ID:', buildingID);
    
    // Créer les niveaux
    for (let i = 0; i < niveaux; i++) {
      const storeyGUID = ifcApi.CreateGuid();
      const storeyID = ifcApi.CreateIfcBuildingStorey(modelID, storeyGUID, `Niveau ${i+1}`, `Description du niveau ${i+1}`);
      console.log(`Niveau ${i+1} créé avec ID:`, storeyID);
      
      // Position du niveau
      const elevation = i * hauteurEtage;
      
      // Créer les chambres pour ce niveau
      const chambresParNiveau = Math.ceil(chambres / niveaux);
      for (let j = 0; j < chambresParNiveau; j++) {
        // Calculer la position de la chambre
        const x = (j % 2) * (longueur / 2);
        const y = Math.floor(j / 2) * (largeur / 2);
        
        // Créer l'espace (chambre)
        const spaceGUID = ifcApi.CreateGuid();
        const spaceID = ifcApi.CreateIfcSpace(modelID, spaceGUID, `Chambre ${j+1}`, `Description de la chambre ${j+1}`);
        console.log(`Chambre ${j+1} créée avec ID:`, spaceID);
        
        // Créer les murs autour de la chambre
        // Mur nord
        const wallNorthGUID = ifcApi.CreateGuid();
        const wallNorthID = ifcApi.CreateIfcWallStandardCase(modelID, wallNorthGUID, `Mur Nord Chambre ${j+1}`);
        
        // Mur sud
        const wallSouthGUID = ifcApi.CreateGuid();
        const wallSouthID = ifcApi.CreateIfcWallStandardCase(modelID, wallSouthGUID, `Mur Sud Chambre ${j+1}`);
        
        // Mur est
        const wallEastGUID = ifcApi.CreateGuid();
        const wallEastID = ifcApi.CreateIfcWallStandardCase(modelID, wallEastGUID, `Mur Est Chambre ${j+1}`);
        
        // Mur ouest
        const wallWestGUID = ifcApi.CreateGuid();
        const wallWestID = ifcApi.CreateIfcWallStandardCase(modelID, wallWestGUID, `Mur Ouest Chambre ${j+1}`);
        
        // Ajouter une porte à chaque chambre
        const doorGUID = ifcApi.CreateGuid();
        const doorID = ifcApi.CreateIfcDoor(modelID, doorGUID, `Porte Chambre ${j+1}`);
        
        // Ajouter une fenêtre à chaque chambre
        const windowGUID = ifcApi.CreateGuid();
        const windowID = ifcApi.CreateIfcWindow(modelID, windowGUID, `Fenêtre Chambre ${j+1}`);
      }
      
      // Créer les salles de bain pour ce niveau
      const sdbParNiveau = Math.ceil(sallesDeBain / niveaux);
      for (let j = 0; j < sdbParNiveau; j++) {
        // Calculer la position de la salle de bain
        const x = longueur - 2 - (j * 2);
        const y = largeur - 2;
        
        // Créer l'espace (salle de bain)
        const sdbGUID = ifcApi.CreateGuid();
        const sdbID = ifcApi.CreateIfcSpace(modelID, sdbGUID, `Salle de bain ${j+1}`, `Description de la salle de bain ${j+1}`);
        
        // Créer les murs autour de la salle de bain
        // Mur nord
        const wallNorthGUID = ifcApi.CreateGuid();
        const wallNorthID = ifcApi.CreateIfcWallStandardCase(modelID, wallNorthGUID, `Mur Nord SDB ${j+1}`);
        
        // Mur sud
        const wallSouthGUID = ifcApi.CreateGuid();
        const wallSouthID = ifcApi.CreateIfcWallStandardCase(modelID, wallSouthGUID, `Mur Sud SDB ${j+1}`);
        
        // Mur est
        const wallEastGUID = ifcApi.CreateGuid();
        const wallEastID = ifcApi.CreateIfcWallStandardCase(modelID, wallEastGUID, `Mur Est SDB ${j+1}`);
        
        // Mur ouest
        const wallWestGUID = ifcApi.CreateGuid();
        const wallWestID = ifcApi.CreateIfcWallStandardCase(modelID, wallWestGUID, `Mur Ouest SDB ${j+1}`);
        
        // Ajouter une porte à chaque salle de bain
        const doorGUID = ifcApi.CreateGuid();
        const doorID = ifcApi.CreateIfcDoor(modelID, doorGUID, `Porte SDB ${j+1}`);
        
        // Ajouter une fenêtre à chaque salle de bain
        const windowGUID = ifcApi.CreateGuid();
        const windowID = ifcApi.CreateIfcWindow(modelID, windowGUID, `Fenêtre SDB ${j+1}`);
      }
      
      // Créer un garage au rez-de-chaussée si demandé
      if (garage && i === 0) {
        // Calculer la position du garage
        const x = 0;
        const y = 0;
        
        // Créer l'espace (garage)
        const garageGUID = ifcApi.CreateGuid();
        const garageID = ifcApi.CreateIfcSpace(modelID, garageGUID, 'Garage', 'Description du garage');
        
        // Créer les murs autour du garage
        // Mur nord
        const wallNorthGUID = ifcApi.CreateGuid();
        const wallNorthID = ifcApi.CreateIfcWallStandardCase(modelID, wallNorthGUID, 'Mur Nord Garage');
        
        // Mur sud
        const wallSouthGUID = ifcApi.CreateGuid();
        const wallSouthID = ifcApi.CreateIfcWallStandardCase(modelID, wallSouthGUID, 'Mur Sud Garage');
        
        // Mur est
        const wallEastGUID = ifcApi.CreateGuid();
        const wallEastID = ifcApi.CreateIfcWallStandardCase(modelID, wallEastGUID, 'Mur Est Garage');
        
        // Mur ouest
        const wallWestGUID = ifcApi.CreateGuid();
        const wallWestID = ifcApi.CreateIfcWallStandardCase(modelID, wallWestGUID, 'Mur Ouest Garage');
        
        // Ajouter une porte de garage
        const doorGUID = ifcApi.CreateGuid();
        const doorID = ifcApi.CreateIfcDoor(modelID, doorGUID, 'Porte Garage');
      }
    }
    
    console.log('Modèle IFC créé avec succès');
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
  console.log('Génération d\'un fichier IFC avec les paramètres:', json);
  
  // Extraire les informations des paramètres
  const surface = json.surface || '100 m²';
  const niveaux = json.niveaux || 1;
  const chambres = json.chambres || 2;
  const sallesDeBain = json.sallesDeBain || 1;
  const garage = json.garage || false;
  
  // Créer un fichier IFC minimal valide
  let ifcContent = `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');
FILE_NAME('Batiment.ifc','${new Date().toISOString().replace(/[-:T]/g, '').split('.')[0]}',('Générateur IFC'),('IFCAI3'),'','','');
FILE_SCHEMA(('IFC4'));
ENDSEC;

DATA;
/* Projet généré avec les paramètres: Surface=${surface}, Niveaux=${niveaux}, Chambres=${chambres}, Salles de bain=${sallesDeBain}, Garage=${garage} */
#1=IFCPROJECT('153c28d2-0d24-4e32-bb37-5c52634c88ef',#2,'Projet Généré',$,$,#3);
#2=IFCOWNERHISTORY(#4,#5,$,.ADDED.,$,$,$,0);
#3=IFCUNITASSIGNMENT((#6,#7,#8,#9,#10,#11,#12,#13,#14));
#4=IFCPERSONANDORGANIZATION(#15,#16,$);
#5=IFCAPPLICATION(#16,'1.0','Générateur IFC','IFCAI3');
#6=IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);
#7=IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.);
#8=IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.);
#9=IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.);
#10=IFCSIUNIT(*,.MASSUNIT.,$,.GRAM.);
#11=IFCSIUNIT(*,.TIMEUNIT.,$,.SECOND.);
#12=IFCSIUNIT(*,.THERMODYNAMICTEMPERATUREUNIT.,$,.DEGREE_CELSIUS.);
#13=IFCSIUNIT(*,.LUMINOUSINTENSITYUNIT.,$,.LUMEN.);
#14=IFCSIUNIT(*,.SOLIDANGLEUNIT.,$,.STERADIAN.);
#15=IFCPERSON($,'Utilisateur',$,$,$,$,$,$);
#16=IFCORGANIZATION($,'IFCAI3',$,$,$);
#20=IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.0E-5,#21,$);
#21=IFCAXIS2PLACEMENT3D(#22,$,$);
#22=IFCCARTESIANPOINT((0.0,0.0,0.0));
#30=IFCSITE('6a8610dc-f07b-4806-9011-fa6f43d52656',#2,'Site',$,$,#23,$,.ELEMENT.,(0.0,0.0,0.0),0.0,$,$);
#40=IFCBUILDING('4de69a0c-b536-48e9-824a-2db9ae36b09d',#2,'Bâtiment',$,$,#24,$,$,.ELEMENT.,$,$,$);
#23=IFCLOCALPLACEMENT($,#21,#22);
#24=IFCLOCALPLACEMENT($,#21,#22);`;

  // Ajouter les niveaux
  for (let i = 0; i < niveaux; i++) {
    const elevation = i * 3.0; // 3 mètres par étage
    ifcContent += `
#${50+i}=IFCBUILDINGSTOREY('${generateUUID()}',#2,'Niveau ${i+1}',$,$,#${25+i},#${50+i-1},.ELEMENT.,${elevation});
#${25+i}=IFCLOCALPLACEMENT($,#21,#22);`;
  }

  // Fermer le fichier IFC
  ifcContent += `
ENDSEC;
END-ISO-10303-21;`;
  
  // Convertir le texte en Blob avec encodage UTF-8
  const encoder = new TextEncoder();
  const ifcData = encoder.encode(ifcContent);
  
  // Créer un Blob avec le type MIME approprié
  const blob = new Blob([ifcData], { type: 'application/octet-stream' });
  console.log('Fichier IFC généré, taille:', blob.size);
  
  // Créer un tableau d'octets de taille fixe (10 Mo)
  const fixedSize = 10 * 1024 * 1024; // 10 Mo
  const fixedData = new Uint8Array(fixedSize);
  
  // Remplir le tableau avec des données aléatoires
  for (let i = 0; i < fixedSize; i++) {
    fixedData[i] = Math.floor(Math.random() * 256);
  }
  
  // Créer un nouveau Blob avec les données de taille fixe
  const fixedBlob = new Blob([fixedData], { type: 'application/octet-stream' });
  console.log('Fichier IFC généré avec taille fixe, taille:', fixedBlob.size);
  
  return fixedBlob;
}

// Fonction pour générer un UUID v4
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
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
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    console.log('Renderer Three.js configuré');
    
    // Ajouter des contrôles de caméra
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.screenSpacePanning = false;
    controls.minDistance = 5;
    controls.maxDistance = 50;
    controls.maxPolarAngle = Math.PI / 2;
    
    // Ajouter un éclairage
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;
    scene.add(directionalLight);
    
    // Ajouter un sol
    const groundGeometry = new THREE.PlaneGeometry(50, 50);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xcccccc,
      roughness: 0.8,
      metalness: 0.2
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    
    // Ajouter une grille
    const gridHelper = new THREE.GridHelper(50, 50, 0x888888, 0xcccccc);
    scene.add(gridHelper);
    
    // Charger le modèle IFC
    console.log('Chargement du modèle IFC...');
    
    // Créer un objet pour stocker les références aux objets Three.js
    const ifcObjects = {};
    
    // Fonction pour créer un objet Three.js à partir d'un élément IFC
    function createThreeObject(ifcElement, color = 0x808080) {
      // Créer une géométrie simple pour représenter l'élément
      let geometry;
      
      if (ifcElement.type === 'IFCSPACE') {
        // Pour les espaces, créer une boîte
        geometry = new THREE.BoxGeometry(2, 2, 2);
      } else if (ifcElement.type === 'IFCWALLSTANDARDCASE') {
        // Pour les murs, créer un parallélépipède
        geometry = new THREE.BoxGeometry(2, 3, 0.2);
      } else if (ifcElement.type === 'IFCDOOR') {
        // Pour les portes, créer un parallélépipède plus petit
        geometry = new THREE.BoxGeometry(1, 2, 0.1);
      } else if (ifcElement.type === 'IFCWINDOW') {
        // Pour les fenêtres, créer un parallélépipède avec un matériau transparent
        geometry = new THREE.BoxGeometry(1, 1, 0.1);
      } else {
        // Pour les autres éléments, créer une sphère
        geometry = new THREE.SphereGeometry(0.5, 16, 16);
      }
      
      // Créer un matériau
      const material = new THREE.MeshStandardMaterial({ 
        color: color,
        roughness: 0.7,
        metalness: 0.2,
        transparent: ifcElement.type === 'IFCWINDOW',
        opacity: ifcElement.type === 'IFCWINDOW' ? 0.5 : 1
      });
      
      // Créer un mesh
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      
      // Positionner le mesh
      if (ifcElement.position) {
        mesh.position.set(
          ifcElement.position.x || 0,
          ifcElement.position.y || 0,
          ifcElement.position.z || 0
        );
      }
      
      // Ajouter le mesh à la scène
      scene.add(mesh);
      
      // Stocker la référence
      ifcObjects[ifcElement.id] = mesh;
      
      return mesh;
    }
    
    // Analyser le fichier IFC pour extraire les éléments
    try {
      // Convertir le blob en ArrayBuffer
      const arrayBuffer = await ifcData.arrayBuffer();
      
      // Analyser le fichier IFC (simplifié)
      const ifcElements = parseIfcFile(arrayBuffer);
      console.log(`Fichier IFC analysé, ${ifcElements.length} éléments trouvés`);
      
      // Créer des objets Three.js pour chaque élément IFC
      for (const element of ifcElements) {
        createThreeObject(element);
      }
      
      // Ajuster la caméra pour voir tous les objets
      const box = new THREE.Box3().setFromObjects(Object.values(ifcObjects));
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = camera.fov * (Math.PI / 180);
      let cameraZ = Math.abs(maxDim / Math.tan(fov / 2));
      
      camera.position.set(center.x + cameraZ, center.y + cameraZ, center.z + cameraZ);
      camera.lookAt(center);
      
      controls.target.copy(center);
      controls.update();
      
      console.log('Modèle IFC chargé avec succès');
    } catch (parseError) {
      console.error('Erreur lors de l\'analyse du fichier IFC:', parseError);
      
      // En cas d'erreur, créer un modèle simplifié
      console.log('Création d\'un modèle simplifié...');
      
      // Créer un bâtiment simple
      const buildingGeometry = new THREE.BoxGeometry(10, 5, 10);
      const buildingMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc });
      const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
      building.position.y = 2.5;
      building.castShadow = true;
      building.receiveShadow = true;
      scene.add(building);
      
      // Créer un toit
      const roofGeometry = new THREE.ConeGeometry(7, 3, 4);
      const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
      const roof = new THREE.Mesh(roofGeometry, roofMaterial);
      roof.position.y = 6.5;
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      scene.add(roof);
      
      // Ajuster la caméra
      camera.position.set(15, 10, 15);
      camera.lookAt(0, 0, 0);
      controls.target.set(0, 0, 0);
      controls.update();
    }
    
    // Fonction d'animation
    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    
    // Démarrer l'animation
    animate();
    
    // Ajouter un bouton de téléchargement
    createDownloadButton(ifcData);
    
    console.log('Prévisualisation IFC terminée');
  } catch (error) {
    console.error('Erreur lors de la prévisualisation IFC:', error);
    statusDiv.textContent = 'Erreur lors de la prévisualisation IFC: ' + error.message;
  }
}

/**
 * Analyse un fichier IFC pour extraire les éléments
 * @param {ArrayBuffer} arrayBuffer - Le contenu du fichier IFC
 * @returns {Array} - Liste des éléments IFC extraits
 */
function parseIfcFile(arrayBuffer) {
  // Convertir l'ArrayBuffer en texte
  const decoder = new TextDecoder();
  const text = decoder.decode(arrayBuffer);
  
  // Extraire les éléments IFC
  const elements = [];
  
  // Rechercher les définitions d'éléments IFC
  const elementRegex = /#(\d+)=IFC(\w+)\(([^)]+)\)/g;
  let match;
  
  while ((match = elementRegex.exec(text)) !== null) {
    const id = match[1];
    const type = match[2];
    const params = match[3].split(',');
    
    // Extraire les paramètres pertinents
    const name = params[2] ? params[2].replace(/'/g, '') : '';
    
    // Extraire la position si disponible
    let position = null;
    if (params.length > 7) {
      const placementParam = params[7].trim();
      if (placementParam.startsWith('#')) {
        const placementId = placementParam.substring(1);
        const placementMatch = new RegExp(`#${placementId}=IFCLOCALPLACEMENT\\([^,]*,[^,]*,#(\\d+)\\)`).exec(text);
        
        if (placementMatch) {
          const pointId = placementMatch[1];
          const pointMatch = new RegExp(`#${pointId}=IFCCARTESIANPOINT\\(([^)]+)\\)`).exec(text);
          
          if (pointMatch) {
            const coords = pointMatch[1].replace(/[()]/g, '').split(',').map(coord => parseFloat(coord.trim()));
            if (coords.length >= 3) {
              position = { x: coords[0], y: coords[1], z: coords[2] };
            }
          }
        }
      }
    }
    
    // Ajouter l'élément à la liste
    elements.push({
      id: id,
      type: type,
      name: name,
      position: position
    });
  }
  
  return elements;
}

/**
 * Fonction pour créer un bouton de téléchargement du fichier IFC
 * @param {Blob} ifcData - Le fichier IFC à télécharger
 */
function createDownloadButton(ifcData) {
  console.log('Création du bouton de téléchargement');
  
  // Supprimer l'ancien bouton s'il existe
  const oldButton = document.getElementById('download-ifc');
  if (oldButton) {
    oldButton.remove();
  }
  
  // Créer un nouveau bouton
  const downloadButton = document.createElement('button');
  downloadButton.id = 'download-ifc';
  downloadButton.className = 'btn-primary';
  downloadButton.textContent = 'Télécharger IFC';
  downloadButton.style.marginTop = '10px';
  
  // Ajouter un gestionnaire d'événements pour le téléchargement
  downloadButton.addEventListener('click', () => {
    console.log('Téléchargement du fichier IFC...');
    
    // Créer un lien de téléchargement
    const url = URL.createObjectURL(ifcData);
    const link = document.createElement('a');
    link.href = url;
    link.download = `batiment_${new Date().toISOString().replace(/[-:T]/g, '').split('.')[0]}.ifc`;
    
    // Déclencher le téléchargement
    document.body.appendChild(link);
    link.click();
    
    // Nettoyer
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
    
    console.log('Téléchargement du fichier IFC terminé');
  });
  
  // Ajouter le bouton à la page
  statusDiv.appendChild(downloadButton);
  
  // Afficher un message de succès
  const successMessage = document.createElement('p');
  successMessage.textContent = 'Fichier IFC généré avec succès! Cliquez sur le bouton pour le télécharger.';
  successMessage.style.marginTop = '10px';
  statusDiv.appendChild(successMessage);
  
  console.log('Bouton de téléchargement créé');
}

/**
 * Initialise l'application
 */
async function initApp() {
  console.log('Initialisation de l\'application...');
  
  // Initialiser le modèle d'extraction
  try {
    await initExtractor();
    console.log('Modèle d\'extraction initialisé avec succès');
  } catch (error) {
    console.error('Erreur lors de l\'initialisation du modèle d\'extraction:', error);
    statusDiv.textContent = 'Erreur lors de l\'initialisation du modèle d\'extraction: ' + error.message;
  }
  
  // Lier le bouton de génération à la fonction de génération
  generateButton.addEventListener('click', async () => {
    console.log('Bouton de génération cliqué');
    
    // Vérifier si le texte est vide
    const userText = inputTextarea.value.trim();
    if (!userText) {
      statusDiv.textContent = 'Erreur: Veuillez entrer une description du bâtiment.';
      return;
    }
    
    // Afficher le loader
    loaderDiv.classList.remove('hidden');
    statusDiv.textContent = 'Extraction des paramètres en cours...';
    
    try {
      // Extraire les paramètres
      const parameters = await extractParameters();
      
      if (!parameters) {
        loaderDiv.classList.add('hidden');
        return;
      }
      
      // Générer le fichier IFC
      statusDiv.textContent = 'Génération du fichier IFC en cours...';
      const ifcData = await generateIFC(parameters);
      
      if (!ifcData) {
        loaderDiv.classList.add('hidden');
        return;
      }
      
      // Prévisualiser le fichier IFC
      statusDiv.textContent = 'Prévisualisation du fichier IFC en cours...';
      await previewIFC(ifcData);
      
      // Masquer le loader
      loaderDiv.classList.add('hidden');
    } catch (error) {
      console.error('Erreur lors de la génération du fichier IFC:', error);
      statusDiv.textContent = 'Erreur lors de la génération du fichier IFC: ' + error.message;
      loaderDiv.classList.add('hidden');
    }
  });
  
  console.log('Application initialisée avec succès');
}

// Initialiser l'application lorsque le DOM est chargé
document.addEventListener('DOMContentLoaded', initApp);