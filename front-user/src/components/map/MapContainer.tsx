'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';
import useLocationStore from '@/store/locationStore';
import useFilterStore from '@/store/filterStore';
import useStoresStore from '@/store/storesStore';
import { LOCATION_PERMISSION_STATUS, DEFAULT_LOCATION } from '@/lib/constants';
import { getDistanceMeters } from '@/lib/geoUtils';
import LocationButton from './controls/LocationButton';
import ZoomControl from './controls/ZoomControl';
import LocationPermissionModal from './LocationPermissionModal';
import StoresLayer from './layers/StoresLayer';
import LoadingIndicator from '@/components/ui/LoadingIndicator';
import type { Coordinates } from '@/types';

const MIN_FETCH_DISTANCE_METERS = 120;

export default function MapContainer() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isPermissionDismissed, setIsPermissionDismissed] = useState(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastRequestedCenterRef = useRef<Coordinates | null>(null);

  const userCoordinates = useLocationStore((state) => state.userCoordinates);
  const permissionStatus = useLocationStore((state) => state.permissionStatus);
  const requestPermission = useLocationStore((state) => state.requestPermission);
  const locationError = useLocationStore((state) => state.error);

  const fetchStores = useStoresStore((state) => state.fetchStores);
  const applyFilters = useStoresStore((state) => state.applyFilters);
  const selectStore = useStoresStore((state) => state.selectStore);
  const isLoadingStores = useStoresStore((state) => state.isLoading);

  const activeFilters = useFilterStore((state) => state.activeFilters);
  const filtersRef = useRef(activeFilters);
  filtersRef.current = activeFilters;

  // 1. Inicialización de Mapbox
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

    const initialCenter = userCoordinates || DEFAULT_LOCATION;

    const mapInstance = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [initialCenter.lng, initialCenter.lat],
      zoom: 13,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
    });

    map.current = mapInstance;

    mapInstance.on('load', () => {
      setMapLoaded(true);
      lastRequestedCenterRef.current = initialCenter;
      fetchStores({ location: initialCenter, filters: filtersRef.current });
    });

    mapInstance.on('click', (e) => {
      const target = e.originalEvent?.target as HTMLElement | null;
      if (!target?.closest('.store-marker-container')) {
        selectStore(null);
      }
    });

    const handleMapMove = () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

      debounceTimerRef.current = setTimeout(async () => {
        if (!map.current) return;

        const center = map.current.getCenter();
        const nextCenter: Coordinates = { lat: center.lat, lng: center.lng };

        if (
          lastRequestedCenterRef.current &&
          getDistanceMeters(lastRequestedCenterRef.current, nextCenter) < MIN_FETCH_DISTANCE_METERS
        ) {
          return;
        }

        lastRequestedCenterRef.current = nextCenter;
        await fetchStores({ location: nextCenter, filters: filtersRef.current });
      }, 600);
    };

    mapInstance.on('moveend', handleMapMove);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // 2. Filtrado instantáneo en memoria al cambiar filtros activos
  useEffect(() => {
    if (mapLoaded) {
      applyFilters(activeFilters);
    }
  }, [activeFilters, mapLoaded, applyFilters]);

  const handleLocationClick = async () => {
    if (isLocating) return;

    if (permissionStatus !== LOCATION_PERMISSION_STATUS.GRANTED) {
      setIsLocating(true);
      const granted = await requestPermission();
      setIsLocating(false);
      if (!granted) {
        setIsPermissionDismissed(false);
        return;
      }
    }

    if (userCoordinates && map.current) {
      map.current.flyTo({
        center: [userCoordinates.lng, userCoordinates.lat],
        zoom: 15,
        essential: true,
      });
      lastRequestedCenterRef.current = userCoordinates;
      fetchStores({ location: userCoordinates, filters: filtersRef.current });
    }
  };

  const handleRequestPermission = async () => {
    setIsLocating(true);
    await requestPermission();
    setIsLocating(false);
  };

  const showPermissionPrompt =
    !isPermissionDismissed &&
    (permissionStatus === LOCATION_PERMISSION_STATUS.IDLE ||
      permissionStatus === LOCATION_PERMISSION_STATUS.PENDING ||
      permissionStatus === LOCATION_PERMISSION_STATUS.DENIED);

  return (
    <div className="relative w-full h-full min-h-[300px] rounded-2xl overflow-hidden border border-gray-800 shadow-2xl bg-gray-950">
      <div ref={mapContainer} className="w-full h-full" />

      {isLoadingStores && (
        <div className="absolute top-4 left-4 z-10">
          <LoadingIndicator />
        </div>
      )}

      {/* Botón superior persistente para activar ubicación cuando el modal está minimizado */}
      {mapLoaded && permissionStatus !== LOCATION_PERMISSION_STATUS.GRANTED && isPermissionDismissed && (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleLocationClick}
          disabled={isLocating}
          className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-black/85 backdrop-blur-md border border-cyan-500/50 hover:border-cyan-400 text-cyan-300 hover:text-white px-3.5 py-1.5 rounded-full text-xs font-medium shadow-[0_0_15px_rgba(34,211,238,0.25)] flex items-center gap-2 transition-all duration-200 cursor-pointer"
          title="Toca para activar el GPS de tu dispositivo"
        >
          {isLocating ? (
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="inline-block w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full"
            />
          ) : (
            <MapPin size={13} className="text-cyan-400 animate-pulse" />
          )}
          <span>Permitir ubicación</span>
        </motion.button>
      )}

      {mapLoaded && map.current && (
        <>
          <StoresLayer map={map} />
          <LocationButton
            onClick={handleLocationClick}
            isLocating={isLocating}
          />
          <ZoomControl map={map} />
        </>
      )}

      {showPermissionPrompt && (
        <LocationPermissionModal
          onRequest={handleRequestPermission}
          onDismiss={() => setIsPermissionDismissed(true)}
          isLocating={isLocating}
          error={locationError}
        />
      )}
    </div>
  );
}
