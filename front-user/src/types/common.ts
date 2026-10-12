// Tipos y utilidades comunes en todo el dominio

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface GeoBoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface ActionResult<T = void> {
  ok: boolean;
  code: string;
  message?: string;
  data?: T;
}

