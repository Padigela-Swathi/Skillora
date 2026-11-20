import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { HydrationMarker } from "@/components/HydrationMarker";
import "./globals.css";

const inter = localFont({ src: "./fonts/Inter-Variable.ttf", variable: "--font-inter", weight: "100 900", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Skillora — Practise interviews. Walk in calm.", template: "%s · Skillora" },
  description: "AI mock interviews for CSE and IT students: HR, Technical, Coding and Managerial rounds with a score and feedback for every answer.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#FFFCF3" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-dvh font-sans"><HydrationMarker />{children}</body>
    </html>
  );
}
