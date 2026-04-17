import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DealFlow — Search Business Deals",
  description: "Explore 100k+ active deals aggregated from 200+ sources",
};

import Providers from "@/components/providers";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen overflow-hidden">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
