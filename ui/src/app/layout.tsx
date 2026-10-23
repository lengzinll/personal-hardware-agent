import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { LedWebSocketProvider } from "@/lib/LedWebSocketProvider";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Johnwick - Hardware Agent",
  description: "Personal Hardware Control & AI Assistant",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#191919] text-[#e3e2de] font-sans selection:bg-neutral-700 selection:text-white">
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
