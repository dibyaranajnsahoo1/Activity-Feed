// ─── useInfiniteScroll ────────────────────────────────────────────────────────
// Fires loadMore() when a sentinel element enters the viewport.
// Uses IntersectionObserver — zero dependency, no scroll listener.
import { useEffect, useRef } from 'react';

export function useInfiniteScroll(loadMore, hasMore, loading) {
  const sentinelRef = useRef(null);

  useEffect(() => {
    if (!hasMore || loading) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { threshold: 0.1, rootMargin: '200px' }
    );

    const el = sentinelRef.current;
    if (el) observer.observe(el);

    return () => {
      if (el) observer.unobserve(el);
    };
  }, [hasMore, loading, loadMore]);

  return sentinelRef;
}
