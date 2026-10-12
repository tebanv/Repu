// src/services/api.ts
// Capa de acceso a datos del catálogo (Zero-Coupling Contract): la UI y los
// stores consumen estas 5 funciones con tipos de dominio (`src/types/`); la
// implementación interna consulta Supabase (RPC `get_nearby_stores` + tablas
// `stores`/`products`). Contrato DB: `docs/DATA_MODEL.md` §3.2–§3.3 y §4.
// Historial: antes mock en memoria con `setTimeout`; desde 2026-09-24 lee la
// BD real (ver `docs/CHANGELOG.md`). Las firmas no cambian: UI/stores intactos.

import { getSupabase } from './supabaseClient';
import type {
  NearbyStoresParams,
  Product,
  ProductSpecs,
  Store,
  StoreCategory,
  StoreSchedule,
} from '@/types';

// --- Filas crudas de Supabase (shape DB snake_case, solo capa services) ---

interface StoreRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  city: string;
  location: unknown;
  categories: string[] | null;
  rating: number | string | null;
  total_reviews: number | string | null;
  schedule: StoreSchedule | null;
  delivery_fee: number | string | null;
  avg_prep_minutes: number | string | null;
  logo_url: string | null;
  banner_url: string | null;
}

interface ProductRow {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  price: number | string | null;
  compare_price: number | string | null;
  brand: string | null;
  reference: string | null;
  category: string | null;
  subcategory: string | null;
  stock: number | string | null;
  is_available: boolean | null;
  images: string[] | null;
  specs: ProductSpecs | null;
  compatible_vehicles: string[] | null;
}

// --- Adaptadores DB → dominio (viven solo aquí, nunca en UI/stores) ---

const VALID_CATEGORIES: readonly StoreCategory[] = ['battery', 'tire', 'spare', 'shop'];

// PostgREST devuelve `geography(Point)` como EWKB hexadecimal
// (ej. '0101000020E6100000…'); también se acepta GeoJSON
// `{ type: 'Point', coordinates: [lng, lat] }` o WKT ('POINT(lng lat)').
// La UI jamás ve `geography`.
function parseEwkbPoint(hex: string): { lat: number; lng: number } | null {
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  if (Number.isNaN(bytes[0])) return null;
  const view = new DataView(bytes.buffer);
  const littleEndian = bytes[0] === 1;
  const type = view.getUint32(1, littleEndian);
  if ((type & 0xff) !== 1) return null; // solo POINT
  const offset = type & 0x20000000 ? 9 : 5; // con SRID (EWKB) o WKB plano
  if (bytes.length < offset + 16) return null;
  const lng = view.getFloat64(offset, littleEndian);
  const lat = view.getFloat64(offset + 8, littleEndian);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return { lat, lng };
}

function parseLocation(location: unknown): { lat: number; lng: number } {
  if (typeof location === 'string') {
    const ewkb = parseEwkbPoint(location);
    if (ewkb) return ewkb;
    const match = /POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i.exec(location);
    if (match) return { lng: Number(match[1]), lat: Number(match[2]) };
  }
  if (location !== null && typeof location === 'object' && 'coordinates' in location) {
    const coords = (location as { coordinates: unknown }).coordinates;
    if (
      Array.isArray(coords) &&
      typeof coords[0] === 'number' &&
      typeof coords[1] === 'number'
    ) {
      return { lng: coords[0], lat: coords[1] };
    }
  }
  return { lat: 0, lng: 0 };
}

// Fila `stores` → `Store`. Gaps conocidos (`DATA_MODEL.md` §4): la DB no tiene
// `stats.totalOrders` (solo `total_reviews`) así que `stats` se omite y
// `StoreHeader` oculta el badge; sin `logo/banner` reales van `null`.
function mapStoreRow(row: StoreRow): Store {
  const { lat, lng } = parseLocation(row.location);
  const categories = (Array.isArray(row.categories) ? row.categories : []).filter(
    (c): c is StoreCategory =>
      VALID_CATEGORIES.includes(c as StoreCategory),
  );
  return {
    id: String(row.id),
    slug: row.slug,
    name: row.name,
    description: row.description ?? '',
    lat,
    lng,
    categories,
    rating: Number(row.rating ?? 0),
    totalReviews: Number(row.total_reviews ?? 0),
    city: row.city ?? 'Medellín',
    logo: row.logo_url ?? null,
    banner: row.banner_url ?? null,
    schedule: row.schedule ?? {},
    deliveryInfo: {
      fee: Number(row.delivery_fee ?? 0),
      avgPrepTime: Number(row.avg_prep_minutes ?? 20),
    },
  };
}

// Fila `products` → `Product`. Gaps (`DATA_MODEL.md` §3.3): sin `maxPerOrder`,
// `discount`/`originalPrice`, `image` singular ni compatibilidad estructurada
// (`makes/models/years`); se exponen `specs`+`specifications` (alias) y
// `compatibleVehicles` planos. `stock: 0` conserva el QUIRK documentado en
// `docs/TESTING.md` §7 (el carrito lo trata como sin límite).
function mapProductRow(row: ProductRow): Product {
  const specs = row.specs ?? {};
  const images = (Array.isArray(row.images) ? row.images : []).filter(
    (img): img is string => typeof img === 'string',
  );
  const compatibleVehicles = (
    Array.isArray(row.compatible_vehicles) ? row.compatible_vehicles : []
  ).filter((v): v is string => typeof v === 'string');
  return {
    id: String(row.id),
    storeId: String(row.store_id),
    name: row.name,
    description: row.description ?? '',
    price: Number(row.price ?? 0),
    comparePrice: row.compare_price != null ? Number(row.compare_price) : null,
    category: row.category ?? '',
    subcategory: row.subcategory ?? undefined,
    brand: row.brand ?? '',
    reference: row.reference ?? undefined,
    stock: Number(row.stock ?? 0),
    isAvailable: row.is_available ?? true,
    images,
    image: images[0] ?? null,
    specs,
    specifications: specs,
    compatibleVehicles,
  };
}

/**
 * Tiendas cercanas por ubicación vía RPC PostGIS `get_nearby_stores`
 * (filtra solo por radio y ordena por distancia; las categorías se filtran
 * en memoria en `storesStore.applyFilters`, sin HTTP adicional).
 */
export async function fetchNearbyStores({
  lat,
  lng,
  radius = 5000,
}: NearbyStoresParams): Promise<Store[]> {
  const { data, error } = await getSupabase().rpc('get_nearby_stores', {
    user_lat: lat,
    user_lng: lng,
    radius_m: radius,
  });
  if (error) throw new Error(`fetchNearbyStores: ${error.message}`);
  return ((data ?? []) as StoreRow[]).map(mapStoreRow);
}

/**
 * Obtiene una tienda activa por su slug (routing `/store/[slug]`).
 */
export async function fetchStoreBySlug(slug: string): Promise<Store | null> {
  const { data, error } = await getSupabase()
    .from('stores')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw new Error(`fetchStoreBySlug: ${error.message}`);
  return data ? mapStoreRow(data as StoreRow) : null;
}

/**
 * Obtiene una tienda activa por su ID.
 */
export async function fetchStoreById(storeId: string): Promise<Store | null> {
  const { data, error } = await getSupabase()
    .from('stores')
    .select('*')
    .eq('id', storeId)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw new Error(`fetchStoreById: ${error.message}`);
  return data ? mapStoreRow(data as StoreRow) : null;
}

/**
 * Obtiene el catálogo disponible de una tienda. Sin filtro de stock aquí:
 * la regla de agotado vive en el carrito (QUIRK `TESTING.md` §7 pendiente
 * de decisión antes del checkout con validación server-side).
 */
export async function fetchProductsByStore(storeId: string): Promise<Product[]> {
  const { data, error } = await getSupabase()
    .from('products')
    .select('*')
    .eq('store_id', storeId)
    .eq('is_available', true)
    .order('name', { ascending: true });
  if (error) throw new Error(`fetchProductsByStore: ${error.message}`);
  return ((data ?? []) as ProductRow[]).map(mapProductRow);
}

/**
 * Obtiene un producto por su ID.
 */
export async function fetchProductById(productId: string): Promise<Product | null> {
  const { data, error } = await getSupabase()
    .from('products')
    .select('*')
    .eq('id', productId)
    .maybeSingle();
  if (error) throw new Error(`fetchProductById: ${error.message}`);
  return data ? mapProductRow(data as ProductRow) : null;
}
