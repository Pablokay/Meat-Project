import { useQuery } from '@tanstack/react-query';
import { supabase, type Livestock, type DeliverySlot, type Review } from '../lib/supabase';

export function useLivestock() {
  return useQuery({
    queryKey: ['livestock'],
    queryFn: async (): Promise<Livestock[]> => {
      const { data } = await supabase.from('livestock').select('*').eq('is_available', true).order('created_at');
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: ['livestock', id],
    enabled: !!id,
    queryFn: async (): Promise<Livestock | null> => {
      const { data } = await supabase.from('livestock').select('*').eq('id', id).maybeSingle();
      return data ?? null;
    },
  });
}

export function useReviews() {
  return useQuery({
    queryKey: ['reviews'],
    queryFn: async (): Promise<Review[]> => {
      const { data } = await supabase.from('reviews').select('*').order('created_at', { ascending: false });
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

export type HeroSlide = { img: string; word: string };
export const DEFAULT_HERO: HeroSlide[] = [
  { img: 'https://images.pexels.com/photos/735968/pexels-photo-735968.jpeg', word: 'Difference' },
  { img: 'https://images.pexels.com/photos/2647968/pexels-photo-2647968.jpeg', word: 'Freshness' },
  { img: 'https://images.pexels.com/photos/1300375/pexels-photo-1300375.jpeg', word: 'Quality' },
  { img: 'https://images.pexels.com/photos/3323685/pexels-photo-3323685.jpeg', word: 'Flavour' },
];

export function useHeroSlides() {
  return useQuery({
    queryKey: ['hero_slides'],
    queryFn: async (): Promise<HeroSlide[]> => {
      const { data } = await supabase.from('admin_settings').select('value').eq('key', 'hero_slides').maybeSingle();
      if (data?.value) {
        try {
          const arr = JSON.parse(data.value);
          if (Array.isArray(arr) && arr.length && arr.every((x) => x?.img)) return arr as HeroSlide[];
        } catch { /* fall through */ }
      }
      return DEFAULT_HERO;
    },
    staleTime: 60_000,
  });
}

export function useDeliverySlots() {
  return useQuery({
    queryKey: ['delivery_slots'],
    queryFn: async (): Promise<DeliverySlot[]> => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase.from('delivery_slots').select('*').gte('slot_date', today).order('slot_date');
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

// Aggregate helpers shared across pages.
export function ratingFor(reviews: Review[], livestockId: string) {
  const rs = reviews.filter((r) => r.livestock_id === livestockId);
  if (!rs.length) return { avg: 0, count: 0 };
  return { avg: rs.reduce((s, r) => s + r.rating, 0) / rs.length, count: rs.length };
}

export function badgeFor(l: Livestock, count: number, avg: number): 'New' | 'Popular' | 'Low stock' | null {
  if (count >= 2 && avg >= 4) return 'Popular';
  const isNew = Date.now() - new Date(l.created_at).getTime() < 21 * 24 * 60 * 60 * 1000;
  if (isNew) return 'New';
  if ((l.available_kg ?? 0) <= 5 && (l.available_portions ?? 0) <= 5) return 'Low stock';
  return null;
}
