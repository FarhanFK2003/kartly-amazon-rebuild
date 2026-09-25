"use client";

import { useEffect, useRef } from "react";

/**
 * Tells the app bar when the page has scrolled.
 *
 * A zero-height marker 200px down the page, watched with an IntersectionObserver.
 * When it leaves the viewport the root element gets data-scrolled, and the app
 * bar's CSS does the rest. No scroll listener runs on every frame, and no React
 * state changes, so scrolling costs nothing.
 */
export function StickySentinel({ offset = 200 }: { offset?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        document.documentElement.toggleAttribute("data-scrolled", !entry.isIntersecting);
      },
      { threshold: 0 }
    );
    io.observe(el);

    return () => {
      io.disconnect();
      document.documentElement.removeAttribute("data-scrolled");
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute left-0 h-px w-px"
      style={{ top: offset }}
    />
  );
}
