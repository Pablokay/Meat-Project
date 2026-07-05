import { useQuery } from '@tanstack/react-query';
import { supabase, type Order, type OrderItem, type Livestock, type DeliveryLocation, type DeliverySlot, type BankAccount, type Customer } from '../lib/supabase';

export function useAdminSlots() {
  return useQuery({
    queryKey: ['admin', 'slots'],
    queryFn: async (): Promise<DeliverySlot[]> => {
      const { data } = await supabase.from('delivery_slots').select('*').order('slot_date');
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

export function useAdminBanks() {
  return useQuery({
    queryKey: ['admin', 'banks'],
    queryFn: async (): Promise<BankAccount[]> => {
      const { data } = await supabase.from('bank_accounts').select('*').order('created_at');
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

export function useAdminBlastLog() {
  return useQuery({
    queryKey: ['admin', 'blast_log'],
    queryFn: async (): Promise<any[]> => {
      const { data } = await supabase.from('blast_log').select('*').order('created_at', { ascending: false });
      return data ?? [];
    },
    staleTime: 30_000,
  });
}

export function useAdminProfiles() {
  return useQuery({
    queryKey: ['admin', 'profiles'],
    queryFn: async (): Promise<any[]> => {
      const { data } = await supabase.from('profiles').select('id, full_name, email, phone, is_admin').order('created_at', { ascending: false });
      return data ?? [];
    },
    staleTime: 30_000,
  });
}

export function useAdminSettings() {
  return useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: async (): Promise<Record<string, string>> => {
      const { data } = await supabase.from('admin_settings').select('key, value');
      const map: Record<string, string> = {};
      for (const row of data ?? []) map[row.key] = row.value;
      return map;
    },
    staleTime: 60_000,
  });
}

export function useAdminOrderItems() {
  return useQuery({
    queryKey: ['admin', 'order_items'],
    queryFn: async (): Promise<OrderItem[]> => {
      const { data } = await supabase.from('order_items').select('*');
      return data ?? [];
    },
    staleTime: 30_000,
  });
}

export function useAdminCustomers() {
  return useQuery({
    queryKey: ['admin', 'customers'],
    queryFn: async (): Promise<Customer[]> => {
      const { data } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
      return data ?? [];
    },
    staleTime: 30_000,
  });
}

export function useAdminCarts() {
  return useQuery({
    queryKey: ['admin', 'carts'],
    queryFn: async (): Promise<any[]> => {
      const { data } = await supabase.from('carts').select('*').order('updated_at', { ascending: false });
      return data ?? [];
    },
    staleTime: 20_000,
  });
}

export function useAdminOrders() {
  return useQuery({
    queryKey: ['admin', 'orders'],
    queryFn: async (): Promise<Order[]> => {
      const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      return data ?? [];
    },
    staleTime: 10_000,
  });
}

export function useAdminLivestock() {
  return useQuery({
    queryKey: ['admin', 'livestock'],
    queryFn: async (): Promise<Livestock[]> => {
      const { data } = await supabase.from('livestock').select('*').order('created_at');
      return data ?? [];
    },
    staleTime: 30_000,
  });
}

export function useAdminLocations() {
  return useQuery({
    queryKey: ['admin', 'locations'],
    queryFn: async (): Promise<DeliveryLocation[]> => {
      const { data } = await supabase.from('delivery_locations').select('*').order('fee');
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

export function useAdminSetting(key: string, fallback: string) {
  return useQuery({
    queryKey: ['admin', 'setting', key],
    queryFn: async (): Promise<string> => {
      const { data } = await supabase.from('admin_settings').select('value').eq('key', key).maybeSingle();
      return data?.value ?? fallback;
    },
    staleTime: 60_000,
  });
}

// Lightweight counts for the admin sidebar badges (shared, cached, auto-refreshing).
export function useAdminCounts() {
  return useQuery({
    queryKey: ['admin', 'counts'],
    refetchInterval: 20_000,
    staleTime: 10_000,
    queryFn: async () => {
      const [ordersRes, cartsRes, livestockRes, settingRes] = await Promise.all([
        supabase.from('orders').select('payment_status'),
        supabase.from('carts').select('items, status'),
        supabase.from('livestock').select('available_kg, available_portions, is_available'),
        supabase.from('admin_settings').select('value').eq('key', 'low_stock_threshold').maybeSingle(),
      ]);
      const orders = ordersRes.data ?? [];
      const carts = (cartsRes.data ?? []) as any[];
      const livestock = (livestockRes.data ?? []) as any[];
      const threshold = Number(settingRes.data?.value ?? 10) || 10;
      return {
        pendingPayments: orders.filter((o) => o.payment_status === 'pending').length,
        abandonedCarts: carts.filter((c) => (c.items?.length ?? 0) > 0 && c.status !== 'checked_out').length,
        lowStock: livestock.filter((l) => l.is_available && (l.available_kg <= threshold || l.available_portions <= threshold)).length,
      };
    },
  });
}
