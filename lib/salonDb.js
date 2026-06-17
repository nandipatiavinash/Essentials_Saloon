import { supabase } from "./supabase";

const table = (name) => supabase.from(name);

export async function fetchSalonData() {
  const [categories, services, offers, gallery, settingsRes, bookings] = await Promise.all([
    table("categories").select("*").order("id"),
    table("services").select("*").order("id"),
    table("offers").select("*").order("id"),
    table("gallery").select("*").order("id"),
    table("salon_settings").select("*").eq("id", 1).maybeSingle(),
    table("bookings").select("*").order("created_at", { ascending: false }),
  ]);

  const errors = [categories, services, offers, gallery, settingsRes, bookings]
    .map((r) => r.error)
    .filter(Boolean);
  if (errors.length) throw errors[0];

  return {
    categories: categories.data ?? [],
    services: (services.data ?? []).map(normalizeService),
    offers: offers.data ?? [],
    gallery: gallery.data ?? [],
    settings: settingsRes.data ?? null,
    bookings: (bookings.data ?? []).map(normalizeBooking),
  };
}

export async function seedSalonData({ categories, services, offers, gallery, settings }) {
  const { count, error: countError } = await table("services").select("*", { count: "exact", head: true });
  if (countError) throw countError;
  if (count > 0) return false;

  const inserts = [
    table("categories").insert(categories.map(({ id, ...row }) => row)),
    table("services").insert(services.map(({ id, ...row }) => toServiceRow(row))),
    table("offers").insert(offers.map(({ id, ...row }) => row)),
    table("gallery").insert(gallery.map(({ id, ...row }) => row)),
    table("salon_settings").upsert({ id: 1, ...settings }),
  ];

  const results = await Promise.all(inserts);
  const err = results.map((r) => r.error).find(Boolean);
  if (err) throw err;
  return true;
}

export async function createService(data) {
  const { data: row, error } = await table("services").insert(toServiceRow(data)).select().single();
  if (error) throw error;
  return normalizeService(row);
}

export async function updateService(id, data) {
  const { data: row, error } = await table("services").update(toServiceRow(data)).eq("id", id).select().single();
  if (error) throw error;
  return normalizeService(row);
}

export async function deleteService(id) {
  const { error } = await table("services").delete().eq("id", id);
  if (error) throw error;
}

export async function patchService(id, patch) {
  const { data: row, error } = await table("services").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return normalizeService(row);
}

export async function createCategory(data) {
  const { data: row, error } = await table("categories").insert(data).select().single();
  if (error) throw error;
  return row;
}

export async function updateCategory(id, data) {
  const { id: _, ...rest } = data;
  const { data: row, error } = await table("categories").update(rest).eq("id", id).select().single();
  if (error) throw error;
  return row;
}

export async function deleteCategory(id) {
  const { error } = await table("categories").delete().eq("id", id);
  if (error) throw error;
}

export async function createOffer(data) {
  const { data: row, error } = await table("offers").insert(data).select().single();
  if (error) throw error;
  return row;
}

export async function updateOffer(id, data) {
  const { id: _, ...rest } = data;
  const { data: row, error } = await table("offers").update(rest).eq("id", id).select().single();
  if (error) throw error;
  return row;
}

export async function deleteOffer(id) {
  const { error } = await table("offers").delete().eq("id", id);
  if (error) throw error;
}

export async function createGalleryItem(data) {
  const { data: row, error } = await table("gallery").insert(data).select().single();
  if (error) throw error;
  return row;
}

export async function updateGalleryItem(id, data) {
  const { id: _, ...rest } = data;
  const { data: row, error } = await table("gallery").update(rest).eq("id", id).select().single();
  if (error) throw error;
  return row;
}

export async function deleteGalleryItem(id) {
  const { error } = await table("gallery").delete().eq("id", id);
  if (error) throw error;
}

export async function saveSalonSettings(settings) {
  const { data, error } = await table("salon_settings").upsert({ id: 1, ...settings }).select().single();
  if (error) throw error;
  return data;
}

export async function createBooking(form) {
  const { data, error } = await table("bookings")
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
  return normalizeBooking(data);
}

export async function updateBookingStatus(id, status) {
  const { data, error } = await table("bookings").update({ status }).eq("id", id).select().single();
  if (error) throw error;
  return normalizeBooking(data);
}

function toServiceRow(data) {
  return {
    name: data.name,
    category: data.category,
    description: data.description,
    duration: data.duration,
    price_from: data.price_from,
    price_to: data.price_to ?? null,
    featured: !!data.featured,
    active: data.active !== false,
    image: data.image,
  };
}

function normalizeService(row) {
  return {
    ...row,
    price_from: Number(row.price_from),
    price_to: row.price_to != null ? Number(row.price_to) : null,
    featured: !!row.featured,
    active: !!row.active,
  };
}

function normalizeBooking(row) {
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
  const { data: row, error } = await table("customers")
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
  return row;
}
