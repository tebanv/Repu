// Telemetría mínima del frontend (Fase A2).
// Hoy es un sink controlado: en desarrollo emite console.debug, en el resto
// es no-op. Al integrar un proveedor (PostHog, Segment, etc.) se implementa
// solo aquí, sin tocar las llamadas existentes en stores.
export type AnalyticsEventName = 'cart_expired';

export function track(
  event: AnalyticsEventName,
  properties?: Record<string, unknown>
): void {
  if (process.env.NODE_ENV === 'development') {
    console.debug(`[analytics] ${event}`, properties ?? {});
  }
}
