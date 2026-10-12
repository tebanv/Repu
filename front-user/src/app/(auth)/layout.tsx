import React from 'react';
import MagneticBackground from '@/components/auth/MagneticBackground';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MagneticBackground>{children}</MagneticBackground>;
}
