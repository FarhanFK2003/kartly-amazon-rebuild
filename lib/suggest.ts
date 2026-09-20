import { getAllProducts, getCategories } from "./catalog";
import type { Product } from "./types";

export interface QuerySuggestion {
  type: "query";
  text: string;
  /** Scope label rendered after the term, e.g. "in Computers". */
  scope?: string;
  scopeId?: string;
}

export interface ProductSuggestion {
  type: "product";
  text: string;
  slug: string;
  image: string | null;
  price: number;
}

export interface CategorySuggestion {
  type: "category";
  text: string;
  id: string;
}

export type Suggestion = QuerySuggestion | ProductSuggestion | CategorySuggestion;

/*
  Suggestion terms are derived once from the catalogue: the search phrases
  behind each product, its brand, and each department name. That gives short,
  typeable suggestions ("wireless earbuds") rather than echoing 200-character
  product titles back at the shopper.
*/
const TERMS: { term: string; categoryId: string; weight: number }[] = (() => {
  const seen = new Map<string, { term: string; categoryId: string; weight: number }>();

  for (const p of getAllProducts()) {
    for (const [term, weight] of [
      [p.imageQuery, 3],
      [p.brand.toLowerCase(), 1],
    ] as const) {
      const key = term.toLowerCase();
      const existing = seen.get(key);
      if (existing) existing.weight += weight;
      else seen.set(key, { term: key, categoryId: p.categoryId, weight });
    }
  }

  for (const c of getCategories()) {
    seen.set(c.name.toLowerCase(), { term: c.name.toLowerCase(), categoryId: c.id, weight: 4 });
  }

  return [...seen.values()].sort((a, b) => b.weight - a.weight);
})();

const MAX_QUERY = 6;
const MAX_PRODUCTS = 4;
const MAX_CATEGORIES = 2;

/**
 * Prefix and substring matching, prefix ranked first. Deliberately simpler than
 * the fuzzy matching behind the results page: a suggestion list that guesses is
 * more annoying than one that stays literal while you type.
 */
export function suggest(rawQuery: string): Suggestion[] {
  const q = rawQuery.trim().toLowerCase();
  if (q.length < 1) return [];

  const out: Suggestion[] = [];

  const termMatches = TERMS.filter((t) => t.term.includes(q)).sort((a, b) => {
    const aStarts = a.term.startsWith(q) ? 0 : 1;
    const bStarts = b.term.startsWith(q) ? 0 : 1;
    if (aStarts !== bStarts) return aStarts - bStarts;
    if (a.weight !== b.weight) return b.weight - a.weight;
    return a.term.length - b.term.length;
  });

  const categories = getCategories();
  for (const t of termMatches.slice(0, MAX_QUERY)) {
    const category = categories.find((c) => c.id === t.categoryId);
    out.push({
      type: "query",
      text: t.term,
      scope: category?.name,
      scopeId: category?.id,
    });
  }

  for (const c of categories.filter((c) => c.name.toLowerCase().includes(q)).slice(0, MAX_CATEGORIES)) {
    out.push({ type: "category", text: c.name, id: c.id });
  }

  /*
    Relevance has to beat popularity here.

    Ranking product suggestions by review count alone means typing "laptop"
    surfaces a USB cable whose title happens to end "...Laptop and Phone
    Compatible", because that accessory has more reviews than any actual laptop.
    A word buried in a compatibility clause is a far weaker signal than the
    product's own category term, so score the match and use popularity only to
    break ties.
  */
  const scoreProduct = (p: Product) => {
    const title = p.title.toLowerCase();
    const brand = p.brand.toLowerCase();
    let score = 0;

    if (p.imageQuery === q) score = 100;
    else if (p.imageQuery.startsWith(q)) score = 80;
    else if (p.imageQuery.includes(q)) score = 60;
    else if (title.startsWith(q)) score = 50;
    else if (brand.includes(q)) score = 40;
    else if (title.includes(` ${q}`)) score = 15;
    else if (title.includes(q)) score = 10;

    // Popularity nudges within a band; it can never promote a weak match above
    // a strong one.
    return score + Math.min(5, p.reviewCount / 2000);
  };

  const products = getAllProducts()
    .filter((p) => p.title.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.imageQuery.includes(q))
    .map((p) => ({ p, score: scoreProduct(p) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_PRODUCTS)
    .map((x) => x.p);

  for (const p of products) {
    out.push({ type: "product", text: p.title, slug: p.slug, image: p.image, price: p.price });
  }

  return out;
}
