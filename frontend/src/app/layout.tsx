import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SORE — Institutional Options Flow",
  description: "GEX analysis and institutional support/resistance levels",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bg text-white min-h-screen">{children}</body>
    </html>
  );
}
