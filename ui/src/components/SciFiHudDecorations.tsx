'use client';

import React from 'react';

export function SciFiHudDecorations() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 w-full">
      {/* HUD Widget 1: Rotating Target Radar */}
      <div className="hud-panel p-2 flex items-center gap-3 overflow-hidden">
        <div className="relative w-10 h-10 shrink-0 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-cyan-500/40" />
          <div className="absolute inset-1 rounded-full border border-dashed border-cyan-400/60 animate-radar" />
          <div className="absolute inset-2.5 rounded-full border border-dotted border-cyan-300 animate-radar-rev" />
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#00f0ff] animate-ping" />
          <div className="absolute w-full h-[1px] bg-cyan-500/30" />
          <div className="absolute h-full w-[1px] bg-cyan-500/30" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] text-cyan-400/70 uppercase tracking-widest font-mono">NEURAL_RADAR</div>
          <div className="text-xs font-bold text-cyan-300 font-mono tracking-wider">TRACKING: ON</div>
          <div className="text-[9px] text-cyan-500/60 font-mono">AZIMUTH: 184.2°</div>
        </div>
      </div>

      {/* HUD Widget 2: Dynamic Equalizer / Audio Waveform */}
      <div className="hud-panel p-2 flex flex-col justify-between overflow-hidden">
        <div className="flex items-center justify-between text-[9px] text-cyan-400/80 font-mono">
          <span>ACOUSTIC_SPECT</span>
          <span className="text-cyan-300 font-bold">LIVE</span>
        </div>
        <div className="flex items-end gap-[3px] h-6 my-1">
          {[40, 75, 90, 60, 85, 45, 100, 65, 80, 50, 95, 70, 30].map((h, i) => (
            <div
              key={i}
              className="flex-1 bg-gradient-to-t from-cyan-900 via-cyan-500 to-cyan-300 rounded-t-[1px] shadow-[0_0_4px_rgba(0,240,255,0.4)] transition-all duration-300"
              style={{
                height: `${h}%`,
                animation: `waveform-pulse ${0.8 + (i % 5) * 0.2}s ease-in-out infinite alternate`,
                animationDelay: `${i * 70}ms`
              }}
            />
          ))}
        </div>
        <div className="flex justify-between text-[8px] text-cyan-500/60 font-mono">
          <span>0.1kHz</span>
          <span>16.0kHz</span>
        </div>
      </div>

      {/* HUD Widget 3: Quantum Core / Hex Grid Status */}
      <div className="hud-panel p-2 flex items-center gap-2.5 overflow-hidden">
        <div className="relative w-9 h-9 shrink-0 flex items-center justify-center">
          <div className="w-8 h-8 rotate-45 border border-cyan-400/60 shadow-[0_0_8px_rgba(0,240,255,0.4)] animate-pulse" />
          <div className="absolute w-5 h-5 -rotate-12 border border-cyan-300/80" />
          <div className="absolute w-2 h-2 bg-cyan-400 rounded-full shadow-[0_0_10px_#00f0ff]" />
        </div>
        <div className="min-w-0">
          <div className="text-[9px] text-cyan-400/70 uppercase font-mono">SYS_INTEGRITY</div>
          <div className="text-xs font-bold text-emerald-400 font-mono">OPTIMAL [99.8%]</div>
          <div className="w-full bg-cyan-950/80 h-1.5 rounded-full overflow-hidden border border-cyan-800/60 mt-0.5">
            <div className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-full w-[99%]" />
          </div>
        </div>
      </div>

      {/* HUD Widget 4: Telemetry Data Grid */}
      <div className="hud-panel p-2 flex flex-col justify-between overflow-hidden">
        <div className="flex items-center justify-between text-[9px] text-cyan-400/80 font-mono">
          <span>BUS_TELEMETRY</span>
          <span className="text-emerald-400">SYNCED</span>
        </div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9px] font-mono my-0.5">
          <div className="text-cyan-500/70">GPIO_LAT: <span className="text-cyan-200">0.4ms</span></div>
          <div className="text-cyan-500/70">BUFF_SZ: <span className="text-cyan-200">1024KB</span></div>
          <div className="text-cyan-500/70">BAUD: <span className="text-cyan-200">115200</span></div>
          <div className="text-cyan-500/70">TEMP: <span className="text-cyan-200">41.8°C</span></div>
        </div>
        <div className="w-full bg-cyan-500/20 h-[1px]" />
      </div>

      {/* HUD Widget 5: Cyber Matrix Data Stream (Hidden on small screens) */}
      <div className="hud-panel p-2 hidden lg:flex flex-col justify-between overflow-hidden font-mono">
        <div className="text-[9px] text-cyan-400/80 flex items-center justify-between">
          <span>NODE_MATRIX</span>
          <span className="text-[8px] bg-cyan-500/20 text-cyan-300 px-1 rounded">V4.9</span>
        </div>
        <div className="text-[8px] text-cyan-400/60 leading-tight truncate">
          0x7F 0xAA 0x12 0x8C<br/>
          0x03 0xEE 0x99 0x4B<br/>
          SEC_HASH: SHA-256
        </div>
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[8px] text-cyan-300">LINK: ONLINE</span>
        </div>
      </div>

      {/* HUD Widget 6: Scanning Horizon Radar (Hidden on small screens) */}
      <div className="hud-panel p-2 hidden lg:flex flex-col justify-between overflow-hidden">
        <div className="flex items-center justify-between text-[9px] text-cyan-400/80 font-mono">
          <span>OBJECT_SENSOR</span>
          <span className="text-cyan-300">YOLO_V8</span>
        </div>
        <div className="relative h-6 w-full border border-cyan-500/40 bg-cyan-950/30 overflow-hidden flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent w-1/3 animate-scan-sweep" />
          <span className="text-[8px] font-mono text-cyan-300/80 tracking-widest">SCANNING_FIELD</span>
        </div>
        <div className="text-[8px] text-cyan-500/60 font-mono text-right">FOV: 120° RTSP</div>
      </div>
    </div>
  );
}
