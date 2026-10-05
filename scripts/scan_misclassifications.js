import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function scan() {
  const { data: items, error: itemsErr } = await supabase
    .from('invoice_items')
    .select('*');
  
  if (itemsErr) {
    console.error('Error fetching items:', itemsErr);
    return;
  }

  const { data: inventory, error: invErr } = await supabase
    .from('inventory')
    .select('id, name, type');

  const { data: services, error: srvErr } = await supabase
    .from('services')
    .select('id, name');

  console.log(`Fetched ${items?.length} invoice_items, ${inventory?.length || 0} inventory items, ${services?.length || 0} services.`);

  const invNames = new Set((inventory || []).map(i => i.name.toLowerCase().trim()));
  const srvNames = new Set((services || []).map(s => s.name.toLowerCase().trim()));

  const distinctItems = {};
  for (const it of (items || [])) {
    const rawName = it.service_name || '';
    const norm = rawName.trim();
    if (!distinctItems[norm]) {
      distinctItems[norm] = {
        name: norm,
        types: new Set(),
        hasInvId: 0,
        hasSrvId: 0,
        count: 0,
        sampleIds: []
      };
    }
    distinctItems[norm].types.add(it.item_type || '(null)');
    if (it.inventory_id) distinctItems[norm].hasInvId++;
    if (it.service_id) distinctItems[norm].hasSrvId++;
    distinctItems[norm].count++;
    if (distinctItems[norm].sampleIds.length < 3) distinctItems[norm].sampleIds.push(it.id);
  }

  const sorted = Object.values(distinctItems).sort((a, b) => a.name.localeCompare(b.name));

  console.log('\n=== COMPLETE INVOICE ITEM AUDIT ===');
  for (const item of sorted) {
    const types = Array.from(item.types).join(', ');
    const lower = item.name.toLowerCase();
    const inInv = invNames.has(lower);
    const inSrv = srvNames.has(lower);

    let flag = '';
    if (item.name.toLowerCase().startsWith('wallet')) {
      flag = '💳 [WALLET]';
    } else if (item.name.toLowerCase().includes('membership')) {
      flag = '⭐ [MEMBERSHIP]';
    } else if (types.includes('service') && inInv && !inSrv) {
      flag = '⚠️ [MISCLASSIFIED: In Inventory as Product, but saved as service!]';
    } else if (types.includes('product') && inSrv && !inInv) {
      flag = '⚠️ [MISCLASSIFIED: In Services table, but saved as product!]';
    }

    console.log(`[${types}] "${item.name}" (Count: ${item.count}, inv_id: ${item.hasInvId}, srv_id: ${item.hasSrvId}) ${flag}`);
  }
}

scan().catch(console.error);
