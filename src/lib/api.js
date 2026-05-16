import { supabase } from "./supabase";

const t = (name) => supabase.from(name);

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
  const [cats, svcs, offs, gal, settRes, bkgs] = await Promise.all([
    t("categories").select("*").order("id"),
    t("services").select("*").order("id"),
    t("offers").select("*").order("id"),
    t("gallery").select("*").order("id"),
    t("salon_settings").select("*").eq("id", 1).maybeSingle(),
    t("bookings").select("*").order("created_at", { ascending: false }),
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
  const { data: row, error } = await t("categories").update(data).eq("id", id).select().single();
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
  const { data: row, error } = await t("offers").update(data).eq("id", id).select().single();
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
  const { data: row, error } = await t("gallery").update(data).eq("id", id).select().single();
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toRow(d) {
  return {
    name: d.name,
    category: d.category,
    description: d.description,
    duration: d.duration,
    price_from: d.price_from,
    price_to: d.price_to ?? null,
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
