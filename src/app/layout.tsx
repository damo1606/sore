import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SORE — Institutional Options Flow",
  description: "GEX analysis dashboard for institutional support and resistance levels",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(localStorage.getItem('sore-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}})()`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
