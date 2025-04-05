/**
 * Module de gestion du cache pour les modèles IFC
 */

// Cache pour stocker les modèles IFC générés
const ifcModelCache = new Map();

// Cache pour stocker les résultats d'extraction de paramètres
const extractionCache = new Map();

/**
 * Génère une clé de cache basée sur le texte d'entrée
 * @param {string} inputText - Le texte d'entrée de l'utilisateur
 * @returns {string} - La clé de cache
 */
function generateCacheKey(inputText) {
  // Simplifier le texte pour la mise en cache (enlever espaces supplémentaires, mettre en minuscules)
  return inputText.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Vérifie si un résultat d'extraction existe dans le cache
 * @param {string} inputText - Le texte d'entrée de l'utilisateur
 * @returns {Object|null} - Les paramètres extraits ou null si non trouvés
 */
export function getExtractedParamsFromCache(inputText) {
  const cacheKey = generateCacheKey(inputText);
  if (extractionCache.has(cacheKey)) {
    console.log('Paramètres trouvés dans le cache');
    return extractionCache.get(cacheKey);
  }
  return null;
}

/**
 * Stocke les paramètres extraits dans le cache
 * @param {string} inputText - Le texte d'entrée de l'utilisateur
 * @param {Object} params - Les paramètres extraits
 */
export function storeExtractedParamsInCache(inputText, params) {
  const cacheKey = generateCacheKey(inputText);
  console.log('Stockage des paramètres dans le cache');
  extractionCache.set(cacheKey, params);
}

/**
 * Vérifie si un modèle IFC existe dans le cache
 * @param {Object} params - Les paramètres du bâtiment
 * @returns {Blob|null} - Le blob IFC ou null si non trouvé
 */
export function getIfcModelFromCache(params) {
  const cacheKey = JSON.stringify(params);
  if (ifcModelCache.has(cacheKey)) {
    console.log('Modèle IFC trouvé dans le cache');
    return ifcModelCache.get(cacheKey);
  }
  return null;
}

/**
 * Stocke un modèle IFC dans le cache
 * @param {Object} params - Les paramètres du bâtiment
 * @param {Blob} ifcBlob - Le blob IFC généré
 */
export function storeIfcModelInCache(params, ifcBlob) {
  const cacheKey = JSON.stringify(params);
  console.log('Stockage du modèle IFC dans le cache');
  ifcModelCache.set(cacheKey, ifcBlob);
}

/**
 * Nettoie le cache si nécessaire (limite la taille)
 * @param {number} maxSize - Taille maximale du cache
 */
export function cleanCache(maxSize = 10) {
  // Limiter la taille du cache d'extraction
  if (extractionCache.size > maxSize) {
    console.log('Nettoyage du cache d\'extraction');
    const keys = Array.from(extractionCache.keys());
    for (let i = 0; i < keys.length - maxSize; i++) {
      extractionCache.delete(keys[i]);
    }
  }
  
  // Limiter la taille du cache de modèles IFC
  if (ifcModelCache.size > maxSize) {
    console.log('Nettoyage du cache de modèles IFC');
    const keys = Array.from(ifcModelCache.keys());
    for (let i = 0; i < keys.length - maxSize; i++) {
      ifcModelCache.delete(keys[i]);
    }
  }
}