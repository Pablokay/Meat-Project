import { useState, useEffect } from 'react';
import { supabase, type Livestock } from '../lib/supabase';
import { useApp } from '../providers/AppProvider';

export function useFavorites() {
  const { session } = useApp();
  const userId = session?.user?.id ?? null;
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) { setFavorites(new Set()); return; }
    supabase.from('favorites').select('livestock_id').eq('user_id', userId).then(({ data }) => setFavorites(new Set((data ?? []).map((f) => f.livestock_id))));
  }, [userId]);

  async function toggleFavorite(l: Livestock) {
    if (!userId) return;
    const isFav = favorites.has(l.id);
    setFavorites((prev) => { const n = new Set(prev); isFav ? n.delete(l.id) : n.add(l.id); return n; });
    if (isFav) await supabase.from('favorites').delete().eq('user_id', userId).eq('livestock_id', l.id);
    else await supabase.from('favorites').insert({ user_id: userId, livestock_id: l.id });
  }

  return { favorites, toggleFavorite, canFavorite: !!userId };
}
