import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Amazon Ember is licensed and cannot ship here. Inter is the closest free
// substitute for its proportions at small sizes.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

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
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
