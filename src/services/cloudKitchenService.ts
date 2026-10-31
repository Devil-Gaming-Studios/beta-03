import {
  MenuItem,
  MenuItemDietTag,
  MenuItemCookMethod,
  MenuItemVariant,
  MenuItemRecipeIngredient,
  CloudOrder,
  CloudOrderItem,
  OrderStatus,
  OrderSource,
  PaymentStatus,
  CookBatch,
  StockReservation,
  StockLedgerEntry,
  WastageEntry,
  Supplier,
  PurchaseList,
  PurchaseListItem,
  CloudKitchenReport,
  CloudKitchenRole,
  BaseUnit,
  StockItem,
} from '../types';

export const MEAT_KEYWORDS = [
  'chicken', 'mutton', 'goat', 'fish', 'prawn', 'prawns', 'shrimp',
  'keema', 'kebab', 'beef', 'pork', 'lamb', 'crab', 'bacon'
];

export const EGG_KEYWORDS = [
  'egg', 'eggs', 'anda', 'omelette', 'omelet', 'egg-white', 'albumen'
];

/**
 * Normalizes input units to base unit ('g', 'ml', 'pcs')
 */
export function normalizeToBaseUnit(qty: number, fromUnit: string, targetUnit: BaseUnit): number {
  const f = fromUnit.toLowerCase().trim();
  if (targetUnit === 'g') {
    if (f === 'kg' || f === 'kilo' || f === 'kilogram') return qty * 1000;
    if (f === 'tbsp') return qty * 15;
    if (f === 'tsp') return qty * 5;
    if (f === 'pinch') return qty * 1;
    return qty;
  }
  if (targetUnit === 'ml') {
    if (f === 'l' || f === 'liter' || f === 'litre') return qty * 1000;
    if (f === 'tbsp') return qty * 15;
    if (f === 'tsp') return qty * 5;
    return qty;
  }
  return qty;
}

/**
 * Deterministically derives diet tag ('veg', 'nonveg', 'egg') from ingredient names and tags.
 * Never guesses via LLM; strictly code-enforced.
 */
export function deriveDietTag(
  ingredients: { name: string; isNonVeg?: boolean }[]
): { tag: MenuItemDietTag; hasConflict: boolean; conflictReason?: string } {
  let hasMeat = false;
  let hasEgg = false;

  for (const ing of ingredients) {
    const lower = (ing.name || '').toLowerCase();
    if (ing.isNonVeg) {
      hasMeat = true;
    }
    if (MEAT_KEYWORDS.some((kw) => lower.includes(kw))) {
      hasMeat = true;
    }
    if (EGG_KEYWORDS.some((kw) => lower.includes(kw))) {
      hasEgg = true;
    }
  }

  if (hasMeat) {
    const hasConflict = hasEgg;
    return {
      tag: 'nonveg',
      hasConflict,
      conflictReason: hasConflict ? 'Dish mixes both egg and poultry/meat products' : undefined,
    };
  }

  if (hasEgg) {
    return { tag: 'egg', hasConflict: false };
  }

  return { tag: 'veg', hasConflict: false };
}

/**
 * Default Seed Menu Items (10 items spanning Biryani, Curries, Breads, Combos, Desserts)
 */
export function getDefaultMenuItems(householdId: string): MenuItem[] {
  return [
    {
      id: 'menu_dum_biryani',
      household_id: householdId,
      name: 'Hyderabadi Dum Biryani (Veg)',
      name_hi: 'हैदराबादी दम बिरयानी (वेज)',
      description: 'Slow-cooked fragrant basmati rice layered with spiced paneer, vegetables, and saffron milk. Served with salan and raita.',
      category: 'Biryani & Rice',
      price_inr: 240,
      cost_inr: 72,
      portion_size: '450g Handi Box',
      yield_per_batch: 20,
      prep_time_mins: 45,
      cook_method: 'batch',
      is_available: true,
      diet_tag: 'veg',
      is_spicy: true,
      allergens: ['dairy'],
      cooked_portions_available: 8,
      variants: [
        { id: 'v_half', name: 'Half (300g)', price_inr: 150, portion_multiplier: 0.65 },
        { id: 'v_full', name: 'Full (550g)', price_inr: 240, portion_multiplier: 1.0 },
        { id: 'v_extra_paneer', name: 'Extra Paneer & Kaju', price_inr: 290, portion_multiplier: 1.2 },
      ],
      ingredients: [
        { ingredient_id: 'ing_chawal', name: 'Basmati Rice', qty_per_portion: 120, unit: 'g', cost_estimate_inr: 14 },
        { ingredient_id: 'ing_paneer', name: 'Fresh Paneer', qty_per_portion: 70, unit: 'g', cost_estimate_inr: 28 },
        { ingredient_id: 'ing_pyaz', name: 'Birista Onions', qty_per_portion: 60, unit: 'g', cost_estimate_inr: 5 },
        { ingredient_id: 'ing_dahi', name: 'Fresh Dahi (Curd)', qty_per_portion: 50, unit: 'ml', cost_estimate_inr: 4 },
        { ingredient_id: 'ing_ghee', name: 'Desi Ghee', qty_per_portion: 15, unit: 'ml', cost_estimate_inr: 12 },
        { ingredient_id: 'ing_biryani_masala', name: 'Shahi Masala & Saffron', qty_per_portion: 5, unit: 'g', is_pinch_or_taste: true, cost_estimate_inr: 9 },
      ],
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'menu_dal_makhani',
      household_id: householdId,
      name: 'Dal Makhani (Slow-Cooked Overnight)',
      name_hi: 'दाल मखनी (अमृतसरी स्टाइल)',
      description: 'Slow-simmered whole black lentils & kidney beans with white butter, fresh dairy cream, and kasuri methi.',
      category: 'Curries & Gravies',
      price_inr: 180,
      cost_inr: 46,
      portion_size: '350ml Tub',
      yield_per_batch: 25,
      prep_time_mins: 60,
      cook_method: 'batch',
      is_available: true,
      diet_tag: 'veg',
      is_spicy: false,
      allergens: ['dairy'],
      cooked_portions_available: 12,
      variants: [
        { id: 'v_makhani_reg', name: 'Regular Tub (350ml)', price_inr: 180, portion_multiplier: 1.0 },
        { id: 'v_makhani_large', name: 'Family Tub (700ml)', price_inr: 320, portion_multiplier: 1.8 },
      ],
      ingredients: [
        { ingredient_id: 'ing_urad_dal', name: 'Black Urad Dal', qty_per_portion: 70, unit: 'g', cost_estimate_inr: 12 },
        { ingredient_id: 'ing_rajma', name: 'Chitra Rajma', qty_per_portion: 20, unit: 'g', cost_estimate_inr: 4 },
        { ingredient_id: 'ing_tamatar', name: 'Desi Tomato Puree', qty_per_portion: 80, unit: 'g', cost_estimate_inr: 6 },
        { ingredient_id: 'ing_butter', name: 'White Makkhan / Butter', qty_per_portion: 25, unit: 'g', cost_estimate_inr: 15 },
        { ingredient_id: 'ing_cream', name: 'Fresh Dairy Cream', qty_per_portion: 20, unit: 'ml', cost_estimate_inr: 9 },
      ],
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'menu_paneer_butter_masala',
      household_id: householdId,
      name: 'Paneer Butter Masala',
      name_hi: 'पनीर बटर मसाला',
      description: 'Cubes of soft malai paneer simmered in rich velvety cashew-tomato butter sauce.',
      category: 'Curries & Gravies',
      price_inr: 220,
      cost_inr: 64,
      portion_size: '350ml Tub',
      yield_per_batch: 1, // cooked fresh to order
      prep_time_mins: 15,
      cook_method: 'to_order',
      is_available: true,
      diet_tag: 'veg',
      is_spicy: false,
      allergens: ['dairy', 'nuts'],
      variants: [
        { id: 'v_pbm_half', name: 'Half (250ml)', price_inr: 140, portion_multiplier: 0.6 },
        { id: 'v_pbm_full', name: 'Full (400ml)', price_inr: 220, portion_multiplier: 1.0 },
        { id: 'v_pbm_extra_paneer', name: 'Full + Extra Paneer', price_inr: 270, portion_multiplier: 1.3 },
      ],
      ingredients: [
        { ingredient_id: 'ing_paneer', name: 'Fresh Paneer', qty_per_portion: 120, unit: 'g', cost_estimate_inr: 42 },
        { ingredient_id: 'ing_tamatar', name: 'Desi Tamatar', qty_per_portion: 90, unit: 'g', cost_estimate_inr: 6 },
        { ingredient_id: 'ing_butter', name: 'Amul Butter', qty_per_portion: 20, unit: 'g', cost_estimate_inr: 11 },
        { ingredient_id: 'ing_cream', name: 'Fresh Cream', qty_per_portion: 15, unit: 'ml', cost_estimate_inr: 5 },
      ],
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'menu_chole_bhature',
      household_id: householdId,
      name: 'Delhi Style Chole Bhature Box',
      name_hi: 'दिल्ली स्पेशल छोले भटूरे कॉम्बो',
      description: 'Authentic spiced Pindi Chole cooked with amla & anardana, paired with 2 fluffy bhature, pickled onions, and green chutney.',
      category: 'Combos & Thalis',
      price_inr: 160,
      cost_inr: 38,
      portion_size: '1 Box (Chole + 2 Bhature)',
      yield_per_batch: 25,
      prep_time_mins: 20,
      cook_method: 'batch',
      is_available: true,
      diet_tag: 'veg',
      is_spicy: true,
      allergens: ['gluten'],
      cooked_portions_available: 5,
      variants: [
        { id: 'v_cb_regular', name: '1 Portion (2 Bhature)', price_inr: 160, portion_multiplier: 1.0 },
        { id: 'v_cb_extra_bhatura', name: 'With 1 Extra Bhatura', price_inr: 195, portion_multiplier: 1.25 },
      ],
      ingredients: [
        { ingredient_id: 'ing_chana', name: 'Kabuli Chana', qty_per_portion: 100, unit: 'g', cost_estimate_inr: 15 },
        { ingredient_id: 'ing_maida', name: 'Fine Flour (Maida)', qty_per_portion: 120, unit: 'g', cost_estimate_inr: 7 },
        { ingredient_id: 'ing_oil', name: 'Refined Oil for Frying', qty_per_portion: 40, unit: 'ml', cost_estimate_inr: 8 },
        { ingredient_id: 'ing_pyaz', name: 'Onions & Masala', qty_per_portion: 50, unit: 'g', cost_estimate_inr: 8 },
      ],
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'menu_tandoori_roti',
      household_id: householdId,
      name: 'Tandoori Butter Roti (Freshly Baked)',
      name_hi: 'तंदूरी बटर रोटी',
      description: '100% whole wheat crisp tandoori roti brushed with golden melted butter.',
      category: 'Breads & Rotis',
      price_inr: 25,
      cost_inr: 5,
      portion_size: '1 pc',
      yield_per_batch: 1,
      prep_time_mins: 5,
      cook_method: 'to_order',
      is_available: true,
      diet_tag: 'veg',
      allergens: ['gluten', 'dairy'],
      variants: [
        { id: 'v_plain_roti', name: 'Plain (Without Butter)', price_inr: 20, portion_multiplier: 0.9 },
        { id: 'v_butter_roti', name: 'With Amul Butter', price_inr: 25, portion_multiplier: 1.0 },
      ],
      ingredients: [
        { ingredient_id: 'ing_atta', name: 'Whole Wheat Atta', qty_per_portion: 45, unit: 'g', cost_estimate_inr: 3 },
        { ingredient_id: 'ing_butter', name: 'Butter Glaze', qty_per_portion: 5, unit: 'g', cost_estimate_inr: 2 },
      ],
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'menu_garlic_naan',
      household_id: householdId,
      name: 'Garlic Coriander Naan',
      name_hi: 'लहसुन धनिया नान',
      description: 'Leavened clay oven bread topped with crushed minced garlic, fresh coriander leaves, and butter.',
      category: 'Breads & Rotis',
      price_inr: 45,
      cost_inr: 10,
      portion_size: '1 pc',
      yield_per_batch: 1,
      prep_time_mins: 8,
      cook_method: 'to_order',
      is_available: true,
      diet_tag: 'veg',
      allergens: ['gluten', 'dairy'],
      variants: [],
      ingredients: [
        { ingredient_id: 'ing_maida', name: 'Maida Dough', qty_per_portion: 75, unit: 'g', cost_estimate_inr: 4 },
        { ingredient_id: 'ing_lasun', name: 'Fresh Garlic', qty_per_portion: 15, unit: 'g', cost_estimate_inr: 3 },
        { ingredient_id: 'ing_butter', name: 'Butter', qty_per_portion: 10, unit: 'g', cost_estimate_inr: 3 },
      ],
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'menu_jeera_rice',
      household_id: householdId,
      name: 'Jeera Ghee Rice Box',
      name_hi: 'जीरा घी राइस बॉक्स',
      description: 'Long-grain basmati rice tempered with roasted cumin seeds and desi ghee.',
      category: 'Biryani & Rice',
      price_inr: 120,
      cost_inr: 26,
      portion_size: '400g Box',
      yield_per_batch: 25,
      prep_time_mins: 25,
      cook_method: 'batch',
      is_available: true,
      diet_tag: 'veg',
      allergens: ['dairy'],
      cooked_portions_available: 15,
      variants: [],
      ingredients: [
        { ingredient_id: 'ing_chawal', name: 'Basmati Rice', qty_per_portion: 120, unit: 'g', cost_estimate_inr: 14 },
        { ingredient_id: 'ing_jeera', name: 'Roasted Cumin (Jeera)', qty_per_portion: 5, unit: 'g', cost_estimate_inr: 4 },
        { ingredient_id: 'ing_ghee', name: 'Desi Ghee', qty_per_portion: 10, unit: 'ml', cost_estimate_inr: 8 },
      ],
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'menu_rajma_masala',
      household_id: householdId,
      name: 'Punjabi Dhaba Rajma Masala',
      name_hi: 'पंजाबी ढाबा राजमा मसाला',
      description: 'Red kidney beans simmered in spiced onion, ginger and tomato gravy with kasuri methi.',
      category: 'Curries & Gravies',
      price_inr: 190,
      cost_inr: 42,
      portion_size: '350ml Tub',
      yield_per_batch: 20,
      prep_time_mins: 45,
      cook_method: 'batch',
      is_available: true,
      diet_tag: 'veg',
      allergens: [],
      cooked_portions_available: 10,
      variants: [],
      ingredients: [
        { ingredient_id: 'ing_rajma', name: 'Chitra Rajma', qty_per_portion: 90, unit: 'g', cost_estimate_inr: 18 },
        { ingredient_id: 'ing_tamatar', name: 'Tamatar Gravy', qty_per_portion: 80, unit: 'g', cost_estimate_inr: 6 },
        { ingredient_id: 'ing_pyaz', name: 'Brown Onions', qty_per_portion: 60, unit: 'g', cost_estimate_inr: 5 },
        { ingredient_id: 'ing_oil', name: 'Mustard Oil / Ghee', qty_per_portion: 15, unit: 'ml', cost_estimate_inr: 13 },
      ],
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'menu_gulab_jamun',
      household_id: householdId,
      name: 'Angoori Mawa Gulab Jamun (2 pcs)',
      name_hi: 'मावा गुलाब जामुन (2 पीस)',
      description: 'Soft melt-in-mouth khoya dumplings soaked in fragrant cardamom & rose sugar syrup.',
      category: 'Desserts & Sweets',
      price_inr: 70,
      cost_inr: 16,
      portion_size: '2 pcs in Cup',
      yield_per_batch: 40,
      prep_time_mins: 35,
      cook_method: 'batch',
      is_available: true,
      diet_tag: 'veg',
      allergens: ['dairy', 'gluten'],
      cooked_portions_available: 22,
      variants: [
        { id: 'v_gj_2', name: '2 Pieces Cup', price_inr: 70, portion_multiplier: 1.0 },
        { id: 'v_gj_4', name: '4 Pieces Box', price_inr: 130, portion_multiplier: 1.9 },
      ],
      ingredients: [
        { ingredient_id: 'ing_khoya', name: 'Fresh Khoya (Mawa)', qty_per_portion: 40, unit: 'g', cost_estimate_inr: 10 },
        { ingredient_id: 'ing_cheeni', name: 'Sugar Syrup', qty_per_portion: 50, unit: 'g', cost_estimate_inr: 3 },
        { ingredient_id: 'ing_oil', name: 'Ghee for Frying', qty_per_portion: 10, unit: 'ml', cost_estimate_inr: 3 },
      ],
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'menu_chicken_tikka_masala',
      household_id: householdId,
      name: 'Tandoori Chicken Tikka Masala',
      name_hi: 'तंदूरी चिकन टिक्का मसाला',
      description: 'Smoky charcoal-grilled tender boneless chicken thigh pieces in spicy rich tomato-fenugreek gravy.',
      category: 'Curries & Gravies',
      price_inr: 290,
      cost_inr: 105,
      portion_size: '400ml Tub (4-5 Tikka pcs)',
      yield_per_batch: 1,
      prep_time_mins: 20,
      cook_method: 'to_order',
      is_available: true,
      diet_tag: 'nonveg', // Note: strictly non-veg!
      is_spicy: true,
      allergens: ['dairy'],
      variants: [
        { id: 'v_ctm_half', name: 'Half (3 pcs)', price_inr: 180, portion_multiplier: 0.65 },
        { id: 'v_ctm_full', name: 'Full (6 pcs)', price_inr: 290, portion_multiplier: 1.0 },
      ],
      ingredients: [
        { ingredient_id: 'ing_chicken', name: 'Boneless Chicken Thigh', qty_per_portion: 180, unit: 'g', cost_estimate_inr: 65 },
        { ingredient_id: 'ing_dahi', name: 'Hung Curd Tikka Marination', qty_per_portion: 40, unit: 'ml', cost_estimate_inr: 4 },
        { ingredient_id: 'ing_tamatar', name: 'Makhani Tomato Gravy', qty_per_portion: 100, unit: 'g', cost_estimate_inr: 8 },
        { ingredient_id: 'ing_butter', name: 'Amul Butter', qty_per_portion: 25, unit: 'g', cost_estimate_inr: 16 },
        { ingredient_id: 'ing_cream', name: 'Heavy Cream', qty_per_portion: 20, unit: 'ml', cost_estimate_inr: 12 },
      ],
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];
}

/**
 * Default Seed Suppliers for Cloud Kitchen
 */
export function getDefaultSuppliers(householdId: string): Supplier[] {
  return [
    {
      id: 'sup_dairy',
      household_id: householdId,
      name: 'Krishna Dairy & Cold Store',
      category: 'Dairy (पनीर, मक्खन, क्रीम, दूध)',
      phone: '+91 98234 11223',
      lead_time_hours: 3,
      preferred_brands: ['Amul', 'Gowardhan', 'Desi Fresh'],
    },
    {
      id: 'sup_veggies',
      household_id: householdId,
      name: 'Sabzi Mandi Direct Traders',
      category: 'Fresh Vegetables (प्याज, टमाटर, लहसुन, अदरक)',
      phone: '+91 98901 44556',
      lead_time_hours: 4,
      preferred_brands: ['Local Mandi Grade-A'],
    },
    {
      id: 'sup_spices',
      household_id: householdId,
      name: 'Shrinath Grains & Spices Co.',
      category: 'Dry Grains & Spices (बासमती चावल, आटा, दाल, मसाले)',
      phone: '+91 98450 77889',
      lead_time_hours: 24,
      preferred_brands: ['Daawat Basmati', 'Aashirvaad Atta', 'MDH', 'Catch'],
    },
    {
      id: 'sup_packaging',
      household_id: householdId,
      name: 'EcoPack Containers & Bags',
      category: 'Packaging Materials (बिरयानी हांडी, करी टब, पेपर बैग)',
      phone: '+91 99120 33441',
      lead_time_hours: 12,
      preferred_brands: ['EcoKraft 500ml', 'BakeMate Foil Handi'],
    },
  ];
}

/**
 * Default Seed Orders for Cloud Kitchen (5 live orders)
 */
export function getDefaultOrders(householdId: string): CloudOrder[] {
  const now = Date.now();
  return [
    {
      id: 'ord_101',
      household_id: householdId,
      order_number: 101,
      customer_name: 'Rahul Verma',
      customer_phone: '+91 98111 23456',
      source: 'whatsapp',
      status: 'preparing',
      payment_status: 'paid',
      scheduled_time: new Date(now + 20 * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      notes: 'Less spicy in biryani, send extra salan and cutlery.',
      total_amount_inr: 700,
      items: [
        {
          item_id: 'oi_1',
          menu_item_id: 'menu_dum_biryani',
          name: 'Hyderabadi Dum Biryani (Veg)',
          variant_name: 'Full (550g)',
          quantity: 2,
          unit_price_inr: 240,
          total_price_inr: 480,
        },
        {
          item_id: 'oi_2',
          menu_item_id: 'menu_paneer_butter_masala',
          name: 'Paneer Butter Masala',
          variant_name: 'Full (400ml)',
          quantity: 1,
          unit_price_inr: 220,
          total_price_inr: 220,
        },
      ],
      created_at: new Date(now - 15 * 60000).toISOString(),
      updated_at: new Date(now - 5 * 60000).toISOString(),
    },
    {
      id: 'ord_102',
      household_id: householdId,
      order_number: 102,
      customer_name: 'Priya Sharma',
      customer_phone: '+91 98222 34567',
      source: 'phone_call',
      status: 'accepted',
      payment_status: 'pending',
      scheduled_time: new Date(now + 40 * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      notes: 'Crisp rotis please. Call before delivery.',
      total_amount_inr: 280,
      items: [
        {
          item_id: 'oi_3',
          menu_item_id: 'menu_dal_makhani',
          name: 'Dal Makhani (Slow-Cooked Overnight)',
          quantity: 1,
          unit_price_inr: 180,
          total_price_inr: 180,
        },
        {
          item_id: 'oi_4',
          menu_item_id: 'menu_tandoori_roti',
          name: 'Tandoori Butter Roti (Freshly Baked)',
          quantity: 4,
          unit_price_inr: 25,
          total_price_inr: 100,
        },
      ],
      created_at: new Date(now - 10 * 60000).toISOString(),
      updated_at: new Date(now - 8 * 60000).toISOString(),
    },
    {
      id: 'ord_103',
      household_id: householdId,
      order_number: 103,
      customer_name: 'Amit Patel',
      customer_phone: '+91 98333 45678',
      source: 'walk_in',
      status: 'ready',
      payment_status: 'paid',
      scheduled_time: 'Ready for Pickup',
      notes: 'Customer waiting at counter, extra green chutney added.',
      total_amount_inr: 300,
      items: [
        {
          item_id: 'oi_5',
          menu_item_id: 'menu_chole_bhature',
          name: 'Delhi Style Chole Bhature Box',
          quantity: 1,
          unit_price_inr: 160,
          total_price_inr: 160,
        },
        {
          item_id: 'oi_6',
          menu_item_id: 'menu_gulab_jamun',
          name: 'Angoori Mawa Gulab Jamun (2 pcs)',
          quantity: 2,
          unit_price_inr: 70,
          total_price_inr: 140,
        },
      ],
      created_at: new Date(now - 25 * 60000).toISOString(),
      updated_at: new Date(now - 2 * 60000).toISOString(),
    },
    {
      id: 'ord_104',
      household_id: householdId,
      order_number: 104,
      customer_name: 'Ananya Roy',
      customer_phone: '+91 98444 56789',
      source: 'swiggy_manual',
      status: 'new',
      payment_status: 'paid',
      scheduled_time: new Date(now + 45 * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      notes: 'Rider arriving in 35 mins.',
      total_amount_inr: 810,
      items: [
        {
          item_id: 'oi_7',
          menu_item_id: 'menu_dum_biryani',
          name: 'Hyderabadi Dum Biryani (Veg)',
          quantity: 3,
          unit_price_inr: 240,
          total_price_inr: 720,
        },
        {
          item_id: 'oi_8',
          menu_item_id: 'menu_garlic_naan',
          name: 'Garlic Coriander Naan',
          quantity: 2,
          unit_price_inr: 45,
          total_price_inr: 90,
        },
      ],
      created_at: new Date(now - 3 * 60000).toISOString(),
      updated_at: new Date(now - 3 * 60000).toISOString(),
    },
    {
      id: 'ord_105',
      household_id: householdId,
      order_number: 105,
      customer_name: 'Vikram Singh',
      customer_phone: '+91 98555 67890',
      source: 'telegram',
      status: 'delivered',
      payment_status: 'paid',
      scheduled_time: 'Delivered',
      notes: 'Delivered to Flat 402 with receipt.',
      total_amount_inr: 295,
      items: [
        {
          item_id: 'oi_9',
          menu_item_id: 'menu_paneer_butter_masala',
          name: 'Paneer Butter Masala',
          quantity: 1,
          unit_price_inr: 220,
          total_price_inr: 220,
        },
        {
          item_id: 'oi_10',
          menu_item_id: 'menu_tandoori_roti',
          name: 'Tandoori Butter Roti (Freshly Baked)',
          quantity: 3,
          unit_price_inr: 25,
          total_price_inr: 75,
        },
      ],
      created_at: new Date(now - 70 * 60000).toISOString(),
      updated_at: new Date(now - 30 * 60000).toISOString(),
    },
  ];
}

/**
 * Check deterministic portion feasibility strictly in code from current inventory
 */
export function calculatePortionsFeasibility(
  menuItem: MenuItem,
  requestedPortions: number,
  stockItems: StockItem[] | Record<string, StockItem>
): {
  canCook: boolean;
  maxPossiblePortions: number;
  shortages: {
    ingredient_id: string;
    name: string;
    unit: BaseUnit;
    qty_needed: number;
    qty_available: number;
    shortage_qty: number;
  }[];
} {
  if (!menuItem.ingredients || menuItem.ingredients.length === 0) {
    return { canCook: true, maxPossiblePortions: 999, shortages: [] };
  }

  const stockList = Array.isArray(stockItems) ? stockItems : Object.values(stockItems);
  const shortages: {
    ingredient_id: string;
    name: string;
    unit: BaseUnit;
    qty_needed: number;
    qty_available: number;
    shortage_qty: number;
  }[] = [];

  let maxPossible = 99999;

  for (const ing of menuItem.ingredients) {
    // Find all matching stock items by ingredient_id or loose name match and sum available quantity
    const matchingStocks = stockList.filter(
      (s) => s.ingredient_id === ing.ingredient_id || s.name.toLowerCase().includes(ing.name.toLowerCase())
    );
    const available = matchingStocks.reduce((sum, s) => sum + (s.qty_base || 0), 0);
    const needed = ing.qty_per_portion * requestedPortions;

    if (ing.is_pinch_or_taste) {
      // Pinch/to-taste ingredients (salt, turmeric) don't strictly cap max possible if low
      continue;
    }

    if (ing.qty_per_portion > 0) {
      const possibleForThis = Math.floor(available / ing.qty_per_portion);
      if (possibleForThis < maxPossible) {
        maxPossible = possibleForThis;
      }
    }

    if (available < needed) {
      shortages.push({
        ingredient_id: ing.ingredient_id,
        name: ing.name,
        unit: ing.unit,
        qty_needed: needed,
        qty_available: available,
        shortage_qty: needed - available,
      });
    }
  }

  return {
    canCook: shortages.length === 0,
    maxPossiblePortions: Math.max(0, maxPossible),
    shortages,
  };
}

/**
 * Cloud Kitchen Role Permissions Check
 */
export function canPerformCloudAction(
  role: CloudKitchenRole,
  action: 'edit_menu' | 'edit_prices' | 'edit_stock_rules' | 'announce_batch' | 'mark_cooking' | 'mark_ready' | 'mark_delivered' | 'log_wastage' | 'view_reports' | 'receive_goods'
): boolean {
  if (role === 'owner') return true;

  if (role === 'cook') {
    return (
      action === 'announce_batch' ||
      action === 'mark_cooking' ||
      action === 'mark_ready' ||
      action === 'log_wastage'
    );
  }

  if (role === 'packer' || role === 'helper') {
    return action === 'mark_delivered' || action === 'mark_ready';
  }

  return false;
}
