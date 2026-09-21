/**
 * Shared header interaction styles.
 *
 * The hover box - a transparent 1px border that turns white on hover - is the
 * header's one interaction signature, and it was previously written out as a
 * string literal in SiteHeader and again in AccountArea, while CartButton
 * carried a third copy that had lost its transition. The result was a cart
 * control that snapped on hover while everything beside it faded.
 *
 * One definition, so every control in the bar behaves the same way.
 */
export const HEADER_HOVER_BOX =
  "rounded-[2px] border border-transparent px-2 py-1 transition-colors duration-150 hover:border-white focus-visible:border-white focus-visible:outline-none";
