'use client';

import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, Edit3, Check } from 'lucide-react';
import useLocationStore from '@/store/locationStore';
import type { DeliveryAddress } from '@/types';

export interface DeliveryAddressCardProps {
  address: DeliveryAddress;
  onChange: (updatedAddress: DeliveryAddress) => void;
}

export default function DeliveryAddressCard({
  address,
  onChange,
}: DeliveryAddressCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const userCoordinates = useLocationStore((state) => state.userCoordinates);

  // Si hay coordenadas de usuario y aún no se ha establecido la calle, autocompletar
  useEffect(() => {
    if (userCoordinates && !address.street) {
      onChange({
        ...address,
        street: 'Ubicación actual detectada por GPS',
        city: 'Medellín',
        coordinates: userCoordinates,
      });
    }
  }, [userCoordinates]);

  return (
    <div className="bg-gradient-to-br from-gray-900 via-gray-900/90 to-gray-950 border border-white/10 rounded-2xl p-5 shadow-xl relative overflow-hidden">
      {/* Glow de acento sutil */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <MapPin size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Dirección de Entrega</h3>
            <p className="text-[11px] text-gray-400">¿Dónde entregaremos tu repuesto?</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsEditing(!isEditing)}
          className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 py-1 px-2.5 rounded-lg hover:bg-white/5 transition-colors"
        >
          {isEditing ? (
            <>
              <Check size={14} />
              <span>Listo</span>
            </>
          ) : (
            <>
              <Edit3 size={14} />
              <span>Editar</span>
            </>
          )}
        </button>
      </div>

      {isEditing ? (
        <div className="space-y-3 pt-1">
          <div>
            <label className="block text-xs text-gray-400 mb-1 font-medium">
              Dirección o referencia principal *
            </label>
            <div className="relative">
              <input
                type="text"
                value={address.street}
                onChange={(e) => onChange({ ...address, street: e.target.value })}
                placeholder="Ej. Calle 10 # 43E-12, Laureles"
                className="w-full bg-black/50 border border-white/15 focus:border-cyan-400 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-400 transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1 font-medium">
                Apartamento / Taller / Local (opcional)
              </label>
              <input
                type="text"
                value={address.details || ''}
                onChange={(e) => onChange({ ...address, details: e.target.value })}
                placeholder="Ej. Taller AutoFix, Bahía 2"
                className="w-full bg-black/50 border border-white/15 focus:border-cyan-400 rounded-xl px-3.5 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-400 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1 font-medium">
                Ciudad
              </label>
              <input
                type="text"
                value={address.city}
                onChange={(e) => onChange({ ...address, city: e.target.value })}
                placeholder="Medellín"
                className="w-full bg-black/50 border border-white/15 focus:border-cyan-400 rounded-xl px-3.5 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-400 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1 font-medium">
              Instrucciones para el repartidor (opcional)
            </label>
            <input
              type="text"
              value={address.notes || ''}
              onChange={(e) => onChange({ ...address, notes: e.target.value })}
              placeholder="Ej. Dejar en recepción, capó abierto o llamar al llegar"
              className="w-full bg-black/50 border border-white/15 focus:border-cyan-400 rounded-xl px-3.5 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-400 transition-colors"
            />
          </div>
        </div>
      ) : (
        <div className="bg-black/30 rounded-xl p-3.5 border border-white/5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {address.street || 'Sin dirección especificada'}
            </p>
            {address.details && (
              <p className="text-xs text-gray-400 mt-0.5">{address.details}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              {address.city} {address.notes ? `• "${address.notes}"` : ''}
            </p>
          </div>

          {address.coordinates && (
            <div className="flex-shrink-0 flex items-center gap-1 text-[11px] text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-md">
              <Navigation size={10} />
              <span>GPS</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
