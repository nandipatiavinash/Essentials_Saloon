import { supabase } from "./supabase";

const t = (name) => supabase.from(name);
const optional = async (promise, fallback) => {
  const res = await promise;
  if (res.error) {
    console.warn("Optional admin data unavailable:", res.error.message);
    return fallback;
  }
  return res.data ?? fallback;
};

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
  const [cats, svcs, offs, gal, settRes, bkgs, invoices, customers, transactions, reportLogs, staff, attendance, inventory, cashRegister] = await Promise.all([
    t("categories").select("*").order("id"),
    t("services").select("*").order("id"),
    t("offers").select("*").order("id"),
    t("gallery").select("*").order("id"),
    t("salon_settings").select("*").eq("id", 1).maybeSingle(),
    t("bookings").select("*").order("created_at", { ascending: false }),
    optional(t("invoices").select("*, customers(*), invoice_items(*)").order("billing_at", { ascending: false }).limit(250), []),
    optional(t("customers").select("*").order("last_visit_at", { ascending: false }).limit(500), []),
    optional(t("transactions").select("*").order("created_at", { ascending: false }).limit(250), []),
    optional(t("report_logs").select("*").order("created_at", { ascending: false }).limit(100), []),
    optional(t("staff").select("*").order("name"), []),
    optional(t("attendance").select("*").order("date", { ascending: false }), []),
    optional(t("inventory").select("*").order("name"), []),
    optional(t("cash_register").select("*").order("date", { ascending: false }).limit(60), []),
  ]);
  const errs = [cats, svcs, offs, gal, settRes, bkgs].map((r) => r.error).filter(Boolean);
  if (errs.length) throw errs[0];
  return {
    categories: cats.data ?? [],
    services: (svcs.data ?? []).map(norm),
    offers: offs.data ?? [],
    gallery: gal.data ?? [],
    settings: settRes.data ?? {},
    bookings: (bkgs.data ?? []).map(normBooking),
    invoices: (invoices ?? []).map(normInvoice),
    customers: (customers ?? []).map(normCustomer),
    transactions: transactions ?? [],
    reportLogs: reportLogs ?? [],
    staff: staff ?? [],
    attendance: attendance ?? [],
    inventory: inventory ?? [],
    cashRegister: cashRegister ?? [],
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

// ─── Salon ERP / POS ─────────────────────────────────────────────────────────
export async function findCustomerByPhone(phone) {
  const cleanPhone = normalizePhone(phone);
  if (!cleanPhone) return null;
  const { data, error } = await t("customers").select("*").eq("mobile", cleanPhone).maybeSingle();
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

  const { data: customer, error: customerError } = await t("customers")
    .upsert({
      id: payload.customer_id || undefined,
      name: payload.client_name.trim(),
      mobile,
      notes: payload.customer_notes || null,
      last_visit_at: payload.billing_at || new Date().toISOString(),
      total_spend: totals.total,
      visit_count: 1,
      preferred_services: payload.items.map((item) => item.service_name).filter(Boolean),
    }, { onConflict: "mobile" })
    .select()
    .single();
  if (customerError) throw customerError;

  const invoiceRow = {
    invoice_number: payload.invoice_number || makeInvoiceNumber(),
    customer_id: customer.id,
    client_name: payload.client_name.trim(),
    mobile,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    tax_rate: Number(payload.tax_rate || 0),
    total: totals.total,
    payment_method: payload.payment_method || "Cash",
    transaction_id: payload.transaction_id || null,
    notes: payload.notes || null,
    staff_name: payload.staff_name || null,
    status: payload.status || "paid",
    refund_status: payload.refund_status || "none",
    created_by: userRes?.user?.id || null,
    billing_at: payload.billing_at || new Date().toISOString(),
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
    service_id: item.service_id || null,
    service_name: item.service_name,
    quantity: Number(item.quantity || 1),
    price: Number(item.price || 0),
    total: Number(item.quantity || 1) * Number(item.price || 0),
    staff_name: item.staff_name || payload.staff_name || null,
  }));
  const { error: itemsError } = await t("invoice_items").insert(itemRows);
  if (itemsError) throw itemsError;

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
    created_at: row.created_at,
  };
}

export function calculateInvoiceTotals(payload) {
  const subtotal = (payload.items ?? []).reduce((sum, item) => {
    return sum + Number(item.quantity || 1) * Number(item.price || 0);
  }, 0);
  const discount = Number(payload.discount || 0);
  const taxable = Math.max(subtotal - discount, 0);
  const tax = payload.tax_enabled === false ? 0 : taxable * (Number(payload.tax_rate || 0) / 100);
  return {
    subtotal: roundMoney(subtotal),
    discount: roundMoney(discount),
    tax: roundMoney(tax),
    total: roundMoney(taxable + tax),
  };
}

export function buildAnalytics(invoices = []) {
  const paid = invoices.filter((invoice) => invoice.status !== "void");
  const revenue = paid.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
  const paymentBreakdown = groupSum(paid, "payment_method", "total");
  const byDay = {};
  const byMonth = {};
  const byHour = {};
  const serviceTotals = {};
  const customerTotals = {};

  paid.forEach((invoice) => {
    const date = new Date(invoice.billing_at || invoice.created_at);
    const day = date.toISOString().slice(0, 10);
    const month = day.slice(0, 7);
    const hour = String(date.getHours()).padStart(2, "0") + ":00";
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
  const todayKey = new Date().toISOString().slice(0, 10);
  const monthKey = todayKey.slice(0, 7);
  const weekAgo = new Date();
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
  };
}

function normalizePhone(phone = "") {
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length < 8) return "";
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function makeInvoiceNumber() {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `INV-${stamp}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
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

export async function saveAttendance(rows) {
  const cleanRows = rows.map(r => ({
    staff_id: r.staff_id,
    date: r.date,
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

// ─── Customer Membership Update ──────────────────────────────────────────────
export async function updateCustomerMembership(customerId, details) {
  const { data: row, error } = await t("customers")
    .update({
      is_member: !!details.is_member,
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
      provider: "mailto",
      payload: { body: textContent },
      sent_at: new Date().toISOString()
    });
  } catch (e) {
    console.warn("Could not log EOD email to DB:", e.message);
  }

  const subject = encodeURIComponent("Toni & Guy Essensuals Gorantla - EOD Report - " + new Date().toLocaleDateString("en-IN"));
  const body = encodeURIComponent(textContent);
  window.open(`mailto:${adminEmail}?subject=${subject}&body=${body}`, "_blank");
  return true;
}
