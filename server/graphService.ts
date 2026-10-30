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
