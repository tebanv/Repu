# Sistema de Autenticación

Este documento describe el sistema de autenticación implementado en la aplicación.

## Resumen

El sistema utiliza **Zustand** con persistencia en `localStorage` para gestionar el estado de autenticación. Actualmente trabaja con datos mockeados (100% cliente, sin backend), pero está diseñado para integrarse fácilmente con un backend real.

**Persistencia:** `persist` con key `auth-storage`, `partialize` solo `user` + `isAuthenticated` (no se persisten `isLoading`/`error`/`hasHydrated`). Rehidratación con gate `hasHydrated` (`onRehydrateStorage` → `setHasHydrated(true)`), que evita flash/redirect prematuro.

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
- **Acciones** (`login`, `logout`, `clearError`, `setHasHydrated`)

`login(credentials): Promise<boolean>` — retorna `true` en éxito, `false` en error (el mensaje queda en `state.error`).

**Persistencia:**

- Usa middleware `persist` de Zustand
- Guarda `user` e `isAuthenticated` en localStorage (`partialize`: solo esos dos campos)
- Key: `auth-storage`
- `onRehydrateStorage` → `setHasHydrated(true)` al terminar la rehidratación

### 2. `src/services/authService.ts`

Servicio mock (sin backend) con 6 funciones:

- **`login(email, password): Promise<User>`**: delay 800ms; email case-insensitive; error `'Email y contraseña son requeridos'` si faltan datos, `'Credenciales inválidas'` si no hay match; retorna `User` **sin** password.
- **`logout(): void`**: solo `console.log('Sesión cerrada')` — **no** limpia nada; la limpieza (`user=null`, `isAuthenticated=false`) la hace el store.
- **`verifyToken(token): Promise<boolean>`** (stub): delay 300ms, retorna `Boolean(token)` — no es validación JWT real.
- **`getCurrentUser(token): Promise<User | null>`** (stub): delay 300ms; `null` sin token; con token devuelve `MOCK_USERS[0]` sin password.
- **`register(userData)`** (stub existente): delay 1000ms y lanza `'Función de registro no implementada aún'`.
- **`requestPasswordReset(email)`** (stub existente): delay 800ms, `console.log(...)` y retorna `true`.

**Usuarios de prueba:**

```typescript
admin@mallvirtual.com / admin123
usuario@test.com / user123
demo@demo.com / demo
```

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
2. `AppHeader` llama a `authStore.logout()`, que a su vez llama a `logout()` del service (solo log)
3. El store setea `user=null` / `isAuthenticated=false` (este estado se persiste; **la key `auth-storage` PERMANECE**, no se borra)
4. `AppHeader` redirige con `router.push('/login')` (la redirección la hace el header, no el store)

### Restauración de Sesión

1. Usuario recarga la página o vuelve a la app
2. Zustand rehidrata automáticamente el estado desde localStorage
3. `onRehydrateStorage` pone `hasHydrated=true`
4. `MainLayoutShell` espera el flag (spinner "Verificando credenciales...") y recién entonces verifica `isAuthenticated`
5. Si es `true`, permite el acceso
6. Si es `false`, redirige a `/login`

## Integración con Backend Real (Futuro — no implementado)

Hoy **no** hay backend: sin `.env`, sin `NEXT_PUBLIC_API_URL`/`AUTH_ENDPOINT`, sin JWT/expiry/refresh, cero `@supabase` en `src/`, sin middleware. `User` no lleva token ni password. Para conectar con un backend, modifica `src/services/authService.ts`:

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

### Consideraciones para Producción (Futuro — no implementado)

1. **Tokens JWT**: Guarda el token en el store y envíalo en las headers de las peticiones
2. **Refresh Tokens**: Implementa lógica para renovar tokens expirados
3. **Interceptores**: Usa axios o fetch interceptors para agregar el token a todas las peticiones
4. **Logout en backend**: Invalida el token en el servidor
5. **Seguridad**:
   - No guardes información sensible en localStorage
   - Usa HTTPS siempre
   - Implementa CSRF protection
   - Configura CORS correctamente

## Extensiones Futuras

- [x] Registro (`register`: stub existente, lanza "no implementada", pendiente backend)
- [x] Recuperación de contraseña (`requestPasswordReset`: stub existente, log + `true`, pendiente backend)
- [ ] Autenticación con redes sociales (OAuth)
- [ ] Two-Factor Authentication (2FA)
- [ ] Roles y permisos granulares
- [ ] Sesiones múltiples / gestión de dispositivos

## Variables de Entorno (Futuro — no implementado)

Hoy no existe ningún `.env` en el repo. Cuando se cablee el backend:

```env
NEXT_PUBLIC_API_URL=https://tu-api.com
NEXT_PUBLIC_AUTH_ENDPOINT=/auth/login
```

## Testing

Usuarios de prueba disponibles en desarrollo:

| Email | Password | Rol |
|-------|----------|-----|
| admin@mallvirtual.com | admin123 | admin |
| usuario@test.com | user123 | user |
| demo@demo.com | demo | user |
