import type { Metadata, Viewport } from "next";
import { Fraunces, Outfit } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin", "latin-ext"],
  axes: ["SOFT", "opsz"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Voice Baby Album",
  description: "Your baby's first year, told in your own voice.",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Baby Album" },
  icons: { apple: "/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#faf6f0",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${outfit.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col relative">{children}</body>
    </html>
  );
}
