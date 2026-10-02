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
  const isLamp = ledStates.lamp === 'ON';

  return (
    <div className="h-screen max-h-screen overflow-hidden flex flex-col bg-background text-foreground">
      {/* Top Header Navbar (Pinned) */}
      <header className="shrink-0 border-b border-border bg-card/80 backdrop-blur-md z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3 flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-4">
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
              <p className="text-[11px] sm:text-xs text-muted-foreground">AI Chat Agent for Traffic LEDs & Lamp Relay Controller</p>
            </div>
          </div>

          {/* Backend & Live Hardware Status Bar */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-muted/80 border border-border text-xs">
              <Cpu className="w-3.5 h-3.5 text-primary" />
              <span className="text-muted-foreground font-mono hidden sm:inline">Backend:</span>
              <span className="font-semibold flex items-center gap-1.5 text-[11px] sm:text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                FastAPI
              </span>
            </div>

            {/* Hardware Output Status Pill Indicators */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-muted/80 border border-border">
              <span
                title="Red LED (GPIO 17)"
                className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full transition-all ${
                  isRed ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)] animate-pulse' : 'bg-rose-950/70 border border-rose-900/50'
                }`}
              />
              <span
                title="Yellow LED (GPIO 22)"
                className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full transition-all ${
                  isYellow ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)] animate-pulse' : 'bg-amber-950/70 border border-amber-900/50'
                }`}
              />
              <span
                title="Green LED (GPIO 23)"
                className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full transition-all ${
                  isGreen ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)] animate-pulse' : 'bg-emerald-950/70 border border-emerald-900/50'
                }`}
              />
              <div className="w-[1px] h-3 bg-border mx-0.5" />
              <span
                title="Lamp Relay (GPIO 27)"
                className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full transition-all ${
                  isLamp ? 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.9)] animate-pulse' : 'bg-sky-950/70 border border-sky-900/50'
                }`}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Container - Strictly fills viewport with zero outer scroll */}
      <main className="flex-1 min-h-0 overflow-hidden flex flex-col max-w-6xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4 gap-3 sm:gap-4">
        {/* Hardware Control Card (Fixed Height, Pinned) */}
        <div className="shrink-0">
          <LedControl />
        </div>

        {/* AI Chat Agent (Takes 100% of remaining space with internal chat scroll) */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <VoiceAgent />
        </div>
      </main>
    </div>
  );
}
