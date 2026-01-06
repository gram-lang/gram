"use strict";
/**
 * Ingredient Database
 * Stores physical properties of common ingredients for mass estimation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.INGREDIENT_DB = void 0;
exports.getIngredientData = getIngredientData;
// Top 50 Common Ingredients Data
// Densities are approximate averages.
// Internal Definition with Synonyms
const RAW_ENTRIES = [
    // Basic Baking
    { names: ['flour', 'all-purpose flour', 'wheat flour'], data: { density: 0.53, macros: { calories: 364, protein: 10, carbs: 76, fat: 1, sugar: 0.3, fiber: 2.7, salt: 0 } } },
    { names: ['sugar', 'white sugar', 'granulated sugar'], data: { density: 0.85, macros: { calories: 387, protein: 0, carbs: 100, fat: 0, sugar: 100, fiber: 0, salt: 0 } } },
    { names: ['brown sugar'], data: { density: 0.93, macros: { calories: 380, protein: 0, carbs: 98, fat: 0, sugar: 97, fiber: 0, salt: 0.04 } } },
    { names: ['powdered sugar', 'icing sugar'], data: { density: 0.56, macros: { calories: 389, protein: 0, carbs: 100, fat: 0 } } },
    { names: ['butter'], data: { density: 0.911, macros: { calories: 717, protein: 0.85, carbs: 0.06, fat: 81 } } },
    { names: ['oil', 'vegetable oil', 'olive oil'], data: { density: 0.92, macros: { calories: 884, protein: 0, carbs: 0, fat: 100 } } },
    { names: ['milk', 'whole milk'], data: { density: 1.03, macros: { calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3 } } },
    { names: ['water'], data: { density: 1.0, macros: { calories: 0, protein: 0, carbs: 0, fat: 0 } } },
    { names: ['salt', 'sea salt'], data: { density: 1.2, macros: { calories: 0, protein: 0, carbs: 0, fat: 0, salt: 100 } } },
    { names: ['yeast', 'active dry yeast'], data: { density: 0.95, macros: { calories: 325, protein: 40, carbs: 41, fat: 7 } } },
    { names: ['baking powder'], data: { density: 0.9, macros: { calories: 53, protein: 0, carbs: 28, fat: 0 } } },
    { names: ['baking soda'], data: { density: 1.2, macros: { calories: 0, protein: 0, carbs: 0, fat: 0 } } },
    { names: ['cocoa powder', 'cocoa'], data: { density: 0.44, macros: { calories: 228, protein: 20, carbs: 58, fat: 14 } } },
    { names: ['honey'], data: { density: 1.42, macros: { calories: 304, protein: 0.3, carbs: 82, fat: 0 } } },
    { names: ['maple syrup'], data: { density: 1.37, macros: { calories: 260, protein: 0, carbs: 67, fat: 0 } } },
    { names: ['cream', 'heavy cream'], data: { density: 1.01, macros: { calories: 340, protein: 2.8, carbs: 2.7, fat: 36 } } },
    { names: ['vanilla extract'], data: { density: 0.88, macros: { calories: 288, protein: 0, carbs: 13, fat: 0 } } }, // Alcohol based
    { names: ['cornstarch', 'corn flour'], data: { density: 0.65, macros: { calories: 381, protein: 0.3, carbs: 91, fat: 0.1 } } },
    { names: ['almond flour', 'ground almonds'], data: { density: 0.45, macros: { calories: 579, protein: 21, carbs: 22, fat: 50 } } },
    { names: ['chocolate chips', 'chocolate'], data: { density: 0.7, macros: { calories: 546, protein: 6, carbs: 61, fat: 31 } } }, // loose pack
    { names: ['cheese', 'cheddar'], data: { density: 0.6, macros: { calories: 403, protein: 25, carbs: 1.3, fat: 33 } } },
    // Produce
    { names: ['egg', 'eggs'], data: { density: 1.03, unit_weight: 55, yield: 0.88, macros: { calories: 143, protein: 12.6, carbs: 0.7, fat: 9.5 } } }, // Net values
    { names: ['egg yolk', 'egg yolks', 'yolk', 'yolks'], data: { density: 1.03, unit_weight: 18, macros: { calories: 322, protein: 16, carbs: 3.6, fat: 27 } } },
    { names: ['egg white', 'egg whites', 'white', 'whites'], data: { density: 1.03, unit_weight: 33, macros: { calories: 52, protein: 11, carbs: 0.7, fat: 0.2 } } },
    { names: ['lemon', 'lemons'], data: { density: 1.0, unit_weight: 120, yield: 0.50, macros: { calories: 29, protein: 1.1, carbs: 9, fat: 0.3 } } },
    { names: ['lemon juice', 'juice'], data: { density: 1.04, unit_weight: 45, macros: { calories: 22, protein: 0.35, carbs: 6.9, fat: 0.2 } } },
    { names: ['lemon zest', 'zest'], data: { density: 0.5, unit_weight: 3, macros: { calories: 47, protein: 1.5, carbs: 16, fat: 0.3 } } },
    { names: ['lime', 'limes'], data: { density: 1.0, unit_weight: 60, yield: 0.55, macros: { calories: 30, protein: 0.7, carbs: 11, fat: 0.2 } } },
    { names: ['onion', 'onions', 'yellow onion'], data: { density: 0.7, unit_weight: 150, yield: 0.90, macros: { calories: 40, protein: 1.1, carbs: 9.3, fat: 0.1 } } },
    { names: ['red onion', 'red onions'], data: { density: 0.7, unit_weight: 150, yield: 0.90, macros: { calories: 40, protein: 1.1, carbs: 9.3, fat: 0.1 } } },
    { names: ['garlic', 'garlic clove', 'garlic cloves'], data: { density: 0.6, unit_weight: 5, yield: 0.85, macros: { calories: 149, protein: 6.4, carbs: 33, fat: 0.5 } } },
    { names: ['carrot', 'carrots'], data: { density: 0.7, unit_weight: 100, yield: 0.80, macros: { calories: 41, protein: 0.9, carbs: 9.6, fat: 0.2, sugar: 4.7, fiber: 2.8, salt: 0.1 } } },
    { names: ['potato', 'potatoes', 'russet potato'], data: { density: 0.77, unit_weight: 200, yield: 0.80, macros: { calories: 77, protein: 2, carbs: 17, fat: 0.1, sugar: 0.8, fiber: 2.2, salt: 0 } } },
    { names: ['apple', 'apples'], data: { density: 0.6, unit_weight: 180, yield: 0.75, macros: { calories: 52, protein: 0.3, carbs: 14, fat: 0.2, sugar: 10, fiber: 2.4, salt: 0 } } },
    { names: ['banana', 'bananas'], data: { density: 0.9, unit_weight: 120, yield: 0.65, macros: { calories: 89, protein: 1.1, carbs: 23, fat: 0.3, sugar: 12, fiber: 2.6, salt: 0 } } },
    { names: ['tomato', 'tomatoes'], data: { density: 0.95, unit_weight: 120, yield: 0.91, macros: { calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2, sugar: 2.6, fiber: 1.2, salt: 0.01 } } },
    { names: ['canned tomatoes', 'canned tomato'], data: { density: 1.1, macros: { calories: 32, protein: 1.6, carbs: 7.3, fat: 0.3 } } },
    { names: ['bell pepper', 'red bell pepper', 'green bell pepper'], data: { density: 0.5, unit_weight: 150, yield: 0.82, macros: { calories: 26, protein: 1, carbs: 6, fat: 0.3 } } },
    { names: ['chili', 'chili pepper', 'espelette pepper'], data: { density: 0.5, unit_weight: 15, yield: 0.85, macros: { calories: 40, protein: 1.9, carbs: 9, fat: 0.4 } } },
    { names: ['ginger'], data: { density: 0.9, unit_weight: 30, yield: 0.75, macros: { calories: 80, protein: 1.8, carbs: 18, fat: 0.8 } } },
    { names: ['spinach'], data: { density: 0.1, unit_weight: 300, yield: 0.90, macros: { calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4 } } },
    // Meat & Protein
    { names: ['chicken', 'chicken breast'], data: { density: 1.05, unit_weight: 200, macros: { calories: 165, protein: 31, carbs: 0, fat: 3.6 } } },
    { names: ['chicken thigh', 'chicken thighs'], data: { density: 1.05, unit_weight: 120, macros: { calories: 209, protein: 26, carbs: 0, fat: 10.9 } } },
    { names: ['beef', 'ground beef', 'steak'], data: { density: 1.05, macros: { calories: 250, protein: 26, carbs: 0, fat: 17 } } },
    { names: ['pork', 'pork chop'], data: { density: 1.05, unit_weight: 150, macros: { calories: 242, protein: 27, carbs: 0, fat: 14 } } },
    { names: ['bacon'], data: { density: 0.5, macros: { calories: 541, protein: 37, carbs: 1.4, fat: 42 } } },
    { names: ['tofu'], data: { density: 0.95, macros: { calories: 76, protein: 8.1, carbs: 1.9, fat: 4.8 } } },
    // Spices
    { names: ['pepper', 'black pepper', 'ground pepper'], data: { density: 0.5, macros: { calories: 251, protein: 10, carbs: 64, fat: 3.3 } } },
    { names: ['cinnamon'], data: { density: 0.55, macros: { calories: 247, protein: 4, carbs: 81, fat: 1.2 } } },
    { names: ['paprika'], data: { density: 0.45, macros: { calories: 282, protein: 14, carbs: 54, fat: 13 } } },
    { names: ['cumin'], data: { density: 0.45, macros: { calories: 375, protein: 18, carbs: 44, fat: 22 } } },
    { names: ['turmeric'], data: { density: 0.6, macros: { calories: 354, protein: 8, carbs: 65, fat: 10 } } },
    // Stocks & Sauces
    { names: ['stock', 'chicken stock', 'beef stock', 'vegetable stock', 'broth'], data: { density: 1.01, macros: { calories: 15, protein: 2, carbs: 1, fat: 0.5 } } },
    { names: ['mayonnaise'], data: { density: 0.92, macros: { calories: 680, protein: 1, carbs: 1, fat: 75 } } },
    { names: ['mustard'], data: { density: 1.05, macros: { calories: 66, protein: 4, carbs: 8, fat: 4 } } },
    { names: ['ketchup'], data: { density: 1.15, macros: { calories: 111, protein: 1, carbs: 26, fat: 0 } } },
    // Grains
    { names: ['rice'], data: { density: 0.85, macros: { calories: 360, protein: 7, carbs: 80, fat: 0.7 } } }, // raw
    { names: ['basmati rice'], data: { density: 0.85, macros: { calories: 350, protein: 8, carbs: 77, fat: 0.5 } } },
    { names: ['oats', 'rolled oats'], data: { density: 0.4, macros: { calories: 389, protein: 17, carbs: 66, fat: 7 } } },
    { names: ['pasta', 'spaghetti'], data: { density: 1.3, macros: { calories: 371, protein: 13, carbs: 75, fat: 1.5 } } }, // raw
    // Liquids
    { names: ['wine', 'red wine', 'white wine'], data: { density: 0.99 } },
    { names: ['vinegar'], data: { density: 1.01 } },
    { names: ['soy sauce'], data: { density: 1.13 } },
    { names: ['maple syrup'], data: { density: 1.32 } }
];
// Generate the fast lookup map efficiently
exports.INGREDIENT_DB = {};
RAW_ENTRIES.forEach(entry => {
    entry.names.forEach(name => {
        exports.INGREDIENT_DB[name] = entry.data;
    });
});
function getIngredientData(name) {
    const slug = name.toLowerCase().trim();
    // Direct match
    if (exports.INGREDIENT_DB[slug])
        return exports.INGREDIENT_DB[slug];
    // Simple singularization fallback (very naive)
    if (slug.endsWith('s') && exports.INGREDIENT_DB[slug.slice(0, -1)]) {
        return exports.INGREDIENT_DB[slug.slice(0, -1)];
    }
    return null;
}
