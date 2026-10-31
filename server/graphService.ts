import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GraphRAGOutput, GraphRecipeNode, buildGraphRAG } from '../scripts/convert_csv_to_graph_rag';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class GraphRAGService {
  private graph: GraphRAGOutput | null = null;
  private isLoaded = false;

  constructor() {
    this.init();
  }

  public init() {
    const jsonPath = path.resolve(__dirname, '..', 'public', 'data', 'graph_rag.json');
    const seedPath = path.resolve(__dirname, '..', 'src', 'data', 'graph_rag_seed.json');
    const csvPath = path.resolve(__dirname, '..', 'public', 'assets', 'aistudio', 'IndianFoodDatasetCSV_273f8d45.csv');

    try {
      if (fs.existsSync(jsonPath)) {
        console.log(`Loading Graph RAG from ${jsonPath}...`);
        const data = fs.readFileSync(jsonPath, 'utf-8');
        this.graph = JSON.parse(data);
        this.isLoaded = true;
        console.log(`Graph RAG loaded with ${this.graph?.stats.totalRecipes} recipes!`);
      } else if (fs.existsSync(seedPath)) {
        console.log(`Loading Graph RAG from seed ${seedPath}...`);
        const data = fs.readFileSync(seedPath, 'utf-8');
        this.graph = JSON.parse(data);
        this.isLoaded = true;
      } else if (fs.existsSync(csvPath)) {
        console.log(`Building Graph RAG from ${csvPath}...`);
        const csvRaw = fs.readFileSync(csvPath, 'utf-8');
        this.graph = buildGraphRAG(csvRaw, 1000);
        this.isLoaded = true;
      }
    } catch (err) {
      console.error('Failed to initialize GraphRAGService:', err);
    }
  }

  public getStats() {
    return this.graph?.stats || {
      totalRecipes: 0,
      totalIngredients: 0,
      totalEdges: 0,
      vegRecipesCount: 0,
      nonVegRecipesCount: 0,
      beginnerRecipesCount: 0
    };
  }

  public getRecipeById(id: string): (GraphRecipeNode & { similarRecipeObjects?: GraphRecipeNode[] }) | null {
    if (!this.graph) return null;
    const recipe = this.graph.recipes.find((r) => r.id === id);
    if (!recipe) return null;

    const similarIds = this.graph.indices.recipeSimilarities[id] || [];
    const similarRecipeObjects = similarIds
      .map((sid) => this.graph?.recipes.find((r) => r.id === sid))
      .filter(Boolean) as GraphRecipeNode[];

    return {
      ...recipe,
      similarRecipeObjects
    };
  }

  public searchRecipes(options: {
    query?: string;
    diet_pref?: 'veg' | 'nonveg';
    is_beginner?: boolean;
    cuisine?: string;
    course?: string;
    max_time?: number;
    equipment?: string[];
    high_protein?: boolean;
    page?: number;
    limit?: number;
  }) {
    if (!this.graph) return { recipes: [], total: 0, page: 1, totalPages: 0 };

    let results = this.graph.recipes;

    // Strict dietary filter
    if (options.diet_pref === 'veg') {
      results = results.filter((r) => !r.isNonVeg);
    }

    // Beginner mode filter
    if (options.is_beginner) {
      results = results.filter((r) => r.difficulty === 'beginner' || r.cookTime <= 25);
    }

    // Cuisine filter
    if (options.cuisine && options.cuisine !== 'all') {
      const target = options.cuisine.toLowerCase();
      results = results.filter((r) => r.cuisine.toLowerCase().includes(target));
    }

    // Course filter
    if (options.course && options.course !== 'all') {
      const target = options.course.toLowerCase();
      results = results.filter((r) => r.course.toLowerCase().includes(target));
    }

    // Max time
    if (options.max_time) {
      results = results.filter((r) => r.totalTime <= (options.max_time || 120));
    }

    // Equipment filter (only recipes doable with available equipment)
    if (options.equipment && options.equipment.length > 0) {
      const availableEq = new Set(options.equipment.map((e) => e.toLowerCase()));
      results = results.filter((r) => {
        return r.equipment.every((eq) => availableEq.has(eq.toLowerCase()));
      });
    }

    // Text search query
    if (options.query && options.query.trim()) {
      const q = options.query.toLowerCase().trim();
      results = results.filter((r) => {
        return (
          r.name.toLowerCase().includes(q) ||
          r.translatedName.toLowerCase().includes(q) ||
          r.cuisine.toLowerCase().includes(q) ||
          r.ingredients.some((ing) => ing.name.toLowerCase().includes(q))
        );
      });
    }

    // High protein sorting
    if (options.high_protein) {
      results = [...results].sort((a, b) => b.nutrientsEstimated.protein_g - a.nutrientsEstimated.protein_g);
    }

    const total = results.length;
    const page = Math.max(1, options.page || 1);
    const limit = Math.max(1, Math.min(50, options.limit || 20));
    const startIndex = (page - 1) * limit;
    const paged = results.slice(startIndex, startIndex + limit);

    return {
      recipes: paged,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  // Graph RAG stock traversal: match recipes reachable with available stock
  public suggestFromStock(
    stockIngredients: string[], // list of ingredient names or canonical ids
    options: {
      diet_pref?: 'veg' | 'nonveg';
      is_beginner?: boolean;
      course?: string;
      limit?: number;
    } = {}
  ) {
    if (!this.graph) return { readyToCook: [], missingOne: [], missingTwo: [] };

    const normStock = new Set(
      stockIngredients.map((s) =>
        s.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
      )
    );

    let candidates = this.graph.recipes;
    if (options.diet_pref === 'veg') {
      candidates = candidates.filter((r) => !r.isNonVeg);
    }
    if (options.is_beginner) {
      candidates = candidates.filter((r) => r.difficulty === 'beginner' || r.cookTime <= 25);
    }
    if (options.course && options.course !== 'all') {
      const target = options.course.toLowerCase();
      candidates = candidates.filter((r) => r.course.toLowerCase().includes(target));
    }

    const scored = candidates.map((recipe) => {
      let matchedCount = 0;
      const missingItems: typeof recipe.ingredients = [];

      for (const ing of recipe.ingredients) {
        const idSlug = ing.canonicalId.replace('ing_', '');
        const nameSlug = ing.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
        let hasInStock = false;

        normStock.forEach((st) => {
          if (st.includes(idSlug) || idSlug.includes(st) || st.includes(nameSlug) || nameSlug.includes(st)) {
            hasInStock = true;
          }
        });

        if (hasInStock) {
          matchedCount++;
        } else {
          missingItems.push(ing);
        }
      }

      const totalIngs = Math.max(1, recipe.ingredients.length);
      const matchRatio = matchedCount / totalIngs;

      return {
        recipe,
        matchedCount,
        missingCount: missingItems.length,
        missingItems,
        matchRatio
      };
    });

    const readyToCook = scored
      .filter((s) => s.missingCount === 0 || s.matchRatio >= 0.85)
      .sort((a, b) => b.matchRatio - a.matchRatio || b.recipe.nutrientsEstimated.protein_g - a.recipe.nutrientsEstimated.protein_g)
      .slice(0, options.limit || 8);

    const missingOne = scored
      .filter((s) => s.missingCount === 1)
      .sort((a, b) => b.recipe.nutrientsEstimated.protein_g - a.recipe.nutrientsEstimated.protein_g)
      .slice(0, options.limit || 8);

    const missingTwo = scored
      .filter((s) => s.missingCount === 2)
      .sort((a, b) => b.recipe.nutrientsEstimated.protein_g - a.recipe.nutrientsEstimated.protein_g)
      .slice(0, options.limit || 8);

    return {
      readyToCook,
      missingOne,
      missingTwo
    };
  }

  // Find ingredient substitutions via Graph Co-occurrence
  public getSubstitutions(ingredientQuery: string) {
    if (!this.graph) return [];
    const query = ingredientQuery.toLowerCase().trim();
    const ingEntry = Object.values(this.graph.ingredients).find(
      (i) => i.name.toLowerCase().includes(query) || i.id.toLowerCase().includes(query)
    );

    if (!ingEntry) return [];

    // Find other ingredients in the same category
    const sameCategory = Object.values(this.graph.ingredients)
      .filter((i) => i.category === ingEntry.category && i.id !== ingEntry.id)
      .sort((a, b) => b.recipeCount - a.recipeCount)
      .slice(0, 5);

    return sameCategory.map((i) => ({
      id: i.id,
      name: i.name,
      category: i.category,
      shelfLifeDays: i.shelfLifeDays,
      storagePlace: i.storagePlace
    }));
  }

  public getIngredients() {
    if (!this.graph?.ingredients) return [];
    return Array.isArray(this.graph.ingredients)
      ? this.graph.ingredients
      : Object.values(this.graph.ingredients);
  }

  /**
   * Graph RAG retrieval for 7-Day AI Auto-Planner:
   * Splits recipe graph into:
   * 1. regularCandidates: Matches user's past diet history, habitual regions, and staple ingredients + stock
   * 2. newDiscoveryCandidates: Disjoint from user's past habitual dishes, exploring new regional dishes or
   *    ingredient combinations while strictly matching diet_pref (veg/nonveg) and health goals (protein_rich, diabetes)
   */
  public getWeeklyPlanCandidates(params: {
    stock: string[];
    diet_pref: 'veg' | 'nonveg';
    is_beginner?: boolean;
    diet_goals?: string[];
    preferred_regions?: string[];
    past_regular_dishes?: { recipe_id?: string; title: string; cuisine?: string; ingredients?: string[] }[];
    common_ingredients?: string[];
    common_regions?: string[];
  }) {
    if (!this.graph) {
      return { regularCandidates: [], newDiscoveryCandidates: [] };
    }

    const stockSet = new Set(
      (params.stock || []).map((s) =>
        s.toLowerCase().trim().replace(/^ing_/, '').replace(/[^a-z0-9]/g, '_')
      )
    );
    const goals = new Set((params.diet_goals || []).map((g) => g.toLowerCase()));
    const wantProtein = goals.has('protein_rich') || goals.has('high_protein');
    const wantDiabetes = goals.has('diabetes') || goals.has('diabetic');
    const wantLowOil = goals.has('low_oil') || goals.has('heart');

    const pastIds = new Set(
      (params.past_regular_dishes || [])
        .map((d) => (d.recipe_id || '').toLowerCase().trim())
        .filter(Boolean)
    );
    const pastTitleTokens = (params.past_regular_dishes || [])
      .map((d) => (d.title || '').toLowerCase().trim())
      .filter(Boolean);

    const commonRegions = new Set(
      (params.common_regions || []).concat(params.preferred_regions || []).map((r) => r.toLowerCase().trim())
    );
    const commonIngs = new Set(
      (params.common_ingredients || []).map((i) =>
        i.toLowerCase().trim().replace(/^ing_/, '').replace(/[^a-z0-9]/g, '_')
      )
    );

    // 1. Strict Dietary Lock Filter
    let pool = this.graph.recipes;
    if (params.diet_pref === 'veg') {
      pool = pool.filter((r) => !r.isNonVeg);
    }

    const isPastHabitual = (recipe: GraphRecipe): boolean => {
      if (pastIds.has(recipe.id.toLowerCase())) return true;
      const rName = recipe.name.toLowerCase();
      const rTrans = (recipe.translatedName || '').toLowerCase();
      for (const pastTitle of pastTitleTokens) {
        if (!pastTitle) continue;
        // Check exact or core dish name match (e.g., "kanda poha", "dal tadka", "paneer bhurji")
        const cleanPast = pastTitle.split('(')[0].trim();
        if (cleanPast.length >= 4 && (rName.includes(cleanPast) || rTrans.includes(cleanPast) || cleanPast.includes(rName))) {
          return true;
        }
      }
      return false;
    };

    const scoreDietaryFit = (recipe: GraphRecipe): { score: number; tags: string[] } => {
      let score = 0;
      const tags: string[] = [];
      const dietLower = (recipe.diet || '').toLowerCase();
      const protein = recipe.nutrientsEstimated?.protein_g || 0;
      const carbs = recipe.nutrientsEstimated?.carbs_g || 40;
      const fat = recipe.nutrientsEstimated?.fat_g || 10;

      if (wantProtein) {
        if (protein >= 14 || dietLower.includes('high protein')) {
          score += 35;
          tags.push(`High Protein (${protein}g)`);
        } else if (protein >= 10) {
          score += 15;
        }
      }

      if (wantDiabetes) {
        const isDiabeticTag =
          dietLower.includes('diabetic') ||
          dietLower.includes('sugar free') ||
          (carbs <= 38 && protein >= 9);
        const hasHeavySugar = recipe.ingredients.some((i) =>
          ['sugar', 'jaggery', 'chini', 'gud', 'condensed_milk'].some((s) => i.canonicalId.includes(s) || i.name.toLowerCase().includes(s))
        );
        if (isDiabeticTag && !hasHeavySugar) {
          score += 40;
          tags.push('Diabetes-Friendly (Low GI)');
        } else if (hasHeavySugar) {
          score -= 50;
        }
      }

      if (wantLowOil && fat <= 9) {
        score += 20;
        tags.push('Heart-Healthy / Low Oil');
      }

      if (params.is_beginner && recipe.difficulty === 'beginner') {
        score += 15;
        tags.push('Beginner Easy');
      }

      return { score, tags };
    };

    const scoreStockAndGraph = (recipe: GraphRecipe) => {
      let stockMatched = 0;
      let commonIngMatched = 0;
      const matchedStockNames: string[] = [];
      for (const ing of recipe.ingredients) {
        const slug = ing.canonicalId.replace(/^ing_/, '');
        const nameLower = ing.name.toLowerCase();
        if (
          stockSet.has(slug) ||
          stockSet.has(ing.canonicalId) ||
          Array.from(stockSet).some((s) => s.length > 2 && (slug.includes(s) || nameLower.includes(s)))
        ) {
          stockMatched++;
          matchedStockNames.push(ing.name);
        }
        if (
          commonIngs.has(slug) ||
          Array.from(commonIngs).some((ci) => ci.length > 2 && (slug.includes(ci) || nameLower.includes(ci)))
        ) {
          commonIngMatched++;
        }
      }
      const totalIngs = Math.max(recipe.ingredients.length, 1);
      const stockRatio = stockMatched / totalIngs;
      const cuisineLower = (recipe.cuisine || '').toLowerCase();
      const regionMatch = Array.from(commonRegions).some(
        (reg) => reg && reg !== 'all' && cuisineLower.includes(reg)
      );

      return {
        stockMatched,
        totalIngs,
        stockRatio,
        commonIngMatched,
        regionMatch,
        matchedStockNames: matchedStockNames.slice(0, 4),
      };
    };

    const regularScored: any[] = [];
    const discoveryScored: any[] = [];

    // Sample up to 600 recipes from pool for fast Graph RAG scoring
    const maxScan = Math.min(pool.length, 600);
    for (let idx = 0; idx < maxScan; idx++) {
      const r = pool[idx];
      const habitual = isPastHabitual(r);
      const dietFit = scoreDietaryFit(r);
      const graphFit = scoreStockAndGraph(r);

      const candidateSummary = {
        id: r.id,
        name: r.name,
        cuisine: r.cuisine || 'Indian',
        course: r.course || 'Main Course',
        diet: r.diet || (r.isNonVeg ? 'Non-Vegetarian' : 'Vegetarian'),
        totalTime: r.totalTime || 25,
        protein_g: r.nutrientsEstimated?.protein_g || 12,
        kcal: r.nutrientsEstimated?.kcal || 320,
        carbs_g: r.nutrientsEstimated?.carbs_g || 40,
        stockMatched: graphFit.stockMatched,
        totalIngs: graphFit.totalIngs,
        matchedIngredients: graphFit.matchedStockNames,
        dietTags: dietFit.tags,
        keyIngredients: r.ingredients.slice(0, 5).map((i) => i.name),
      };

      if (habitual || (graphFit.commonIngMatched >= 2 && graphFit.regionMatch)) {
        const regScore =
          (habitual ? 60 : 0) +
          (graphFit.regionMatch ? 25 : 0) +
          graphFit.commonIngMatched * 8 +
          graphFit.stockRatio * 35 +
          dietFit.score;
        regularScored.push({ ...candidateSummary, score: regScore, isPastFavorite: habitual });
      }

      // For 'new' discovery pool: strictly exclude past habitual dishes
      if (!habitual) {
        // Prefer dishes that still match dietary goals & use some stock ingredients,
        // and either match preferred regions or introduce regional variety
        const noveltyRegionBonus = graphFit.regionMatch ? 18 : 12;
        const discScore =
          dietFit.score * 1.3 +
          graphFit.stockRatio * 40 +
          noveltyRegionBonus +
          (graphFit.commonIngMatched === 0 ? 15 : 5); // bonus for novel ingredient combinations
        discoveryScored.push({ ...candidateSummary, score: discScore });
      }
    }

    regularScored.sort((a, b) => b.score - a.score);
    discoveryScored.sort((a, b) => b.score - a.score);

    return {
      regularCandidates: regularScored.slice(0, 18),
      newDiscoveryCandidates: discoveryScored.slice(0, 24),
    };
  }

  public rebuild(customCsvPath?: string) {
    const csvPath = customCsvPath || path.resolve(__dirname, '..', 'public', 'assets', 'aistudio', 'IndianFoodDatasetCSV_273f8d45.csv');
    if (!fs.existsSync(csvPath)) throw new Error(`CSV file not found at ${csvPath}`);
    const raw = fs.readFileSync(csvPath, 'utf-8');
    this.graph = buildGraphRAG(raw);
    this.isLoaded = true;

    // Save
    const jsonPath = path.resolve(__dirname, '..', 'public', 'data', 'graph_rag.json');
    fs.writeFileSync(jsonPath, JSON.stringify(this.graph, null, 2), 'utf-8');
    return this.graph.stats;
  }
}

export const graphService = new GraphRAGService();
