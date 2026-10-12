'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

interface AdItem {
  id: number;
  image: string;
  alt: string;
}

const ADS: AdItem[] = [
  {
    id: 1,
    image: '/images/duralastbattery.png',
    alt: 'Duralast Battery',
  },
  {
    id: 2,
    image: '/images/macbattery.png',
    alt: 'Mac Battery',
  },
  {
    id: 3,
    image: '/images/willardbattery.png',
    alt: 'Willard Battery',
  },
];

const SLIDE_DURATION = 4000; // 4 segundos por slide

export default function AdCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const slideInterval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % ADS.length);
    }, SLIDE_DURATION);

    return () => {
      clearInterval(slideInterval);
    };
  }, []);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center pb-3 pt-1 px-3 bg-gradient-to-br from-gray-900 via-gray-800 to-black rounded-xl border border-accent/20 shadow-lg relative overflow-hidden">
      {/* Glow effect de fondo */}
      <div className="absolute inset-0 bg-accent/5 blur-3xl" />

      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
          className="relative w-full flex-1 flex items-center justify-center"
        >
          <Image
            src={ADS[currentIndex].image}
            alt={ADS[currentIndex].alt}
            fill
            className="object-contain"
            priority={currentIndex === 0}
          />
        </motion.div>
      </AnimatePresence>

      {/* Barra de progreso lineal */}
      <div className="w-full h-1 lg:h-0.5 bg-gray-700/50 rounded-full overflow-hidden relative z-10 mt-2 lg:mt-1">
        <motion.div
          key={currentIndex}
          className="h-full bg-accent rounded-full"
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: SLIDE_DURATION / 1000, ease: 'linear' }}
          style={{
            boxShadow: '0 0 8px var(--color-accent), 0 0 12px var(--color-accent)',
          }}
        />
      </div>
    </div>
  );
}
