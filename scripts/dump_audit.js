import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

async function fullAudit() {
  const { data: items } = await supabase.from('invoice_items').select('*');
  const { data: inventory } = await supabase.from('inventory').select('*');
  const { data: services } = await supabase.from('services').select('*');

  console.log(`Auditing all ${items?.length} items...`);

  const distinct = {};
  for (const it of items) {
    const name = it.service_name?.trim();
    if (!distinct[name]) {
      distinct[name] = {
        name,
        types: new Set(),
        count: 0,
        hasInvId: 0,
        hasSrvId: 0,
        sampleItem: it
      };
    }
    distinct[name].types.add(it.item_type || 'null');
    if (it.inventory_id) distinct[name].hasInvId++;
    if (it.service_id) distinct[name].hasSrvId++;
    distinct[name].count++;
  }

  const list = Object.values(distinct).sort((a,b) => a.name.localeCompare(b.name));

  // Let's print in JSON chunks or write to a file so we can analyze all
  import('fs').then(fs => {
    fs.writeFileSync('audit_results.json', JSON.stringify({
      totalInvoiceItems: items.length,
      distinctCount: list.length,
      inventoryCount: inventory?.length || 0,
      servicesCount: services?.length || 0,
      inventoryNames: inventory?.map(i => i.name),
      distinctItems: list.map(i => ({
        name: i.name,
        types: Array.from(i.types),
        count: i.count,
        hasInvId: i.hasInvId,
        hasSrvId: i.hasSrvId,
        unitPrice: i.sampleItem.price
      }))
    }, null, 2));
    console.log('Saved audit_results.json');
  });
}
fullAudit();
