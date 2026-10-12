// Modelos de tiendas y horarios

export type StoreCategory = 'battery' | 'tire' | 'spare' | 'shop';

export interface TimeSlot {
  open: string;
  close: string;
}

export interface StoreSchedule {
  monday?: TimeSlot | null;
  tuesday?: TimeSlot | null;
  wednesday?: TimeSlot | null;
  thursday?: TimeSlot | null;
  friday?: TimeSlot | null;
  saturday?: TimeSlot | null;
  sunday?: TimeSlot | null;
}

export interface StoreDeliveryInfo {
  fee: number;
  avgPrepTime: number;
}

export interface StoreStats {
  totalOrders: number;
}

export interface Store {
  id: string;
  slug: string;
  name: string;
  description: string;
  lat: number;
  lng: number;
  categories: StoreCategory[];
  rating: number;
  totalReviews: number;
  city: string;
  logo?: string | null;
  banner?: string | null;
  schedule: StoreSchedule;
  deliveryInfo: StoreDeliveryInfo;
  stats?: StoreStats;
}

export interface NearbyStoresParams {
  lat: number;
  lng: number;
  radius?: number;
}
