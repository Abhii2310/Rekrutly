import 'server-only';
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { env } from "@/lib/env";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const description = "A glass-box AI hiring agent for small startup hiring teams. It plans, asks before it acts, and keeps a receipt for every step.";

export const metadata: Metadata = {
  metadataBase: new URL(env.APP_URL),
  title: { default: "Rekrutly", template: "%s | Rekrutly" },
  description,
  openGraph: { title: "Rekrutly: the glass-box hiring agent", description, siteName: "Rekrutly", type: "website" },
  twitter: { card: "summary", title: "Rekrutly: the glass-box hiring agent", description },
  // A private team tool and personal candidate links: nothing here belongs in a search engine.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
