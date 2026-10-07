'use client';

import React from 'react';
import { Bot, Cpu, Radio, Shield, Terminal, Zap, Activity } from 'lucide-react';
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
    <div className="h-screen max-h-screen overflow-hidden flex flex-col hud-grid-bg hud-scanline text-[#00f0ff] font-mono selection:bg-cyan-500/30 selection:text-white">
      {/* Top Holographic Header Ribbon */}
      <header className="shrink-0 border-b border-cyan-500/30 bg-[#020b18]/90 backdrop-blur-md z-40 px-3 sm:px-6 py-2">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          {/* Logo & Terminal Identity */}
          <div className="flex items-center gap-2.5">
            <div className="relative w-8 h-8 rounded-xs bg-cyan-950/80 border border-cyan-400 flex items-center justify-center text-cyan-300 shadow-[0_0_12px_rgba(0,240,255,0.6)]">
              <Bot className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold tracking-widest font-heading text-cyan-300 hud-glow-cyan">
                NEURAL_HUD_V4.9
                </h1>
                <span className="px-1.5 py-0.2 text-[9px] font-bold bg-cyan-500/20 text-cyan-200 border border-cyan-400/40 rounded-xs">
                  LIBGPIOD_ACTIVE
                </span>
              </div>
              <p className="text-[10px] text-cyan-500/80 tracking-wider">CYBERNETIC HARDWARE & VOICE SYNAPSE CONTROLLER</p>
            </div>
          </div>

          {/* Realtime Status Bar & Hardware Indicators */}
          <div className="flex items-center gap-2">
            {/* Server Status */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xs bg-cyan-950/60 border border-cyan-500/30 text-[11px]">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-cyan-500 hidden sm:inline">FASTAPI_DAEMON:</span>
              <span className="font-bold flex items-center gap-1 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#10b981]" />
                ONLINE
              </span>
            </div>

            {/* Actuator State Indicators */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xs bg-cyan-950/60 border border-cyan-500/30">
              <span
                title="RED BEACON (GPIO 17)"
                className={`w-2.5 h-2.5 rounded-xs transition-all ${
                  isRed ? 'bg-rose-500 shadow-[0_0_10px_#f43f5e] animate-pulse' : 'bg-rose-950 border border-rose-900/60'
                }`}
              />
              <span
                title="YELLOW BEACON (GPIO 22)"
                className={`w-2.5 h-2.5 rounded-xs transition-all ${
                  isYellow ? 'bg-amber-400 shadow-[0_0_10px_#fbbf24] animate-pulse' : 'bg-amber-950 border border-amber-900/60'
                }`}
              />
              <span
                title="GREEN BEACON (GPIO 23)"
                className={`w-2.5 h-2.5 rounded-xs transition-all ${
                  isGreen ? 'bg-emerald-400 shadow-[0_0_10px_#10b981] animate-pulse' : 'bg-emerald-950 border border-emerald-900/60'
                }`}
              />
              <div className="w-[1px] h-3 bg-cyan-500/30 mx-0.5" />
              <span
                title="LAMP RELAY (GPIO 27)"
                className={`w-2.5 h-2.5 rounded-xs transition-all ${
                  isLamp ? 'bg-cyan-400 shadow-[0_0_10px_#00f0ff] animate-pulse' : 'bg-cyan-950 border border-cyan-900/60'
                }`}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 min-h-0 overflow-hidden flex flex-col max-w-7xl w-full mx-auto px-2 sm:px-4 py-2 sm:py-3 gap-2 sm:gap-3">

        {/* Hardware Control Matrix (Pinned) */}
        <div className="shrink-0">
          <LedControl />
        </div>

        {/* AI Chat Agent (Full remaining viewport height) */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <VoiceAgent />
        </div>
      </main>
    </div>
  );
}
