// Modelos de productos y catálogo

export interface ProductCompatibility {
  makes: string[];
  models: string[];
  years: string[];
}

export type ProductSpecs = Record<string, string | number | boolean>;

export interface Product {
  id: string;
  storeId: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  comparePrice?: number | null;
  discount?: number;
  category: string;
  subcategory?: string;
  brand: string;
  reference?: string;
  stock: number;
  maxPerOrder?: number | null;
  isAvailable?: boolean;
  images?: string[];
  image?: string | null;
  specs?: ProductSpecs;
  specifications?: ProductSpecs;
  compatibility?: ProductCompatibility;
  compatibleVehicles?: string[];
  storeSlug?: string;
  storeName?: string;
}
