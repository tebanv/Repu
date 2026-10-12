// src/services/supabaseClient.ts
// Único punto de contacto con el backend Supabase (Zero-Coupling Contract:
// ningún componente de `src/components/`, página de `src/app/` ni store de
// Zustand importa `@supabase/supabase-js` directamente; solo este módulo y
// los servicios de `src/services/` como `api.ts`). Cambiar de proveedor
// (Supabase → Spring Boot/AWS) implica reescribir este archivo y los
// adaptadores, sin tocar UI ni stores.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Singleton diferido: se crea al primer uso, nunca en import time, para no
// romper el setup de tests (entorno node sin `.env.local`).
let cached: SupabaseClient | null = null;

// Informa si las variables públicas de Supabase están presentes. Útil para
// mensajes de error accionables antes de intentar red.
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

// Retorna el cliente singleton. Lanza un error descriptivo si falta
// configuración en vez de fallar con un 401 opaco aguas abajo.
export function getSupabase(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      'Supabase no configurado: faltan NEXT_PUBLIC_SUPABASE_URL y/o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local (ver .env.example).',
    );
  }
  cached = createClient(url, anonKey);
  return cached;
}
