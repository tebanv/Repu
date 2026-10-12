"use client"

import React from 'react';
import useFilterStore from '@/store/filterStore';
import { motion, AnimatePresence } from 'framer-motion';
import type { StoreCategory } from '@/types';

// Componentes de iconos animados
const AnimatedBattery = ({ isActive }: { isActive: boolean }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="transition-colors duration-300"
  >
    <g className={isActive ? 'is-active' : ''}>
      <rect width="16" height="10" x="2" y="7" rx="2" ry="2" />
      <line x1="22" x2="22" y1="11" y2="13" />
      <line className="battery-level" x1="6" x2="6" y1="10" y2="14" />
      <line className="battery-level" x1="10" x2="10" y1="10" y2="14" style={{ animationDelay: '0.1s' }} />
      <line className="battery-level" x1="14" x2="14" y1="10" y2="14" style={{ animationDelay: '0.2s' }} />
    </g>
  </svg>
);

const AnimatedTire = ({ isActive }: { isActive: boolean }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="transition-colors duration-300"
  >
    <g className={isActive ? 'is-active' : ''}>
      <g className="tire-wheel">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="4" />
        <line x1="12" x2="12" y1="2" y2="8" />
        <line x1="12" x2="12" y1="16" y2="22" />
        <line x1="2" x2="8" y1="12" y2="12" />
        <line x1="16" x2="22" y1="12" y2="12" />
        <line x1="4.93" x2="9.17" y1="4.93" y2="9.17" />
        <line x1="14.83" x2="19.07" y1="14.83" y2="19.07" />
        <line x1="4.93" x2="9.17" y1="19.07" y2="14.83" />
        <line x1="14.83" x2="19.07" y1="9.17" y2="4.93" />
      </g>
    </g>
  </svg>
);

const AnimatedWrench = ({ isActive }: { isActive: boolean }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="transition-colors duration-300"
  >
    <g className={isActive ? 'is-active' : ''}>
      <path
        className="wrench-tool"
        d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
      />
    </g>
  </svg>
);

interface CategoryItem {
  id: StoreCategory;
  label: string;
  icon: React.ComponentType<{ isActive: boolean }>;
}

const CATEGORIES: CategoryItem[] = [
  {
    id: 'battery',
    label: 'Baterías',
    icon: AnimatedBattery,
  },
  {
    id: 'tire',
    label: 'Llantas',
    icon: AnimatedTire,
  },
  {
    id: 'spare',
    label: 'Repuestos',
    icon: AnimatedWrench,
  },
];

export default function FilterBanner() {
  const activeFilters = useFilterStore((state) => state.activeFilters);
  const toggleFilter = useFilterStore((state) => state.toggleFilter);

  const handleFilter = (categoryId: StoreCategory) => {
    toggleFilter(categoryId);
  };

  return (
    <div className="w-full bg-background border-b border-border sticky top-0 z-40">
      <div className="flex items-center justify-between px-4 h-16 sm:h-14 md:h-16 overflow-x-auto">
        <div className="flex gap-2 sm:gap-3 min-w-0">
          {CATEGORIES.map((category) => (
            <motion.button
              key={category.id}
              onClick={() => handleFilter(category.id)}
              className={`
                relative px-4 py-2 whitespace-nowrap text-sm font-medium
                transition-colors duration-200 rounded-lg
                flex items-center gap-2
                touch-manipulation
                ${
                  activeFilters.has(category.id)
                    ? 'text-accent bg-accent/10'
                    : 'text-muted-foreground hover:text-foreground'
                }
              `}
              whileTap={{ scale: 0.95 }}
              aria-pressed={activeFilters.has(category.id)}
              aria-label={`Filtrar por ${category.label}`}
            >
              <span className="text-base">
                <category.icon isActive={activeFilters.has(category.id)} />
              </span>
              {category.label}
              <AnimatePresence>
                {activeFilters.has(category.id) && (
                  <motion.div
                    layoutId={`activeIndicator-${category.id}`}
                    className="absolute bottom-0 left-0 right-0 h-1 bg-accent rounded-t-full"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  />
                )}
              </AnimatePresence>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
