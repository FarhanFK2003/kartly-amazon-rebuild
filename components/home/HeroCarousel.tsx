"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface HeroSlide {
  id: string;
  eyebrow: string;
  headline: string;
  sub: string;
  cta: string;
  href: string;
  image: string | null;
  /** Slide background; kept muted so the marketplace content below still reads. */
  background: string;
}

const ROTATE_MS = 6000;

/**
 * Hero carousel: autoplay, arrows, dots, keyboard, and pause on hover or focus.
 *
 * Deliberately short (about a third of the viewport) so the departments and
 * product rows below it are visible without scrolling. A hero that fills the
 * fold makes a marketplace look like a landing page.
 *
 * No carousel library: a translated flex track plus an interval is the whole
 * mechanism, and it costs nothing to ship.
 */
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const regionRef = useRef<HTMLElement>(null);

  const go = useCallback(
    (next: number) => setIndex(((next % slides.length) + slides.length) % slides.length),
    [slides.length]
  );

  useEffect(() => {
    if (paused || slides.length <= 1) return;
    // Autoplay is an accessibility hazard for people who need more time, so it
    // is off entirely when the system asks for reduced motion.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setInterval(() => setIndex((i) => (i + 1) % slides.length), ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [paused, slides.length]);

  if (slides.length === 0) return null;

  return (
    <section
      ref={regionRef}
      aria-roledescription="carousel"
      aria-label="Featured promotions"
      className="relative overflow-hidden rounded-[8px] bg-white"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(index + 1);
        if (e.key === "ArrowLeft") go(index - 1);
      }}
    >
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {slides.map((slide, i) => (
          <div
            key={slide.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${slides.length}`}
            aria-hidden={i !== index}
            className="w-full shrink-0"
            style={{ background: slide.background }}
          >
            <div className="mx-auto flex h-[220px] max-w-[1100px] items-center gap-4 px-10 sm:h-[260px] sm:px-14 lg:h-[300px]">
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-bold uppercase tracking-wider text-ink/60">
                  {slide.eyebrow}
                </p>
                <h2 className="mt-1 text-[24px] font-bold leading-tight text-ink sm:text-[32px] lg:text-[38px]">
                  {slide.headline}
                </h2>
                <p className="mt-1 max-w-[380px] text-[13px] text-ink/70 sm:text-[15px]">{slide.sub}</p>
                <Link
                  href={slide.href}
                  tabIndex={i === index ? 0 : -1}
                  className="mt-4 inline-flex h-9 items-center rounded-full border border-cta-border bg-cta px-5 text-[14px] font-medium text-ink shadow-[0_2px_5px_rgba(0,0,0,.12)] hover:bg-cta-hover"
                >
                  {slide.cta}
                </Link>
              </div>

              <div className="relative hidden h-[170px] w-[230px] shrink-0 sm:block lg:h-[220px] lg:w-[300px]">
                {slide.image && (
                  <Image
                    src={slide.image}
                    alt=""
                    fill
                    sizes="300px"
                    priority={i === 0}
                    className="object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,.18)]"
                  />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* controls */}
      <button
        type="button"
        onClick={() => go(index - 1)}
        aria-label="Previous slide"
        className="absolute left-1 top-1/2 flex h-12 w-8 -translate-y-1/2 items-center justify-center rounded-[4px] text-ink/60 hover:bg-black/5 hover:text-ink sm:w-10"
      >
        <ChevronLeft className="h-7 w-7" />
      </button>
      <button
        type="button"
        onClick={() => go(index + 1)}
        aria-label="Next slide"
        className="absolute right-1 top-1/2 flex h-12 w-8 -translate-y-1/2 items-center justify-center rounded-[4px] text-ink/60 hover:bg-black/5 hover:text-ink sm:w-10"
      >
        <ChevronRight className="h-7 w-7" />
      </button>

      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2">
        {slides.map((slide, i) => (
          <button
            key={slide.id}
            type="button"
            onClick={() => go(i)}
            aria-label={`Go to slide ${i + 1}`}
            aria-current={i === index}
            className={cn(
              "h-[7px] rounded-full transition-all",
              i === index ? "w-6 bg-ink/70" : "w-[7px] bg-ink/25 hover:bg-ink/40"
            )}
          />
        ))}
      </div>

      {/* Announces slide changes without stealing focus. */}
      <span className="sr-only" aria-live="polite">
        Slide {index + 1} of {slides.length}: {slides[index].headline}
      </span>
    </section>
  );
}
