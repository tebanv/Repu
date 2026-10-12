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
};
  
  module.exports = nextConfig;