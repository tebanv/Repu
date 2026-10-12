'use client';

import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Store, MapPin, Bike, Navigation, Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import type { Coordinates, OrderStatus } from '@/types';

export interface OrderTrackingMapProps {
  storeCoordinates?: Coordinates;
  deliveryCoordinates?: Coordinates;
  driverCoordinates?: Coordinates;
  storeName: string;
  destinationStreet: string;
  status: OrderStatus;
  className?: string;
}

// Fallbacks de coordenadas para Medellín
const DEFAULT_STORE_LOCATION: Coordinates = { lat: 6.2087, lng: -75.5678 };
const DEFAULT_DEST_LOCATION: Coordinates = { lat: 6.2232, lng: -75.6016 };

/**
 * Genera una serie de puntos de ruta interpolados entre origen y destino
 */
function generateRouteCoordinates(
  origin: Coordinates,
  destination: Coordinates,
  pointsCount = 30
): [number, number][] {
  const coords: [number, number][] = [];
  // Agregamos una ligera curvatura para que parezca una ruta real
  const midLat = (origin.lat + destination.lat) / 2 + 0.002;
  const midLng = (origin.lng + destination.lng) / 2 - 0.003;

  for (let i = 0; i <= pointsCount; i++) {
    const t = i / pointsCount;
    // Curva cuadrática bezier
    const lng = (1 - t) * (1 - t) * origin.lng + 2 * (1 - t) * t * midLng + t * t * destination.lng;
    const lat = (1 - t) * (1 - t) * origin.lat + 2 * (1 - t) * t * midLat + t * t * destination.lat;
    coords.push([lng, lat]);
  }
  return coords;
}

export default function OrderTrackingMap({
  storeCoordinates,
  deliveryCoordinates,
  driverCoordinates,
  storeName,
  destinationStreet,
  status,
  className = '',
}: OrderTrackingMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const driverMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const origin = storeCoordinates || DEFAULT_STORE_LOCATION;
  const destination = deliveryCoordinates || DEFAULT_DEST_LOCATION;

  // 1. Inicializar mapa
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

    const centerLng = (origin.lng + destination.lng) / 2;
    const centerLat = (origin.lat + destination.lat) / 2;

    const mapInstance = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [centerLng, centerLat],
      zoom: 13.5,
      pitch: 30, // Ligera inclinación cyberpunk
      bearing: -10,
      attributionControl: false,
    });

    map.current = mapInstance;

    mapInstance.on('load', () => {
      setMapLoaded(true);

      // Dibujar la ruta entre origen y destino
      const routeCoordinates = generateRouteCoordinates(origin, destination);

      mapInstance.addSource('delivery-route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: routeCoordinates,
          },
        },
      });

      // Capa de halo / brillo de la ruta
      mapInstance.addLayer({
        id: 'delivery-route-glow',
        type: 'line',
        source: 'delivery-route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#06b6d4',
          'line-width': 8,
          'line-opacity': 0.35,
          'line-blur': 4,
        },
      });

      // Capa principal de la ruta
      mapInstance.addLayer({
        id: 'delivery-route-core',
        type: 'line',
        source: 'delivery-route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#22d3ee',
          'line-width': 3.5,
          'line-dasharray': [1.5, 1],
        },
      });

      // Ajustar límites para mostrar ambos puntos
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend([origin.lng, origin.lat]);
      bounds.extend([destination.lng, destination.lat]);
      mapInstance.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 1000 });
    });

    return () => {
      mapInstance.remove();
      map.current = null;
    };
  }, [origin.lat, origin.lng, destination.lat, destination.lng]);

  // 2. Agregar / Actualizar Marcadores (Tienda, Destino y Repartidor)
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    const mapInstance = map.current;

    // --- Marcador de Tienda (Origen) ---
    const storeEl = document.createElement('div');
    storeEl.className = 'store-tracking-marker';
    storeEl.innerHTML = `
      <div class="relative flex items-center justify-center group cursor-pointer">
        <div class="absolute -inset-1 rounded-full bg-emerald-500/30 animate-ping"></div>
        <div class="relative w-9 h-9 rounded-full bg-gradient-to-br from-emerald-950 to-gray-900 border-2 border-emerald-400 flex items-center justify-center text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.5)]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/>
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
            <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/>
            <path d="M2 7h20"/>
          </svg>
        </div>
      </div>
    `;

    const storePopup = new mapboxgl.Popup({ offset: 15, closeButton: false }).setHTML(`
      <div class="p-2 text-xs font-sans bg-gray-900 text-white rounded-lg border border-emerald-500/30">
        <strong class="text-emerald-400 block">${storeName}</strong>
        <span class="text-gray-400 text-[10px]">Tienda de autopartes</span>
      </div>
    `);

    const storeMarker = new mapboxgl.Marker(storeEl)
      .setLngLat([origin.lng, origin.lat])
      .setPopup(storePopup)
      .addTo(mapInstance);

    // --- Marcador de Destino (Cliente / Taller) ---
    const destEl = document.createElement('div');
    destEl.className = 'dest-tracking-marker';
    destEl.innerHTML = `
      <div class="relative flex items-center justify-center group cursor-pointer">
        <div class="absolute -inset-1 rounded-full bg-cyan-500/30 animate-ping"></div>
        <div class="relative w-9 h-9 rounded-full bg-gradient-to-br from-cyan-950 to-gray-900 border-2 border-cyan-400 flex items-center justify-center text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.5)]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </div>
      </div>
    `;

    const destPopup = new mapboxgl.Popup({ offset: 15, closeButton: false }).setHTML(`
      <div class="p-2 text-xs font-sans bg-gray-900 text-white rounded-lg border border-cyan-500/30">
        <strong class="text-cyan-400 block">Tu Ubicación</strong>
        <span class="text-gray-300 text-[10px]">${destinationStreet}</span>
      </div>
    `);

    const destMarker = new mapboxgl.Marker(destEl)
      .setLngLat([destination.lng, destination.lat])
      .setPopup(destPopup)
      .addTo(mapInstance);

    // --- Marcador del Domiciliario (Moto) ---
    const driverEl = document.createElement('div');
    driverEl.className = 'driver-tracking-marker';
    driverEl.innerHTML = `
      <div class="relative flex items-center justify-center">
        <div class="absolute -inset-2 rounded-full bg-cyan-400/40 animate-ping"></div>
        <div class="relative w-11 h-11 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 border-2 border-white flex items-center justify-center text-black shadow-[0_0_20px_rgba(34,211,238,0.8)]">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="18.5" cy="17.5" r="3.5"/>
            <circle cx="5.5" cy="17.5" r="3.5"/>
            <circle cx="15" cy="5" r="1"/>
            <path d="M12 17.5V14l-3-3 4-3 2 3h2"/>
          </svg>
        </div>
      </div>
    `;

    // Posición inicial del repartidor según el estado
    let driverInitialLng = origin.lng;
    let driverInitialLat = origin.lat;

    if (status === 'EN_CAMINO') {
      // Posición intermedia en camino
      driverInitialLng = (origin.lng * 0.4 + destination.lng * 0.6);
      driverInitialLat = (origin.lat * 0.4 + destination.lat * 0.6);
    } else if (status === 'ENTREGADO') {
      driverInitialLng = destination.lng;
      driverInitialLat = destination.lat;
    }

    if (driverCoordinates) {
      driverInitialLng = driverCoordinates.lng;
      driverInitialLat = driverCoordinates.lat;
    }

    const driverMarker = new mapboxgl.Marker(driverEl)
      .setLngLat([driverInitialLng, driverInitialLat])
      .addTo(mapInstance);

    driverMarkerRef.current = driverMarker;

    return () => {
      storeMarker.remove();
      destMarker.remove();
      driverMarker.remove();
    };
  }, [mapLoaded, origin, destination, storeName, destinationStreet, status, driverCoordinates]);

  // 3. Animación de posición del repartidor al cambiar de estado
  useEffect(() => {
    if (!driverMarkerRef.current || !mapLoaded) return;

    let targetLng = origin.lng;
    let targetLat = origin.lat;

    if (status === 'CREADO' || status === 'PAGADO' || status === 'ACEPTADO' || status === 'PREPARANDO') {
      targetLng = origin.lng;
      targetLat = origin.lat;
    } else if (status === 'RECOGIDO') {
      targetLng = origin.lng * 0.85 + destination.lng * 0.15;
      targetLat = origin.lat * 0.85 + destination.lat * 0.15;
    } else if (status === 'EN_CAMINO') {
      targetLng = origin.lng * 0.35 + destination.lng * 0.65;
      targetLat = origin.lat * 0.35 + destination.lat * 0.65;
    } else if (status === 'ENTREGADO') {
      targetLng = destination.lng;
      targetLat = destination.lat;
    }

    driverMarkerRef.current.setLngLat([targetLng, targetLat]);
  }, [status, origin, destination, mapLoaded]);

  // Controles del mapa
  const handleRecenterDriver = () => {
    if (!map.current || !driverMarkerRef.current) return;
    const pos = driverMarkerRef.current.getLngLat();
    map.current.flyTo({ center: pos, zoom: 15, duration: 1200 });
  };

  const handleFitFullRoute = () => {
    if (!map.current) return;
    const bounds = new mapboxgl.LngLatBounds();
    bounds.extend([origin.lng, origin.lat]);
    bounds.extend([destination.lng, destination.lat]);
    map.current.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 1000 });
  };

  const handleZoomIn = () => {
    if (map.current) map.current.zoomIn({ duration: 300 });
  };

  const handleZoomOut = () => {
    if (map.current) map.current.zoomOut({ duration: 300 });
  };

  return (
    <div className={`relative w-full h-full min-h-[380px] rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-gray-900 ${className}`}>
      {/* Contenedor Mapbox */}
      <div ref={mapContainer} className="w-full h-full min-h-[380px]" />

      {/* Overlays informativos */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        <div className="px-3 py-1.5 rounded-xl bg-gray-950/80 backdrop-blur-md border border-white/10 text-xs text-white flex items-center gap-2 shadow-lg">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="font-semibold">Ruta en Vivo</span>
        </div>
      </div>

      {/* Botones de Control Flotantes */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <button
          type="button"
          onClick={handleRecenterDriver}
          className="w-9 h-9 rounded-xl bg-gray-950/85 backdrop-blur-md border border-white/10 hover:border-cyan-400 text-gray-300 hover:text-cyan-400 flex items-center justify-center shadow-lg transition-all cursor-pointer"
          title="Centrar en el repartidor"
          aria-label="Centrar en el repartidor"
        >
          <Navigation size={16} />
        </button>

        <button
          type="button"
          onClick={handleFitFullRoute}
          className="w-9 h-9 rounded-xl bg-gray-950/85 backdrop-blur-md border border-white/10 hover:border-cyan-400 text-gray-300 hover:text-cyan-400 flex items-center justify-center shadow-lg transition-all cursor-pointer"
          title="Ver ruta completa"
          aria-label="Ver ruta completa"
        >
          <Maximize2 size={16} />
        </button>

        <div className="h-px bg-white/10 my-0.5" />

        <button
          type="button"
          onClick={handleZoomIn}
          className="w-9 h-9 rounded-xl bg-gray-950/85 backdrop-blur-md border border-white/10 hover:border-white/20 text-gray-300 hover:text-white flex items-center justify-center shadow-lg transition-all cursor-pointer"
          title="Acercar mapa"
          aria-label="Acercar mapa"
        >
          <ZoomIn size={16} />
        </button>

        <button
          type="button"
          onClick={handleZoomOut}
          className="w-9 h-9 rounded-xl bg-gray-950/85 backdrop-blur-md border border-white/10 hover:border-white/20 text-gray-300 hover:text-white flex items-center justify-center shadow-lg transition-all cursor-pointer"
          title="Alejar mapa"
          aria-label="Alejar mapa"
        >
          <ZoomOut size={16} />
        </button>
      </div>

      {/* Leyenda inferior del mapa */}
      <div className="absolute bottom-4 left-4 right-4 z-10 flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-gray-950/85 backdrop-blur-md border border-white/10 text-[11px] text-gray-300 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span>Tienda</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
            <span>Repartidor</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.5)]" />
            <span>Destino</span>
          </div>
        </div>

        <span className="text-[10px] text-gray-400 font-mono">
          Mapbox GL · Live GPS
        </span>
      </div>
    </div>
  );
}
