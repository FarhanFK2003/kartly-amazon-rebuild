"use client";

/**
 * Full-width bar that caps the page and returns to the top. Kept as a real
 * button rather than an anchor so it can animate the scroll and respect a
 * reduced-motion preference.
 */
export function BackToTop() {
  return (
    <button
      type="button"
      onClick={() => {
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
      }}
      className="w-full bg-[#37475a] py-[15px] text-center text-[13px] text-white hover:bg-[#485769]"
    >
      Back to top
    </button>
  );
}
