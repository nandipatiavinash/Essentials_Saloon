import { supabase } from "./supabase";

const t = (name) => supabase.from(name);
const optional = async (promise, fallback) => {
  try {
    const res = await promise;
    if (res.error) {
      console.warn("Optional admin data unavailable:", res.error.message);
      return fallback;
    }
    return res.data ?? fallback;
  } catch (err) {
    console.warn("Optional admin data threw:", err.message);
    return fallback;
  }
};

export function getISTDate() {
  const d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * 5.5));
}

export function parseDateOrIST(val) {
  if (!val) return getISTDate();
  let str = String(val);
  if (str.includes("T") && !str.endsWith("Z") && !str.includes("+") && !str.match(/-\d{2}:\d{2}$/)) {
    str += "+05:30";
  }
  const date = new Date(str);
  if (isNaN(date.getTime())) return getISTDate();
  return date;
}

// ─── Fetch all public data ────────────────────────────────────────────────────
export async function fetchPublicData() {
  const [cats, svcs, offs, gal, settRes] = await Promise.all([
    t("categories").select("*").order("id"),
    t("services").select("*").eq("active", true).order("id"),
    t("offers").select("*").eq("active", true).order("id"),
    t("gallery").select("*").order("id"),
    t("salon_settings").select("*").eq("id", 1).maybeSingle(),
  ]);
  const errs = [cats, svcs, offs, gal, settRes].map((r) => r.error).filter(Boolean);
  if (errs.length) throw errs[0];
  return {
    categories: cats.data ?? [],
    services: (svcs.data ?? []).map(norm),
    offers: offs.data ?? [],
    gallery: gal.data ?? [],
    settings: settRes.data ?? {},
  };
}

// ─── Fetch all admin data ─────────────────────────────────────────────────────
export async function fetchAdminData() {
  const [
    cats, svcs, offs, gal, settRes, bkgs,
    invoices, customers, transactions, reportLogs,
    staff, attendance, inventory, cashRegister, attendanceLogs,
    staffPayments, staffAdvances, expenses, expenseCategories, tipSplits, reviews,
    fixedExpenses, fixedExpensePayments
  ] = await Promise.all([
    optional(t("categories").select("*").order("id"), []),
    optional(t("services").select("*").order("id"), []),
    optional(t("offers").select("*").order("id"), []),
    optional(t("gallery").select("*").order("id"), []),
    optional(t("salon_settings").select("*").eq("id", 1).maybeSingle(), {}),
    optional(t("bookings").select("*").order("created_at", { ascending: false }), []),
    optional(t("invoices").select("*, customers(*), invoice_items(*)").order("billing_at", { ascending: false }).limit(250), []),
    optional(t("customers").select("*").order("last_visit_at", { ascending: false }).limit(500), []),
    optional(t("transactions").select("*").order("created_at", { ascending: false }).limit(250), []),
    optional(t("report_logs").select("*").order("created_at", { ascending: false }).limit(100), []),
    optional(t("staff").select("*").order("name"), []),
    optional(t("attendance").select("*").order("date", { ascending: false }), []),
    optional(t("inventory").select("*").order("name"), []),
    optional(t("cash_register").select("*").order("date", { ascending: false }).limit(60), []),
    optional(t("attendance_logs").select("*").order("created_at", { ascending: false }).limit(200), []),
    optional(t("staff_payments").select("*").order("work_month", { ascending: false }), []),
    optional(t("staff_advances").select("*").order("date", { ascending: false }), []),
    optional(t("expenses").select("*").order("date", { ascending: false }).limit(300), []),
    optional(t("expense_categories").select("*").order("sort_order"), []),
    optional(t("invoice_tip_splits").select("*").order("created_at", { ascending: false }).limit(500), []),
    optional(t("reviews").select("*").order("created_at", { ascending: false }).limit(200), []),
    optional(t("fixed_expenses").select("*").order("created_at", { ascending: true }), []),
    optional(t("fixed_expense_payments").select("*").order("work_month", { ascending: false }), []),
  ]);

  // Clean up orphaned staff advance expenses
  const advIds = new Set((staffAdvances ?? []).map(a => a.id));
  const orphanedExpenseIds = (expenses ?? [])
    .filter(e => e.category === "Staff Advance" && e.is_system_entry && e.source_id && !advIds.has(e.source_id))
    .map(e => e.id);
  if (orphanedExpenseIds.length > 0) {
    t("expenses").delete().in("id", orphanedExpenseIds).then(({ error }) => {
      if (error) console.error("Orphaned expenses cleanup failed:", error.message);
    });
  }
  const cleanExpenses = (expenses ?? []).filter(e => !orphanedExpenseIds.includes(e.id));

  return {
    categories: cats ?? [],
    services: (svcs ?? []).map(norm),
    offers: offs ?? [],
    gallery: gal ?? [],
    settings: settRes ?? {},
    bookings: (bkgs ?? []).map(normBooking),
    invoices: (invoices ?? []).map(normInvoice),
    customers: (customers ?? []).map(normCustomer),
    transactions: transactions ?? [],
    reportLogs: reportLogs ?? [],
    staff: staff ?? [],
    attendance: attendance ?? [],
    inventory: inventory ?? [],
    cashRegister: cashRegister ?? [],
    attendanceActivityLogs: attendanceLogs ?? [],
    staffPayments: staffPayments ?? [],
    staffAdvances: staffAdvances ?? [],
    expenses: cleanExpenses,
    expenseCategories: expenseCategories ?? [],
    tipSplits: tipSplits ?? [],
    reviews: reviews ?? [],
    fixedExpenses: fixedExpenses ?? [],
    fixedExpensePayments: fixedExpensePayments ?? [],
  };
}

// ─── Services ─────────────────────────────────────────────────────────────────
export async function createService(data) {
  const { data: row, error } = await t("services").insert(toRow(data)).select().single();
  if (error) throw error;
  return norm(row);
}
export async function updateService(id, data) {
  const { data: row, error } = await t("services").update(toRow(data)).eq("id", id).select().single();
  if (error) throw error;
  return norm(row);
}
export async function patchService(id, patch) {
  const { data: row, error } = await t("services").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return norm(row);
}
export async function deleteService(id) {
  const { error } = await t("services").delete().eq("id", id);
  if (error) throw error;
}

// ─── Categories ───────────────────────────────────────────────────────────────
export async function createCategory(data) {
  const { data: row, error } = await t("categories").insert(data).select().single();
  if (error) throw error;
  return row;
}
export async function updateCategory(id, data) {
  const { id: _, ...rest } = data;
  const { data: row, error } = await t("categories").update(rest).eq("id", id).select().single();
  if (error) throw error;
  return row;
}
export async function deleteCategory(id) {
  const { error } = await t("categories").delete().eq("id", id);
  if (error) throw error;
}

// ─── Offers ───────────────────────────────────────────────────────────────────
export async function createOffer(data) {
  const { data: row, error } = await t("offers").insert(data).select().single();
  if (error) throw error;
  return row;
}
export async function updateOffer(id, data) {
  const { id: _, ...rest } = data;
  const { data: row, error } = await t("offers").update(rest).eq("id", id).select().single();
  if (error) throw error;
  return row;
}
export async function deleteOffer(id) {
  const { error } = await t("offers").delete().eq("id", id);
  if (error) throw error;
}

// ─── Gallery ──────────────────────────────────────────────────────────────────
export async function createGalleryItem(data) {
  const { data: row, error } = await t("gallery").insert(data).select().single();
  if (error) throw error;
  return row;
}
export async function updateGalleryItem(id, data) {
  const { id: _, ...rest } = data;
  const { data: row, error } = await t("gallery").update(rest).eq("id", id).select().single();
  if (error) throw error;
  return row;
}
export async function deleteGalleryItem(id) {
  const { error } = await t("gallery").delete().eq("id", id);
  if (error) throw error;
}

// ─── Settings ─────────────────────────────────────────────────────────────────
export async function saveSettings(settings) {
  const { id: _id, ...rest } = settings;
  const { data, error } = await t("salon_settings").upsert({ id: 1, ...rest }).select().single();
  if (error) throw error;
  return data;
}

// ─── Bookings ─────────────────────────────────────────────────────────────────
export async function createBooking(form) {
  const { data, error } = await t("bookings")
    .insert({
      name: form.name,
      phone: form.phone,
      service: form.service || null,
      booking_date: form.date || null,
      booking_time: form.time || null,
      notes: form.notes || null,
      status: "pending",
    })
    .select()
    .single();
  if (error) throw error;
  return normBooking(data);
}
export async function updateBookingStatus(id, status) {
  const { data, error } = await t("bookings").update({ status }).eq("id", id).select().single();
  if (error) throw error;
  return normBooking(data);
}

export async function updateBooking(id, data) {
  const { id: _, created_at: _c, ...rest } = data;
  const { data: row, error } = await t("bookings").update(rest).eq("id", id).select().single();
  if (error) throw error;
  return normBooking(row);
}

// ─── Salon ERP / POS ─────────────────────────────────────────────────────────
export async function findCustomerByPhone(term) {
  if (!term?.trim()) return null;
  const cleanPhone = normalizePhone(term);
  let query = t("customers").select("*");
  if (cleanPhone) {
    query = query.or(`mobile.eq.${cleanPhone},membership_id.eq.${term.trim()}`);
  } else {
    query = query.eq("membership_id", term.trim());
  }
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data ? normCustomer(data) : null;
}

export async function fetchInvoiceDetails(id) {
  const [invoiceRes, itemsRes] = await Promise.all([
    t("invoices").select("*, customers(*)").eq("id", id).single(),
    t("invoice_items").select("*, services(*)").eq("invoice_id", id).order("id"),
  ]);
  if (invoiceRes.error) throw invoiceRes.error;
  if (itemsRes.error) throw itemsRes.error;
  return {
    invoice: normInvoice(invoiceRes.data),
    items: (itemsRes.data ?? []).map((row) => ({
      id: row.id,
      service_id: row.service_id,
      service_name: row.service_name || row.services?.name || "Service",
      quantity: Number(row.quantity || 1),
      price: Number(row.price || 0),
      total: Number(row.total || 0),
      staff_name: row.staff_name || "",
    })),
  };
}

export async function saveInvoice(payload) {
  const mobile = normalizePhone(payload.mobile);
  if (!payload.client_name?.trim()) throw new Error("Client name is required");
  if (!mobile) throw new Error("A valid mobile number is required");
  if (!payload.items?.length) throw new Error("Add at least one service");

  const totals = calculateInvoiceTotals(payload);
  const { data: userRes } = await supabase.auth.getUser();

  const { data: existingCust } = await t("customers")
    .select("id, is_member, membership_id, membership_tier, membership_start, membership_end")
    .eq("mobile", mobile)
    .maybeSingle();

  let isMember = !!payload.is_member;
  let mId = payload.membership_id;
  let mTier = payload.membership_tier;
  let mStart = payload.membership_start;
  let mEnd = payload.membership_end;

  if (existingCust?.is_member && !payload.is_member_signup && !payload.is_member) {
    isMember = true;
    mId = existingCust.membership_id;
    mTier = existingCust.membership_tier;
    mStart = existingCust.membership_start;
    mEnd = existingCust.membership_end;
  }

  if (isMember) {
    if (!mId) {
      const year = parseDateOrIST(payload.billing_at).getFullYear();
      const rand = Math.floor(10000 + Math.random() * 90000);
      mId = `MEM-${year}-${rand}`;
    }
    if (!mTier || mTier === "Regular") mTier = "Member";
    if (!mStart) mStart = parseDateOrIST(payload.billing_at).toISOString().slice(0, 10);
    if (!mEnd) {
      const nextYear = parseDateOrIST(payload.billing_at);
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      mEnd = nextYear.toISOString().slice(0, 10);
    }
  }

  const { data: customer, error: customerError } = await t("customers")
    .upsert({
      id: payload.customer_id || existingCust?.id || undefined,
      name: payload.client_name.trim(),
      mobile,
      notes: payload.customer_notes || null,
      last_visit_at: payload.billing_at || getISTDate().toISOString(),
      total_spend: totals.total,
      visit_count: 1,
      preferred_services: payload.items.map((item) => item.service_name).filter(Boolean),
      is_member: isMember,
      membership_id: isMember ? mId : null,
      membership_tier: isMember ? mTier : "Regular",
      membership_start: isMember ? mStart : null,
      membership_end: isMember ? mEnd : null,
    }, { onConflict: "mobile" })
    .select()
    .single();
  if (customerError) throw customerError;

  const invoiceRow = {
    invoice_number: payload.invoice_number || await makeInvoiceNumber(payload.billing_at),
    customer_id: customer.id,
    client_name: payload.client_name.trim(),
    mobile,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    tax_rate: Number(payload.tax_rate || 0),
    tip: Number(payload.tip || 0),
    total: totals.total,
    payment_method: payload.payment_method || "Cash",
    transaction_id: payload.transaction_id || null,
    notes: payload.notes || null,
    staff_name: payload.staff_name || null,
    status: payload.status || "paid",
    refund_status: payload.refund_status || "none",
    created_by: userRes?.user?.id || null,
    billing_at: payload.billing_at || getISTDate().toISOString(),
  };

  const invoiceReq = payload.id
    ? t("invoices").update(invoiceRow).eq("id", payload.id)
    : t("invoices").insert(invoiceRow);
  const { data: invoice, error: invoiceError } = await invoiceReq.select().single();
  if (invoiceError) throw invoiceError;

  if (payload.id) {
    const { error: deleteError } = await t("invoice_items").delete().eq("invoice_id", payload.id);
    if (deleteError) throw deleteError;
  }

  const itemRows = payload.items.map((item) => ({
    invoice_id: invoice.id,
    service_id: item.item_type === "product" ? null : (item.service_id || null),
    inventory_id: item.item_type === "product" ? (item.inventory_id || null) : null,
    service_name: item.service_name,
    item_type: item.item_type || "service",
    quantity: Number(item.quantity || 1),
    price: Number(item.price || 0),
    total: Number(item.quantity || 1) * Number(item.price || 0),
    staff_name: item.staff_name || payload.staff_name || null,
    tax_inclusive: item.item_type === "service" ? (item.tax_inclusive !== false) : true,
  }));
  const { error: itemsError } = await t("invoice_items").insert(itemRows);
  if (itemsError) throw itemsError;

  // Decrement stock for any product items
  const productItems = payload.items.filter(item => item.item_type === "product" && item.inventory_id);
  for (const pItem of productItems) {
    const { data: invRow } = await t("inventory").select("stock_qty").eq("id", pItem.inventory_id).single();
    if (invRow) {
      const newQty = Math.max(0, Number(invRow.stock_qty) - Number(pItem.quantity || 1));
      await t("inventory").update({ stock_qty: newQty, updated_at: getISTDate().toISOString() }).eq("id", pItem.inventory_id);
    }
  }

  const { error: txnError } = await t("transactions").upsert({
    invoice_id: invoice.id,
    customer_id: customer.id,
    payment_method: invoice.payment_method,
    transaction_id: invoice.transaction_id,
    amount: invoice.total,
    status: invoice.status === "refunded" ? "refunded" : "success",
    paid_at: invoice.billing_at,
  }, { onConflict: "invoice_id" });
  if (txnError) throw txnError;

  await refreshCustomerRollup(customer.id);
  return normInvoice({ ...invoice, customers: customer });
}

export async function deleteInvoice(id) {
  const { data: inv, error: invError } = await t("invoices").select("customer_id").eq("id", id).maybeSingle();
  if (invError) throw invError;

  const { data: items, error: itemsError } = await t("invoice_items").select("*").eq("invoice_id", id);
  if (itemsError) throw itemsError;

  const productItems = (items || []).filter(item => item.item_type === "product" && item.inventory_id);
  for (const pItem of productItems) {
    const { data: invRow } = await t("inventory").select("stock_qty").eq("id", pItem.inventory_id).single();
    if (invRow) {
      const newQty = Number(invRow.stock_qty) + Number(pItem.quantity || 1);
      await t("inventory").update({ stock_qty: newQty, updated_at: getISTDate().toISOString() }).eq("id", pItem.inventory_id);
    }
  }

  const { error } = await t("invoices").delete().eq("id", id);
  if (error) throw error;

  if (inv?.customer_id) {
    await refreshCustomerRollup(inv.customer_id);
  }
}

export async function searchInvoices(term = "") {
  const query = t("invoices").select("*, customers(*)").order("billing_at", { ascending: false }).limit(100);
  if (!term.trim()) {
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(normInvoice);
  }
  const safe = term.trim().replaceAll("%", "");
  const { data, error } = await query.or(`invoice_number.ilike.%${safe}%,client_name.ilike.%${safe}%,mobile.ilike.%${safe}%,transaction_id.ilike.%${safe}%`);
  if (error) throw error;
  return (data ?? []).map(normInvoice);
}

export async function fetchAnalyticsRange({ from, to } = {}) {
  let query = t("invoices").select("*, invoice_items(*)").order("billing_at", { ascending: true });
  if (from) query = query.gte("billing_at", from);
  if (to) query = query.lte("billing_at", to);
  const { data, error } = await query;
  if (error) throw error;
  return buildAnalytics(data ?? []);
}

export async function logReport(report) {
  const { data, error } = await t("report_logs").insert(report).select().single();
  if (error) throw error;
  return data;
}

export async function importHistoricalInvoices(rows, source = {}) {
  const results = { inserted: 0, skipped: 0, errors: [] };
  const { data: fileRow, error: fileError } = await t("imported_files")
    .insert({
      file_name: source.file_name || "manual-import",
      file_type: source.file_type || "csv",
      row_count: rows.length,
      status: "processing",
      mapping: source.mapping || {},
    })
    .select()
    .single();
  if (fileError) throw fileError;

  for (const row of rows) {
    try {
      if (row.invoice_number) {
        const { data: existing, error } = await t("invoices").select("id").eq("invoice_number", row.invoice_number).maybeSingle();
        if (error) throw error;
        if (existing) {
          results.skipped += 1;
          continue;
        }
      }
      await saveInvoice({
        client_name: row.client_name,
        mobile: row.mobile,
        invoice_number: row.invoice_number || undefined,
        payment_method: row.payment_method || "Cash",
        transaction_id: row.transaction_id || "",
        discount: Number(row.discount || 0),
        tax_rate: Number(row.tax_rate || 0),
        notes: row.notes || "Imported historical invoice",
        staff_name: row.staff_name || "",
        billing_at: row.billing_at || new Date().toISOString(),
        items: [{
          service_id: row.service_id || null,
          service_name: row.service_name || "Imported service",
          quantity: Number(row.quantity || 1),
          price: Number(row.price || row.total || 0),
        }],
      });
      results.inserted += 1;
    } catch (err) {
      results.errors.push({ row, message: err.message });
    }
  }

  await t("imported_files").update({
    status: results.errors.length ? "completed_with_errors" : "completed",
    processed_rows: results.inserted,
    error_rows: results.errors.length,
    errors: results.errors.slice(0, 100),
  }).eq("id", fileRow.id);
  return results;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toRow(d) {
  return {
    name: d.name,
    category: d.category,
    description: d.description,
    duration: d.duration,
    price_from: d.price_from,
    price_to: d.price_to ?? null,
    member_price: d.member_price ?? null,
    featured: !!d.featured,
    active: d.active !== false,
    image: d.image,
    tax_inclusive: d.tax_inclusive !== false,
  };
}
function norm(row) {
  return {
    ...row,
    price_from: Number(row.price_from),
    price_to: row.price_to != null ? Number(row.price_to) : null,
    member_price: row.member_price != null ? Number(row.member_price) : null,
    featured: !!row.featured,
    active: !!row.active,
  };
}
function normBooking(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    service: row.service,
    date: row.booking_date,
    time: row.booking_time,
    notes: row.notes,
    status: row.status,
    follow_up_date: row.follow_up_date || null,
    follow_up_notes: row.follow_up_notes || "",
    assigned_staff: row.assigned_staff || "",
    created_at: row.created_at,
  };
}

export function calculateInvoiceTotals(payload) {
  const items = payload.items ?? [];
  const discountPct = Number(payload.discount || 0);
  const taxRate = payload.tax_enabled === false ? 0 : Number(payload.tax_rate || 5);
  const taxEnabled = payload.tax_enabled !== false;

  let serviceSubtotal = 0;
  let productSubtotal = 0;
  let membershipSubtotal = 0;
  let totalDiscount = 0;
  let totalTaxable = 0;
  let totalTax = 0;

  items.forEach(item => {
    const qty = Number(item.quantity || 1);
    const price = Number(item.price || 0);
    const rawTotal = qty * price;

    if (item.item_type === "product") {
      productSubtotal += rawTotal;
      const itemDiscount = rawTotal * (discountPct / 100);
      totalDiscount += itemDiscount;
      return;
    }
    if (item.item_type === "membership") {
      membershipSubtotal += rawTotal;
      const itemDiscount = rawTotal * (discountPct / 100);
      totalDiscount += itemDiscount;
      return;
    }

    // It's a service
    const isInclusive = item.tax_inclusive !== false;
    const rawBase = isInclusive ? (rawTotal / 1.05) : rawTotal;
    serviceSubtotal += rawBase;

    const itemDiscount = rawBase * (discountPct / 100);
    totalDiscount += itemDiscount;

    const discountedBase = rawBase - itemDiscount;

    if (taxEnabled && taxRate > 0) {
      if (isInclusive) {
        const tax = discountedBase * (taxRate / 100);
        totalTaxable += discountedBase;
        totalTax += tax;
      } else {
        const base = discountedBase;
        const tax = discountedBase * (taxRate / 100);
        totalTaxable += base;
        totalTax += tax;
      }
    } else {
      totalTaxable += discountedBase;
    }
  });

  const subtotal = serviceSubtotal + productSubtotal + membershipSubtotal;

  const productSubtotalDiscounted = items
    .filter(item => item.item_type === "product")
    .reduce((sum, item) => sum + (Number(item.quantity || 1) * Number(item.price || 0) * (1 - discountPct / 100)), 0);

  const membershipSubtotalDiscounted = items
    .filter(item => item.item_type === "membership")
    .reduce((sum, item) => sum + (Number(item.quantity || 1) * Number(item.price || 0) * (1 - discountPct / 100)), 0);

  const tip = Number(payload.tip || 0);
  const totalBeforeRounding = totalTaxable + totalTax + productSubtotalDiscounted + membershipSubtotalDiscounted + tip;
  const roundedTotal = Math.round(totalBeforeRounding);
  const roundOff = roundedTotal - totalBeforeRounding;

  return {
    subtotal: roundMoney(subtotal),
    serviceSubtotal: roundMoney(serviceSubtotal),
    productSubtotal: roundMoney(productSubtotal),
    membershipSubtotal: roundMoney(membershipSubtotal),
    discount: roundMoney(totalDiscount),
    taxable: roundMoney(totalTaxable),
    tax: roundMoney(totalTax),
    tip: roundMoney(tip),
    roundOff: roundMoney(roundOff),
    total: roundMoney(roundedTotal),
  };
}

export function format12HourTime(timeStr) {
  if (!timeStr) return "—";
  if (timeStr.includes("AM") || timeStr.includes("PM")) return timeStr;
  const parts = timeStr.split(":");
  if (parts.length < 2) return timeStr;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursStr = String(hours).padStart(2, "0");
  return `${hoursStr}:${minutes} ${ampm}`;
}

export function buildAnalytics(invoices = []) {
  const paid = invoices.filter((invoice) => invoice.status !== "void");
  const revenue = paid.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
  
  const paymentBreakdown = {};
  paid.forEach((invoice) => {
    const payment = invoice.payment_method || "Unknown";
    const total = Number(invoice.total || 0);
    if (payment === "Cash + UPI" && invoice.transaction_id && invoice.transaction_id.includes("cash:")) {
      const parts = invoice.transaction_id.split("|");
      let cashAmt = 0;
      let upiAmt = 0;
      parts.forEach(p => {
        if (p.startsWith("cash:")) cashAmt = Number(p.replace("cash:", "")) || 0;
        if (p.startsWith("upi:")) upiAmt = Number(p.replace("upi:", "")) || 0;
      });
      paymentBreakdown["Cash"] = (paymentBreakdown["Cash"] || 0) + cashAmt;
      paymentBreakdown["UPI"] = (paymentBreakdown["UPI"] || 0) + upiAmt;
    } else {
      paymentBreakdown[payment] = (paymentBreakdown[payment] || 0) + total;
    }
  });
  
  Object.keys(paymentBreakdown).forEach(k => {
    paymentBreakdown[k] = roundMoney(paymentBreakdown[k]);
  });

  const byDay = {};
  const byMonth = {};
  const byHour = {};
  const serviceTotals = {};
  const customerTotals = {};

  paid.forEach((invoice) => {
    const date = new Date(invoice.billing_at || invoice.created_at);
    const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
    const istDate = new Date(utc + (3600000 * 5.5));
    const day = istDate.toISOString().slice(0, 10);
    const month = day.slice(0, 7);
    const hour = String(istDate.getHours()).padStart(2, "0") + ":00";
    byDay[day] = (byDay[day] || 0) + Number(invoice.total || 0);
    byMonth[month] = (byMonth[month] || 0) + Number(invoice.total || 0);
    byHour[hour] = (byHour[hour] || 0) + Number(invoice.total || 0);
    customerTotals[invoice.client_name || "Walk-in"] = (customerTotals[invoice.client_name || "Walk-in"] || 0) + Number(invoice.total || 0);
    (invoice.invoice_items || []).forEach((item) => {
      const name = item.service_name || "Service";
      serviceTotals[name] = (serviceTotals[name] || 0) + Number(item.total || 0);
    });
  });

  const sortedDays = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b));
  const todayKey = getISTDate().toISOString().slice(0, 10);
  const monthKey = todayKey.slice(0, 7);
  const weekAgo = getISTDate();
  weekAgo.setDate(weekAgo.getDate() - 6);

  return {
    revenue: roundMoney(revenue),
    billCount: paid.length,
    averageBill: paid.length ? roundMoney(revenue / paid.length) : 0,
    todayRevenue: roundMoney(byDay[todayKey] || 0),
    monthlyRevenue: roundMoney(byMonth[monthKey] || 0),
    weeklyRevenue: roundMoney(sortedDays.filter(([day]) => new Date(day) >= weekAgo).reduce((sum, [, value]) => sum + value, 0)),
    paymentBreakdown,
    dailySeries: sortedDays.map(([date, total]) => ({ date, total: roundMoney(total) })),
    monthlySeries: Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([month, total]) => ({ month, total: roundMoney(total) })),
    hourlySeries: Object.entries(byHour).sort(([a], [b]) => a.localeCompare(b)).map(([hour, total]) => ({ hour, total: roundMoney(total) })),
    topServices: topEntries(serviceTotals),
    topCustomers: topEntries(customerTotals),
  };
}

function normInvoice(row) {
  return {
    ...row,
    customer: row.customers || null,
    invoice_items: row.invoice_items || [],
    subtotal: Number(row.subtotal || 0),
    discount: Number(row.discount || 0),
    tax: Number(row.tax || 0),
    tip: Number(row.tip || 0),
    total: Number(row.total || 0),
  };
}

function normCustomer(row) {
  return {
    ...row,
    total_spend: Number(row.total_spend || 0),
    visit_count: Number(row.visit_count || 0),
    is_member: !!row.is_member,
    membership_tier: row.membership_tier || "Regular",
    membership_start: row.membership_start || null,
    membership_end: row.membership_end || null,
    membership_id: row.membership_id || null,
  };
}

function normalizePhone(phone = "") {
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length < 8) return "";
  return digits.length > 10 ? digits.slice(-10) : digits;
}

async function makeInvoiceNumber(billingAt) {
  // Use the billing date if provided, otherwise fall back to today (IST)
  let dateStr;
  if (billingAt) {
    // billingAt may be an ISO string (with or without time) or a plain date string
    dateStr = String(billingAt).slice(0, 10).replaceAll("-", ""); // YYYYMMDD
  } else {
    dateStr = getISTDate().toISOString().slice(0, 10).replaceAll("-", "");
  }
  const prefix = `INV-${dateStr}-`;
  const { data, error } = await supabase
    .from("invoices")
    .select("invoice_number")
    .like("invoice_number", `${prefix}%`)
    .order("invoice_number", { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) return `${prefix}001`;
  const last = data[0].invoice_number;
  const seq = parseInt(last.replace(prefix, ""), 10) || 0;
  return `${prefix}${String(seq + 1).padStart(3, "0")}`;
}

function roundMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function groupSum(rows, key, amountKey) {
  return rows.reduce((acc, row) => {
    const label = row[key] || "Unknown";
    acc[label] = roundMoney((acc[label] || 0) + Number(row[amountKey] || 0));
    return acc;
  }, {});
}

function topEntries(obj, limit = 8) {
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, value]) => ({ name, value: roundMoney(value) }));
}

async function refreshCustomerRollup(customerId) {
  const { data, error } = await t("invoices")
    .select("total, billing_at, invoice_items(service_name)")
    .eq("customer_id", customerId)
    .neq("status", "void");
  if (error) return;
  const totalSpend = (data ?? []).reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
  const services = {};
  let lastVisit = null;
  (data ?? []).forEach((invoice) => {
    if (!lastVisit || new Date(invoice.billing_at) > new Date(lastVisit)) lastVisit = invoice.billing_at;
    (invoice.invoice_items ?? []).forEach((item) => {
      services[item.service_name] = (services[item.service_name] || 0) + 1;
    });
  });
  await t("customers").update({
    total_spend: roundMoney(totalSpend),
    visit_count: data?.length || 0,
    last_visit_at: lastVisit,
    preferred_services: topEntries(services, 5).map((item) => item.name),
  }).eq("id", customerId);
}

// ─── Staff & HR CRUD ──────────────────────────────────────────────────────────
export async function createStaff(data) {
  const { data: row, error } = await t("staff").insert(data).select().single();
  if (error) throw error;
  return row;
}

export async function updateStaff(id, data) {
  const { id: _, created_at: _c, updated_at: _u, ...rest } = data;
  const { data: row, error } = await t("staff").update(rest).eq("id", id).select().single();
  if (error) throw error;
  return row;
}

export async function deleteStaff(id) {
  const { error } = await t("staff").delete().eq("id", id);
  if (error) throw error;
}

export async function saveAttendance(dateOrRows, rowsIfTwoArgs) {
  const actualRows = Array.isArray(dateOrRows) ? dateOrRows : rowsIfTwoArgs;
  const fallbackDate = Array.isArray(dateOrRows) ? null : dateOrRows;

  const cleanRows = (actualRows || []).map(r => ({
    staff_id: r.staff_id,
    date: r.date || fallbackDate,
    status: r.status,
    check_in: r.check_in || null,
    check_out: r.check_out || null,
    notes: r.notes || null,
    updated_at: new Date().toISOString()
  }));
  const { data, error } = await t("attendance").upsert(cleanRows, { onConflict: "staff_id,date" }).select();
  if (error) throw error;
  return data;
}

export async function createAttendanceLog(log) {
  const { data, error } = await t("attendance_logs").insert({
    staff_id: log.staff_id || null,
    date: log.date || new Date().toISOString().slice(0, 10),
    action_type: log.action_type || "manual",
    details: log.details,
    timestamp: new Date().toISOString()
  }).select();
  if (error) throw error;
  return data;
}


// ─── Inventory CRUD ───────────────────────────────────────────────────────────
export async function createInventoryItem(data) {
  const { data: row, error } = await t("inventory").insert(data).select().single();
  if (error) throw error;
  return row;
}

export async function updateInventoryItem(id, data) {
  const { id: _, created_at: _c, updated_at: _u, ...rest } = data;
  const { data: row, error } = await t("inventory").update(rest).eq("id", id).select().single();
  if (error) throw error;
  return row;
}

export async function deleteInventoryItem(id) {
  const { error } = await t("inventory").delete().eq("id", id);
  if (error) throw error;
}

// ─── Cash Register operations ───────────────────────────────────────────────
export async function openCashRegister(date, openingCash) {
  const { data: row, error } = await t("cash_register")
    .upsert({
      date,
      opening_cash: Number(openingCash),
      status: "open",
      expenses: 0,
      expense_notes: "",
      closed_at: null
    }, { onConflict: "date" })
    .select()
    .single();
  if (error) throw error;
  return row;
}

export async function updateCashRegisterExpenses(id, expenses, expenseNotes) {
  const { data: row, error } = await t("cash_register")
    .update({
      expenses: Number(expenses),
      expense_notes: expenseNotes,
      updated_at: new Date().toISOString()
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return row;
}

export async function closeCashRegister(id, closingCash, notes) {
  const { data: row, error } = await t("cash_register")
    .update({
      closing_cash: Number(closingCash),
      notes,
      status: "closed",
      closed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return row;
}

export async function reopenCashRegister(id) {
  const { data: row, error } = await t("cash_register")
    .update({
      status: "open",
      closed_at: null,
      closing_cash: null,
      notes: null,
      updated_at: new Date().toISOString()
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return row;
}

// ─── Customer Membership Update ──────────────────────────────────────────────
export async function updateCustomerMembership(customerId, details) {
  const { data: row, error } = await t("customers")
    .update({
      name: details.name,
      mobile: details.mobile,
      is_member: !!details.is_member,
      membership_id: details.membership_id || null,
      membership_tier: details.membership_tier || "Regular",
      membership_start: details.membership_start || null,
      membership_end: details.membership_end || null,
      updated_at: new Date().toISOString()
    })
    .eq("id", customerId)
    .select()
    .single();
  if (error) throw error;
  return normCustomer(row);
}

// ─── EOD Email Sending ────────────────────────────────────────────────────────
export async function sendEodEmailReport(reportHtml, textContent, adminEmail) {
  try {
    await logReport({
      report_type: "eod_email",
      recipient: adminEmail,
      status: "sent",
      provider: "gmail",
      payload: { body: textContent },
      sent_at: new Date().toISOString()
    });
  } catch (e) {
    console.warn("Could not log EOD email to DB:", e.message);
  }

  const subject = encodeURIComponent("Toni & Guy Essensuals Gorantla - EOD Report - " + new Date().toLocaleDateString("en-IN"));
  const body = encodeURIComponent(textContent);
  window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${adminEmail}&su=${subject}&body=${body}`, "_blank");
  return true;
}

export async function uploadImage(file, bucketName = "salon-images") {
  const fileExt = file.name.split(".").pop();
  const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
  const filePath = `uploads/${fileName}`;

  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(filePath, file);

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from(bucketName)
    .getPublicUrl(filePath);

  return publicUrl;
}

export async function createCustomer(data) {
  const { data: row, error } = await t("customers")
    .upsert({
      name: data.name.trim(),
      mobile: data.mobile.trim(),
      notes: data.notes || null,
      is_member: !!data.is_member,
      membership_tier: data.membership_tier || "Regular",
      membership_start: data.membership_start || null,
      membership_end: data.membership_end || null,
      membership_id: data.membership_id || null,
    }, { onConflict: "mobile" })
    .select()
    .single();
  if (error) throw error;
  return normCustomer(row);
}

// ─── Reset Database - Clear Client and Transaction/Billing History ──────────
export async function cleanDemographicData() {
  // 1. Delete invoice items
  const { error: errItems } = await supabase.from("invoice_items").delete().gte("quantity", 0);
  if (errItems) throw errItems;

  // 2. Delete invoices
  const { error: errInvoices } = await supabase.from("invoices").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (errInvoices) throw errInvoices;

  // 3. Delete transactions
  const { error: errTx } = await supabase.from("transactions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (errTx) throw errTx;

  // 4. Delete bookings
  const { error: errBookings } = await supabase.from("bookings").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (errBookings) throw errBookings;

  // 5. Delete attendance
  const { error: errAtt } = await supabase.from("attendance").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (errAtt) throw errAtt;

  // 6. Delete cash registers
  const { error: errCash } = await supabase.from("cash_register").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (errCash) throw errCash;

  // 7. Delete customers
  const { error: errCust } = await supabase.from("customers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (errCust) throw errCust;

  return true;
}


// ─── Tip Splits ───────────────────────────────────────────────────────────────
export async function saveTipSplits(invoiceId, splits = []) {
  await t("invoice_tip_splits").delete().eq("invoice_id", invoiceId);
  if (!splits.length) return [];
  const rows = splits.map(s => ({
    invoice_id: invoiceId,
    staff_id: s.staff_id || null,
    staff_name: s.staff_name,
    tip_amount: Number(s.tip_amount || 0),
  }));
  const { data, error } = await t("invoice_tip_splits").insert(rows).select();
  if (error) throw error;
  return data;
}

// ─── Review Token ─────────────────────────────────────────────────────────────
export async function generateAndSaveReviewToken(invoiceId) {
  const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const { error } = await t("invoices").update({ review_token: token, review_sent: true }).eq("id", invoiceId);
  if (error) throw error;
  return token;
}

export async function fetchInvoiceByReviewToken(token) {
  const { data, error } = await t("invoices")
    .select("id, invoice_number, customer_id, client_name, mobile, staff_name, review_token, review_sent, billing_at, invoice_items(service_name, item_type, staff_name)")
    .eq("review_token", token)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function submitReview(payload) {
  const { error } = await t("reviews").insert({
    invoice_id: payload.invoice_id || null,
    invoice_number: payload.invoice_number || null,
    customer_id: payload.customer_id || null,
    client_name: payload.client_name || null,
    mobile: payload.mobile || null,
    rating: Number(payload.rating),
    comment: payload.comment || null,
    staff_name: payload.staff_name || null,
    service_names: payload.service_names || null,
    review_token: payload.review_token || null,
    reviewed_at: new Date().toISOString(),
  });
  if (error) throw error;

  // Clear review_token on the invoice once submitted so it cannot be used again
  if (payload.invoice_id) {
    await t("invoices").update({ review_token: null }).eq("id", payload.invoice_id);
  }
  
  return true;
}

// ─── Staff Payments (Payroll) ─────────────────────────────────────────────────
export async function saveStaffPayment(payload) {
  const row = {
    staff_id: payload.staff_id,
    work_month: payload.work_month,
    payment_month: payload.payment_month || null,
    base_salary: Number(payload.base_salary || 0),
    tips_earned: Number(payload.tips_earned || 0),
    incentives: Number(payload.incentives || 0),
    advances_deducted: Number(payload.advances_deducted || 0),
    other_deductions: Number(payload.other_deductions || 0),
    net_payable: Number(payload.net_payable || 0),
    scheduled_payment_date: payload.scheduled_payment_date || null,
    status: payload.status || "unpaid",
    payment_method: payload.payment_method || "Cash",
    notes: payload.notes || null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await t("staff_payments")
    .upsert(row, { onConflict: "staff_id,work_month" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function markSalaryPaid(paymentId, staffId, workMonth, paymentDate, netPayable, staffName, paymentMethod = "Cash") {
  const { error: payErr } = await t("staff_payments")
    .update({ status: "paid", payment_date: paymentDate, payment_method: paymentMethod, updated_at: new Date().toISOString() })
    .eq("id", paymentId);
  if (payErr) throw payErr;

  const { error: advErr } = await t("staff_advances")
    .update({ status: "deducted", salary_payment_id: paymentId })
    .eq("staff_id", staffId)
    .eq("work_month", workMonth)
    .eq("status", "pending");
  if (advErr) throw advErr;

  const { error: expErr } = await t("expenses").insert({
    category: "Salaries",
    description: `Salary paid to ${staffName} for ${workMonth}`,
    amount: Number(netPayable),
    date: paymentDate,
    payment_method: paymentMethod,
    month: paymentDate.slice(0, 7),
    is_system_entry: true,
    source_id: paymentId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (expErr) throw expErr;
}

// ─── Staff Advances ───────────────────────────────────────────────────────────
export async function saveStaffAdvance(payload) {
  const { data, error } = await t("staff_advances").insert({
    staff_id: payload.staff_id,
    amount: Number(payload.amount),
    date: payload.date || new Date().toISOString().slice(0, 10),
    work_month: payload.work_month,
    status: "pending",
    notes: payload.notes || null,
  }).select().single();
  if (error) throw error;

  const staffName = payload.staff_name || "Staff";
  await t("expenses").insert({
    category: "Staff Advance",
    description: `Advance issued to ${staffName}`,
    amount: Number(payload.amount),
    date: payload.date || new Date().toISOString().slice(0, 10),
    payment_method: "Cash",
    month: (payload.date || new Date().toISOString().slice(0, 10)).slice(0, 7),
    is_system_entry: true,
    source_id: data.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  return data;
}

export async function deleteStaffAdvance(id) {
  const { error } = await t("staff_advances").delete().eq("id", id).eq("status", "pending");
  if (error) throw error;

  // Delete the corresponding cash drawer payout expense entry
  await t("expenses").delete().eq("source_id", id).eq("is_system_entry", true);
}

// ─── Expenses ─────────────────────────────────────────────────────────────────
export async function saveExpense(payload) {
  const row = {
    category: payload.category,
    description: payload.description || null,
    amount: Number(payload.amount),
    date: payload.date,
    payment_method: payload.payment_method || "Cash",
    reference: payload.reference || null,
    month: payload.date ? payload.date.slice(0, 7) : new Date().toISOString().slice(0, 7),
    notes: payload.notes || null,
    is_system_entry: false,
    updated_at: new Date().toISOString(),
  };
  if (payload.id) {
    const { data, error } = await t("expenses").update(row).eq("id", payload.id).select().single();
    if (error) throw error;
    return data;
  } else {
    row.created_at = new Date().toISOString();
    const { data, error } = await t("expenses").insert(row).select().single();
    if (error) throw error;
    return data;
  }
}

export async function deleteExpense(id) {
  const { error } = await t("expenses").delete().eq("id", id).eq("is_system_entry", false);
  if (error) throw error;
}

export async function saveExpenseCategory(payload) {
  const { data, error } = await t("expense_categories").insert({
    name: payload.name.trim(),
    icon: payload.icon || "💳",
    is_system: false,
    is_fixed: !!payload.is_fixed,
    sort_order: 50,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function deleteExpenseCategory(id) {
  const { error } = await t("expense_categories").delete().eq("id", id).eq("is_system", false);
  if (error) throw error;
}

// ─── Stock Transfers ──────────────────────────────────────────────────────────
export async function saveStockTransfer(payload) {
  const { data, error } = await t("stock_transfers").insert({
    inventory_id: payload.inventory_id,
    product_name: payload.product_name,
    quantity: Number(payload.quantity),
    transfer_type: payload.transfer_type,
    destination: payload.destination || null,
    origin: payload.origin || null,
    reason: payload.reason || null,
    reference: payload.reference || null,
    transferred_by: payload.transferred_by || null,
    date: payload.date || new Date().toISOString().slice(0, 10),
    notes: payload.notes || null,
  }).select().single();
  if (error) throw error;

  const { data: invRow } = await t("inventory").select("stock_qty").eq("id", payload.inventory_id).single();
  if (invRow) {
    let newQty = Number(invRow.stock_qty);
    const qty = Number(payload.quantity);
    if (payload.transfer_type === "transfer_out" || payload.transfer_type === "write_off") {
      newQty = Math.max(0, newQty - qty);
    } else if (payload.transfer_type === "transfer_in") {
      newQty = newQty + qty;
    } else if (payload.transfer_type === "adjustment") {
      newQty = Math.max(0, newQty + qty);
    }
    await t("inventory").update({ stock_qty: newQty, updated_at: getISTDate().toISOString() }).eq("id", payload.inventory_id);
  }

  return data;
}

export async function fetchStockTransfers(inventoryId = null) {
  let query = t("stock_transfers").select("*").order("date", { ascending: false });
  if (inventoryId) query = query.eq("inventory_id", inventoryId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

// ─── Fixed Expenses CRUD ───────────────────────────────────────────────────────
export async function saveFixedExpense(payload) {
  const { id, ...rest } = payload;
  if (id) {
    const { data, error } = await t("fixed_expenses").update(rest).eq("id", id).select().single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await t("fixed_expenses").insert(rest).select().single();
    if (error) throw error;
    return data;
  }
}

export async function deleteFixedExpense(id) {
  const { error } = await t("fixed_expenses").delete().eq("id", id);
  if (error) throw error;
}

// ─── Fixed Expense Payments (monthly paid/unpaid tracking) ────────────────────
export async function saveFixedExpensePayment(payload) {
  // Upsert by fixed_expense_id + work_month
  const { data, error } = await t("fixed_expense_payments")
    .upsert(
      {
        fixed_expense_id: payload.fixed_expense_id,
        work_month: payload.work_month,
        status: payload.status,
        paid_amount: payload.paid_amount ?? null,
        paid_date: payload.paid_date ?? null,
        notes: payload.notes ?? null,
      },
      { onConflict: "fixed_expense_id,work_month" }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteFixedExpensePayment(id) {
  const { error } = await t("fixed_expense_payments").delete().eq("id", id);
  if (error) throw error;
}


