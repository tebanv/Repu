'use client';

import { memo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export interface ProductIconProps {
  className?: string;
  containerClassName?: string;
  iconWrapperClassName?: string;
  ambientGlowClassName?: string;
  iconShadow?: string;
  floatDistance?: number;
  floatDuration?: number;
}

function ProductIcon({
  className = 'h-full w-full text-cyan-400',
  containerClassName = 'bg-zinc-900/60 border border-zinc-800 rounded-xl',
  iconWrapperClassName = 'h-1/2 w-1/2',
  ambientGlowClassName = 'bg-cyan-500/5 blur-xl',
  iconShadow = 'drop-shadow(0 0 4px rgba(34, 211, 238, 0.32))',
  floatDistance = 2,
  floatDuration = 4,
}: ProductIconProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      className={`relative flex h-full w-full items-center justify-center overflow-hidden ${containerClassName}`}
      aria-hidden="true"
    >
      <div className={`absolute inset-0 rounded-full ${ambientGlowClassName}`} />

      <motion.div
        initial={false}
        animate={prefersReducedMotion ? undefined : { y: [-floatDistance, floatDistance, -floatDistance] }}
        transition={prefersReducedMotion ? undefined : { duration: floatDuration, repeat: Infinity, ease: 'easeInOut' }}
        className={`relative z-10 flex items-center justify-center ${iconWrapperClassName}`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          style={{ filter: iconShadow }}
        >
          <motion.path
            d="M12 3L20 7.5L12 12L4 7.5L12 3Z"
            initial={prefersReducedMotion ? false : { pathLength: 0, opacity: 0.35 }}
            animate={prefersReducedMotion ? { pathLength: 1, opacity: 0.85 } : { pathLength: 1, opacity: 0.9 }}
            transition={{ duration: prefersReducedMotion ? 0.2 : 1.1, ease: 'easeOut' }}
          />

          <motion.path
            d="M4 7.5V16.5L12 21V12L4 7.5Z"
            initial={prefersReducedMotion ? false : { pathLength: 0, opacity: 0.25 }}
            animate={prefersReducedMotion ? { pathLength: 1, opacity: 0.7 } : { pathLength: 1, opacity: 0.82 }}
            transition={{ duration: prefersReducedMotion ? 0.2 : 1.1, ease: 'easeOut', delay: prefersReducedMotion ? 0 : 0.15 }}
          />

          <motion.path
            d="M20 7.5V16.5L12 21V12L20 7.5Z"
            initial={prefersReducedMotion ? false : { pathLength: 0, opacity: 0.25 }}
            animate={prefersReducedMotion ? { pathLength: 1, opacity: 0.7 } : { pathLength: 1, opacity: 0.82 }}
            transition={{ duration: prefersReducedMotion ? 0.2 : 1.1, ease: 'easeOut', delay: prefersReducedMotion ? 0 : 0.3 }}
          />

          <motion.path
            d="M12 12V16.5"
            strokeDasharray="2 2"
            initial={prefersReducedMotion ? false : { pathLength: 0, opacity: 0.2 }}
            animate={prefersReducedMotion ? { pathLength: 1, opacity: 0.45 } : { pathLength: 1, opacity: [0.18, 0.45, 0.18] }}
            transition={prefersReducedMotion
              ? { duration: 0.2, ease: 'linear' }
              : { duration: 1.4, ease: 'easeInOut', delay: 0.8, repeat: Infinity, repeatType: 'mirror' }}
          />
        </svg>
      </motion.div>
    </div>
  );
}

export default memo(ProductIcon);
