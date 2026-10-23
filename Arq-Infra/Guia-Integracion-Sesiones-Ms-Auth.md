# Integración de autenticación y sesiones REPU

Guía para los equipos e implementaciones de los microservicios REPU. `ms-auth` es la autoridad para iniciar sesión, validar y revocar sesiones. Cada microservicio debe autorizar sus propios recursos después de obtener una identidad válida.

## Flujo normal

1. El cliente envía sus credenciales a `POST /api/auth/login` de `ms-auth`.
2. Si son válidas, `ms-auth` crea una sesión y responde con `Set-Cookie: __Host-repu_session=...`. La respuesta JSON incluye `userId`, `role`, `expiresInSeconds` y `accessToken`.
3. En web, el navegador conserva y envía la cookie automáticamente. No leerla ni guardarla en JavaScript.
4. En aplicaciones móviles nativas, guardar `accessToken` en Keychain/Secure Enclave o Android Keystore y enviarlo como `Authorization: Bearer <accessToken>`.
5. En cada solicitud protegida, el microservicio valida la credencial y después aplica sus reglas de autorización al recurso solicitado.

El token es opaco, aleatorio y funciona como credencial de sesión. `ms-auth` guarda su hash en PostgreSQL y una referencia de sesión en Redis. No es un JWT: los micros no deben decodificarlo ni validar su firma.

## Contratos de `ms-auth`

| Endpoint | Uso |
|---|---|
| `POST /api/auth/login` | Iniciar sesión; emite la cookie y devuelve el token para clientes nativos. |
| `POST /api/auth/register` | Registrar una cuenta. |
| `GET /api/auth/session` | Validar la cookie o el Bearer actual; responde `{ "userId": "...", "role": "..." }`. Devuelve `401` si la sesión no es válida o expiró. |
| `POST /api/auth/logout` | Revocar la sesión presentada y expirar la cookie. |
| `POST /api/auth/logout-all` | Revocar todas las sesiones del usuario autenticado. |
| `GET /api/auth/sessions` | Listar las sesiones activas del usuario autenticado para la gestión de dispositivos. **No usar para validar una solicitud.** |

Para validar una credencial desde un microservicio, el endpoint es `GET /api/auth/session`, no `/api/auth/sessions`. Reenviar la credencial original:

```http
GET /api/auth/session
Authorization: Bearer <token>
X-Request-ID: <id-correlacion>
```

Para autenticación por cookie, reenviar el encabezado `Cookie` recibido por el servicio, o dejar que el gateway propague la cookie. No enviar el token en query parameters ni en logs.

## Integración entre microservicios

**Recomendación para servicios que reciben solicitudes directamente:** validar cada solicitud protegida mediante una llamada backend-a-backend a `GET /api/auth/session`, reenviando la cookie o el Bearer del usuario. Usar HTTPS, identidad/autorización de servicio a servicio, timeouts y `X-Request-ID`. Un `401` de `ms-auth` significa sesión inválida; si `ms-auth` no está disponible, fallar cerrado y responder `503` —no asumir identidad autenticada ni convertir el error de red en éxito.

**Alternativa para una arquitectura con gateway:** el gateway valida la sesión una vez y pasa la identidad a los servicios privados. En ese caso, el gateway debe eliminar cualquier `X-User-Id`, `X-Role` o encabezado equivalente enviado por el cliente y establecer los valores confiables él mismo. Los servicios solo pueden confiar en esos encabezados si no son accesibles desde clientes externos y el tráfico interno está autenticado (por ejemplo, mTLS). Nunca aceptar esos encabezados directamente desde Internet.

No consultar directamente las tablas de sesión o Redis desde otros micros, ni copiar la lógica de hashing/validación de `ms-auth`. Los servicios aplican autorización de negocio en backend usando la identidad validada y verifican que el usuario tenga permiso sobre el recurso; ocultar botones en el frontend no es autorización.

## Cookies, CORS y dominios

La cookie usa `__Host-repu_session`, `HttpOnly`, `Secure`, `SameSite=Lax` y `Path=/`. `__Host-` requiere HTTPS, no permite atributo `Domain` y limita la cookie al host que la emitió. Por eso, para `app.repu.com` y `comercio.repu.com`, no se debe esperar que una cookie emitida por un host se envíe directamente al otro.

Para compartir la sesión entre portales, exponer las APIs detrás de un host común —por ejemplo, `api.repu.com`— y enrutar desde allí a los microservicios. En llamadas web entre orígenes, usar `credentials: "include"` (o `withCredentials: true`) y configurar CORS con orígenes explícitos y credenciales habilitadas; nunca combinar credenciales con `Access-Control-Allow-Origin: *`. `SameSite=Lax` permite subdominios del mismo sitio HTTPS, pero no convierte la cookie `__Host-` en una cookie compartida entre hosts.

### Desarrollo local sobre HTTP/IP (solo pruebas)

La configuración recomendada sigue siendo HTTPS con `__Host-repu_session`. Para probar desde un navegador contra Traefik en HTTP/IP, configura en el `.env` local (ignorado por Git) los siguientes valores:

```dotenv
SESSION_COOKIE_NAME=repu_session_dev
SESSION_COOKIE_SECURE=false
SESSION_COOKIE_ALLOW_INSECURE_HTTP=true
```

Este modo usa una cookie sin prefijo `__Host-`; los navegadores exigen `Secure` para ese prefijo y no aceptarían la cookie sobre HTTP. Los valores predeterminados del Compose siguen siendo `__Host-repu_session` y `Secure=true`; `ms-auth` además se niega a arrancar con cookies no seguras salvo que se habilite explícitamente `SESSION_COOKIE_ALLOW_INSECURE_HTTP=true` y el perfil Spring sea `local` o `dev`. No uses este modo en redes públicas, staging ni producción: HTTP expone la cookie de sesión y permite su robo. Para probar con cookie en navegador, abre el frontend y las APIs bajo el mismo host/IP que sirve Traefik; `SameSite=Lax` no permite enviar esa cookie en llamadas cross-site desde `localhost` hacia una IP. Si el frontend corre en otro puerto del mismo host, usa `credentials: "include"` y configura el CORS con el origen exacto (esquema, host y puerto, sin `/` final); los métodos de actualización/eliminación requieren preflight y están permitidos por los servicios que autentican esta sesión. Al volver a HTTPS, elimina estos overrides y reinicia todos los servicios para que todos vuelvan al nombre `__Host-repu_session`.

## Seguridad y expiración

- No almacenar el token web en `localStorage`, `sessionStorage`, URLs ni telemetría; la cookie es gestionada por el navegador.
- En móvil, proteger el token en el almacén seguro del sistema operativo y enviarlo únicamente por HTTPS.
- No registrar `Cookie`, `Set-Cookie`, `Authorization` ni el token en trazas o logs.
- Las sesiones expiran en 8 horas para `ADMIN` y `ANALISTA`, y en 7 días para los demás roles. El backend intenta renovar la sesión al acercarse a la expiración; hoy la cookie solo se emite en login, por lo que su `Max-Age` del navegador no se extiende automáticamente con esa renovación.
- Actualmente no hay un endpoint ni un flujo de `refresh_token`. Para cerrar sesión, llamar a `/api/auth/logout`; para revocar todos los dispositivos, llamar a `/api/auth/logout-all`.
