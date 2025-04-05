/**
 * Script de test pour vérifier le chargement du modèle T5-small
 */

console.log('Test de chargement de la bibliothèque transformers');

// Importer la bibliothèque transformers
const { pipeline } = require('@xenova/transformers');

// Fonction asynchrone pour tester le chargement du modèle
async function testModelLoading() {
  try {
    console.log('Tentative de chargement du modèle T5-small...');
    const extractor = await pipeline('text2text-generation', 't5-small', { quantized: true });
    console.log('Modèle T5-small chargé avec succès!');
    
    // Tester une extraction simple
    const question = "Quelle est la surface totale du bâtiment ?";
    const context = "Je veux construire une maison de 150 m² avec 3 chambres et 2 salles de bain.";
    const input = `${question}\nContexte: ${context}`;
    
    console.log('Test d\'extraction avec le texte:', input);
    const result = await extractor(input, { max_new_tokens: 50 });
    console.log('Résultat de l\'extraction:', result[0].generated_text);
    
    return true;
  } catch (error) {
    console.error('Erreur lors du chargement du modèle:', error);
    return false;
  }
}

// Exécuter le test
testModelLoading().then(success => {
  console.log('Test terminé avec succès:', success);
}).catch(error => {
  console.error('Erreur lors de l\'exécution du test:', error);
});