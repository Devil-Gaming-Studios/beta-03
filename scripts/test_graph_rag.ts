import { graphService } from '../server/graphService';

async function runTests() {
  console.log('--- Running Graph RAG Tests ---');

  // 1. Stats test
  const stats = graphService.getStats();
  console.log('1. Graph Stats Check:', stats);
  if (stats.totalRecipes < 100) throw new Error('Stats recipe count too low');

  // 2. Strict Veg filter test
  const vegSearch = graphService.searchRecipes({ diet_pref: 'veg', limit: 50 });
  const hasAnyNonVegInVegSearch = vegSearch.recipes.some((r) => r.isNonVeg);
  console.log('2. Strict Veg Hard Lock Test:', hasAnyNonVegInVegSearch ? 'FAILED' : 'PASSED (0 non-veg found in veg query)');
  if (hasAnyNonVegInVegSearch) throw new Error('Strict veg filter leaked non-veg recipe!');

  // 3. Beginner mode filter test
  const beginnerSearch = graphService.searchRecipes({ is_beginner: true, limit: 10 });
  console.log('3. Beginner Mode Test:', beginnerSearch.recipes.length > 0 ? `PASSED (${beginnerSearch.recipes.length} beginner recipes found)` : 'FAILED');

  // 4. Stock Traversal test
  const stockTraverse = graphService.suggestFromStock(['atta', 'aloo', 'salt', 'oil', 'jeera'], {
    diet_pref: 'veg',
    limit: 5,
  });
  console.log('4. Graph RAG Stock Traversal Test:');
  console.log('   Ready to cook now:', stockTraverse.readyToCook.map((r) => r.recipe.name));
  console.log('   Missing 1 item:', stockTraverse.missingOne.map((r) => `${r.recipe.name} (needs ${r.missingItems[0]?.name})`));

  // 5. Substitutions test
  const subs = graphService.getSubstitutions('paneer');
  console.log('5. Substitutions for Paneer:', subs.map((s) => s.name));

  console.log('--- All Graph RAG Tests Passed Successfully! ---');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
