import fs from 'fs';

const data = JSON.parse(fs.readFileSync('all_invoice_items_summary.json', 'utf8'));

// Categorize all 203 distinct items
const alreadyFixedProducts = [];
const retailProductsStillAsService = [];
const genuineSalonServices = [];
const walletAndMemberships = [];

// Retail product names or retail brand items
const retailProductNames = [
  'brillare  dandruff shampoo',
  'brillare dandruff mask',
  'SHEA CONDITIONER',
  'SHEA THICKENING SHAMPOO',
  'COLOR MOTION SHAMPOO',
  'System Professional Balance Energy Serum',
  'QOD SHAMPOO',
  'qod organ shampoo',
  'QOD ORGAN CONDITIONER'
];

for (const it of data.items) {
  const name = it.name.trim();
  const lower = name.toLowerCase();

  if (lower.startsWith('wallet recharge')) {
    walletAndMemberships.push({ ...it, role: 'Wallet Recharge (was membership, updated to wallet)' });
  } else if (lower.includes('membership')) {
    walletAndMemberships.push({ ...it, role: 'Membership Signup' });
  } else if (name === 'brillare  dandruff shampoo' || name === 'brillare dandruff mask') {
    retailProductsStillAsService.push({ ...it, reason: 'Retail product entered without inventory selection; currently saved as item_type: "service"' });
  } else if (it.types.includes('product')) {
    alreadyFixedProducts.push(it);
  } else {
    // All other items are genuine salon services (haircuts, styling, waxing, facial, detan, hairspa, etc.)
    genuineSalonServices.push(it);
  }
}

fs.writeFileSync('categorization_report.json', JSON.stringify({
  retailProductsStillAsService,
  alreadyFixedProducts,
  walletAndMemberships,
  genuineSalonServicesCount: genuineSalonServices.length,
  genuineSalonServices: genuineSalonServices.map(s => `${s.name} (${s.types.join('/')}) - ₹${s.prices.join(', ')}`)
}, null, 2));

console.log('Report generated.');
