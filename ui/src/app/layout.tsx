import type { Metadata } from "next";
import { Orbitron, Share_Tech_Mono, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { LedWebSocketProvider } from "@/lib/LedWebSocketProvider";
import { Toaster } from "sonner";

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
});

const shareTechMono = Share_Tech_Mono({
  weight: "400",
  variable: "--font-share-tech-mono",
  subsets: ["latin"],
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Johnwick - Neural Hardware HUD",
  description: "Futuristic Sci-Fi Holographic Hardware Interface",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`dark ${orbitron.variable} ${shareTechMono.variable} ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#020710] text-[#00f0ff] font-mono selection:bg-[#00f0ff]/30 selection:text-[#ffffff]">
        <QueryProvider>
          <LedWebSocketProvider>
            {children}
          </LedWebSocketProvider>
        </QueryProvider>
        <Toaster position="top-right" theme="dark" richColors closeButton />
      </body>
    </html>
  );
}
