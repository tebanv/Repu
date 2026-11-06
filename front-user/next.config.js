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
   * Same-origin en desarrollo para los microservicios.
   *
   * En producción Traefik ya enruta `/ms-*` en el mismo host; en dev Next
   * replica esas rutas para que la cookie `HttpOnly` funcione sin CORS ni
   * diferencias de host. Cada regla solo se activa si su variable existe y
   * nunca en producción.
   */
  async rewrites() {
    if (process.env.NODE_ENV === 'production') return [];

    // Prefijo público → variable de entorno (solo servidor) con su origen.
    const services = [
      ['ms-auth', 'AUTH_API_ORIGIN'],
      ['ms-users', 'USERS_API_ORIGIN'],
      ['ms-companies', 'COMPANIES_API_ORIGIN'],
      ['ms-products', 'PRODUCTS_API_ORIGIN'],
      ['ms-categories', 'CATEGORIES_API_ORIGIN'],
      ['ms-orders', 'ORDERS_API_ORIGIN'],
    ];

    return services.flatMap(([prefix, envName]) => {
      const origin = process.env[envName]?.replace(/\/$/, '');
      return origin
        ? [{ source: `/${prefix}/:path*`, destination: `${origin}/${prefix}/:path*` }]
        : [];
    });
  },
};

module.exports = nextConfig;