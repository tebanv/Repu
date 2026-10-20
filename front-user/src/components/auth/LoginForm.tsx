'use client';

/**
 * LoginForm — Formulario "Ignición" del login de Repu.
 *
 * Diseño: campos de línea con label flotante (sin cajas), CTA estilo switch de
 * ignición y coreografía acoplada al fondo magnético vía `useAuthField()`:
 * focus→mood, cada tecla→pulso de onda, error→turbulencia, éxito→onda de
 * alineación antes de navegar. Si el motor del campo no está disponible
 * (reduced-motion o fallback estático) todo degrada a un login normal.
 */

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type FocusEvent, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Eye, EyeOff, TriangleAlert } from 'lucide-react';
import useAuthStore, { useAuthHasHydrated } from '@/store/authStore';
import { useAuthField } from './AuthFieldContext';

type Phase = 'idle' | 'loading' | 'success';

/** Accesos rápidos de desarrollo (usuarios seed en Supabase Auth, rol 'comprador').
 * Deben crearse en el proyecto Supabase (signUp o panel Auth); no son mocks. */
const DEMO_USERS = [
  { label: 'Admin', email: 'admin@mallvirtual.com', password: 'admin123' },
  { label: 'Usuario', email: 'usuario@demo.com', password: 'user123' },
  { label: 'Demo', email: 'demo@demo.com', password: 'demo123' },
] as const;

export default function LoginForm() {
  const router = useRouter();
  const field = useAuthField();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  /** Foco activo por campo: controla el flotado del label y el mood del fondo */
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const navTimer = useRef<number | null>(null);

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authHasHydrated = useAuthHasHydrated();
  const initializeAuth = useAuthStore((state) => state.initialize);
  const login = useAuthStore((state) => state.login);
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);

  useEffect(() => {
    // Revalida sesión vigente al entrar a /login: evita redirect con
    // `auth-storage` rancio si el token Supabase ya expiró.
    void initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    if (authHasHydrated && isAuthenticated && phase !== 'success') {
      router.replace('/');
    }
  }, [authHasHydrated, isAuthenticated, router, phase]);

  // Limpieza del timer de navegación diferida (guardrail de ciclo de vida)
  useEffect(() => {
    return () => {
      if (navTimer.current !== null) window.clearTimeout(navTimer.current);
    };
  }, []);

  /** Pulso de onda en el campo magnético desde la posición del input */
  const emitPulse = (el: HTMLInputElement) => {
    if (!field) return;
    const rect = el.getBoundingClientRect();
    field.pulse(rect.left + rect.width / 2, rect.top);
  };

  const handleFocus = (name: 'email' | 'password') => {
    setFocusedField(name);
    field?.setMood(name === 'email' ? 'email' : 'password');
  };

  const handleBlur = (
    e: FocusEvent<HTMLInputElement>,
    setter: (v: string) => void
  ) => {
    setFocusedField(null);
    setter(e.target.value.trim());
    // El motor ignita turbulencia/onda por sí solo; aquí solo volvemos a calma
    if (phase === 'idle') field?.setMood('idle');
  };

  const handleChange =
    (setter: (v: string) => void) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      setter(e.target.value);
      clearError();
      emitPulse(e.currentTarget);
    };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (phase !== 'idle') return;
    clearError();

    setPhase('loading');
    field?.setMood('loading');

    const success = await login({ email, password });

    if (success) {
      // Onda de alineación visible antes de navegar: micro-momento de recompensa
      setPhase('success');
      field?.setMood('success');
      navTimer.current = window.setTimeout(() => router.push('/'), 900);
    } else {
      setPhase('idle');
      field?.setMood('error');
    }
  };

  const fillDemo = (user: (typeof DEMO_USERS)[number]) => {
    setEmail(user.email);
    setPassword(user.password);
    clearError();
    field?.flipPolarity();
  };

  const busy = phase !== 'idle';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full"
    >
      {/* ---- Marca: monograma que se dibuja + wordmark técnico ---- */}
      <div className="flex flex-col items-center mb-8">
        <motion.svg
          width="52"
          height="52"
          viewBox="0 0 48 48"
          fill="none"
          aria-hidden="true"
          className="mb-3"
        >
          <defs>
            <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#e879f9" />
            </linearGradient>
          </defs>
          {/* Pin de mapa: destino de delivery */}
          <motion.path
            d="M24 5C15.7 5 9 11.7 9 20c0 10.5 15 23 15 23s15-12.5 15-23c0-8.3-6.7-15-15-15Z"
            stroke="url(#logoGrad)"
            strokeWidth="2"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1, ease: 'easeInOut' }}
          />
          {/* Rayo: energía / encendido */}
          <motion.path
            d="M26.5 12 18 25.5h5.5L21.5 36 30 22.5h-5.5L26.5 12Z"
            stroke="url(#logoGrad)"
            strokeWidth="2"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.75, ease: 'easeOut' }}
          />
        </motion.svg>

        <motion.h1
          initial={{ opacity: 0, letterSpacing: '0.6em' }}
          animate={{ opacity: 1, letterSpacing: '0.32em' }}
          transition={{ duration: 0.9, delay: 0.3, ease: 'easeOut' }}
          className="font-display text-3xl font-bold bg-gradient-to-r from-cyan-300 via-purple-300 to-fuchsia-300 bg-clip-text text-transparent pl-[0.32em]"
        >
          REPU
        </motion.h1>
        <p className="mt-2 text-xs text-gray-400 tracking-wide">
          Ingresa a tu cuenta para continuar
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6" noValidate={false}>
        {/* ---- Error de credenciales: shake + mensaje accesible ---- */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              key={error}
              role="alert"
              initial={{ opacity: 0, y: -6 }}
              animate={{
                opacity: 1,
                y: 0,
                x: [0, -7, 7, -4, 4, 0],
                transition: { duration: 0.45, x: { duration: 0.45 } },
              }}
              exit={{ opacity: 0 }}
              className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5 flex items-center gap-2 text-red-300 text-sm"
            >
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ---- Campo de correo: solo línea inferior, label flotante ---- */}
        <LineField
          id="email"
          label="Correo electrónico"
          type="email"
          value={email}
          placeholder="tu@email.com"
          autoComplete="email"
          focused={focusedField === 'email'}
          accent="cyan"
          disabled={busy}
          onFocus={() => handleFocus('email')}
          onBlur={(e) => handleBlur(e, setEmail)}
          onChange={handleChange(setEmail)}
        />

        {/* ---- Campo de contraseña ---- */}
        <LineField
          id="password"
          label="Contraseña"
          type={showPassword ? 'text' : 'password'}
          value={password}
          placeholder="••••••••"
          autoComplete="current-password"
          focused={focusedField === 'password'}
          accent="magenta"
          disabled={busy}
          paddingRight
          onFocus={() => handleFocus('password')}
          onBlur={(e) => handleBlur(e, setPassword)}
          onChange={handleChange(setPassword)}
          onKeyDown={(e) => setCapsLock(e.getModifierState('CapsLock'))}
          rightSlot={
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={
                showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
              }
              className="min-h-0 text-gray-500 transition-colors hover:text-gray-300"
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          }
        />
        <div className="flex items-center mt-1.5 min-h-[16px]">
          {/* Indicador Caps Lock: detalle de cuidado con el usuario */}
          <AnimatePresence>
            {capsLock && (
              <motion.span
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1.5 text-[11px] text-amber-300/90"
              >
                <TriangleAlert size={12} />
                Bloq Mayús activado
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* ---- CTA: switch de ignición ---- */}
        <button
          type="submit"
          disabled={isLoading || busy}
          className="group relative w-full overflow-hidden rounded-lg border border-cyan-400/40 bg-cyan-400/[0.07] py-3 mt-2 min-h-0 font-display text-sm font-semibold uppercase tracking-[0.28em] text-cyan-100 transition-all duration-300 hover:border-cyan-300/80 hover:bg-cyan-400/[0.14] hover:shadow-[0_0_28px_rgba(34,211,238,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 disabled:cursor-wait disabled:opacity-70 active:scale-[0.99]"
        >
          {/* Halo interno que sigue al cursor no aplica aquí; brillo fijo sutil */}
          <span className="relative z-10">
            {phase === 'loading'
              ? 'Verificando…'
              : phase === 'success'
                ? 'Acceso concedido'
                : 'Iniciar sesión'}
          </span>
          {phase === 'loading' && (
            <span
              aria-hidden="true"
              className="absolute bottom-0 left-0 h-[2px] w-1/3 animate-ignition bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-cyan-400"
            />
          )}
          {phase === 'success' && (
            <motion.span
              aria-hidden="true"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              className="absolute bottom-0 left-0 h-[2px] w-full origin-left bg-gradient-to-r from-cyan-400 to-fuchsia-400"
            />
          )}
        </button>
      </form>

      {/* ---- Accesos rápidos de demo ---- */}
      <div className="mt-7">
        <p className="text-center text-[10px] font-display uppercase tracking-[0.3em] text-gray-600 mb-2.5">
          Acceso demo
        </p>
        <div className="flex items-center justify-center gap-2">
          {DEMO_USERS.map((user) => (
            <button
              key={user.label}
              type="button"
              onClick={() => fillDemo(user)}
              disabled={busy}
              className="min-h-0 rounded-full border border-white/10 px-3.5 py-1.5 text-[11px] text-gray-400 transition-colors hover:border-cyan-400/40 hover:text-cyan-200 disabled:opacity-40"
            >
              {user.label}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ================================================================
   Campo de línea: input transparente + label flotante + barrido de energía
   ================================================================ */

interface LineFieldProps {
  id: string;
  label: string;
  type: string;
  value: string;
  placeholder: string;
  autoComplete?: string;
  focused: boolean;
  accent: 'cyan' | 'magenta';
  disabled?: boolean;
  paddingRight?: boolean;
  /** Slot derecho absoluto (ej. toggle de visibilidad de contraseña) */
  rightSlot?: React.ReactNode;
  onFocus: () => void;
  onBlur: (e: FocusEvent<HTMLInputElement>) => void;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
}

function LineField({
  id,
  label,
  type,
  value,
  placeholder,
  autoComplete,
  focused,
  accent,
  disabled,
  paddingRight,
  rightSlot,
  onFocus,
  onBlur,
  onChange,
  onKeyDown,
}: LineFieldProps) {
  // El flotado en la ventana pre-hidratación (autofill antes de que React
  // conozca el valor) lo resuelve CSS unlayered en globals.css; aquí basta
  // la lógica React normal: foco o contenido.
  const floated = focused || value.length > 0;

  return (
    <div className="relative">
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        placeholder=" "
        autoComplete={autoComplete}
        disabled={disabled}
        onFocus={onFocus}
        onBlur={onBlur}
        onChange={onChange}
        onKeyDown={onKeyDown}
        aria-label={label}
        className={`peer w-full bg-transparent border-b ${
          paddingRight ? 'pr-10' : ''
        } pt-5 pb-2 text-sm text-white outline-none transition-colors border-white/15 focus:border-white/10 disabled:opacity-60`}
      />

      {/* Label flotante: centro cuando vacío y sin foco; arriba en otro caso */}
      <label
        htmlFor={id}
        className={`pointer-events-none absolute left-0 font-display transition-all duration-200 ${
          floated
            ? `top-0 text-[10px] uppercase tracking-[0.22em] ${
                focused
                  ? accent === 'cyan'
                    ? 'text-cyan-300'
                    : 'text-fuchsia-300'
                  : 'text-gray-500'
              }`
            : 'top-1/2 -translate-y-1/2 text-sm tracking-normal text-gray-500'
        }`}
      >
        {label}
      </label>

      {/* Barrido de energía al enfocar: la línea se enciende de izquierda a derecha */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute bottom-0 left-0 h-[2px] w-full origin-left transition-transform duration-300 ease-out ${
          focused ? 'scale-x-100' : 'scale-x-0'
        } ${
          accent === 'cyan'
            ? 'bg-gradient-to-r from-cyan-400 to-cyan-300/60'
            : 'bg-gradient-to-r from-fuchsia-400 to-purple-400/60'
        }`}
      />

      {/* Slot derecho (toggle de visibilidad), centrado sobre la línea del input */}
      {rightSlot && (
        <div className="absolute right-0 top-[26px] -translate-y-1/2 flex items-center">
          {rightSlot}
        </div>
      )}
    </div>
  );
}
