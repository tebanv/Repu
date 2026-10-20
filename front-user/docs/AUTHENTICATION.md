# Sistema de Autenticación

Este documento describe el sistema de autenticación implementado en la aplicación.

## Resumen

El sistema utiliza **Zustand** con persistencia en `localStorage` para el estado de UI de sesión, con **Supabase Auth como fuente de verdad** (desde P1, 2026-10-12; antes mock 100% cliente). El JWT lo custodia `supabase-js` en su propia key; `User` nunca lleva token ni password.

**Persistencia:** `persist` con key `auth-storage`, `partialize` solo `user` + `isAuthenticated` (no se persisten `isLoading`/`error`/`hasHydrated`). Rehidratación con gate `hasHydrated` (`onRehydrateStorage` → `setHasHydrated(true)`), que evita flash/redirect prematuro.

> **Decisión backend (2026-10-19, [ADR-001](./ADR-001-BACKEND-SPRING.md)):** Supabase Auth es el **puente congelado** actual. El destino es **Spring Security + JWT**; el contrato de `authService`/`authStore` se mantiene para no tocar UI/stores. No se añaden flujos nuevos dependientes de Supabase Auth. El login actual sigue operativo hasta el corte.

## Arquitectura

### Route Groups (Next.js 13+)

La aplicación utiliza route groups para organizar las rutas:

```
app/
├── (auth)/          # Rutas públicas (login, registro)
│   ├── layout.tsx
│   └── login/
│       └── page.tsx
└── (main)/          # Rutas protegidas (requieren autenticación)
    ├── layout.tsx
    ├── page.tsx
    └── store/[slug]/page.tsx
```

### Protección de Rutas

**Guard en `MainLayoutShell`** (`src/components/layout/MainLayoutShell.tsx`):

- `app/(main)/layout.tsx` solo monta `<MainLayoutShell>`; **no** verifica sesión por sí mismo.
- El guard vive en `MainLayoutShell` (client): espera `authHasHydrated` (vía `useAuthHasHydrated()`); si `!isAuthenticated` → `router.push('/login')`.
- Mientras espera, muestra spinner "Verificando credenciales...". Sin este gate habría flash/redirect prematuro.
- Envuelve todas las páginas del grupo `(main)`, incluyendo el mapa (`page.tsx`) y el catálogo de tiendas (`store/[slug]/page.tsx`).

**Página Root** (`app/(main)/page.tsx`):

- Punto de entrada de la aplicación (el mapa).
- Ya no contiene lógica de redirección, delega esa responsabilidad al guard en `MainLayoutShell` (vía `layout.tsx` de su grupo).

## Componentes

### 1. `src/store/authStore.ts`

Store de Zustand que gestiona:

- **Estado del usuario** (`user`, `isAuthenticated`)
- **Estados de UI** (`isLoading`, `error`)
- **Gate de rehidratación** (`hasHydrated`, `setHasHydrated`, hook `useAuthHasHydrated()`)
- **Acciones** (`login`, `logout` async, `clearError`, `setHasHydrated`, `initialize`)

`login(credentials): Promise<boolean>` — retorna `true` en éxito, `false` en error (el mensaje queda en `state.error`).

`initialize(): Promise<void>` — idempotente (vuelos concurrentes comparten promesa): revalida `auth-storage` contra `getSession()` + `profiles` (la sesión vigente manda; sin sesión descarta la local rancia) y arranca la suscripción única a `onAuthStateChange`. La llaman `MainLayoutShell` (grupo protegido) y `LoginForm` (`/login`).

`logout(): Promise<void>` — `signOut()` + limpieza local garantizada aun sin red.

**Persistencia:**

- Usa middleware `persist` de Zustand
- Guarda `user` e `isAuthenticated` en localStorage (`partialize`: solo esos dos campos)
- Key: `auth-storage`
- `onRehydrateStorage` → `setHasHydrated(true)` al terminar la rehidratación

### 2. `src/services/authService.ts`

Servicio real sobre Supabase Auth (vía `getSupabase()`, único importador del SDK). Mismas 6 exportaciones que en la era mock, ahora con tipos de dominio `User` con rol real (`comprador|distribuidor|domiciliario|admin`, asignación directa sin traducción):

- **`login(email, password): Promise<User>`**: `signInWithPassword` (email normalizado a minúsculas/trim) + fetch de `profiles` por `id`. Errores normalizados: `'Email y contraseña son requeridos'` si faltan datos, `'Credenciales inválidas'` en resto (no filtra si el email existe). Requiere la policy `profiles_owner` (0007) y el trigger 0010 para cuentas recién registradas.
- **`logout(): Promise<void>`**: `supabase.auth.signOut()`; el store limpia `user/isAuthenticated` siempre, incluso si la red falla.
- **`verifyToken(_token): Promise<boolean>`**: retorna si hay sesión vigente (`getSession()`); el argumento legacy se ignora (el JWT nunca sale del cliente Supabase).
- **`getCurrentUser(): Promise<User | null>`**: `null` sin sesión; con sesión, perfil desde `profiles`.
- **`register(userData)`**: `signUp` con `name` en `options.data` (lo consume el trigger 0010, que crea el perfil con rol `comprador`).
- **`requestPasswordReset(email)`**: `resetPasswordForEmail`; mensaje genérico anti-enumeración.
- **`subscribeToAuthChanges(listener): () => void`** (nuevo): envuelve `onAuthStateChange` y entrega `User | null` de dominio al store (multi-tab, expiración/refresh sin polling). Zero-Coupling: el store nunca importa el SDK.

**Usuarios seed de desarrollo (Supabase Auth, rol `comprador`):**

```typescript
admin@mallvirtual.com / admin123
usuario@demo.com / user123
demo@demo.com / demo123
```

> Deben crearse en el proyecto Supabase (signUp o panel Auth → Users); el trigger `0010_handle_new_user` les crea el perfil automáticamente. Los chips "Acceso demo" del `LoginForm` solo rellenan estas credenciales, no son un rol (`'demo'` no existe en `UserRole`).

### 3. `src/components/auth/LoginForm.tsx`

Formulario de inicio de sesión estilo **"Ignición" REPU** (no genérico):

- Campos de línea con label flotante, CTA switch, fondo vía `AuthFieldContext` (focus→mood, tecla→pulso, error→turbulencia, éxito→onda)
- Botones demo Admin/Usuario/Demo (`fillDemo`)
- Fases `idle`/`loading`/`success`; `router.replace('/')` si ya hay sesión; tras éxito `router.push('/')` diferido 900ms
- Indicador CapsLock, toggle mostrar contraseña, trim en blur, `clearError` en cada tecla
- Error de `state.error` con shake; validación de campos requeridos; manejo de carga

### 4. `src/components/layout/AppHeader.tsx`

Barra superior de la aplicación:

- Nombre del usuario (`user?.name || 'Usuario'` con fallback)
- Botón "Salir" → `logout()` + `router.push('/login')`
- Carrito con badge dinámico (abre `CartDrawer` global, con checkout a `/checkout`)
- Pedidos en curso (abre `ActiveOrdersDrawer` cuando hay activos)
- Logo "Repu" de la aplicación

## Flujo de Autenticación

### Login

1. Usuario ingresa email y password en `/login`
2. `LoginForm` llama a `authStore.login()` (delay mock 800ms)
3. `authStore` llama a `authService.login()`; retorna `boolean`
4. Si las credenciales son válidas:
   - Se guardan los datos del usuario en el store
   - Se persiste en localStorage (key `auth-storage`)
   - Fase `success` + navegación diferida 900ms con `push('/')`
   - Si ya había sesión al montar, `replace('/')` directo
5. Si fallan:
   - Se muestra mensaje de error (`state.error`) con shake

### Logout

1. Usuario hace clic en botón "Salir" en `AppHeader`
2. `AppHeader` llama a `authStore.logout()` (async, fire-and-forget) + `router.push('/login')`; el store hace `signOut()` en Supabase y limpia `user=null` / `isAuthenticated=false` **incluso si la red falla** (este estado se persiste; **la key `auth-storage` PERMANECE**, no se borra)
3. La suscripción `onAuthStateChange` propaga el `SIGNED_OUT` a otras pestañas abiertas

### Restauración de Sesión

1. Usuario recarga la página o vuelve a la app
2. Zustand rehidrata el estado local desde localStorage (puede estar rancio)
3. `MainLayoutShell` llama a `initialize()`: `getSession()` + fetch de `profiles`; **la sesión vigente manda sobre `auth-storage`** (sin sesión, se descarta la local en vez de conservarla)
4. `onRehydrateStorage` + fin de `initialize()` ponen `hasHydrated=true`
5. `MainLayoutShell` espera `hasHydrated + !isLoading` (spinner "Verificando credenciales...") y recién entonces verifica `isAuthenticated`
6. Si es `true`, permite el acceso
7. Si es `false`, redirige a `/login`

## Integración con Backend Real (Supabase P1 → Spring Boot, ADR-001)

`login`/`logout`/sesión ya van contra Supabase Auth (ver §Componentes). `User` no lleva token ni password. JWT custodiado por `supabase-js`, refresh automático y `onAuthStateChange` suscrito desde `authStore.initialize()`.

Ejemplo legacy (referencia para la futura migración a Spring Boot, donde sí se reescribe `authService.ts` por dentro sin tocar UI/stores):

```typescript
export const login = async (email, password) => {
  const response = await fetch('https://tu-api.com/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error('Credenciales inválidas');
  }

  const data = await response.json();

  return {
    id: data.user.id,
    email: data.user.email,
    name: data.user.name,
    role: data.user.role,
    token: data.token, // Guarda el JWT
  };
};
```

### Consideraciones para Producción

1. **Tokens JWT**: custodiados por `supabase-js` (nunca en `auth-storage` ni en `User`); el cliente los envía en cada request (RLS `profiles_owner`/`orders_owner`)
2. **Refresh Tokens**: automático vía `onAuthStateChange` suscrito en `initialize()` (sin polling)
3. **Logout multi-pestaña**: propagado por el mismo canal
4. **Pendiente**: endurecer expiración/refresh manual y CSRF/CORS al migrar a Spring Boot. Preferencia: access token corto + refresh en cookie `httpOnly` y proxy same-origin; guard server-side en Next.js.
5. **Corte a Spring:** reescribir solo la implementación de `authService` (login/logout/getCurrentUser/register/reset/subscribe) contra Spring Security; `User`, `UserRole`, `authStore` y componentes no cambian (Zero-Coupling).
6. **Seguridad**:
   - No guardar información sensible en localStorage (solo `user` público + flag)
   - Usar HTTPS siempre
   - No filtrar en mensajes de error si el email existe (anti-enumeración)

## Extensiones Futuras

- [x] Registro (`register`: `signUp` real + trigger 0010 crea el perfil; falta UI de registro)
- [x] Recuperación de contraseña (`requestPasswordReset`: `resetPasswordForEmail` real; falta UI)
- [ ] Autenticación con redes sociales (OAuth)
- [ ] Two-Factor Authentication (2FA)
- [ ] Roles y permisos granulares
- [ ] Sesiones múltiples / gestión de dispositivos

## Variables de Entorno

```env
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

Sin ellas, `getSupabase()` lanza error descriptivo (no hay fallback silencioso al mock). Ver `.env.example`. Las credenciales reales nunca se commitean (pendiente P0 en `CHANGELOG.md`).

## Testing

Usuarios seed de desarrollo (Supabase Auth, ver arriba):

| Email | Password | Rol |
|-------|----------|-----|
| admin@mallvirtual.com | admin123 | admin |
| usuario@demo.com | user123 | comprador |
| demo@demo.com | demo123 | comprador |
