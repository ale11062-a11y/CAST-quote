import { adminFunctionUrl, supabase } from "./supabase";
import type { Company, Profile } from "./types";

export async function callAdmin<T = unknown>(
  action: string,
  payload: Record<string, unknown>
): Promise<{ data: T | null; error: string | null }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) return { data: null, error: "Sessão expirada. Faça login novamente." };

  try {
    const res = await fetch(`${adminFunctionUrl}?action=${action}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: (json as { error?: string }).error || "Erro desconhecido." };
    return { data: json as T, error: null };
  } catch (err) {
    return { data: null, error: (err as Error).message };
  }
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, role, company_id, name, active, created_at")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as Profile;
}

export async function isCompanyActive(companyId: string | null): Promise<boolean> {
  if (!companyId) return true;
  const { data, error } = await supabase
    .from("companies")
    .select("active")
    .eq("id", companyId)
    .maybeSingle();
  if (error || !data) return false;
  return data.active === true;
}

export async function fetchCompany(companyId: string): Promise<Company | null> {
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, active, primary_color, logo_url, created_at")
    .eq("id", companyId)
    .maybeSingle();
  if (error || !data) return null;
  return data as Company;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export async function uploadCompanyLogo(companyId: string, file: File): Promise<{ url: string | null; error: string | null }> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${companyId}/logo-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("logos")
    .upload(path, file, { cacheControl: "3600", upsert: true });
  if (error) return { url: null, error: error.message };
  const { data } = supabase.storage.from("logos").getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}

export async function uploadBudgetPhoto(budgetId: string, file: File): Promise<{ path: string | null; url: string | null; error: string | null }> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${budgetId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from("budget-photos")
    .upload(path, file, { cacheControl: "3600", upsert: true });
  if (error) return { path: null, url: null, error: error.message };
  const { data } = supabase.storage.from("budget-photos").getPublicUrl(path);
  return { path, url: data.publicUrl, error: null };
}

export async function uploadServiceOrderPhoto(serviceOrderId: string, file: File): Promise<{ path: string | null; url: string | null; error: string | null }> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${serviceOrderId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from("service-order-photos")
    .upload(path, file, { cacheControl: "3600", upsert: true });
  if (error) return { path: null, url: null, error: error.message };
  const { data } = supabase.storage.from("service-order-photos").getPublicUrl(path);
  return { path, url: data.publicUrl, error: null };
}

export function publicBudgetPhotoUrl(path: string): string {
  const { data } = supabase.storage.from("budget-photos").getPublicUrl(path);
  return data.publicUrl;
}

export function publicServiceOrderPhotoUrl(path: string): string {
  const { data } = supabase.storage.from("service-order-photos").getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteStorageObject(bucket: string, path: string): Promise<{ error: string | null }> {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  return { error: error ? error.message : null };
}

const LABOR_UNITS = ["sv", "h"];
const LABOR_KEYWORD = "mão de obra";

export function buildMaterialLines(items: { description: string; quantity: number; unit: string; unit_price: number }[]): string[] {
  return items
    .filter((it) => it.description.trim())
    .filter((it) => !LABOR_UNITS.includes((it.unit || "un").toLowerCase()))
    .filter((it) => !it.description.toLowerCase().includes(LABOR_KEYWORD))
    .map((it) => `${it.description} — ${it.quantity} ${it.unit || "un"}`);
}
