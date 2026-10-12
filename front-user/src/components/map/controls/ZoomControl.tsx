'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import type mapboxgl from 'mapbox-gl';

const ENERGY_LEVELS = 8;

export interface ZoomControlProps {
  map: React.RefObject<mapboxgl.Map | null>;
  minZoom?: number;
  maxZoom?: number;
}

export default function ZoomControl({ map, minZoom = 1, maxZoom = 20 }: ZoomControlProps) {
  const [currentZoom, setCurrentZoom] = useState(12);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const barRef = useRef<HTMLDivElement | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);

  const isActive = isHovered || isDragging;

  // Cleanup de seguridad al desmontar el componente
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      if (dragCleanupRef.current) {
        dragCleanupRef.current();
        dragCleanupRef.current = null;
      }
    };
  }, []);

  const handleInteractionStart = () => {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    setIsHovered(true);
  };

  const handleInteractionEnd = () => {
    if (!isDragging) {
      hideTimeoutRef.current = setTimeout(() => {
        setIsHovered(false);
      }, 1500);
    }
  };

  useEffect(() => {
    if (!isDragging && isHovered) {
      handleInteractionEnd();
    }
  }, [isDragging]);

  const updateZoomFromMap = useCallback(() => {
    if (map?.current) {
      const zoom = map.current.getZoom();
      setCurrentZoom(Math.round(zoom * 10) / 10);
    }
  }, [map]);

  useEffect(() => {
    const mapInstance = map?.current;
    if (!mapInstance) return;

    updateZoomFromMap();

    mapInstance.on('zoom', updateZoomFromMap);
    return () => {
      mapInstance.off('zoom', updateZoomFromMap);
    };
  }, [map, updateZoomFromMap]);

  const setMapZoom = useCallback(
    (newZoom: number) => {
      const clampedZoom = Math.min(maxZoom, Math.max(minZoom, newZoom));
      if (map?.current) {
        map.current.zoomTo(clampedZoom, { duration: 300 });
        setCurrentZoom(Math.round(clampedZoom * 10) / 10);
      }
    },
    [map, minZoom, maxZoom]
  );

  const zoomPercentage = (currentZoom - minZoom) / (maxZoom - minZoom);
  const activeLevel = Math.round(zoomPercentage * ENERGY_LEVELS);

  const zoomIn = () => setMapZoom(currentZoom + 1);
  const zoomOut = () => setMapZoom(currentZoom - 1);

  const handleSegmentClick = (segmentIndex: number) => {
    const targetPercentage = (ENERGY_LEVELS - segmentIndex) / ENERGY_LEVELS;
    const targetZoom = minZoom + targetPercentage * (maxZoom - minZoom);
    setMapZoom(targetZoom);
  };

  const handleBarInteraction = (clientY: number) => {
    if (!barRef.current) return;

    const rect = barRef.current.getBoundingClientRect();
    const relativeY = clientY - rect.top;
    const percentage = 1 - Math.max(0, Math.min(1, relativeY / rect.height));
    const targetZoom = minZoom + percentage * (maxZoom - minZoom);

    if (map?.current) {
      map.current.setZoom(targetZoom);
      setCurrentZoom(Math.round(targetZoom * 10) / 10);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleBarInteraction(e.clientY);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      handleBarInteraction(moveEvent.clientY);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      dragCleanupRef.current = null;
    };

    dragCleanupRef.current = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    handleInteractionStart();
    handleBarInteraction(e.touches[0].clientY);

    const handleTouchMove = (moveEvent: TouchEvent) => {
      handleBarInteraction(moveEvent.touches[0].clientY);
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      dragCleanupRef.current = null;
    };

    dragCleanupRef.current = () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };

    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);
  };

  return (
    <div
      className='absolute top-6 right-4 z-20 flex flex-col items-center select-none'
      onMouseEnter={handleInteractionStart}
      onMouseLeave={handleInteractionEnd}
      onTouchStart={handleInteractionStart}
    >
      <div className='flex flex-col items-center bg-black/80 backdrop-blur-sm border border-fuchsia-500/30 rounded-2xl p-1.5 shadow-[0_0_20px_rgba(217,70,239,0.15)]'>
        <motion.button
          onClick={zoomIn}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className='w-8 h-8 flex items-center justify-center text-fuchsia-400 hover:text-fuchsia-300 hover:bg-fuchsia-500/20 rounded-xl transition-all duration-200'
          aria-label='Acercar mapa'
        >
          <span className='text-lg font-mono font-bold leading-none'>+</span>
        </motion.button>

        <div
          ref={barRef}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          className='relative my-1.5 w-8 py-1 flex flex-col items-center justify-between gap-[3px] cursor-ns-resize touch-none'
          style={{ height: '120px' }}
        >
          <div className='absolute inset-x-2 inset-y-0 bg-zinc-900/60 rounded-full border border-fuchsia-500/20' />

          {Array.from({ length: ENERGY_LEVELS }).map((_, index) => {
            const segmentLevel = ENERGY_LEVELS - index;
            const isSegmentActive = segmentLevel <= activeLevel;
            const isHighEnergy = segmentLevel > ENERGY_LEVELS * 0.7;

            return (
              <motion.div
                key={index}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSegmentClick(index);
                }}
                className='relative z-10 w-4 rounded-full transition-all duration-150'
                style={{
                  height: '8px',
                  backgroundColor: isSegmentActive
                    ? isHighEnergy
                      ? '#ec4899'
                      : '#d946ef'
                    : 'rgba(255, 255, 255, 0.08)',
                  boxShadow:
                    isSegmentActive && isActive
                      ? isHighEnergy
                        ? '0 0 8px rgba(236, 72, 153, 0.8), 0 0 12px rgba(236, 72, 153, 0.4)'
                        : '0 0 8px rgba(217, 70, 239, 0.8), 0 0 12px rgba(217, 70, 239, 0.4)'
                      : 'none',
                  opacity: isSegmentActive ? 1 : 0.3,
                }}
                whileHover={{ scaleX: 1.3 }}
                transition={{ duration: 0.1 }}
              />
            );
          })}
        </div>

        <motion.button
          onClick={zoomOut}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className='w-8 h-8 flex items-center justify-center text-fuchsia-400 hover:text-fuchsia-300 hover:bg-fuchsia-500/20 rounded-xl transition-all duration-200'
          aria-label='Alejar mapa'
        >
          <span className='text-lg font-mono font-bold leading-none'>-</span>
        </motion.button>
      </div>

      <motion.div
        animate={{
          opacity: isActive ? 1 : 0,
          y: isActive ? 0 : -4,
          scale: isActive ? 1 : 0.95,
        }}
        transition={{ duration: 0.2 }}
        className='mt-1.5 flex items-center gap-1 bg-black/90 border border-fuchsia-500/40 rounded-md px-1.5 py-0.5 pointer-events-none'
      >
        <Zap
          size={10}
          className={
            isActive
              ? 'text-fuchsia-400 fill-fuchsia-500/30 animate-pulse'
              : 'text-fuchsia-400/40'
          }
        />
        <span className='text-[10px] font-mono font-bold text-fuchsia-300/90 leading-none'>
          {currentZoom.toFixed(1)}
        </span>
      </motion.div>
    </div>
  );
}
