'use client';

import { useState } from 'react';
import { LogOut, ShoppingCart, User, Bike } from 'lucide-react';
import { useRouter } from 'next/navigation';
import useAuthStore from '@/store/authStore';
import { useActiveOrdersCount } from '@/store/orderStore';
import { useCartSummary, useCartHasHydrated } from '@/store/cartStore';
import CartDrawer from '@/components/stores/CartDrawer';
import ActiveOrdersDrawer from '@/components/tracking/ActiveOrdersDrawer';

export default function AppHeader() {
  const router = useRouter();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isOrdersDrawerOpen, setIsOrdersDrawerOpen] = useState(false);

  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const { itemCount } = useCartSummary();
  const hasHydrated = useCartHasHydrated();
  const activeOrdersCount = useActiveOrdersCount();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const handleCheckout = () => {
    setIsCartOpen(false);
    router.push('/checkout');
  };

  return (
    <>
      <header className="bg-gray-900/80 backdrop-blur-sm border-b border-gray-700/50 px-4 py-2 flex items-center justify-between z-30 relative">
        <div className="flex items-center gap-2 ml-3">
          <h1 className="relative text-xs sm:text-2xl font-bold tracking-wider inline-block">
            <span className="relative z-10 text-white opacity-60">
              Repu
            </span>
            <span 
              className="absolute inset-0 -z-10 bg-gradient-to-r from-cyan-400 to-sky-400 bg-clip-text text-transparent blur-lg opacity-80 select-none" 
              aria-hidden="true"
            >
              Repu
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Botón de Pedidos Activos en Curso (Abre ActiveOrdersDrawer) */}
          {activeOrdersCount > 0 && (
            <button
              type="button"
              onClick={() => setIsOrdersDrawerOpen(true)}
              className="
                relative flex items-center gap-1.5 px-2.5 py-1.5
                bg-cyan-500/10 hover:bg-cyan-500/20
                border border-cyan-500/40 hover:border-cyan-400
                rounded-lg text-cyan-300
                transition-all duration-200
                text-xs font-semibold cursor-pointer shadow-[0_0_12px_rgba(34,211,238,0.2)]
              "
              title={
                activeOrdersCount === 1
                  ? 'Ver 1 pedido en curso'
                  : `Ver ${activeOrdersCount} pedidos en curso`
              }
            >
              <Bike size={15} className="animate-pulse text-cyan-400" />
              <span className="hidden sm:inline">
                {activeOrdersCount === 1 ? '1 Pedido en curso' : `${activeOrdersCount} Pedidos en curso`}
              </span>
              <span className="sm:hidden font-mono font-bold text-[11px] text-cyan-300">
                {activeOrdersCount}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            </button>
          )}

          {/* Botón Carrito con badge dinámico (solo icono y cantidad) */}
          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="
              relative flex items-center justify-center p-2
              bg-gray-800/50 hover:bg-cyan-500/15
              border border-gray-700 hover:border-cyan-500/50
              rounded-lg text-gray-300 hover:text-cyan-400
              transition-all duration-200
              group cursor-pointer
            "
            title={itemCount > 0 ? `Ver carrito (${itemCount} artículos)` : 'Ver carrito'}
            aria-label={itemCount > 0 ? `Ver carrito con ${itemCount} artículos` : 'Abrir carrito de compras'}
          >
            <ShoppingCart size={18} className="group-hover:scale-105 transition-transform" />
            {hasHydrated && itemCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-gradient-to-r from-cyan-400 to-emerald-400 text-black font-extrabold text-[10px] rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(34,211,238,0.5)]">
                {itemCount > 99 ? '99+' : itemCount}
              </span>
            )}
          </button>

          <div className="hidden sm:flex items-center gap-2 text-sm">
            <User size={16} className="text-cyan-400" />
            <span className="text-gray-300">{user?.name || 'Usuario'}</span>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="
              flex items-center gap-2 px-3 py-1.5
              bg-gray-800/50 hover:bg-fuchsia-500/20
              border border-gray-700 hover:border-fuchsia-500/50
              rounded-lg text-gray-300 hover:text-fuchsia-400
              transition-all duration-200
              text-sm cursor-pointer
            "
            title="Cerrar sesión"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </header>

      {/* CartDrawer montado globalmente para el Header */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onCheckout={handleCheckout}
      />

      {/* ActiveOrdersDrawer montado globalmente para el Header */}
      <ActiveOrdersDrawer
        isOpen={isOrdersDrawerOpen}
        onClose={() => setIsOrdersDrawerOpen(false)}
      />
    </>
  );
}
