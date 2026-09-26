import { COMMERCE } from "./commerce";
import { formatPrice, formatPriceShort } from "./utils";

export interface HelpLink {
  label: string;
  href: string;
}

export interface HelpArticle {
  id: string;
  topic: HelpTopicId;
  question: string;
  answer: string;
  links?: HelpLink[];
}

export type HelpTopicId = "orders" | "delivery" | "returns" | "payments" | "account" | "demo";

export interface HelpTopic {
  id: HelpTopicId;
  title: string;
  blurb: string;
}

export const HELP_TOPICS: HelpTopic[] = [
  { id: "orders", title: "Your Orders", blurb: "Track, review and re-order" },
  { id: "delivery", title: "Delivery", blurb: "Estimates, costs and free shipping" },
  { id: "returns", title: "Returns & Refunds", blurb: "How returns work here" },
  { id: "payments", title: "Payments & Pricing", blurb: "Simulated payment, tax and totals" },
  { id: "account", title: "Your Account", blurb: "Signing in and stored data" },
  { id: "demo", title: "About this demo", blurb: "What is and isn't real" },
];

/*
  Help content.

  Every answer describes how this application actually behaves - where state
  lives, what the checkout does, which features are absent. That makes the help
  centre genuinely useful rather than decorative, and it keeps the promise that
  nothing here is invented: there is no support team to invent.
*/
export const HELP_ARTICLES: HelpArticle[] = [
  /* ---------- orders ---------- */
  {
    id: "where-orders",
    topic: "orders",
    question: "Where are my orders?",
    answer:
      "Orders you place appear in Your Orders, newest first, with status, total, item count and a delivery estimate. Opening one shows the full receipt including the delivery address and payment summary.",
    links: [{ label: "Go to Your Orders", href: "/orders" }],
  },
  {
    id: "orders-missing",
    topic: "orders",
    question: "My order has disappeared",
    answer:
      "Orders are stored in this browser only. They will not appear on another device, in a private window, or after you clear site data. An order confirmation link opened elsewhere will say it cannot find the order, which is expected rather than an error.",
    links: [{ label: "Your Orders", href: "/orders" }],
  },
  {
    id: "buy-again",
    topic: "orders",
    question: "Can I buy something again?",
    answer:
      "Yes. Each order card has a Buy it again link that takes you back to the product page, and every line in an expanded order links to its product.",
    links: [{ label: "Your Orders", href: "/orders" }],
  },
  {
    id: "cancel-order",
    topic: "orders",
    question: "How do I cancel an order?",
    answer:
      "There is nothing to cancel. Orders here are simulated records, nothing is charged and nothing ships, so an order can simply be ignored. Clearing site data removes them entirely.",
  },

  /* ---------- delivery ---------- */
  {
    id: "delivery-estimate",
    topic: "delivery",
    question: "How are delivery dates calculated?",
    answer:
      "Each product carries a delivery window, and the date shown is calculated from today, so it is always a real upcoming date. When an order contains several items, checkout shows the latest of their dates, because the order is treated as a single shipment.",
  },
  {
    id: "free-shipping",
    topic: "delivery",
    question: "When is delivery free?",
    answer:
      `Orders of ${formatPriceShort(COMMERCE.freeShippingThreshold)} or more qualify for free shipping. Below that a flat ${formatPrice(COMMERCE.standardShippingCents)} applies. The cart shows a progress meter with the exact amount still needed to qualify.`,
    links: [{ label: "Go to your cart", href: "/cart" }],
  },
  {
    id: "delivery-address",
    topic: "delivery",
    question: "Can I change the delivery address?",
    answer:
      "Yes, during checkout. The delivery step can be reopened with the Change link at any point before you place the order, and your entries are preserved if you move between steps or refresh.",
    links: [{ label: "Go to checkout", href: "/checkout" }],
  },
  {
    id: "delivery-where",
    topic: "delivery",
    question: "Where does Kartly deliver?",
    answer:
      "Nowhere. No order is fulfilled and nothing is dispatched. The address form accepts US-format addresses purely so the checkout behaves realistically.",
  },

  /* ---------- returns ---------- */
  {
    id: "returns-window",
    topic: "returns",
    question: "What is the returns policy?",
    answer:
      "Product pages show a 30-day refund window, which is illustrative copy. Because no purchase is real and no payment is taken, there is nothing to return and no refund to issue.",
  },
  {
    id: "returns-start",
    topic: "returns",
    question: "How do I start a return?",
    answer:
      "Returns are not implemented in this demo. If you want to undo a purchase, clearing the cart or ignoring the simulated order has the same effect.",
    links: [{ label: "Go to your cart", href: "/cart" }],
  },
  {
    id: "item-wrong",
    topic: "returns",
    question: "An item looks wrong on the page",
    answer:
      "Product photography comes from openly licensed sources, and for some items the picture is only loosely related to the product it illustrates. This is a known limitation of the demo catalogue, not a listing error.",
  },

  /* ---------- payments ---------- */
  {
    id: "payment-simulated",
    topic: "payments",
    question: "Is my card charged?",
    answer:
      "No. Checkout is simulated end to end. There is no payment provider, no charge, and card details are never transmitted or stored. The card number is checked for length and a valid checksum purely so the form behaves like a real one, then discarded; only the last four digits are kept on the order so it can display 'ending in 4242'.",
    links: [{ label: "Go to checkout", href: "/checkout" }],
  },
  {
    id: "test-card",
    topic: "payments",
    question: "What card details should I use?",
    answer:
      "Use 4242 4242 4242 4242 with any future expiry and any three-digit code. Pay on delivery is also offered, which skips the card form entirely.",
    links: [{ label: "Go to checkout", href: "/checkout" }],
  },
  {
    id: "totals",
    topic: "payments",
    question: "How is my total calculated?",
    answer:
      "The order total is the sum of your items, plus shipping if the order is under the free-shipping threshold, plus estimated tax at 8.25%. Every figure is derived from what is actually in your cart.",
    links: [{ label: "Go to your cart", href: "/cart" }],
  },
  {
    id: "promo-codes",
    topic: "payments",
    question: "Can I use a promo code or gift card?",
    answer:
      "No. Promotional codes, gift cards and store credit are deliberately out of scope. Discounts shown on products are part of the catalogue data and are already reflected in the price.",
    links: [{ label: "See discounted products", href: "/s?deals=1" }],
  },

  /* ---------- account ---------- */
  {
    id: "need-account",
    topic: "account",
    question: "Do I need an account to shop?",
    answer:
      "No. Browsing, searching, the cart, checkout and order confirmation all work signed out. Signing in changes the greeting in the header, not what you can do.",
    links: [{ label: "Continue shopping", href: "/s" }],
  },
  {
    id: "signin-real",
    topic: "account",
    question: "Is sign-in real?",
    answer:
      "Yes. Creating an account stores your email address in Kartly's database, and your password is hashed with bcrypt before it is saved - the plaintext is never stored and is never sent back to the browser. Signing in gives you a secure session cookie that your browser holds and page scripts cannot read. There is no password reset or email verification in this demo.",
    links: [{ label: "Go to sign in", href: "/signin" }],
  },
  {
    id: "my-data",
    topic: "account",
    question: "What data is stored about me?",
    answer:
      "If you create an account, your email and a hashed password are stored in Kartly's database, along with any orders you place and the delivery details on them. Your cart is stored server-side too, so it follows you between tabs and survives a refresh. Your checkout progress and recently viewed products stay in your browser. There is no analytics and no tracking.",
  },
  {
    id: "sign-out",
    topic: "account",
    question: "How do I sign out?",
    answer:
      "Open the Account & Lists menu in the header and choose Sign out, or use Sign out in the departments menu. Your cart stays where it is - it belongs to the browser, not the account, so signing out does not empty it. Any orders you placed while signed in belong to your account: they are not deleted, and you will see them again the next time you sign in.",
  },

  /* ---------- demo ---------- */
  {
    id: "what-is-kartly",
    topic: "demo",
    question: "What is Kartly?",
    answer:
      "Kartly is an original demo storefront built for a product rebuild exercise. It reproduces the structure and interaction quality of a large marketplace under its own branding. It is not a real shop, nothing is for sale, and it is not affiliated with or endorsed by Amazon.com, Inc.",
  },
  {
    id: "real-products",
    topic: "demo",
    question: "Are these real products and brands?",
    answer:
      "No. All 120 products and every brand name are fictional, generated from a seed file. Ratings, review counts and reviews are generated too, which is why the numbers are internally consistent but not real feedback.",
    links: [{ label: "Browse the catalogue", href: "/s" }],
  },
  {
    id: "missing-features",
    topic: "demo",
    question: "Why can't I find gift cards, a registry, or selling?",
    answer:
      "Those are not part of this demo. The build deliberately covers a polished core shopping journey - search, product detail, cart, checkout, orders - rather than a shallow version of everything a marketplace offers.",
    links: [{ label: "Browse the catalogue", href: "/s" }],
  },
  {
    id: "terms-privacy",
    topic: "demo",
    question: "Conditions of use and privacy",
    answer:
      "Kartly is a demo storefront, so there is no commercial service to agree terms for. Accounts are real, though: if you create one, your email, a hashed password, and any orders and delivery details you enter are stored in Kartly's database. No payment is ever taken, and no card number, expiry or security code is collected or stored - only the last four digits, to render the receipt.",
  },
  {
    id: "contact",
    topic: "demo",
    question: "How do I contact support?",
    answer:
      "There is no support team, and a contact form that went nowhere would be worse than saying so. If something looks broken, it is a bug in the demo rather than a problem with an order.",
  },
];

/** Case-insensitive match across question, answer and topic title. */
export function searchHelp(query: string): HelpArticle[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const words = q.split(/\s+/).filter(Boolean);
  return HELP_ARTICLES.map((article) => {
    const topic = HELP_TOPICS.find((t) => t.id === article.topic)?.title ?? "";
    const haystack = `${article.question} ${article.answer} ${topic}`.toLowerCase();
    // Every word must appear somewhere, then rank by question matches first.
    const matchesAll = words.every((w) => haystack.includes(w));
    const inQuestion = words.filter((w) => article.question.toLowerCase().includes(w)).length;
    return { article, matchesAll, score: inQuestion };
  })
    .filter((r) => r.matchesAll)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.article);
}

export const articlesByTopic = (topic: HelpTopicId) =>
  HELP_ARTICLES.filter((a) => a.topic === topic);
