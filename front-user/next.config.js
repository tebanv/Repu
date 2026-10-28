/** @type {import('next').NextConfig} */
const nextConfig = {
  // Genera `.next/standalone` (server.js autocontenido) para imagen Docker mínima.
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.mapbox.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'mapbox.com',
        port: '',
        pathname: '/**',
      },
    ],
  },

  /**
   * Same-origin en desarrollo para `ms-auth`/`ms-users`.
   *
   * En producción Traefik ya enruta `/ms-auth` y `/ms-users` en el mismo host;
   * en dev Next replica esas rutas para que la cookie `HttpOnly` funcione sin
   * CORS ni diferencias de host. Solo se activa si las variables existen y
   * nunca en producción.
   */
  async rewrites() {
    if (process.env.NODE_ENV === 'production') return [];

    const authOrigin = process.env.AUTH_API_ORIGIN?.replace(/\/$/, '');
    const usersOrigin = process.env.USERS_API_ORIGIN?.replace(/\/$/, '');
    const rules = [];

    if (authOrigin) {
      rules.push({
        source: '/ms-auth/:path*',
        destination: `${authOrigin}/ms-auth/:path*`,
      });
    }
    if (usersOrigin) {
      rules.push({
        source: '/ms-users/:path*',
        destination: `${usersOrigin}/ms-users/:path*`,
      });
    }

    return rules;
  },
};

module.exports = nextConfig;