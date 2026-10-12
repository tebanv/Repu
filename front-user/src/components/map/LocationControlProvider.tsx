'use client';

import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import useLocationStore from '@/store/locationStore';
import { LOCATION_PERMISSION_STATUS, type LocationPermissionStatus } from '@/lib/constants';
import type { Coordinates } from '@/types';

interface LocationContextType {
  permissionStatus: LocationPermissionStatus;
  userCoordinates: Coordinates | null;
  requestPermission: () => Promise<boolean>;
  isTracking: boolean;
}

const LocationContext = createContext<LocationContextType | null>(null);

export function LocationControlProvider({ children }: { children: ReactNode }) {
  const permissionStatus = useLocationStore((state) => state.permissionStatus);
  const userCoordinates = useLocationStore((state) => state.userCoordinates);
  const requestPermission = useLocationStore((state) => state.requestPermission);
  const startTracking = useLocationStore((state) => state.startTracking);
  const stopTracking = useLocationStore((state) => state.stopTracking);
  const isTracking = useLocationStore((state) => state.isTracking);

  const [hasCheckedPermission, setHasCheckedPermission] = useState(false);

  useEffect(() => {
    if (!hasCheckedPermission) {
      if (typeof window !== 'undefined' && 'permissions' in navigator) {
        navigator.permissions
          .query({ name: 'geolocation' as PermissionName })
          .then((permission) => {
            if (permission.state === 'granted') {
              requestPermission();
            }
            setHasCheckedPermission(true);
          })
          .catch(() => {
            setHasCheckedPermission(true);
          });
      } else {
        setHasCheckedPermission(true);
      }
    }
  }, [hasCheckedPermission, requestPermission]);

  useEffect(() => {
    if (permissionStatus === LOCATION_PERMISSION_STATUS.GRANTED) {
      startTracking();
    } else {
      stopTracking();
    }

    return () => {
      stopTracking();
    };
  }, [permissionStatus, startTracking, stopTracking]);

  return (
    <LocationContext.Provider
      value={{
        permissionStatus,
        userCoordinates,
        requestPermission,
        isTracking,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocationControl() {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocationControl must be used within LocationControlProvider');
  }
  return context;
}
