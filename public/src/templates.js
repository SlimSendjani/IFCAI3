/**
 * Fichier contenant les templates IFC prédéfinis pour optimiser la génération
 */

// Cache pour stocker les résultats intermédiaires
const templateCache = new Map();

/**
 * Récupère un template IFC du cache ou le crée s'il n'existe pas
 * @param {string} templateKey - Clé unique pour identifier le template
 * @param {Function} templateGenerator - Fonction pour générer le template si non présent dans le cache
 * @returns {string} - Le contenu du template IFC
 */
export function getOrCreateTemplate(templateKey, templateGenerator) {
  if (templateCache.has(templateKey)) {
    console.log(`Utilisation du template en cache pour: ${templateKey}`);
    return templateCache.get(templateKey);
  }
  
  console.log(`Création d'un nouveau template pour: ${templateKey}`);
  const template = templateGenerator();
  templateCache.set(templateKey, template);
  return template;
}

/**
 * Génère un template IFC de base
 * @returns {string} - Le contenu du template IFC de base
 */
export function generateBasicTemplate() {
  return `ISO-10303-21;
    HEADER;
    FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');
    FILE_NAME('Projet Généré','{{DATE}}',('Générateur IFC'),('IFCAI3'),'','','');
    FILE_SCHEMA(('IFC4'));
    ENDSEC;
    
    DATA;
    #1=IFCPROJECT('{{UUID_1}}',#2,'Projet Généré',$,$,#3);
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
    
    /* Bâtiment */
    #100=IFCBUILDING('{{UUID_100}}',#2,'Bâtiment',$,$,#101,$,$,.ELEMENT.,$,$,$);
    #101=IFCLOCALPLACEMENT($,#102);
    #102=IFCAXIS2PLACEMENT3D(#103,$,$);
    #103=IFCCARTESIANPOINT((0.0,0.0,0.0));
    
    /* Étages */
    {{STOREYS}}
    
    /* Murs */
    {{WALLS}}
    
    ENDSEC;
    END-ISO-10303-21;`;
}

/**
 * Génère un template d'étage pour un bâtiment
 * @param {number} index - Numéro de l'étage
 * @param {number} height - Hauteur de l'étage
 * @returns {string} - Le contenu du template d'étage
 */
export function generateStoreyTemplate(index, height) {
  const baseIndex = 200 + (index * 10);
  return `#${baseIndex}=IFCBUILDINGSTOREY('{{UUID_${baseIndex}}}',#2,'Étage ${index + 1}',$,$,#${baseIndex + 1},$,$,.ELEMENT.,${height});
    #${baseIndex + 1}=IFCLOCALPLACEMENT(#101,#${baseIndex + 2});
    #${baseIndex + 2}=IFCAXIS2PLACEMENT3D(#${baseIndex + 3},$,$);
    #${baseIndex + 3}=IFCCARTESIANPOINT((0.0,0.0,${index * 3.0}));`;
}

/**
 * Génère un template de mur
 * @param {number} index - Numéro du mur
 * @param {string} name - Nom du mur
 * @param {number} x - Position X du mur
 * @param {number} y - Position Y du mur
 * @param {number} width - Largeur du mur
 * @param {number} height - Hauteur du mur
 * @returns {string} - Le contenu du template de mur
 */
export function generateWallTemplate(index, name, x, y, width, height) {
  const baseIndex = 300 + (index * 20);
  return `#${baseIndex}=IFCWALL('{{UUID_${baseIndex}}}',#2,'${name}',$,$,#${baseIndex + 1},#${baseIndex + 10},$,.STANDARD.);
    #${baseIndex + 1}=IFCLOCALPLACEMENT(#201,#${baseIndex + 2});
    #${baseIndex + 2}=IFCAXIS2PLACEMENT3D(#${baseIndex + 3},$,$);
    #${baseIndex + 3}=IFCCARTESIANPOINT((${x},${y},0.0));
    #${baseIndex + 10}=IFCPRODUCTDEFINITIONSHAPE($,$,(#${baseIndex + 11}));
    #${baseIndex + 11}=IFCSHAPEREPRESENTATION(#20,'Body','SweptSolid',(#${baseIndex + 12}));
    #${baseIndex + 12}=IFCEXTRUDEDAREASOLID(#${baseIndex + 13},#${baseIndex + 14},#${baseIndex + 15},${height});
    #${baseIndex + 13}=IFCRECTANGLEPROFILEDEF(.AREA.,$,#${baseIndex + 16},${width},0.2);
    #${baseIndex + 14}=IFCAXIS2PLACEMENT3D(#${baseIndex + 17},$,$);
    #${baseIndex + 15}=IFCDIRECTION((0.0,0.0,1.0));
    #${baseIndex + 16}=IFCAXIS2PLACEMENT2D(#${baseIndex + 18},$);
    #${baseIndex + 17}=IFCCARTESIANPOINT((0.0,0.0,0.0));
    #${baseIndex + 18}=IFCCARTESIANPOINT((0.0,0.0));`;
}

/**
 * Remplace les placeholders dans un template avec des valeurs réelles
 * @param {string} template - Le template avec des placeholders
 * @param {Object} values - Les valeurs à insérer dans le template
 * @returns {string} - Le template avec les valeurs insérées
 */
export function applyTemplate(template, values) {
  let result = template;
  
  // Remplacer tous les placeholders par leurs valeurs
  for (const [key, value] of Object.entries(values)) {
    const placeholder = `{{${key}}}`;
    result = result.replace(new RegExp(placeholder, 'g'), value);
  }
  
  return result;
}

/**
 * Génère un UUID v4 pour les identifiants IFC
 */
export function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}