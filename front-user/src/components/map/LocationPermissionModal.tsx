'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, X } from 'lucide-react';

export interface LocationPermissionModalProps {
  onRequest?: () => void;
  onDismiss?: () => void;
  isLocating?: boolean;
  error?: string | null;
}

export default function LocationPermissionModal({
  onRequest,
  onDismiss,
  isLocating = false,
  error = null,
}: LocationPermissionModalProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-black border border-cyan-500/40 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-md max-w-md w-full pointer-events-auto"
        style={{ boxShadow: '0 0 40px rgba(34, 211, 238, 0.15), 0 25px 50px rgba(0, 0, 0, 0.6)' }}
      >
        {/* Botón de minimizar en la esquina superior derecha */}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Minimizar y explorar mapa por defecto"
            className="absolute top-4 right-4 text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800/80 transition-colors"
          >
            <X size={18} />
          </button>
        )}

        {/* Icono */}
        <div className="flex justify-center mb-5">
          <motion.div
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 2.2, repeat: Infinity }}
            className="w-14 h-14 bg-cyan-500/20 rounded-full flex items-center justify-center border border-cyan-400/40 shadow-[0_0_20px_rgba(34,211,238,0.3)]"
          >
            <MapPin className="w-7 h-7 text-cyan-400" strokeWidth={2.5} />
          </motion.div>
        </div>

        {/* Título */}
        <h2 className="text-xl sm:text-2xl font-bold text-white text-center mb-2">
          Permitir ubicación
        </h2>

        {/* Descripción */}
        <p className="text-gray-300 text-center text-sm mb-5 leading-relaxed">
          Para mostrarte las tiendas de repuestos más cercanas, necesitamos acceder a tu ubicación.
        </p>

        {/* Mensaje de error/denegación */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-5 text-left"
          >
            <p className="text-amber-300 text-xs leading-relaxed">
              {error.toLowerCase().includes('denegado')
                ? 'Ubicación bloqueada por el navegador. Puedes habilitarla en la barra de direcciones o continuar explorando el mapa por defecto.'
                : error}
            </p>
          </motion.div>
        )}

        {/* Botón Principal: Permitir ubicación */}
        <button
          type="button"
          onClick={onRequest}
          disabled={isLocating}
          className="w-full bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black font-bold rounded-lg px-6 py-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(34,211,238,0.4)] text-sm"
        >
          {isLocating ? (
            <>
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full"
              />
              Solicitando permiso...
            </>
          ) : (
            'Permitir ubicación'
          )}
        </button>

        {/* Botón Secundario: Minimizar y explorar con ubicación por defecto */}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="w-full mt-3 py-2.5 px-4 rounded-lg text-xs sm:text-sm text-gray-300 hover:text-white bg-gray-800/60 hover:bg-gray-700/60 border border-gray-700/50 transition-colors text-center font-medium"
          >
            Navegar con ubicación por defecto
          </button>
        )}

        {/* Texto pequeño */}
        <p className="text-[11px] text-gray-500 text-center mt-4">
          Tu ubicación solo se utiliza para calcular distancias a tiendas cercanas
        </p>
      </motion.div>
    </div>
  );
}
