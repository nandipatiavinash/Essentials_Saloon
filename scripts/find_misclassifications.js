import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

async function findPotentialMisclassifications() {
  let allItems = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('invoice_items')
      .select('id, invoice_id, service_name, item_type, inventory_id, service_id, price, quantity')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) { console.error(error); break; }
    allItems.push(...data);
    if (data.length < pageSize) break;
    page++;
  }
  console.log('Total invoice items fetched across database:', allItems.length);

  const distinct = {};
  for (const it of allItems) {
    const name = it.service_name?.trim() || '(blank)';
    if (!distinct[name]) {
      distinct[name] = {
        name,
        count: 0,
        types: new Set(),
        hasInvId: 0,
        hasSrvId: 0,
        samplePrices: new Set(),
        itemIds: []
      };
    }
    distinct[name].count++;
    distinct[name].types.add(it.item_type || 'null');
    if (it.inventory_id) distinct[name].hasInvId++;
    if (it.service_id) distinct[name].hasSrvId++;
    distinct[name].samplePrices.add(it.price);
    distinct[name].itemIds.push(it.id);
  }

  const itemsList = Object.values(distinct);

  fs.writeFileSync('all_invoice_items_summary.json', JSON.stringify({
    totalRows: allItems.length,
    distinctCount: itemsList.length,
    items: itemsList.map(i => ({
      name: i.name,
      types: Array.from(i.types),
      count: i.count,
      hasInvId: i.hasInvId,
      hasSrvId: i.hasSrvId,
      prices: Array.from(i.samplePrices)
    }))
  }, null, 2));

  console.log('Dumped summary of all distinct invoice items.');
}

findPotentialMisclassifications().catch(console.error);
