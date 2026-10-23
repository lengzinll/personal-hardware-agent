'use client';

import React from 'react';
import { Bot, Cpu, Radio, Shield, Terminal, Zap, Activity, HardDrive } from 'lucide-react';
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
    <div className="h-screen max-h-screen overflow-hidden flex flex-col bg-[#191919] text-[#e3e2de] font-sans">
      {/* Top Notion-style Breadcrumb Navigation */}
      <header className="shrink-0 border-b border-[#2e2e2e] bg-[#191919] px-4 py-2.5 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          {/* Notion Page Icon & Breadcrumb */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-lg select-none">🚦</span>
            <span className="text-[#8f8e8a] hover:text-[#e3e2de] cursor-pointer transition-colors">Workspace</span>
            <span className="text-[#555555]">/</span>
            <h1 className="font-medium text-[#ecebed] tracking-tight flex items-center gap-2">
              Hardware Agent
              <span className="text-[11px] font-normal px-1.5 py-0.5 rounded-md bg-[#252525] text-[#9b9a97] border border-[#333333]">
                v1.0
              </span>
            </h1>
          </div>

          {/* Minimalist Status Indicators */}
          <div className="flex items-center gap-2">
            {/* FastAPI Daemon Status */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#202020] border border-[#2e2e2e] text-xs text-[#9b9a97]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]" />
              <span className="text-[#ecebed] font-medium">FastAPI Online</span>
            </div>

            {/* Actuator State Dots */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#202020] border border-[#2e2e2e]">
              <span
                title="Red LED (Pin 11)"
                className={`w-2 h-2 rounded-full transition-all ${
                  isRed ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]' : 'bg-[#333333]'
                }`}
              />
              <span
                title="Yellow LED (Pin 15)"
                className={`w-2 h-2 rounded-full transition-all ${
                  isYellow ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]' : 'bg-[#333333]'
                }`}
              />
              <span
                title="Green LED (Pin 16)"
                className={`w-2 h-2 rounded-full transition-all ${
                  isGreen ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-[#333333]'
                }`}
              />
              <div className="w-[1px] h-3 bg-[#333333] mx-0.5" />
              <span
                title="Desk Lamp (Pin 13)"
                className={`w-2 h-2 rounded-full transition-all ${
                  isLamp ? 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.6)]' : 'bg-[#333333]'
                }`}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Page Area */}
      <main className="flex-1 min-h-0 overflow-hidden flex flex-col max-w-6xl w-full mx-auto px-3 sm:px-6 py-3 gap-3">
        {/* Hardware Control Section (Notion Callout/Cards) */}
        <div className="shrink-0">
          <LedControl />
        </div>

        {/* AI Voice & Chat Assistant */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <VoiceAgent />
        </div>
      </main>
    </div>
  );
}
