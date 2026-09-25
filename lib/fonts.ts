import localFont from "next/font/local";

/*
  The application's two typefaces, defined once.

  Both woff2 files are committed to public/fonts and loaded with
  next/font/local, so neither a build nor a page view reaches a third-party
  host. That is the same rule the catalogue imagery follows: download the
  asset, commit it, depend on nothing external.

  They live here rather than in app/layout.tsx because there are two roots that
  render their own <html>: the shop layout, and the global not-found boundary,
  which renders outside every layout. When each defined its own fonts, the
  not-found route declared a second, conflicting --font-inter through
  next/font/google - which quietly reintroduced a build-time network dependency
  and made a clean build fail wherever Google Fonts was unreachable.

  Next deduplicates these module-scope calls, so importing this file from both
  roots emits one copy of each face.

  Licences: SIL Open Font License 1.1, recorded in public/fonts/LICENSE-OFL.txt.
  Both are latin-subset variable fonts, 115KB for the pair.
*/

/** UI and body text. */
export const inter = localFont({
  src: "../public/fonts/Inter-latin-var.woff2",
  variable: "--font-inter",
  display: "swap",
  weight: "100 900",
  style: "normal",
});

/**
 * Display face. A serif against a neutral UI sans is the cheapest and strongest
 * identity signal Kartly has, and the clearest break from the sans-only stack
 * of the replica it replaces.
 */
export const fraunces = localFont({
  src: "../public/fonts/Fraunces-latin-var.woff2",
  variable: "--font-fraunces",
  display: "swap",
  weight: "100 900",
  style: "normal",
});

/**
 * Both font variables, for the className of an <html> element.
 *
 * Every root that renders its own <html> must apply this, or the tokens in
 * globals.css resolve to their fallbacks on that route.
 */
export const fontVariables = `${inter.variable} ${fraunces.variable}`;
