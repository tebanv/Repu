import { create } from 'zustand';
import {
  LOCATION_PERMISSION_STATUS,
  DEFAULT_LOCATION,
  type LocationPermissionStatus,
} from '@/lib/constants';
import { getCurrentPosition } from '@/services/geolocationService';
import type { Coordinates } from '@/types';

export interface LocationStoreState {
  userCoordinates: Coordinates | null;
  permissionStatus: LocationPermissionStatus;
  isTracking: boolean;
  error: string | null;
  watchId: number | null;
  setUserCoordinates: (coordinates: Coordinates | null) => void;
  setPermissionStatus: (status: LocationPermissionStatus) => void;
  setError: (error: string | null) => void;
  requestPermission: () => Promise<boolean>;
  startTracking: () => void;
  stopTracking: () => void;
  resetToDefault: () => void;
}

const useLocationStore = create<LocationStoreState>((set, get) => ({
  userCoordinates: null,
  permissionStatus: LOCATION_PERMISSION_STATUS.IDLE,
  isTracking: false,
  error: null,
  watchId: null,

  setUserCoordinates: (coordinates) => set({ userCoordinates: coordinates }),
  setPermissionStatus: (status) => set({ permissionStatus: status }),
  setError: (error) => set({ error }),

  requestPermission: async () => {
    set({ permissionStatus: LOCATION_PERMISSION_STATUS.PENDING });
    try {
      const coords = await getCurrentPosition();
      set({
        userCoordinates: coords,
        permissionStatus: LOCATION_PERMISSION_STATUS.GRANTED,
        error: null,
      });
      return true;
    } catch (error) {
      const geoError = error as GeolocationPositionError;
      if (geoError && geoError.code === 1) {
        set({
          permissionStatus: LOCATION_PERMISSION_STATUS.DENIED,
          error: 'Permiso de ubicación denegado por el usuario',
        });
      } else {
        set({
          permissionStatus: LOCATION_PERMISSION_STATUS.DENIED,
          error: 'No se pudo obtener la ubicación',
        });
      }
      return false;
    }
  },

  startTracking: () => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) return;
    
    // Si ya existe un watcher activo y funcionando, no creamos otro
    const currentWatchId = get().watchId;
    if (currentWatchId !== null && get().isTracking) return;

    // Si había un watcher previo pero falló o no estaba rastreando, lo limpiamos antes de rearmar
    if (currentWatchId !== null) {
      navigator.geolocation.clearWatch(currentWatchId);
    }

    const id = navigator.geolocation.watchPosition(
      (position) => {
        set({
          userCoordinates: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          },
          isTracking: true,
          permissionStatus: LOCATION_PERMISSION_STATUS.GRANTED,
          error: null,
        });
      },
      (error) => {
        // 1. Si el usuario denegó permisos (Código 1), apagamos el hardware de inmediato
        if (error.code === 1 /* PERMISSION_DENIED */) {
          navigator.geolocation.clearWatch(id);
          set({
            watchId: null,
            isTracking: false,
            permissionStatus: LOCATION_PERMISSION_STATUS.DENIED,
            error: 'Permiso de ubicación denegado.',
          });
          return;
        }

        // 2. Si es pérdida temporal de señal (Códigos 2 y 3: Sótanos/Túneles/Timeout),
        // mantenemos el watcher activo para reconexión automática pero aplicamos
        // guarda anti re-renders para no saturar a Zustand cada 10s.
        if (get().isTracking || get().error !== 'Buscando señal GPS...') {
          set({
            isTracking: false,
            error: 'Buscando señal GPS...',
          });
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    );

    set({ watchId: id });
  },

  stopTracking: () => {
    const { watchId } = get();
    if (watchId !== null && typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchId);
      set({ watchId: null, isTracking: false });
    }
  },

  resetToDefault: () => {
    get().stopTracking();
    set({
      userCoordinates: DEFAULT_LOCATION,
      permissionStatus: LOCATION_PERMISSION_STATUS.IDLE,
      error: null,
    });
  },
}));

export default useLocationStore;
