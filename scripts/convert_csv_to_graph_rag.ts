import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// RFC 4180 compliant CSV parser that supports multiline fields and quotes
export function parseCSV(content: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  // Strip UTF-8 BOM if present
  if (content.charCodeAt(0) === 0xfeff) content = content.slice(1);
  const len = content.length;

  while (i < len) {
    const c = content[i];
    if (inQuotes) {
      if (c === '"') {
        if (i + 1 < len && content[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        field += c;
        i++;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
        i++;
      } else if (c === ',') {
        row.push(field);
        field = '';
        i++;
      } else if (c === '\r') {
        if (i + 1 < len && content[i + 1] === '\n') i++;
        row.push(field);
        records.push(row);
        row = [];
        field = '';
        i++;
      } else if (c === '\n') {
        row.push(field);
        records.push(row);
        row = [];
        field = '';
        i++;
      } else {
        field += c;
        i++;
      }
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    records.push(row);
  }

  return records;
}

// Common Non-Veg keywords for strict FSSAI / vegetarian filtering
const NON_VEG_KEYWORDS = [
  'chicken', 'mutton', 'lamb', 'pork', 'beef', 'fish', 'prawn', 'shrimp', 'crab',
  'lobster', 'egg', 'eggs', 'keema', 'bacon', 'ham', 'sausage', 'turkey', 'duck',
  'gelatin', 'squid', 'anchovy', 'rohu', 'katla', 'hilsa', 'pomfret'
];

// Equipment detector keywords
const EQUIPMENT_KEYWORDS: Record<string, string[]> = {
  pressure_cooker: ['pressure cooker', 'cooker', 'whistle', 'whistles'],
  kadhai_pan: ['kadhai', 'kadai', 'pan', 'skillet', 'heavy bottomed pan', 'saucepan', 'wok'],
  mixer_grinder: ['mixer', 'grinder', 'blend', 'blender', 'puree', 'paste', 'grind'],
  tawa: ['tawa', 'griddle', 'roti', 'dosa', 'paratha'],
  microwave: ['microwave'],
  oven: ['oven', 'bake', 'baking', 'preheat'],
  steamer: ['steamer', 'idli steamer', 'steam', 'idli maker'],
  kettle: ['kettle', 'boil water']
};

// Unit normalizer to base units (g, ml, pcs)
export function normalizeUnitAndQty(rawText: string): { name: string; qty: number; unit: 'g' | 'ml' | 'pcs' } {
  const clean = rawText.trim();
  const lowerClean = clean.toLowerCase();

  // Handle "to taste", "as needed", or "swadanusar" (e.g. "salt to taste", "namak swadanusar")
  if (
    lowerClean.includes('to taste') ||
    lowerClean.includes('swadanusar') ||
    lowerClean.includes('as needed') ||
    lowerClean.includes('as per taste')
  ) {
    let name = clean
      .replace(/to taste/gi, '')
      .replace(/swadanusar/gi, '')
      .replace(/as needed/gi, '')
      .replace(/as per taste/gi, '')
      .replace(/^[-–—:\s,]+|[-–—:\s,]+$/g, '')
      .trim();
    name = name.split('-')[0].replace(/\([^)]*\)/g, '').trim();
    return {
      name: name || 'Salt',
      qty: 2,
      unit: 'g',
    };
  }

  // Handle pinch / pinches (e.g. "pinch of hing", "1 pinch turmeric", "a pinch of salt")
  if (lowerClean.includes('pinch')) {
    const pinchMatch = clean.match(/^([0-9\/\.\-\s]+)?\s*(?:pinch|pinches)\s*(?:of\s+)?(.*)$/i);
    let name = pinchMatch ? pinchMatch[2] : clean.replace(/pinch(?:es)?(?:\s+of)?/gi, '');
    name = (name || '').replace(/^[-–—:\s,]+|[-–—:\s,]+$/g, '').trim();
    name = name.split('-')[0].replace(/\([^)]*\)/g, '').trim();
    return {
      name: name || 'Spice',
      qty: 1,
      unit: 'g',
    };
  }

  // Match patterns like: 2-1/2 cups, 500 grams, 1 teaspoon, 2 tablespoon, 1 Onion
  const match = clean.match(/^([0-9\/\.\-\s]+)?\s*(cup|cups|tablespoon|tablespoons|tbsp|teaspoon|teaspoons|tsp|gram|grams|g|gm|gms|kg|kilogram|ml|milliliter|liter|litre|l|sprig|sprigs|clove|cloves|inch|inches|bunch|bunches|piece|pieces|slice|slices)?\s*(?:of\s+)?(.*)$/i);

  let qty = 1;
  let unit: 'g' | 'ml' | 'pcs' = 'pcs';
  let name = clean;

  if (match) {
    const qtyStr = match[1]?.trim();
    const unitStr = match[2]?.toLowerCase()?.trim();
    name = (match[3] || clean).replace(/^[-–—:\s]+/, '').trim();

    if (qtyStr) {
      if (qtyStr.includes('/')) {
        const parts = qtyStr.split('-');
        if (parts.length === 2 && parts[1].includes('/')) {
          const whole = parseFloat(parts[0]) || 0;
          const [num, den] = parts[1].split('/').map(Number);
          qty = whole + (den ? num / den : 0);
        } else {
          const [num, den] = qtyStr.split('/').map(Number);
          qty = den ? num / den : 1;
        }
      } else {
        qty = parseFloat(qtyStr) || 1;
      }
    }

    const nameLower = name.toLowerCase();
    const isLiquid = ['oil', 'tel', 'water', 'pani', 'milk', 'doodh', 'ghee', 'curd', 'dahi'].some((k) => nameLower.includes(k));
    const isFlour = ['flour', 'atta', 'maida', 'besan', 'sooji', 'rava'].some((k) => nameLower.includes(k));
    const isSpice = ['salt', 'namak', 'haldi', 'turmeric', 'jeera', 'cumin', 'hing', 'mirch', 'masala', 'mustard', 'rai', 'cinnamon', 'clove', 'elaichi'].some((k) => nameLower.includes(k));

    if (unitStr) {
      if (['cup', 'cups'].includes(unitStr)) {
        if (isLiquid) {
          qty = qty * 240;
          unit = 'ml';
        } else if (isFlour) {
          qty = qty * 120;
          unit = 'g';
        } else {
          qty = qty * 200;
          unit = 'g';
        }
      } else if (['tablespoon', 'tablespoons', 'tbsp'].includes(unitStr)) {
        qty = qty * (isLiquid ? 15 : 12);
        unit = isLiquid ? 'ml' : 'g';
      } else if (['teaspoon', 'teaspoons', 'tsp'].includes(unitStr)) {
        qty = qty * 5;
        unit = isLiquid ? 'ml' : 'g';
      } else if (['kg', 'kilogram'].includes(unitStr)) {
        qty = qty * 1000;
        unit = 'g';
      } else if (['gram', 'grams', 'g', 'gm', 'gms'].includes(unitStr)) {
        unit = 'g';
      } else if (['liter', 'litre', 'l'].includes(unitStr)) {
        qty = qty * 1000;
        unit = 'ml';
      } else if (['ml', 'milliliter'].includes(unitStr)) {
        unit = 'ml';
      } else if (isSpice) {
        qty = Math.max(1, qty * 2);
        unit = 'g';
      } else {
        unit = 'pcs';
      }
    } else if (isSpice) {
      qty = Math.max(1, qty * 2);
      unit = 'g';
    }
  }

  // Remove trailing descriptions like "- chopped", "(Haldi)", etc. for cleaner canonical naming
  let canonicalName = name.split('-')[0].trim();
  canonicalName = canonicalName.replace(/\([^)]*\)/g, '').trim();

  return {
    name: canonicalName || name,
    qty: Math.max(0.5, Math.round(qty * 10) / 10),
    unit
  };
}

export function detectIsNonVeg(text: string): boolean {
  const lower = text.toLowerCase();
  return NON_VEG_KEYWORDS.some((kw) => {
    // Word boundary check
    const regex = new RegExp(`\\b${kw}\\b`, 'i');
    return regex.test(lower);
  });
}

export interface GraphRecipeNode {
  id: string;
  srno: number;
  name: string;
  translatedName: string;
  prepTime: number;
  cookTime: number;
  totalTime: number;
  servings: number;
  cuisine: string;
  course: string;
  diet: string;
  isNonVeg: boolean;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  equipment: string[];
  instructions: string;
  translatedInstructions: string;
  url: string;
  ingredients: {
    raw: string;
    name: string;
    canonicalId: string;
    qty_base: number;
    unit_base: 'g' | 'ml' | 'pcs';
    isNonVeg: boolean;
  }[];
  nutrientsEstimated: {
    kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    sodium_mg: number;
  };
}

export interface GraphIngredientNode {
  id: string;
  name: string;
  isNonVeg: boolean;
  category: string;
  recipeCount: number;
  storagePlace: 'pantry' | 'fridge';
  shelfLifeDays: number;
}

export interface GraphRAGOutput {
  version: string;
  generatedAt: string;
  stats: {
    totalRecipes: number;
    totalIngredients: number;
    totalEdges: number;
    vegRecipesCount: number;
    nonVegRecipesCount: number;
    beginnerRecipesCount: number;
  };
  recipes: GraphRecipeNode[];
  ingredients: Record<string, GraphIngredientNode>;
  // Graph indices for high-performance Graph RAG retrieval
  indices: {
    ingredientToRecipes: Record<string, string[]>;
    cuisineToRecipes: Record<string, string[]>;
    courseToRecipes: Record<string, string[]>;
    dietToRecipes: Record<string, string[]>;
    difficultyToRecipes: Record<string, string[]>;
    equipmentToRecipes: Record<string, string[]>;
    ingredientCoOccurrence: Record<string, Record<string, number>>;
    recipeSimilarities: Record<string, string[]>;
  };
}

export function buildGraphRAG(csvContent: string, maxRows?: number): GraphRAGOutput {
  const records = parseCSV(csvContent);
  if (records.length < 2) {
    throw new Error('CSV is empty or does not contain header and data rows');
  }

  const header = records[0].map((h) => h.trim());
  const colIndex: Record<string, number> = {};
  header.forEach((col, idx) => {
    colIndex[col] = idx;
  });

  const getVal = (row: string[], colName: string): string => {
    const idx = colIndex[colName];
    return idx !== undefined && row[idx] ? row[idx].trim() : '';
  };

  const recipeNodes: GraphRecipeNode[] = [];
  const ingredientMap: Record<string, GraphIngredientNode> = {};
  const ingredientToRecipes: Record<string, string[]> = {};
  const cuisineToRecipes: Record<string, string[]> = {};
  const courseToRecipes: Record<string, string[]> = {};
  const dietToRecipes: Record<string, string[]> = {};
  const difficultyToRecipes: Record<string, string[]> = {
    beginner: [],
    intermediate: [],
    advanced: []
  };
  const equipmentToRecipes: Record<string, string[]> = {};
  const ingredientCoOccurrence: Record<string, Record<string, number>> = {};
  const recipeIngredientSets: Record<string, Set<string>> = {};

  let vegCount = 0;
  let nonVegCount = 0;
  let beginnerCount = 0;

  const dataRows = records.slice(1);
  const rowsToProcess = maxRows ? dataRows.slice(0, maxRows) : dataRows;

  console.log(`Processing ${rowsToProcess.length} recipe rows from dataset...`);

  for (let idx = 0; idx < rowsToProcess.length; idx++) {
    const row = rowsToProcess[idx];
    if (!row || row.length < 5) continue;

    const srno = parseInt(getVal(row, 'Srno')) || idx + 1;
    const name = getVal(row, 'RecipeName') || `Recipe ${srno}`;
    const translatedName = getVal(row, 'TranslatedRecipeName') || name;
    const rawIngredients = getVal(row, 'TranslatedIngredients') || getVal(row, 'Ingredients');
    const prepTime = parseInt(getVal(row, 'PrepTimeInMins')) || 15;
    const cookTime = parseInt(getVal(row, 'CookTimeInMins')) || 25;
    const totalTime = parseInt(getVal(row, 'TotalTimeInMins')) || (prepTime + cookTime);
    const servings = parseInt(getVal(row, 'Servings')) || 2;
    const cuisine = getVal(row, 'Cuisine') || 'Indian';
    const course = getVal(row, 'Course') || 'Main Course';
    const diet = getVal(row, 'Diet') || 'Vegetarian';
    const instructions = getVal(row, 'Instructions');
    const translatedInstructions = getVal(row, 'TranslatedInstructions') || instructions;
    const url = getVal(row, 'URL');

    const recipeId = `rec_${srno}`;

    // Detect non-veg status strictly
    let isNonVeg = diet.toLowerCase().includes('non veg') || diet.toLowerCase().includes('non-veg') || diet.toLowerCase().includes('eggetarian');
    if (!isNonVeg) {
      isNonVeg = detectIsNonVeg(name) || detectIsNonVeg(translatedName) || detectIsNonVeg(rawIngredients);
    }

    // Equipment detection
    const allText = `${instructions} ${translatedInstructions} ${name} ${rawIngredients}`.toLowerCase();
    const equipment: string[] = [];
    for (const [eq, keywords] of Object.entries(EQUIPMENT_KEYWORDS)) {
      if (keywords.some((kw) => allText.includes(kw))) {
        equipment.push(eq);
      }
    }
    if (equipment.length === 0) {
      equipment.push('kadhai_pan');
    }

    // Parse ingredients
    const rawList = rawIngredients
      .split(/,(?![^()]*\))/)
      .map((s) => s.trim())
      .filter(Boolean);

    const parsedIngredients: GraphRecipeNode['ingredients'] = [];
    const recipeIngIdSet = new Set<string>();

    for (const raw of rawList) {
      const { name: ingName, qty, unit } = normalizeUnitAndQty(raw);
      if (!ingName) continue;

      const ingIsNonVeg = detectIsNonVeg(ingName) || detectIsNonVeg(raw);
      if (ingIsNonVeg) isNonVeg = true;

      const slug = ingName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 30);
      const canonicalId = `ing_${slug || 'item'}`;

      parsedIngredients.push({
        raw,
        name: ingName,
        canonicalId,
        qty_base: qty,
        unit_base: unit,
        isNonVeg: ingIsNonVeg
      });

      recipeIngIdSet.add(canonicalId);

      // Add to ingredient map
      if (!ingredientMap[canonicalId]) {
        let category = 'vegetable';
        const lName = ingName.toLowerCase();
        if (ingIsNonVeg) category = 'meat_poultry';
        else if (['dal', 'lentil', 'chana', 'rajma', 'urad', 'moong', 'toor'].some((w) => lName.includes(w))) category = 'pulse';
        else if (['rice', 'chawal', 'wheat', 'atta', 'flour', 'ragi', 'millet', 'sooji', 'poha', 'noodle', 'vermicelli'].some((w) => lName.includes(w))) category = 'grain';
        else if (['milk', 'curd', 'dahi', 'paneer', 'cheese', 'ghee', 'butter', 'cream', 'yogurt'].some((w) => lName.includes(w))) category = 'dairy';
        else if (['oil', 'mustard oil', 'sunflower oil', 'sesame oil'].some((w) => lName.includes(w))) category = 'fat_oil';
        else if (['turmeric', 'chilli', 'cumin', 'coriander', 'jeera', 'garam masala', 'salt', 'pepper', 'asafoetida', 'hing', 'methi', 'mustard'].some((w) => lName.includes(w))) category = 'spice';
        else if (['mint', 'coriander leaves', 'curry leaves', 'kasuri methi', 'ginger', 'garlic'].some((w) => lName.includes(w))) category = 'herb';

        const isCold = ['dairy', 'meat_poultry'].includes(category) || ['tomato', 'palak', 'spinach', 'coriander leaves', 'mint leaves'].some((w) => lName.includes(w));

        ingredientMap[canonicalId] = {
          id: canonicalId,
          name: ingName,
          isNonVeg: ingIsNonVeg,
          category,
          recipeCount: 0,
          storagePlace: isCold ? 'fridge' : 'pantry',
          shelfLifeDays: isCold ? 5 : 45
        };
      }

      ingredientMap[canonicalId].recipeCount += 1;

      if (!ingredientToRecipes[canonicalId]) {
        ingredientToRecipes[canonicalId] = [];
      }
      ingredientToRecipes[canonicalId].push(recipeId);
    }

    recipeIngredientSets[recipeId] = recipeIngIdSet;

    // Track co-occurrences
    const ingArray = Array.from(recipeIngIdSet);
    for (let a = 0; a < ingArray.length; a++) {
      for (let b = a + 1; b < ingArray.length; b++) {
        const i1 = ingArray[a];
        const i2 = ingArray[b];
        if (!ingredientCoOccurrence[i1]) ingredientCoOccurrence[i1] = {};
        if (!ingredientCoOccurrence[i2]) ingredientCoOccurrence[i2] = {};
        ingredientCoOccurrence[i1][i2] = (ingredientCoOccurrence[i1][i2] || 0) + 1;
        ingredientCoOccurrence[i2][i1] = (ingredientCoOccurrence[i2][i1] || 0) + 1;
      }
    }

    // Determine difficulty
    const stepLines = (translatedInstructions || instructions).split(/\.|\n/).filter((s) => s.trim().length > 15);
    let difficulty: 'beginner' | 'intermediate' | 'advanced' = 'intermediate';
    if (cookTime <= 20 && totalTime <= 35 && parsedIngredients.length <= 8 && stepLines.length <= 6) {
      difficulty = 'beginner';
    } else if (cookTime > 45 || totalTime > 60 || parsedIngredients.length > 14) {
      difficulty = 'advanced';
    }

    // Estimate nutrition per serving
    let estKcal = 120;
    let estProtein = 4;
    let estCarbs = 18;
    let estFat = 3;

    if (diet.toLowerCase().includes('high protein') || parsedIngredients.some((i) => ['dal', 'paneer', 'chicken', 'egg', 'beans', 'soya'].some((k) => i.name.toLowerCase().includes(k)))) {
      estProtein = 16 + Math.round(Math.random() * 8);
      estKcal += 110;
    }
    if (parsedIngredients.some((i) => ['rice', 'chawal', 'potato', 'aloo', 'atta', 'bread', 'roti'].some((k) => i.name.toLowerCase().includes(k)))) {
      estCarbs += 28;
      estKcal += 130;
    }
    if (parsedIngredients.some((i) => ['oil', 'ghee', 'butter', 'cheese'].some((k) => i.name.toLowerCase().includes(k)))) {
      estFat += 6;
      estKcal += 60;
    }

    const node: GraphRecipeNode = {
      id: recipeId,
      srno,
      name,
      translatedName,
      prepTime,
      cookTime,
      totalTime,
      servings,
      cuisine,
      course,
      diet: isNonVeg ? 'Non Vegeterian' : diet,
      isNonVeg,
      difficulty,
      equipment,
      instructions,
      translatedInstructions,
      url,
      ingredients: parsedIngredients,
      nutrientsEstimated: {
        kcal: Math.round(estKcal),
        protein_g: Math.round(estProtein),
        carbs_g: Math.round(estCarbs),
        fat_g: Math.round(estFat),
        sodium_mg: Math.round(300 + Math.random() * 250)
      }
    };

    recipeNodes.push(node);

    if (isNonVeg) nonVegCount++;
    else vegCount++;
    if (difficulty === 'beginner') beginnerCount++;

    // Index mappings
    if (!cuisineToRecipes[cuisine]) cuisineToRecipes[cuisine] = [];
    cuisineToRecipes[cuisine].push(recipeId);

    if (!courseToRecipes[course]) courseToRecipes[course] = [];
    courseToRecipes[course].push(recipeId);

    if (!dietToRecipes[diet]) dietToRecipes[diet] = [];
    dietToRecipes[diet].push(recipeId);

    difficultyToRecipes[difficulty].push(recipeId);

    for (const eq of equipment) {
      if (!equipmentToRecipes[eq]) equipmentToRecipes[eq] = [];
      equipmentToRecipes[eq].push(recipeId);
    }
  }

  // Compute top similar recipes for each recipe (Graph Neighborhood edges)
  console.log('Computing graph neighborhood similarities for recipes...');
  const recipeSimilarities: Record<string, string[]> = {};
  for (let i = 0; i < Math.min(recipeNodes.length, 1000); i++) {
    const r1 = recipeNodes[i];
    const s1 = recipeIngredientSets[r1.id] || new Set();
    const scores: { id: string; score: number }[] = [];

    // Compare with neighboring recipes sharing at least one ingredient
    const candidateIds = new Set<string>();
    s1.forEach((ingId) => {
      (ingredientToRecipes[ingId] || []).slice(0, 30).forEach((candId) => {
        if (candId !== r1.id) candidateIds.add(candId);
      });
    });

    candidateIds.forEach((candId) => {
      const s2 = recipeIngredientSets[candId];
      if (!s2) return;
      let intersection = 0;
      s1.forEach((x) => {
        if (s2.has(x)) intersection++;
      });
      const union = s1.size + s2.size - intersection;
      const jaccard = union > 0 ? intersection / union : 0;
      if (jaccard > 0.25) {
        scores.push({ id: candId, score: jaccard });
      }
    });

    scores.sort((a, b) => b.score - a.score);
    recipeSimilarities[r1.id] = scores.slice(0, 5).map((s) => s.id);
  }

  const totalEdges =
    recipeNodes.reduce((acc, r) => acc + r.ingredients.length + r.equipment.length + 3, 0) +
    Object.values(recipeSimilarities).reduce((acc, list) => acc + list.length, 0);

  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    stats: {
      totalRecipes: recipeNodes.length,
      totalIngredients: Object.keys(ingredientMap).length,
      totalEdges,
      vegRecipesCount: vegCount,
      nonVegRecipesCount: nonVegCount,
      beginnerRecipesCount: beginnerCount
    },
    recipes: recipeNodes,
    ingredients: ingredientMap,
    indices: {
      ingredientToRecipes,
      cuisineToRecipes,
      courseToRecipes,
      dietToRecipes,
      difficultyToRecipes,
      equipmentToRecipes,
      ingredientCoOccurrence,
      recipeSimilarities
    }
  };
}

// CLI runner
async function main() {
  const args = process.argv.slice(2);
  const defaultInput = path.resolve(__dirname, '..', 'public', 'assets', 'aistudio', 'IndianFoodDatasetCSV_273f8d45.csv');
  const defaultOutput = path.resolve(__dirname, '..', 'public', 'data', 'graph_rag.json');

  const inputPath = args[0] && !args[0].startsWith('--') ? path.resolve(args[0]) : defaultInput;
  const outputPath = args[1] && !args[1].startsWith('--') ? path.resolve(args[1]) : defaultOutput;

  let limit: number | undefined;
  for (const arg of args) {
    if (arg.startsWith('--limit=')) {
      limit = parseInt(arg.replace('--limit=', ''), 10);
    }
  }

  console.log('=== Indian Food Dataset -> Graph RAG Converter ===');
  console.log(`Input CSV:  ${inputPath}`);
  console.log(`Output JSON: ${outputPath}`);
  if (limit) console.log(`Limit:       ${limit} records`);

  if (!fs.existsSync(inputPath)) {
    console.error(`Error: Input file does not exist at ${inputPath}`);
    process.exit(1);
  }

  const csvRaw = fs.readFileSync(inputPath, 'utf-8');
  console.log(`Read ${csvRaw.length} bytes from CSV.`);

  const startTime = Date.now();
  const graph = buildGraphRAG(csvRaw, limit);
  const duration = Date.now() - startTime;

  console.log(`Graph RAG built in ${duration}ms!`);
  console.log(`Recipes:      ${graph.stats.totalRecipes} (${graph.stats.vegRecipesCount} Veg, ${graph.stats.nonVegRecipesCount} Non-Veg)`);
  console.log(`Ingredients:  ${graph.stats.totalIngredients}`);
  console.log(`Total Edges:  ${graph.stats.totalEdges}`);
  console.log(`Beginner:     ${graph.stats.beginnerRecipesCount}`);

  // Ensure output directory exists
  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(graph), 'utf-8');
  console.log(`Saved Graph RAG JSON to ${outputPath} (${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB)`);

  // Also create a lightweight client-side seed copy in src/data/graph_rag_seed.json (with top 200 essential recipes for instant offline caching)
  const clientSeedPath = path.resolve(__dirname, '..', 'src', 'data', 'graph_rag_seed.json');
  const clientSeedDir = path.dirname(clientSeedPath);
  if (!fs.existsSync(clientSeedDir)) {
    fs.mkdirSync(clientSeedDir, { recursive: true });
  }

  const seedGraph = {
    ...graph,
    recipes: graph.recipes.slice(0, 300)
  };
  fs.writeFileSync(clientSeedPath, JSON.stringify(seedGraph), 'utf-8');
  console.log(`Saved client seed copy with 300 recipes to ${clientSeedPath}`);
}

if (process.argv[1] && process.argv[1].endsWith('convert_csv_to_graph_rag.ts')) {
  main().catch((err) => {
    console.error('Conversion failed:', err);
    process.exit(1);
  });
}
