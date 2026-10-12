import type { Metadata, Viewport } from 'next';
import { Chakra_Petch, Inter } from 'next/font/google';
import './globals.css';

/**
 * Tipografías del sistema de diseño:
 * - Inter: cuerpo e inputs (neutral, legible)
 * - Chakra Petch: display técnico cyberpunk (wordmark, labels, CTA)
 */
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const chakraPetch = Chakra_Petch({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-chakra',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Repu - Repuestos y Delivery',
  description: 'Plataforma de delivery de repuestos y servicios automotrices.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={`${inter.variable} ${chakraPetch.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
