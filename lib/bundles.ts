import { getAllProducts } from "./catalog";
import type { Product } from "./types";

/*
  Frequently bought together.

  No recommendation model, no behavioural data - this is a hand-written map of
  which product *type* complements which, keyed on the catalogue's own search
  terms. A laptop pairs with a mouse, a stand and a hub; a tent pairs with a
  sleeping bag and a head torch. Deterministic, inspectable, and it never
  suggests a second laptop.
*/
const COMPLEMENTS: Record<string, string[]> = {
  // computers
  "laptop computer": ["computer mouse", "laptop stand", "usb hub"],
  "gaming laptop": ["mechanical keyboard", "computer mouse", "external hard drive"],
  "desktop computer": ["computer monitor", "mechanical keyboard", "computer mouse"],
  "computer monitor": ["laptop stand", "desk lamp", "cable management"],
  "mechanical keyboard": ["computer mouse", "cable management", "desk lamp"],
  "computer mouse": ["mechanical keyboard", "laptop stand", "usb hub"],
  "usb hub": ["usb cable", "external hard drive", "laptop stand"],
  "external hard drive": ["usb cable", "usb hub", "cable management"],
  "webcam": ["desk lamp", "usb hub", "headphones"],
  "laptop stand": ["computer mouse", "mechanical keyboard", "usb hub"],
  "computer memory": ["desktop computer", "cable management", "usb hub"],
  "cable management": ["usb cable", "desk lamp", "desk organizer"],
  "desk lamp": ["desk organizer", "cable management", "notebook journal"],

  // electronics
  headphones: ["wireless charger", "usb cable", "phone charger"],
  "wireless earbuds": ["wireless charger", "phone charger", "fitness tracker"],
  "action camera": ["external hard drive", "backpack", "duffel bag"],
  "bluetooth speaker": ["portable speaker", "usb cable", "led lights"],
  "portable speaker": ["usb cable", "wireless charger", "cooler bag"],
  "wireless charger": ["usb cable", "phone charger", "wireless earbuds"],
  "security camera": ["led lights", "usb cable", "phone charger"],
  "fitness tracker": ["wireless earbuds", "yoga mat", "water bottle"],
  "usb cable": ["phone charger", "wireless charger", "usb hub"],
  "phone charger": ["usb cable", "wireless charger", "cable management"],
  "led lights": ["cable management", "usb cable", "bluetooth speaker"],

  // home and kitchen
  "chef knife": ["cutting board", "cookware set", "frying pan"],
  "cutting board": ["chef knife", "cookware set", "frying pan"],
  "cookware set": ["chef knife", "cutting board", "frying pan"],
  "frying pan": ["chef knife", "cutting board", "cookware set"],
  "espresso machine": ["electric kettle", "water bottle", "cutting board"],
  "electric kettle": ["espresso machine", "water bottle", "bath towels"],
  "air fryer": ["cookware set", "cutting board", "chef knife"],
  "robot vacuum": ["air purifier", "lint roller", "bath towels"],
  "air purifier": ["robot vacuum", "bedding linen", "bath towels"],
  "bath towels": ["bedding linen", "silk pillowcase", "water bottle"],
  "bedding linen": ["bath towels", "silk pillowcase", "air purifier"],
  "water bottle": ["cooler bag", "fitness tracker", "yoga mat"],

  // sports and outdoors
  "hiking backpack": ["trekking poles", "sleeping bag", "headlamp torch"],
  "camping tent": ["sleeping bag", "headlamp torch", "cooler bag"],
  "sleeping bag": ["camping tent", "headlamp torch", "hiking backpack"],
  "trekking poles": ["hiking backpack", "headlamp torch", "water bottle"],
  "headlamp torch": ["camping tent", "hiking backpack", "sleeping bag"],
  "cooler bag": ["water bottle", "camping tent", "picnic"],
  dumbbells: ["resistance bands", "foam roller", "yoga mat"],
  "yoga mat": ["foam roller", "resistance bands", "jump rope"],
  "resistance bands": ["yoga mat", "foam roller", "jump rope"],
  "foam roller": ["yoga mat", "resistance bands", "dumbbells"],
  "jump rope": ["resistance bands", "yoga mat", "fitness tracker"],
  "swimming goggles": ["bath towels", "water bottle", "fitness tracker"],

  // fashion
  "winter jacket": ["thermal clothing", "scarf", "socks"],
  "running shoes": ["socks", "fitness tracker", "thermal clothing"],
  "t-shirt clothing": ["socks", "leather wallet", "sunglasses"],
  "leather boots": ["socks", "thermal clothing", "leather wallet"],
  backpack: ["leather wallet", "sunglasses", "water bottle"],
  sunglasses: ["leather wallet", "backpack", "wrist watch"],
  scarf: ["winter jacket", "thermal clothing", "leather wallet"],
  "wrist watch": ["leather wallet", "sunglasses", "leather boots"],
  "thermal clothing": ["winter jacket", "socks", "scarf"],
  "duffel bag": ["leather wallet", "socks", "bath towels"],
  socks: ["running shoes", "leather boots", "thermal clothing"],
  "leather wallet": ["sunglasses", "wrist watch", "backpack"],

  // beauty
  "skincare serum": ["face cream", "face wash", "sunscreen"],
  "face cream": ["skincare serum", "face wash", "sunscreen"],
  "face wash": ["face cream", "skincare serum", "sunscreen"],
  sunscreen: ["face cream", "skincare serum", "sunglasses"],
  "hair clipper": ["hair dryer", "vanity mirror", "bath towels"],
  "hair dryer": ["vanity mirror", "hair clipper", "silk pillowcase"],
  "makeup brushes": ["vanity mirror", "face cream", "makeup"],
  "vanity mirror": ["makeup brushes", "hair dryer", "face cream"],
  "silk pillowcase": ["bedding linen", "face cream", "hair dryer"],
  "beauty device": ["face cream", "skincare serum", "vanity mirror"],
  "perfume bottle": ["face cream", "silk pillowcase", "leather wallet"],
  "electric toothbrush": ["bath towels", "vanity mirror", "face wash"],

  // toys
  "building blocks toy": ["board game", "jigsaw puzzle", "art supplies"],
  "board game": ["playing cards", "jigsaw puzzle", "building blocks toy"],
  "jigsaw puzzle": ["board game", "playing cards", "art supplies"],
  "drone toy": ["robot toy", "microscope", "night light"],
  "robot toy": ["building blocks toy", "microscope", "drone toy"],
  "wooden toy": ["teddy bear", "building blocks toy", "art supplies"],
  "night light": ["teddy bear", "childrens book", "wooden toy"],
  "kids scooter": ["night light", "teddy bear", "wooden toy"],
  microscope: ["science book", "art supplies", "robot toy"],
  "teddy bear": ["night light", "childrens book", "wooden toy"],
  "playing cards": ["board game", "jigsaw puzzle", "notebook journal"],
  "art supplies": ["notebook journal", "jigsaw puzzle", "building blocks toy"],

  // books
  "book cover": ["notebook journal", "desk lamp", "paperback book"],
  "novel book": ["notebook journal", "desk lamp", "thriller book"],
  cookbook: ["chef knife", "cutting board", "cookware set"],
  "design book": ["notebook journal", "desk lamp", "art supplies"],
  "atlas map book": ["notebook journal", "hiking backpack", "desk lamp"],
  "paperback book": ["notebook journal", "desk lamp", "novel book"],
  "childrens book": ["teddy bear", "night light", "art supplies"],
  "self help book": ["notebook journal", "desk planner", "desk lamp"],
  "gardening book": ["notebook journal", "desk lamp", "cutting board"],
  "thriller book": ["notebook journal", "desk lamp", "novel book"],
  "science book": ["microscope", "notebook journal", "desk lamp"],
  "notebook journal": ["pens stationery", "desk planner", "desk lamp"],

  // office
  "office chair": ["standing desk", "desk lamp", "desk organizer"],
  "standing desk": ["office chair", "desk lamp", "cable management"],
  "pens stationery": ["notebook journal", "desk organizer", "desk planner"],
  "paper shredder": ["file storage box", "letter tray", "desk organizer"],
  "desk organizer": ["pens stationery", "desk lamp", "letter tray"],
  "file storage box": ["letter tray", "paper shredder", "desk organizer"],
  "office partition": ["desk lamp", "office chair", "whiteboard"],
  "laminator office": ["file storage box", "letter tray", "pens stationery"],
  "letter tray": ["file storage box", "desk organizer", "pens stationery"],
  whiteboard: ["pens stationery", "desk organizer", "office partition"],
  "desk planner": ["pens stationery", "notebook journal", "desk organizer"],

  // pets
  "dog bed": ["dog toy", "pet grooming brush", "dog collar"],
  "pet water fountain": ["pet feeder", "pet bowl", "pet grooming brush"],
  "dog harness": ["dog collar", "dog leash", "pet waste bags"],
  "cat tree": ["cat litter mat", "pet feeder", "pet grooming brush"],
  "pet feeder": ["pet water fountain", "pet bowl", "dog bed"],
  "pet grooming brush": ["lint roller", "dog bed", "pet carrier"],
  "dog toy": ["dog bed", "dog collar", "pet waste bags"],
  "pet carrier": ["dog collar", "pet waste bags", "dog bed"],
  "cat litter mat": ["cat tree", "pet feeder", "lint roller"],
  "dog collar": ["dog harness", "dog leash", "pet waste bags"],
  "pet waste bags": ["dog collar", "dog harness", "dog toy"],
  "lint roller": ["pet grooming brush", "dog bed", "bath towels"],
};

/** Used when a product's own term has no map entry, or the map ran short. */
const CATEGORY_FALLBACK: Record<string, string[]> = {
  electronics: ["usb cable", "wireless charger", "phone charger"],
  computers: ["computer mouse", "usb hub", "cable management"],
  "home-kitchen": ["cutting board", "water bottle", "bath towels"],
  fashion: ["socks", "leather wallet", "sunglasses"],
  sports: ["water bottle", "foam roller", "headlamp torch"],
  beauty: ["face wash", "face cream", "bath towels"],
  toys: ["board game", "art supplies", "playing cards"],
  books: ["notebook journal", "desk lamp", "pens stationery"],
  office: ["pens stationery", "desk organizer", "desk lamp"],
  pets: ["pet waste bags", "dog toy", "pet grooming brush"],
};

const MAX_COMPLEMENTS = 3;

/**
 * Anchor product plus its complements. Always returns the anchor first, and an
 * empty list of complements rather than filler if nothing sensible is in stock.
 */
export function getBundle(product: Product): Product[] {
  const catalogue = getAllProducts();
  const wanted = [
    ...(COMPLEMENTS[product.imageQuery] ?? []),
    ...(CATEGORY_FALLBACK[product.categoryId] ?? []),
  ];

  const picked: Product[] = [];
  const seen = new Set([product.id]);

  for (const term of wanted) {
    if (picked.length >= MAX_COMPLEMENTS) break;
    // First match in catalogue order keeps the bundle stable between builds.
    const match = catalogue.find(
      (p) => p.imageQuery === term && !seen.has(p.id) && p.stock > 0
    );
    if (match) {
      picked.push(match);
      seen.add(match.id);
    }
  }

  // Last resort: same department, so the section is never a lone checkbox.
  if (picked.length < 2) {
    for (const p of catalogue) {
      if (picked.length >= 2) break;
      if (p.categoryId === product.categoryId && !seen.has(p.id) && p.stock > 0) {
        picked.push(p);
        seen.add(p.id);
      }
    }
  }

  return picked.length >= 2 ? [product, ...picked] : [];
}
