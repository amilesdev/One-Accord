import type { Metadata } from "next";
import { Geist, Caveat } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const greatVibes = localFont({
  src: "../great-vibes/GreatVibes-Regular.ttf",
  variable: "--font-great-vibes",
  display: "swap",
});

export const metadata: Metadata = {
  title: "One Accord",
  description: "Grow together in Christ.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${caveat.variable} ${greatVibes.variable} h-full`}>
      <body className="h-full antialiased">{children}</body>
    </html>
  );
}
