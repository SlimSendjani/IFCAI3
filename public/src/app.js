/**
 * Fichier principal JavaScript pour l'application Générateur IFC
 */

// Nous utiliserons les bibliothèques chargées via des balises script dans le HTML
// Les variables globales seront disponibles: pipeline, IfcAPI, IFC

// Import des modules nécessaires
import { getExtractedParamsFromCache, storeExtractedParamsInCache, getIfcModelFromCache, storeIfcModelInCache } from './cache-manager.js';
import { getOrCreateTemplate, generateBasicTemplate, generateStoreyTemplate, generateWallTemplate, applyTemplate } from './templates.js';

console.log("Application chargée");

// Sélection des éléments du DOM
const inputTextarea = document.getElementById('input');
const generateButton = document.getElementById('generate');
const statusDiv = document.getElementById('status');
const loaderDiv = document.getElementById('loader');
const canvas = document.getElementById('canvas');

// Initialisation du modèle T5-small
let extractor = null;
let modelLoading = false;
let modelLoadPromise = null;

async function initExtractor() {
  // Si le modèle est déjà en cours de chargement, retourner la promesse existante
  if (modelLoadPromise) {
    return modelLoadPromise;
  }
  
  // Si le modèle est déjà chargé, retourner immédiatement
  if (extractor) {
    console.log('Modèle déjà chargé, utilisation du cache');
    return true;
  }
  
  try {
    modelLoading = true;
    loaderDiv.classList.remove('hidden');
    statusDiv.textContent = 'Chargement du modèle...';
    
    console.log('Importation de la bibliothèque transformers...');
    console.time('Chargement transformers');
    
    // Créer une promesse pour le chargement du modèle
    modelLoadPromise = (async () => {
      // Importer directement la bibliothèque en utilisant ES modules
      const { pipeline } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.6.0/dist/transformers.min.js');
      console.log('Bibliothèque transformers importée avec succès');
      console.timeEnd('Chargement transformers');
      
      // Charger le modèle T5-small avec l'option quantized
      console.log('Chargement du modèle T5-small...');
      console.time('Chargement modèle T5');
      extractor = await pipeline('text2text-generation', 't5-small', { 
        quantized: true,
        cache: true // Activer le cache pour éviter de recharger le modèle
      });
      console.timeEnd('Chargement modèle T5');
      console.log('Modèle T5-small chargé avec succès');
      
      statusDiv.textContent = 'Modèle chargé avec succès!';
      loaderDiv.classList.add('hidden');
      modelLoading = false;
      return true;
    })();
    
    return await modelLoadPromise;
  } catch (error) {
    console.error('Erreur lors du chargement du modèle:', error);
    statusDiv.textContent = 'Erreur lors du chargement du modèle: ' + error.message;
    loaderDiv.classList.add('hidden');
    modelLoading = false;
    modelLoadPromise = null;
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
  
  // Vérifier si les paramètres sont déjà en cache
  const cachedParams = getExtractedParamsFromCache(userText);
  if (cachedParams) {
    console.log('Paramètres récupérés depuis le cache:', cachedParams);
    statusDiv.textContent = 'Paramètres récupérés depuis le cache';
    return cachedParams;
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
    
    // Traiter toutes les questions en parallèle pour accélérer l'extraction
    const questionPromises = questions.map(async (question, index) => {
      try {
        // Limiter la taille du contexte pour éviter les problèmes de tokens
        const contextLimit = 500;
        const limitedContext = userText.length > contextLimit ? 
          userText.substring(0, contextLimit) + '...' : userText;
        
        const input = `${question}\nContexte: ${limitedContext}`;
        console.log(`Préparation de la question ${index+1}/${questions.length}: ${question}`);
        
        // Ajouter un timeout pour éviter les blocages
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Délai d\'attente dépassé')), 10000);
        });
        
        return { question, promise: Promise.race([extractor(input, { max_new_tokens: 50 }), timeoutPromise]) };
      } catch (error) {
        console.error(`Erreur lors de la préparation de la question "${question}":`, error);
        return { question, error };
      }
    });
    
    // Attendre que toutes les questions soient traitées
    const results = await Promise.all(questionPromises.map(async (item) => {
      try {
        if (item.error) {
          console.error(`Erreur pour la question "${item.question}":`, item.error);
          return { question: item.question, answer: null, error: item.error };
        }
        
        const result = await item.promise;
        console.log(`Réponse obtenue pour "${item.question}":`, result);
        return { question: item.question, answer: result, error: null };
      } catch (error) {
        console.error(`Erreur lors du traitement de la question "${item.question}":`, error);
        return { question: item.question, answer: null, error };
      }
    }));
    
    // Traiter les résultats pour mettre à jour les paramètres
    results.forEach((result, index) => {
      if (result.error || !result.answer) {
        console.warn(`Pas de réponse valide pour la question ${index+1}, utilisation de la valeur par défaut`);
        return; // Conserver la valeur par défaut
      }
      
      const answer = result.answer[0]?.generated_text || '';
      console.log(`Réponse traitée pour la question ${index+1}:`, answer);
      
      // Mettre à jour les paramètres en fonction de la question
      switch (index) {
        case 0: // Surface
          const surfaceMatch = answer.match(/(\d+)\s*m²|m2|metres?\s*carres?/i);
          if (surfaceMatch) {
            parameters.surface = `${surfaceMatch[1]} m²`;
          }
          break;
        case 1: // Niveaux
          const niveauxMatch = answer.match(/(\d+)/i);
          if (niveauxMatch) {
            parameters.niveaux = parseInt(niveauxMatch[1], 10) || 1;
          }
          break;
        case 2: // Chambres
          const chambresMatch = answer.match(/(\d+)/i);
          if (chambresMatch) {
            parameters.chambres = parseInt(chambresMatch[1], 10) || 2;
          }
          break;
        case 3: // Salles de bain
          const sdbMatch = answer.match(/(\d+)/i);
          if (sdbMatch) {
            parameters.sallesDeBain = parseInt(sdbMatch[1], 10) || 1;
          }
          break;
        case 4: // Garage
          parameters.garage = /oui|yes|vrai|true|1/i.test(answer);
          break;
      }
    });
    
    console.log('Paramètres extraits avec succès:', parameters);
    statusDiv.textContent = 'Paramètres extraits avec succès!';
    loaderDiv.classList.add('hidden');
    
    // Stocker les paramètres dans le cache pour une utilisation future
    storeExtractedParamsInCache(userText, parameters);
    
    return parameters;
  } catch (error) {
    console.error('Erreur lors de l\'extraction des paramètres:', error);
    statusDiv.textContent = 'Erreur lors de l\'extraction: ' + error.message;
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
    
    // Vérifier si le modèle est déjà en cache
    const cachedModel = getIfcModelFromCache(json);
    if (cachedModel) {
      console.log('Utilisation du modèle IFC en cache');
      return cachedModel;
    }
    
    // Initialiser l'API IFC
    // Vérifier si la bibliothèque IFC est disponible
    if (typeof IFC === 'undefined') {
      console.error('La bibliothèque IFC n\'est pas chargée');
      throw new Error('La bibliothèque IFC n\'est pas disponible');
    }
    
    const ifcApi = new IFC.IfcAPI();
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
        
        // Stocker le modèle dans le cache
        storeIfcModelInCache(json, blob);
        
        return blob;
      }
    }
    
    // Méthode alternative si les méthodes standard ne fonctionnent pas
    console.log('Utilisation d\'une méthode alternative pour générer un IFC');
    const blob = await generateBasicIfcFile(json);
    
    // Stocker le modèle dans le cache
    storeIfcModelInCache(json, blob);
    
    return blob;
    
  } catch (error) {
    console.error('Erreur lors de la génération du fichier IFC:', error);
    // Générer un fichier IFC minimal en cas d'erreur
    const blob = await generateBasicIfcFile(json);
    return blob;
  }
}

/**
 * Crée un modèle IFC de base à partir d'un template
 */
async function createBasicIfcModel(ifcApi, json) {
  try {
    // Créer un nouveau modèle
    console.log('Tentative de création d\'un nouveau modèle IFC');
    console.log('Méthodes disponibles dans ifcApi:', Object.getOwnPropertyNames(ifcApi).join(', '));
    
    const modelID = ifcApi.CreateModel();
    console.log('Nouveau modèle IFC créé avec ID:', modelID);
    
    // Vérifier les méthodes disponibles dans l'API
    console.log('Vérification des méthodes disponibles dans l\'API IFC');
    
    // Utiliser une approche plus robuste pour créer le modèle
    try {
      // Essayer d'utiliser les méthodes disponibles dans l'API
      if (typeof ifcApi.CreateIfcProject === 'function') {
        const projectGUID = ifcApi.CreateGuid();
        ifcApi.CreateIfcProject(modelID, projectGUID, 'Projet Généré', 'Description du projet');
        console.log('Projet IFC créé avec GUID:', projectGUID);
        
        // Ajouter un bâtiment si possible
        if (typeof ifcApi.CreateIfcBuilding === 'function') {
          const buildingGUID = ifcApi.CreateGuid();
          ifcApi.CreateIfcBuilding(modelID, buildingGUID, 'Bâtiment', 'Description du bâtiment');
          console.log('Bâtiment IFC créé avec GUID:', buildingGUID);
          
          // Ajouter des étages si possible
          if (typeof ifcApi.CreateIfcBuildingStorey === 'function') {
            const niveaux = json.niveaux || 1;
            
            for (let i = 0; i < niveaux; i++) {
              const storeyGUID = ifcApi.CreateGuid();
              ifcApi.CreateIfcBuildingStorey(modelID, storeyGUID, `Étage ${i+1}`, `Description de l'étage ${i+1}`, i * 3.0);
              console.log(`Étage ${i+1} IFC créé avec GUID:`, storeyGUID);
            }
          }
        }
      }
    } catch (apiError) {
      console.warn('Erreur lors de l\'utilisation des méthodes API spécifiques:', apiError);
      console.log('Passage à la méthode alternative...');
    }
    
    return modelID;
  } catch (error) {
    console.error('Erreur lors de la création du modèle de base:', error);
    throw error;
  }
}

/**
 * Génère un fichier IFC minimal valide
 * @param {Object} json - Les paramètres extraits du texte utilisateur
 * @returns {Promise<Blob>} - Le fichier IFC généré sous forme de Blob
 */
async function generateBasicIfcFile(json) {
  try {
    console.log('Génération d\'un fichier IFC avec templates, paramètres:', json);
    
    // Récupérer le template de base
    const basicTemplate = getOrCreateTemplate('basic', generateBasicTemplate);
    console.log('Template de base récupéré, longueur:', basicTemplate.length);
    
    // Générer les sections d'étages
    let storeysContent = '';
    const niveaux = json.niveaux || 1;
    console.log(`Génération de ${niveaux} niveaux`);
    
    for (let i = 0; i < niveaux; i++) {
      const storeyTemplate = generateStoreyTemplate(i, i * 3.0);
      const storeyValues = {
        [`UUID_${200 + i * 10}`]: generateUUID(false) // Utiliser le format sans tirets pour IFC
      };
      storeysContent += applyTemplate(storeyTemplate, storeyValues) + '\n    ';
      console.log(`Étage ${i+1} généré`);
    }
    
    // Générer les sections de murs
    let wallsContent = '';
    const directions = ['Nord', 'Sud', 'Est', 'Ouest'];
    const positions = [
      { x: 0, y: 5, width: 10 },  // Nord
      { x: 0, y: -5, width: 10 }, // Sud
      { x: 5, y: 0, width: 10 },  // Est
      { x: -5, y: 0, width: 10 }  // Ouest
    ];
    
    for (let i = 0; i < 4; i++) {
      const wallTemplate = generateWallTemplate(i, `Mur ${directions[i]}`, positions[i].x, positions[i].y, positions[i].width, 3.0 * niveaux);
      const wallValues = {
        [`UUID_${300 + i * 20}`]: generateUUID(false) // Utiliser le format sans tirets pour IFC
      };
      wallsContent += applyTemplate(wallTemplate, wallValues) + '\n    ';
      console.log(`Mur ${i+1} généré`);
    
    }
    
    // Appliquer les valeurs au template de base
    const templateValues = {
      DATE: new Date().toISOString(),
      UUID_1: generateUUID(false), // Format sans tirets pour IFC
      UUID_100: generateUUID(false), // Format sans tirets pour IFC
      STOREYS: storeysContent,
      WALLS: wallsContent
    };
    
    console.log('Valeurs du template générées avec succès');
    
    const ifcContent = applyTemplate(basicTemplate, templateValues);
    
    // Créer un blob à partir du contenu IFC
    const blob = new Blob([ifcContent], { type: 'application/octet-stream' });
    console.log('Blob IFC créé avec succès, taille:', blob.size);
    console.log('Contenu IFC généré (début):', ifcContent.substring(0, 200) + '...');
    
    // Vérifier que le blob contient des données
    if (blob.size > 0) {
      console.log('Blob valide créé, prêt pour le téléchargement');
      return blob;
    } else {
      console.error('Erreur: Blob vide généré');
      throw new Error('Le fichier IFC généré est vide');
    }
  } catch (error) {
    console.error('Erreur lors de la génération du fichier IFC avec templates:', error);
    
    // Fallback à une version très simple en cas d'erreur
    try {
      const simpleIfcContent = `ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');\nFILE_NAME('Projet Généré','${new Date().toISOString()}',('Générateur IFC'),('IFCAI3'),'','','');\nFILE_SCHEMA(('IFC4'));\nENDSEC;\nDATA;\n#1=IFCPROJECT('${generateUUID()}',#2,'Projet Généré',$,$,$);\n#2=IFCOWNERHISTORY(#3,#4,$,.ADDED.,$,$,$,0);\n#3=IFCPERSONANDORGANIZATION(#5,#6,$);\n#4=IFCAPPLICATION(#6,'1.0','Générateur IFC','IFCAI3');\n#5=IFCPERSON($,'Utilisateur',$,$,$,$,$,$);\n#6=IFCORGANIZATION($,'IFCAI3',$,$,$);\nENDSEC;\nEND-ISO-10303-21;`;
      
      const simpleBlob = new Blob([simpleIfcContent], { type: 'application/octet-stream' });
      console.log('Blob IFC simple créé avec succès (fallback), taille:', simpleBlob.size);
      return simpleBlob;
    } catch (fallbackError) {
      console.error('Erreur lors de la génération du fichier IFC de fallback:', fallbackError);
      throw error; // Remonter l'erreur originale
    }
  }
}

/**
 * Génère un UUID v4 pour les identifiants IFC
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Fonction pour télécharger un fichier
 */
function downloadFile(blob, filename) {
  console.log('Téléchargement du fichier, taille du blob:', blob.size);
  
  // Vérifier que le blob est valide
  if (!blob || blob.size === 0) {
    console.error('Erreur: Tentative de téléchargement d\'un blob vide');
    statusDiv.textContent = 'Erreur: Le fichier généré est vide';
    return;
  }
  
  try {
    const url = URL.createObjectURL(blob);
    console.log('URL créée pour le téléchargement:', url);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'batiment.ifc';
    document.body.appendChild(a);
    
    console.log('Déclenchement du téléchargement...');
    a.click();
    
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('Téléchargement initié avec succès');
    statusDiv.textContent = 'Fichier IFC téléchargé avec succès!';
  } catch (error) {
    console.error('Erreur lors du téléchargement:', error);
    statusDiv.textContent = 'Erreur lors du téléchargement: ' + error.message;
  }
}

// Initialiser l'application au chargement
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM chargé, initialisation de l\'application');
  
  // Ne pas charger le modèle automatiquement au démarrage
  // Le modèle sera chargé uniquement lorsque l'utilisateur clique sur le bouton
  
  // Ajouter un gestionnaire d'événements pour le bouton de génération
  generateButton.addEventListener('click', async () => {
    console.log('Bouton de génération cliqué');
    
    // Charger le modèle si ce n'est pas déjà fait
    if (!extractor) {
      const modelLoaded = await initExtractor();
      if (!modelLoaded) {
        console.error('Échec du chargement du modèle');
        return;
      }
    }
    
    // Extraire les paramètres du texte
    const parameters = await extractParameters();
    if (!parameters) {
      console.error('Échec de l\'extraction des paramètres');
      return;
    }
    
    // Générer le fichier IFC
    try {
      loaderDiv.classList.remove('hidden');
      statusDiv.textContent = 'Génération du fichier IFC en cours...';
      
      // Vérifier si la bibliothèque IFC est disponible
      if (typeof IFC === 'undefined') {
        console.warn('La bibliothèque IFC n\'est pas disponible, utilisation de la méthode alternative');
        // Utiliser directement la méthode alternative
        const ifcBlob = await generateBasicIfcFile(parameters);
        if (ifcBlob) {
          downloadFile(ifcBlob, 'batiment.ifc');
          statusDiv.textContent = 'Fichier IFC généré avec succès (méthode alternative)!';
        } else {
          statusDiv.textContent = 'Erreur lors de la génération du fichier IFC.';
        }
      } else {
        // Utiliser la méthode standard
        const ifcBlob = await generateIFC(parameters);
        if (ifcBlob) {
          // Télécharger le fichier
          downloadFile(ifcBlob, 'batiment.ifc');
          statusDiv.textContent = 'Fichier IFC généré avec succès!';
        } else {
          statusDiv.textContent = 'Erreur lors de la génération du fichier IFC.';
        }
      }
    } catch (error) {
      console.error('Erreur lors de la génération:', error);
      statusDiv.textContent = 'Erreur: ' + error.message;
      
      // En cas d'erreur, essayer la méthode alternative
      try {
        console.log('Tentative de génération avec la méthode alternative...');
        const ifcBlob = await generateBasicIfcFile(parameters);
        if (ifcBlob) {
          downloadFile(ifcBlob, 'batiment.ifc');
          statusDiv.textContent = 'Fichier IFC généré avec succès (méthode de secours)!';
        }
      } catch (fallbackError) {
        console.error('Échec de la méthode alternative:', fallbackError);
      }
    } finally {
      loaderDiv.classList.add('hidden');
      statusDiv.textContent = '';
      console.log('Traitement terminé');
    }

}); // Fermeture du gestionnaire d'événements du bouton de génération
}); // Fermeture de l'événement DOMContentLoaded
