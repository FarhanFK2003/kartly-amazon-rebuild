import "server-only";
import { cache } from "react";
import { prisma } from "./db";

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
  The suggestion corpus, read from PostgreSQL.

  This used to be a module-scope constant derived once from data/catalog.json.
  It had to move: search results now come from the database, and suggestions
  built from a file would have gone on offering products under titles the
  database no longer holds - the shopper would tap a suggestion and land on a
  search for text that matches nothing. The dropdown and the results page have
  to agree about what exists.

  It is a deliberately narrow projection - no reviews, no specs, no bullets -
  and cached per request.
*/
interface SuggestDoc {
  slug: string;
  title: string;
  brand: string;
  categoryId: string;
  imageQuery: string;
  image: string | null;
  price: number;
  reviewCount: number;
}

/*
  The corpus is cached in process for a short window.

  React's cache() only dedupes within one request, and the header fires a
  request per keystroke - so without this, typing "laptop" read all 120
  projections from Singapore six times over, at roughly 400ms each. That is
  slow enough that a shopper navigates away mid-request, which shows up as
  aborted renders in the server log.

  A few seconds of staleness is the right trade here and nowhere else: these
  are typing hints, and the results page they lead to is always read live. The
  window is deliberately short so an edited title still reaches the dropdown
  without a deploy.
*/
const CORPUS_TTL_MS = 30_000;
interface Corpus {
  docs: SuggestDoc[];
  categories: { id: string; name: string }[];
  at: number;
}
let corpus: Corpus | null = null;

const getCorpus = cache(async (): Promise<Corpus> => {
  if (corpus && Date.now() - corpus.at < CORPUS_TTL_MS) return corpus;

  /*
    Deliberately not getCategories() from the read layer. That one also resolves
    each department's cover image, which means reading every product - real work
    for a page that shows the picture, and pure waste for a dropdown that needs
    nothing but id and name.
  */
  const [rows, categories] = await Promise.all([
    prisma.product.findMany({
      select: {
        slug: true,
        title: true,
        categoryId: true,
        imageQuery: true,
        image: true,
        price: true,
        reviewCount: true,
        brand: { select: { name: true } },
      },
      orderBy: { position: "asc" },
    }),
    prisma.category.findMany({ select: { id: true, name: true }, orderBy: { position: "asc" } }),
  ]);

  const docs = rows.map((r) => ({
    slug: r.slug,
    title: r.title,
    brand: r.brand.name,
    categoryId: r.categoryId,
    imageQuery: r.imageQuery,
    image: r.image,
    price: r.price,
    reviewCount: r.reviewCount,
  }));

  corpus = { docs, categories, at: Date.now() };
  return corpus;
});

/**
 * Short, typeable suggestion terms: the search phrase behind each product, its
 * brand, and each department name - rather than echoing 200-character product
 * titles back at the shopper.
 */
function buildTerms(
  docs: SuggestDoc[],
  categories: { id: string; name: string }[]
): { term: string; categoryId: string; weight: number }[] {
  const seen = new Map<string, { term: string; categoryId: string; weight: number }>();

  for (const p of docs) {
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

  for (const c of categories) {
    seen.set(c.name.toLowerCase(), { term: c.name.toLowerCase(), categoryId: c.id, weight: 4 });
  }

  return [...seen.values()].sort((a, b) => b.weight - a.weight);
}

const MAX_QUERY = 6;
const MAX_PRODUCTS = 4;
const MAX_CATEGORIES = 2;

/**
 * Prefix and substring matching, prefix ranked first. Deliberately simpler than
 * the fuzzy matching behind the results page: a suggestion list that guesses is
 * more annoying than one that stays literal while you type.
 */
export async function suggest(rawQuery: string): Promise<Suggestion[]> {
  const q = rawQuery.trim().toLowerCase();
  if (q.length < 1) return [];

  const out: Suggestion[] = [];

  const { docs, categories } = await getCorpus();
  const terms = buildTerms(docs, categories);

  const termMatches = terms.filter((t) => t.term.includes(q)).sort((a, b) => {
    const aStarts = a.term.startsWith(q) ? 0 : 1;
    const bStarts = b.term.startsWith(q) ? 0 : 1;
    if (aStarts !== bStarts) return aStarts - bStarts;
    if (a.weight !== b.weight) return b.weight - a.weight;
    return a.term.length - b.term.length;
  });

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
  const scoreProduct = (p: SuggestDoc) => {
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

  const products = docs
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
