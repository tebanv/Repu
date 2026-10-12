'use client';

import React from 'react';
import { CreditCard, QrCode, ShieldCheck, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import type { PaymentMethod } from '@/types';

export interface PaymentOption {
  id: PaymentMethod;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const PAYMENT_OPTIONS: PaymentOption[] = [
  {
    id: 'wompi',
    title: 'Pago en línea (Wompi)',
    subtitle: 'Transfiere de forma segura con PSE, Tarjeta de Crédito/Débito o Botón Bancolombia',
    icon: QrCode,
  },
];

export interface PaymentMethodSelectorProps {
  selectedMethod: PaymentMethod;
  onSelect: (method: PaymentMethod) => void;
}

export default function PaymentMethodSelector({
  selectedMethod,
  onSelect,
}: PaymentMethodSelectorProps) {
  return (
    <div className="bg-gradient-to-br from-gray-900 via-gray-900/90 to-gray-950 border border-white/10 rounded-2xl p-5 sm:p-6 shadow-xl backdrop-blur-sm">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.15)]">
          <CreditCard size={18} />
        </div>
        <div>
          <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">Método de Pago</h3>
          <p className="text-xs text-gray-400">Selecciona cómo deseas abonar tu compra</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3.5">
        {PAYMENT_OPTIONS.map((option) => {
          const isSelected = selectedMethod === option.id;
          const Icon = option.icon;

          return (
            <motion.button
              key={option.id}
              type="button"
              onClick={() => onSelect(option.id)}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              className={`
                group relative flex items-start gap-3.5 p-4 rounded-2xl text-left border transition-all duration-200 cursor-pointer
                ${
                  isSelected
                    ? 'bg-gradient-to-br from-cyan-950/30 via-gray-900 to-gray-950 border-cyan-400/90 shadow-[0_0_20px_rgba(34,211,238,0.16)] ring-1 ring-cyan-400/40'
                    : 'bg-black/30 border-white/[0.08] hover:border-white/20 hover:bg-white/[0.03]'
                }
              `}
            >
              {/* Icon Box */}
              <div
                className={`
                  w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center transition-all duration-200
                  ${
                    isSelected
                      ? 'bg-gradient-to-br from-cyan-400 to-sky-400 text-black shadow-[0_0_12px_rgba(34,211,238,0.4)]'
                      : 'bg-white/[0.06] text-gray-400 border border-white/[0.06] group-hover:text-gray-200 group-hover:border-white/15'
                  }
                `}
              >
                <Icon size={20} />
              </div>

              {/* Text Info */}
              <div className="flex-1 min-w-0 pr-5">
                <span className="text-sm font-semibold text-white block">
                  {option.title}
                </span>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  {option.subtitle}
                </p>
              </div>

              {/* Radio Indicator */}
              <div
                className={`
                  absolute top-4 right-4 w-5 h-5 rounded-full border flex items-center justify-center transition-all duration-200
                  ${
                    isSelected
                      ? 'border-cyan-400 bg-cyan-400 text-black shadow-[0_0_8px_rgba(34,211,238,0.5)]'
                      : 'border-gray-600/80 bg-black/40 group-hover:border-gray-500'
                  }
                `}
              >
                {isSelected && (
                  <Check size={12} strokeWidth={3} />
                )}
              </div>
            </motion.button>
          );
        })}
      </div>

      <div className="mt-4 pt-3.5 border-t border-white/[0.06] flex items-center gap-2 text-xs text-gray-400">
        <ShieldCheck size={15} className="text-emerald-400 flex-shrink-0" />
        <span>Pago seguro protegido por encriptación y garantía Repu</span>
      </div>
    </div>
  );
}

