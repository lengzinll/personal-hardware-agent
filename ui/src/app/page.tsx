'use client';

import React from 'react';
import { Bot, Cpu } from 'lucide-react';
import { VoiceAgent } from '@/components/VoiceAgent';
import { LedControl } from '@/components/LedControl';
import { useLedState } from '@/lib/LedWebSocketProvider';

export default function Home() {
  const { ledStates } = useLedState();

  const isRed = ledStates.red === 'ON';
  const isYellow = ledStates.yellow === 'ON';
  const isGreen = ledStates.green === 'ON';

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Top Header Navbar */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight">AURA Hardware Agent</h1>
                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-primary/10 text-primary border border-primary/20">
                  gpiod
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Voice & Chat AI Agent for Traffic Light GPIO Controller</p>
            </div>
          </div>

          {/* Backend & Live Traffic LED Status Bar */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted/80 border border-border text-xs">
              <Cpu className="w-3.5 h-3.5 text-primary" />
              <span className="text-muted-foreground font-mono">Backend:</span>
              <span className="font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                FastAPI (Python)
              </span>
            </div>

            {/* 3-LED Pill Indicators */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-muted/80 border border-border">
              <span
                title="Red LED (GPIO 27)"
                className={`w-3 h-3 rounded-full transition-all ${
                  isRed ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)] animate-pulse' : 'bg-rose-950/70 border border-rose-900/50'
                }`}
              />
              <span
                title="Yellow LED (GPIO 22)"
                className={`w-3 h-3 rounded-full transition-all ${
                  isYellow ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)] animate-pulse' : 'bg-amber-950/70 border border-amber-900/50'
                }`}
              />
              <span
                title="Green LED (GPIO 23)"
                className={`w-3 h-3 rounded-full transition-all ${
                  isGreen ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)] animate-pulse' : 'bg-emerald-950/70 border border-emerald-900/50'
                }`}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* LED Traffic Light Hardware Control Card */}
        <LedControl  />

        {/* AI Voice & Chat Agent */}
        <VoiceAgent  />
      </main>
    </div>
  );
}
