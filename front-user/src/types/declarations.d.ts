declare module '*.css';
declare module 'mapbox-gl/dist/mapbox-gl.css';

declare global {
  interface Window {
    mapboxgl?: typeof import('mapbox-gl');
  }
}

export {};
