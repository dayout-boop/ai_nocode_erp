// ============================================================
// useWishlist — localStorage 기반 찜하기 훅
// ============================================================
import { useState, useCallback } from 'react';

const STORAGE_KEY = 'dogolf_wishlist';

function getWishlist(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveWishlist(ids: number[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

export function useWishlist() {
  const [wishlist, setWishlist] = useState<number[]>(() => getWishlist());

  const toggle = useCallback((id: number) => {
    setWishlist((prev) => {
      const next = prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id];
      saveWishlist(next);
      return next;
    });
  }, []);

  const isWished = useCallback(
    (id: number) => wishlist.includes(id),
    [wishlist]
  );

  return { wishlist, toggle, isWished };
}
