/**
 * Página de tienda individual (RSC Server Component)
 */

import StoreView from '@/components/stores/StoreView';

export const dynamic = 'force-dynamic';

export interface StorePageProps {
  params: Promise<{ slug: string }>;
}

export default async function StorePage({ params }: StorePageProps) {
  const { slug } = await params;
  return <StoreView slug={slug} />;
}
