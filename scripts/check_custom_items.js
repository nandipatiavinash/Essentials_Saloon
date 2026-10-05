import fs from 'fs';

const data = JSON.parse(fs.readFileSync('all_invoice_items_summary.json', 'utf8'));

// Filter items with no service_id and no inventory_id
const customItems = data.items.filter(i => i.hasSrvId === 0 && i.hasInvId === 0);

console.log('Total custom entered items:', customItems.length);

const suspectProducts = [];
const genuineServices = [];
const others = [];

for (const c of customItems) {
  const name = c.name;
  const nameLower = name.toLowerCase();

  if (nameLower.includes('shampoo') || nameLower.includes('conditioner') || nameLower.includes('mask') || 
      nameLower.includes('serum') || nameLower.includes('cream') || nameLower.includes('oil') || 
      nameLower.includes('lotion') || nameLower.includes('spf') || nameLower.includes('wash') ||
      nameLower.includes('gel') || nameLower.includes('product')) {
    suspectProducts.push(c);
  } else if (nameLower.includes('wallet') || nameLower.includes('membership')) {
    others.push(c);
  } else {
    genuineServices.push(c);
  }
}

console.log('=== SUSPECT PRODUCTS / RETAIL ITEMS ===');
for (const s of suspectProducts) {
  console.log(`[${s.types.join(',')}] "${s.name}" (Count: ${s.count}, Prices: ${s.prices.join(', ')})`);
}

console.log('\n=== OTHER CUSTOM SERVICES ===');
for (const s of genuineServices) {
  console.log(`[${s.types.join(',')}] "${s.name}" (Count: ${s.count}, Prices: ${s.prices.join(', ')})`);
}
