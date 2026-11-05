// src/services/api.ts
// Capa de acceso al catálogo (Zero-Coupling): la UI y los stores consumen estas
// funciones con tipos de dominio (`src/types/`). La implementación consulta los
// microservicios `ms-companies`, `ms-products` y `ms-categories` a través de
// `httpClient`. Contrato y decisiones: `docs/PLAN-CATALOGO.md` y
// `docs/BACKEND.md` §3. Las firmas que usa la UI no cambian respecto a la
// etapa Supabase, así que `storesStore` y `StoreView` siguen intactos.

import { HttpError, httpClient } from './httpClient';
import type {
  NearbyStoresParams,
  Product,
  ProductSpecs,
  Store,
  StoreCategory,
  StoreSchedule,
} from '@/types';

// --- Respuestas crudas del backend (solo viven en la capa services) ---

interface CompanyResponse {
  id: string;
  businessName: string;
  description?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  location?: { latitude?: number | null; longitude?: number | null } | null;
  operationalConfig?: unknown;
  rating?: number | null;
  reviewCount?: number | null;
  active?: boolean | null;
  slug: string;
  categoryId?: string | null;
}

interface ProductResponse {
  id: string;
  companyId: string;
  categoryId?: string | null;
  name: string;
  brand?: string | null;
  sku?: string | null;
  description?: string | null;
  price?: number | string | null;
  priceOffer?: number | string | null;
  stock?: number | null;
  attributes?: Record<string, unknown> | null;
  images?: unknown[] | null;
  active?: boolean | null;
}

interface CategoryResponse {
  id: string;
  name: string;
  active?: boolean | null;
}

// Las lecturas del catálogo son públicas: un 401 inesperado aquí no debe
// cerrar la sesión del usuario (ver PLAN-CATALOGO §2, decisión 7).
const PUBLIC_READ = { skipUnauthorizedNotification: true } as const;

const DEFAULT_PREP_MINUTES = 20;

// --- Categorías: categoryId (UUID) → StoreCategory ---

// El backend no tiene un código estable de categoría; se traduce buscando una
// palabra clave en el nombre normalizado (los nombres reales son descriptivos,
// p. ej. "Baterías para vehículos"). Gana la primera coincidencia del orden.
const CATEGORY_KEYWORDS: ReadonlyArray<[keyword: string, code: StoreCategory]> = [
  ['bateria', 'battery'],
  ['llanta', 'tire'],
  ['repuesto', 'spare'],
  ['taller', 'shop'],
];

function categoryCodeFromName(name: string): StoreCategory | undefined {
  const normalized = normalizeName(name);
  return CATEGORY_KEYWORDS.find(([keyword]) => normalized.includes(keyword))?.[1];
}

function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

// Caché por sesión de la promesa: una sola petición aunque varias vistas
// pidan tiendas a la vez. Si falla se descarta para reintentar luego.
let categoryMapPromise: Promise<Map<string, StoreCategory>> | null = null;

function loadCategoryMap(): Promise<Map<string, StoreCategory>> {
  if (!categoryMapPromise) {
    categoryMapPromise = httpClient
      .get<CategoryResponse[]>('/ms-categories/api/catalog/categories', PUBLIC_READ)
      .then((categories) => {
        const map = new Map<string, StoreCategory>();
        for (const category of categories ?? []) {
          if (category.active === false || !category.name) continue;
          const code = categoryCodeFromName(category.name);
          if (code) map.set(String(category.id), code);
        }
        return map;
      })
      .catch((error: unknown) => {
        categoryMapPromise = null;
        throw error;
      });
  }
  return categoryMapPromise;
}

// Sin categorías la tienda sigue visible en el mapa, solo que no aparece
// al filtrar: un fallo de `ms-categories` no debe vaciar el mapa.
async function getCategoryMapSafe(): Promise<Map<string, StoreCategory>> {
  try {
    return await loadCategoryMap();
  } catch {
    return new Map();
  }
}

/** Solo para pruebas: limpia la caché de categorías entre casos. */
export function resetCatalogCacheForTests(): void {
  categoryMapPromise = null;
}

// --- Helpers de lectura defensiva de `operationalConfig` (JSON libre) ---

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

/** Dinero del backend (`NUMERIC(15,2)`) → entero COP del front. */
function toCop(value: unknown): number | null {
  const parsed = asFiniteNumber(value);
  return parsed === null ? null : Math.round(parsed);
}

// --- Adaptadores backend → dominio ---

/**
 * Empresa → `Store`. Devuelve `null` si la empresa está inactiva o no se
 * puede ubicar en el mapa (sin coordenadas no hay tienda utilizable).
 */
function toStore(company: CompanyResponse, categoryMap: Map<string, StoreCategory>): Store | null {
  if (company.active === false) return null;

  const lat = asFiniteNumber(company.location?.latitude);
  const lng = asFiniteNumber(company.location?.longitude);
  if (lat === null || lng === null) return null;

  const config = asRecord(company.operationalConfig) ?? {};
  const delivery = asRecord(config.delivery);
  const branding = asRecord(config.branding);
  const category = company.categoryId ? categoryMap.get(String(company.categoryId)) : undefined;

  return {
    id: String(company.id),
    slug: company.slug,
    name: company.businessName,
    description: company.description ?? '',
    lat,
    lng,
    categories: category ? [category] : [],
    rating: asFiniteNumber(company.rating) ?? 0,
    totalReviews: asFiniteNumber(company.reviewCount) ?? 0,
    // `empresas` no tiene ciudad; la UI oculta el dato cuando está vacío.
    city: '',
    logo: asString(company.logoUrl),
    banner: asString(company.bannerUrl) ?? asString(branding?.bannerUrl),
    schedule: (asRecord(config.schedule) as StoreSchedule | null) ?? {},
    deliveryInfo: {
      // Sin definir en el backend → `null` ("por confirmar"), nunca un valor inventado.
      fee: toCop(delivery?.fee),
      avgPrepTime: asFiniteNumber(config.preparationTime) ?? DEFAULT_PREP_MINUTES,
    },
  };
}

/** Producto → `Product`. Devuelve `null` si el producto está inactivo. */
function toProduct(product: ProductResponse): Product | null {
  if (product.active === false) return null;

  const basePrice = toCop(product.price) ?? 0;
  const offerPrice = toCop(product.priceOffer);
  const hasOffer = offerPrice !== null && offerPrice < basePrice;
  const stock = Math.max(0, asFiniteNumber(product.stock) ?? 0);
  const attributes = asRecord(product.attributes) ?? {};
  const images = (Array.isArray(product.images) ? product.images : []).filter(
    (image): image is string => typeof image === 'string' && image.trim() !== '',
  );
  const compatibleVehicles = Array.isArray(attributes.compatibleVehicles)
    ? attributes.compatibleVehicles.filter((v): v is string => typeof v === 'string')
    : [];
  // Las especificaciones visibles son los atributos simples; la lista de
  // compatibilidad se presenta aparte.
  const specs: ProductSpecs = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (
      key !== 'compatibleVehicles' &&
      (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    ) {
      specs[key] = value;
    }
  }

  return {
    id: String(product.id),
    storeId: String(product.companyId),
    name: product.name,
    description: product.description ?? '',
    price: hasOffer ? offerPrice : basePrice,
    comparePrice: hasOffer ? basePrice : null,
    category: product.categoryId ? String(product.categoryId) : '',
    brand: product.brand ?? '',
    reference: product.sku ?? undefined,
    stock,
    // Stock 0 es agotado: la UI muestra "Agotado" y el carrito lo rechaza.
    isAvailable: stock > 0,
    images,
    image: images[0] ?? null,
    specs,
    specifications: specs,
    compatibleVehicles,
  };
}

/** El front trabaja en metros; `ms-companies` espera kilómetros enteros. */
export function toRadiusKm(radiusMeters: number): number {
  return Math.max(1, Math.ceil(radiusMeters / 1000));
}

// --- API pública del catálogo ---

/**
 * Tiendas activas dentro del radio, ordenadas por cercanía (las ordena el
 * backend). El filtrado por categoría ocurre en memoria en
 * `storesStore.applyFilters`, sin HTTP adicional.
 */
export async function fetchNearbyStores({
  lat,
  lng,
  radius = 5000,
}: NearbyStoresParams): Promise<Store[]> {
  const query = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radiusKm: String(toRadiusKm(radius)),
  });
  const [companies, categoryMap] = await Promise.all([
    httpClient.get<CompanyResponse[]>(`/ms-companies/api/companies?${query}`, PUBLIC_READ),
    getCategoryMapSafe(),
  ]);
  return (companies ?? [])
    .map((company) => toStore(company, categoryMap))
    .filter((store): store is Store => store !== null);
}

/**
 * Tienda activa por slug (routing `/store/[slug]` y checkout). `null` si no
 * existe, está inactiva o el slug es inválido.
 */
export async function fetchStoreBySlug(slug: string): Promise<Store | null> {
  if (!slug?.trim()) return null;
  try {
    const [company, categoryMap] = await Promise.all([
      httpClient.get<CompanyResponse>(
        `/ms-companies/api/companies/${encodeURIComponent(slug.trim())}`,
        PUBLIC_READ,
      ),
      getCategoryMapSafe(),
    ]);
    return company ? toStore(company, categoryMap) : null;
  } catch (error) {
    if (error instanceof HttpError && (error.status === 404 || error.status === 400)) {
      return null;
    }
    throw error;
  }
}

/** Productos activos de una tienda, ordenados por nombre. */
export async function fetchProductsByStore(storeId: string): Promise<Product[]> {
  const query = new URLSearchParams({ companyId: storeId });
  const products = await httpClient.get<ProductResponse[]>(
    `/ms-products/api/catalog/products?${query}`,
    PUBLIC_READ,
  );
  return (products ?? [])
    .map(toProduct)
    .filter((product): product is Product => product !== null)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}
