import Link from "next/link";
import { Globe } from "lucide-react";
import { Wordmark } from "@/components/brand/Wordmark";
import { BackToTop } from "@/components/chrome/BackToTop";

const COLUMNS = [
  {
    title: "Get to Know Us",
    links: ["About Kartly", "Careers", "Press Releases", "Kartly Science", "Sustainability"],
  },
  {
    title: "Make Money with Us",
    links: ["Sell on Kartly", "Sell in Kartly Business", "Become an Affiliate", "Advertise Your Products", "Self-Publish with Us"],
  },
  {
    title: "Kartly Payment Products",
    links: ["Kartly Business Card", "Shop with Points", "Reload Your Balance", "Kartly Currency Converter", "Gift Cards"],
  },
  {
    title: "Let Us Help You",
    links: ["Your Account", "Your Orders", "Shipping Rates & Policies", "Returns & Replacements", "Help Centre"],
  },
];

const LEGAL = ["Conditions of Use", "Privacy Notice", "Consumer Health Data Policy", "Your Ads Privacy Choices"];

export function SiteFooter() {
  return (
    <footer className="mt-8">
      <BackToTop />

      <div className="bg-footer text-white">
        <div className="shell grid grid-cols-2 gap-8 py-10 sm:grid-cols-4 lg:px-16">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h2 className="mb-2 text-[16px] font-bold">{col.title}</h2>
              <ul className="space-y-[6px]">
                {col.links.map((label) => (
                  <li key={label}>
                    <Link href="/help" className="text-[13px] text-[#ddd] hover:underline">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/20">
          <div className="shell flex flex-col items-center gap-4 py-7 sm:flex-row sm:justify-center">
            <Link href="/" className="text-white" aria-label="Kartly home">
              <Wordmark height={26} />
            </Link>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Chip>
                <Globe className="h-4 w-4" /> English
              </Chip>
              <Chip>$ USD - U.S. Dollar</Chip>
              <Chip>United States</Chip>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-footer-deep py-7 text-center text-[#ddd]">
        <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 px-4 text-[12px]">
          {LEGAL.map((label) => (
            <li key={label}>
              <Link href="/help" className="hover:underline">
                {label}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-3 px-4 text-[12px] text-[#999]">© 2026 Kartly. A demo storefront.</p>
        <p className="mx-auto mt-1 max-w-[560px] px-4 text-[11px] leading-4 text-[#777]">
          Kartly is an original demo project built for a product rebuild exercise. It is not a real
          shop, nothing here is for sale, and it is not affiliated with or endorsed by Amazon.com,
          Inc. Product names and brands are fictional.
        </p>
      </div>
    </footer>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-[33px] items-center gap-2 rounded-[3px] border border-[#848688] px-3 text-[13px] text-white">
      {children}
    </span>
  );
}
