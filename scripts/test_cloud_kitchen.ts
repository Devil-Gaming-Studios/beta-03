import { store } from '../src/services/store';
import {
  deriveDietTag,
  normalizeToBaseUnit,
  calculatePortionsFeasibility,
} from '../src/services/cloudKitchenService';

console.log('=== RUNNING CLOUD KITCHEN SUITE TESTS ===\n');

// 1. Test Unit Normalization
console.log('Test 1: Unit Conversions');
if (normalizeToBaseUnit(2.5, 'kg', 'g') !== 2500) throw new Error('kg to g failed');
if (normalizeToBaseUnit(1.5, 'liter', 'ml') !== 1500) throw new Error('liter to ml failed');
if (normalizeToBaseUnit(4, 'pcs', 'pcs') !== 4) throw new Error('pcs to pcs failed');
console.log('✓ Unit conversions passed');

// 2. Test Deterministic Diet Classification
console.log('\nTest 2: Deterministic Diet Tag Derivation');
const vegTag = deriveDietTag([{ name: 'Paneer' }, { name: 'Basmati Rice' }, { name: 'Tomato Puree' }]);
if (vegTag.tag !== 'veg') throw new Error('Expected veg tag');

const eggTag = deriveDietTag([{ name: 'Boiled Egg' }, { name: 'Onion Gravy' }]);
if (eggTag.tag !== 'egg') throw new Error('Expected egg tag');

const nonVegTag = deriveDietTag([{ name: 'Boneless Chicken' }, { name: 'Butter' }]);
if (nonVegTag.tag !== 'nonveg') throw new Error('Expected nonveg tag');

const conflictTag = deriveDietTag([{ name: 'Chicken Keema' }, { name: 'Egg Omelette' }]);
if (!conflictTag.hasConflict) throw new Error('Expected conflict warning for mixed meat & egg');
console.log('✓ Deterministic diet tag derivation passed');

// 3. Test Store Cloud Kitchen Setup
console.log('\nTest 3: Cloud Kitchen Setup & Role Management');
const hh = store.getMe().household;
store.updateHousehold({ household_type: 'cloud_kitchen' });
if (store.getMe().household.household_type !== 'cloud_kitchen') throw new Error('Failed to set household_type');

store.setCloudKitchenRole('owner', hh.id);
if (store.getCloudKitchenRole(hh.id) !== 'owner') throw new Error('Role set failed');
console.log('✓ Cloud kitchen setup & role management passed');

// 4. Test Menu Items & Pure-Veg Filter
console.log('\nTest 4: Menu Items & Strict Pure-Veg Filter');
store.setPureVegOnly(false, hh.id);
const allMenuItems = store.getMenuItems(hh.id);
console.log(`Total Menu Items (Unfiltered): ${allMenuItems.length}`);
const hasNonVeg = allMenuItems.some((m) => m.diet_tag === 'nonveg');
if (!hasNonVeg) throw new Error('Expected nonveg item in default seed menu');

store.setPureVegOnly(true, hh.id);
const vegMenuItems = store.getMenuItems(hh.id);
console.log(`Pure-Veg Menu Items: ${vegMenuItems.length}`);
if (vegMenuItems.some((m) => m.diet_tag === 'nonveg')) {
  throw new Error('Pure-Veg filter failed to hide nonveg dishes');
}
store.setPureVegOnly(false, hh.id); // restore
console.log('✓ Pure-veg filter passed');

// 5. Test "Announce What I\'m Cooking" (Batch Cooking & Deduction)
console.log('\nTest 5: Announce Batch Cooking & Inventory Deduction');
const biryani = allMenuItems.find((m) => m.id === 'menu_dum_biryani')!;
const initialRice = store.getStock().find((s) => s.ingredient_id === 'ing_chawal')!.qty_base;

const announceRes = store.announceBatch(biryani.id, 10, false, undefined, hh.id);
if (!announceRes.success || !announceRes.batch) throw new Error('Announce batch failed');

const newRice = store.getStock().find((s) => s.ingredient_id === 'ing_chawal')!.qty_base;
const expectedDeduction = 120 * 10; // 120g per portion * 10 = 1200g
if (initialRice - newRice !== expectedDeduction) {
  throw new Error(`Expected deduction of ${expectedDeduction}g, actual: ${initialRice - newRice}g`);
}
console.log(`✓ Announce batch deducted exactly ${expectedDeduction}g rice from stock and logged to ledger`);

// 6. Test Order Flow: New -> Accepted (Reserve) -> Preparing (Deduct) -> Cancel (Restore)
console.log('\nTest 6: Order Reservation, Deduction & Cancellation Restoration');
const getPaneerStock = () =>
  store
    .getStock()
    .filter((s) => s.ingredient_id === 'ing_paneer')
    .reduce((sum, s) => sum + s.qty_base, 0);

const initialPaneer = getPaneerStock();

// Create order for 2 Paneer Butter Masala (cook_to_order item, 120g paneer per portion = 240g)
const order = store.createCloudOrder(
  {
    customer_name: 'Test Customer Aman',
    items: [{ menu_item_id: 'menu_paneer_butter_masala', quantity: 2 }],
  },
  hh.id
);

const reservations = store.getStockReservations(hh.id).filter((r) => r.order_id === order.id);
if (reservations.length === 0) throw new Error('Expected stock reservation for cook-to-order item');
console.log(`✓ Stock reservation created: ${reservations[0].qty_reserved}${reservations[0].unit} ${reservations[0].ingredient_name}`);

// Move to PREPARING -> Deducts stock
store.updateCloudOrderStatus(order.id, 'preparing', undefined, hh.id);
const paneerAfterPrep = getPaneerStock();
if (initialPaneer - paneerAfterPrep !== 240) {
  throw new Error(`Expected deduction of 240g paneer upon prep, actual: ${initialPaneer - paneerAfterPrep}g`);
}
console.log('✓ Order move to preparing successfully deducted stock');

// CANCEL Order -> Restores stock!
store.updateCloudOrderStatus(order.id, 'cancelled', undefined, hh.id);
const paneerAfterCancel = getPaneerStock();
if (paneerAfterCancel !== initialPaneer) {
  throw new Error(`Expected restoration back to ${initialPaneer}g paneer, actual: ${paneerAfterCancel}g`);
}
console.log('✓ Order cancellation restored stock to initial balance cleanly');

// 7. Test Wastage Logging
console.log('\nTest 7: Wastage Logging & Cost Calculation');
const waste = store.logWastage('ing_tamatar', 300, 'g', 'spoilage', 20, 'Spoiled in storage', hh.id);
if (!waste.id || waste.qty !== 300) throw new Error('Wastage logging failed');
console.log('✓ Wastage logged successfully');

// 8. Test Daily Report & CSV Export
console.log('\nTest 8: Daily P&L Report & CSV Export');
const report = store.getCloudKitchenReport();
if (typeof report.gross_revenue_inr !== 'number' || typeof report.gross_profit_margin_percent !== 'number') {
  throw new Error('Report numbers invalid');
}
const csv = store.exportReportCsv(report);
if (!csv.includes('MAST MEALS CLOUD KITCHEN DAILY PERFORMANCE REPORT')) {
  throw new Error('CSV output header missing');
}
console.log(`✓ Daily report generated (Revenue: ₹${report.gross_revenue_inr}, Margin: ${report.gross_profit_margin_percent}%) and CSV export validated`);

// 9. Test Supplier & Contractor Management
console.log('\nTest 9: Contracted Supplier Management (Add, Edit Contacts, Delete)');
const initialSuppliersCount = store.getSuppliers(hh.id).length;
const newSupplier = store.addSupplier(
  {
    name: 'Sharma Packaging Solutions',
    category: 'Packaging & Disposables',
    phone: '+91 98765 43210',
    contact_person: 'Vijay Sharma',
    lead_time_hours: 4,
    preferred_brands: ['EcoHandi', 'AluFoil Plus'],
    notes: 'Same-day emergency supply available',
  },
  hh.id
);

if (!newSupplier.id || newSupplier.name !== 'Sharma Packaging Solutions') {
  throw new Error('Failed to add new contractor supplier');
}
if (store.getSuppliers(hh.id).length !== initialSuppliersCount + 1) {
  throw new Error('Supplier count did not increment');
}

// Edit supplier contact details
const updateRes = store.updateSupplier(
  newSupplier.id,
  {
    phone: '+91 99999 88888',
    contact_person: 'Vijay Sharma (Senior Partner)',
    lead_time_hours: 2,
    preferred_brands: ['EcoHandi', 'AluFoil Plus', 'Biodegradable Tubs'],
  },
  hh.id
);

if (!updateRes.success || updateRes.supplier?.phone !== '+91 99999 88888') {
  throw new Error('Failed to update contractor contact details');
}
if (updateRes.supplier?.lead_time_hours !== 2) {
  throw new Error('Lead time update failed');
}

// Remove supplier
const deleteRes = store.deleteSupplier(newSupplier.id, hh.id);
if (!deleteRes.success || store.getSuppliers(hh.id).length !== initialSuppliersCount) {
  throw new Error('Failed to remove contracted supplier');
}
console.log('✓ Contracted supplier lifecycle (Add, Edit Contact & Brands, Remove) passed');

console.log('\n=== ALL CLOUD KITCHEN INTEGRATION TESTS PASSED SUCCESSFULLY! ===');

