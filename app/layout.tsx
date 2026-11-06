import Sidebar from "@/components/Sidebar";
import { Suspense } from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RecallFlow",
  description: "Révisions intelligentes et adaptées à ta maîtrise.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
  <div className="flex min-h-screen flex-col bg-transparent text-white lg:flex-row">
    <Suspense fallback={<div className="h-16 border-b border-white/10 bg-slate-950/60 lg:h-screen lg:w-64 lg:border-b-0 lg:border-r" />}><Sidebar /></Suspense>

    <main className="min-w-0 flex-1 p-4 sm:p-8 lg:p-10">
      {children}
    </main>
  </div>
</body>
    </html>
  );
}
