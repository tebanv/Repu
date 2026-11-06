'use client';

// Dirección de entrega del checkout (docs/PLAN-PEDIDOS.md §2.3, cambio visual
// aprobado el 2026-11-05).
//
// Presentacional: la página es dueña de los datos (direcciones de `ms-users`,
// borrador, notas) y de las acciones (GPS, geocodificación, creación). Dos
// modos:
// - `saved`: lista seleccionable de direcciones guardadas (radiogroup).
// - `new`: formulario para una dirección nueva; se guarda al confirmar.
// Las instrucciones para el repartidor son del pedido, no de la dirección,
// así que se muestran en ambos modos.

import React from 'react';
import { MapPin, Navigation, Plus, ArrowLeft, Check, Loader2, RotateCcw } from 'lucide-react';
import type { Coordinates, SavedAddress } from '@/types';

export interface AddressDraft {
  /** Etiqueta opcional ("Casa", "Taller"). */
  name: string;
  street: string;
  /** Apartamento, taller o local; se agrega a la dirección completa. */
  details: string;
  city: string;
  coordinates: Coordinates | null;
}

export type AddressMode = 'saved' | 'new';
export type AddressLoadStatus = 'loading' | 'ready' | 'error';

export interface DeliveryAddressCardProps {
  addresses: SavedAddress[];
  status: AddressLoadStatus;
  onRetry: () => void;
  mode: AddressMode;
  onModeChange: (mode: AddressMode) => void;
  selectedId: string | null;
  onSelect: (addressId: string) => void;
  draft: AddressDraft;
  onDraftChange: (draft: AddressDraft) => void;
  onUseMyLocation: () => void;
  isLocating: boolean;
  notes: string;
  onNotesChange: (notes: string) => void;
  disabled?: boolean;
}

const INPUT_CLASS =
  'w-full bg-black/50 border border-white/15 focus:border-cyan-400 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-400 transition-colors disabled:opacity-60';
const LABEL_CLASS = 'block text-xs text-gray-400 mb-1 font-medium';

function AddressOption({
  address,
  selected,
  disabled,
  onSelect,
}: {
  address: SavedAddress;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={`w-full text-left rounded-xl p-3.5 border flex items-start gap-3 transition-colors cursor-pointer disabled:cursor-not-allowed focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400 ${
        selected
          ? 'border-cyan-400/50 bg-cyan-500/10'
          : 'border-white/10 bg-black/30 hover:border-white/20 hover:bg-white/[0.03]'
      }`}
    >
      <span
        className={`mt-0.5 w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center border ${
          selected
            ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
            : 'bg-white/5 border-white/10 text-gray-400'
        }`}
      >
        <MapPin size={15} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-white truncate">{address.name}</span>
          {address.isPrimary && (
            <span className="flex-shrink-0 text-[10px] font-medium text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded-md">
              Principal
            </span>
          )}
        </span>
        <span className="block text-xs text-gray-300 mt-0.5 line-clamp-2 break-words">
          {address.fullAddress}
        </span>
        {address.city && <span className="block text-[11px] text-gray-500 mt-0.5">{address.city}</span>}
      </span>

      <span
        aria-hidden
        className={`mt-1 w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center border transition-colors ${
          selected ? 'bg-cyan-400 border-cyan-400 text-black' : 'border-white/25'
        }`}
      >
        {selected && <Check size={12} strokeWidth={3} />}
      </span>
    </button>
  );
}

export default function DeliveryAddressCard({
  addresses,
  status,
  onRetry,
  mode,
  onModeChange,
  selectedId,
  onSelect,
  draft,
  onDraftChange,
  onUseMyLocation,
  isLocating,
  notes,
  onNotesChange,
  disabled = false,
}: DeliveryAddressCardProps) {
  const hasSaved = addresses.length > 0;
  const showList = mode === 'saved' && hasSaved;

  return (
    <div className="bg-gradient-to-br from-gray-900 via-gray-900/90 to-gray-950 border border-white/10 rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden">
      {/* Glow de acento sutil */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 flex-shrink-0 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <MapPin size={18} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white">Dirección de Entrega</h3>
            <p className="text-[11px] text-gray-400 truncate">¿Dónde entregaremos tu repuesto?</p>
          </div>
        </div>

        {status === 'ready' && hasSaved && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onModeChange(mode === 'saved' ? 'new' : 'saved')}
            className="flex-shrink-0 text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 py-1 px-2.5 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            {mode === 'saved' ? (
              <>
                <Plus size={14} />
                <span>Nueva</span>
              </>
            ) : (
              <>
                <ArrowLeft size={14} />
                <span>Mis direcciones</span>
              </>
            )}
          </button>
        )}
      </div>

      {status === 'loading' && (
        <div className="space-y-2.5" aria-busy="true" aria-label="Cargando direcciones">
          {[0, 1].map((row) => (
            <div key={row} className="h-[72px] rounded-xl bg-white/[0.04] border border-white/5 animate-pulse" />
          ))}
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center justify-between gap-3 rounded-xl p-3.5 bg-black/30 border border-white/10">
          <p className="text-xs text-gray-400">No pudimos cargar tus direcciones.</p>
          <button
            type="button"
            onClick={onRetry}
            className="flex-shrink-0 text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 py-1 px-2.5 rounded-lg hover:bg-white/5 transition-colors"
          >
            <RotateCcw size={13} />
            <span>Reintentar</span>
          </button>
        </div>
      )}

      {status === 'ready' && showList && (
        <div
          role="radiogroup"
          aria-label="Direcciones guardadas"
          className="space-y-2.5 max-h-72 overflow-y-auto overscroll-contain pr-0.5"
        >
          {addresses.map((address) => (
            <AddressOption
              key={address.id}
              address={address}
              selected={address.id === selectedId}
              disabled={disabled}
              onSelect={() => onSelect(address.id)}
            />
          ))}
        </div>
      )}

      {status === 'ready' && !showList && (
        <div className="space-y-3">
          <button
            type="button"
            disabled={disabled || isLocating}
            onClick={onUseMyLocation}
            className={`w-full flex items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium border transition-colors disabled:opacity-60 ${
              draft.coordinates
                ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
                : 'border-white/15 bg-black/30 text-white hover:border-cyan-400/40 hover:text-cyan-300'
            }`}
          >
            {isLocating ? <Loader2 size={15} className="animate-spin" /> : <Navigation size={15} />}
            <span>
              {isLocating
                ? 'Buscando tu ubicación...'
                : draft.coordinates
                  ? 'Ubicación detectada · actualizar'
                  : 'Usar mi ubicación actual'}
            </span>
          </button>

          <div>
            <label htmlFor="address-street" className={LABEL_CLASS}>
              Dirección *
            </label>
            <input
              id="address-street"
              type="text"
              autoComplete="street-address"
              disabled={disabled}
              value={draft.street}
              onChange={(e) => onDraftChange({ ...draft, street: e.target.value })}
              placeholder="Ej. Calle 10 # 43E-12, Laureles"
              className={INPUT_CLASS}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="address-details" className={LABEL_CLASS}>
                Apartamento / Taller / Local (opcional)
              </label>
              <input
                id="address-details"
                type="text"
                disabled={disabled}
                value={draft.details}
                onChange={(e) => onDraftChange({ ...draft, details: e.target.value })}
                placeholder="Ej. Taller AutoFix, Bahía 2"
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label htmlFor="address-city" className={LABEL_CLASS}>
                Ciudad *
              </label>
              <input
                id="address-city"
                type="text"
                autoComplete="address-level2"
                disabled={disabled}
                value={draft.city}
                onChange={(e) => onDraftChange({ ...draft, city: e.target.value })}
                placeholder="Medellín"
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div>
            <label htmlFor="address-name" className={LABEL_CLASS}>
              Nombre de la dirección (opcional)
            </label>
            <input
              id="address-name"
              type="text"
              disabled={disabled}
              value={draft.name}
              onChange={(e) => onDraftChange({ ...draft, name: e.target.value })}
              placeholder="Ej. Casa, Oficina, Taller"
              className={INPUT_CLASS}
            />
          </div>

          <p className="text-[11px] text-gray-500">
            La guardaremos en tu cuenta para tus próximos pedidos.
          </p>
        </div>
      )}

      {status !== 'loading' && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <label htmlFor="order-notes" className={LABEL_CLASS}>
            Instrucciones para el repartidor (opcional)
          </label>
          <input
            id="order-notes"
            type="text"
            maxLength={250}
            disabled={disabled}
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Ej. Dejar en recepción, capó abierto o llamar al llegar"
            className={INPUT_CLASS}
          />
        </div>
      )}
    </div>
  );
}
