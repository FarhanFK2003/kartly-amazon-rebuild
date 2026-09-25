import type { Metadata } from "next";
import { fontVariables } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Kartly | Online Shopping for Electronics, Home, Fashion & More",
    template: "%s | Kartly",
  },
  description:
    "Kartly is a demo marketplace storefront: browse 120 products across 10 departments, search, filter, and check out as a guest.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
