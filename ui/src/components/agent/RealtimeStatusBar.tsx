'use client';

import { useAtomValue } from 'jotai';
import { Mic, MicOff, Volume2, Square, Zap, Radio, Sparkles, AudioLines } from 'lucide-react';
import {
  realtimeEnabledAtom,
  realtimeSessionStateAtom,
  realtimeVolumeAtom,
  wakeWordAtom,
  lastHeardTranscriptAtom,
} from '@/lib/atoms';

interface RealtimeStatusBarProps {
  toggleRealtime: () => void;
  manualPushToTalk: () => void;
  handleInterrupt: () => void;
}

export function RealtimeStatusBar({
  toggleRealtime,
  manualPushToTalk,
  handleInterrupt,
}: RealtimeStatusBarProps) {
  const realtimeEnabled = useAtomValue(realtimeEnabledAtom);
  const sessionState = useAtomValue(realtimeSessionStateAtom);
  const volume = useAtomValue(realtimeVolumeAtom);
  const wakeWord = useAtomValue(wakeWordAtom);
  const lastHeard = useAtomValue(lastHeardTranscriptAtom);

  const getStatusBadge = () => {
    if (!realtimeEnabled || sessionState === 'muted') {
      return {
        label: 'VOICE_STANDBY: MUTED',
        color: 'text-zinc-400 bg-zinc-900/60 border-zinc-700',
        dot: 'bg-zinc-500',
      };
    }
    if (sessionState === 'standby') {
      return {
        label: `LISTENING FOR "${wakeWord.toUpperCase()}"`,
        color: 'text-cyan-300 bg-cyan-950/60 border-cyan-500/40 shadow-[0_0_8px_rgba(0,240,255,0.2)]',
        dot: 'bg-cyan-400 animate-pulse',
      };
    }
    if (sessionState === 'session_active') {
      return {
        label: 'SESSION_ACTIVE: LISTENING',
        color: 'text-emerald-300 bg-emerald-950/60 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.3)]',
        dot: 'bg-emerald-400 animate-ping',
      };
    }
    if (sessionState === 'recording') {
      return {
        label: 'CAPTURING_VOICE_WAV...',
        color: 'text-rose-300 bg-rose-950/70 border-rose-500/50 shadow-[0_0_12px_rgba(244,63,94,0.4)] animate-pulse',
        dot: 'bg-rose-500 animate-ping',
      };
    }
    if (sessionState === 'processing') {
      return {
        label: 'SYNAPSE_PROCESSING_WAV...',
        color: 'text-amber-300 bg-amber-950/60 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.3)]',
        dot: 'bg-amber-400 animate-spin',
      };
    }
    if (sessionState === 'speaking') {
      return {
        label: 'AI_TRANSMITTING (BARGE-IN READY)',
        color: 'text-purple-300 bg-purple-950/60 border-purple-500/50 shadow-[0_0_12px_rgba(168,85,247,0.4)]',
        dot: 'bg-purple-400 animate-pulse',
      };
    }
    return {
      label: 'VOICE_READY',
      color: 'text-cyan-400 bg-cyan-950/40 border-cyan-500/30',
      dot: 'bg-cyan-400',
    };
  };

  const badge = getStatusBadge();

  // Compute 8 visualizer bar heights based on live volume
  const barHeights = Array.from({ length: 8 }).map((_, i) => {
    if (!realtimeEnabled || sessionState === 'muted') return 3;
    const factor = Math.sin((i + 1) * 0.8) * 0.5 + 0.5;
    const h = Math.max(3, Math.min(24, Math.round(volume * 120 * factor + 3)));
    return h;
  });

  return (
    <div className="px-3 py-1.5 border-b border-cyan-500/20 bg-cyan-950/30 text-cyan-200 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px]">
      {/* Status & Wake Word Indication */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className={`px-2 py-0.5 rounded-xs border flex items-center gap-1.5 ${badge.color} shrink-0`}>
          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
          <span className="font-bold tracking-wider truncate text-[10px] sm:text-[11px]">
            {badge.label}
          </span>
        </div>

        {/* Live Audio Visualizer Bars */}
        {realtimeEnabled && (
          <div className="hidden sm:flex items-center gap-0.5 h-4 px-1.5 bg-slate-950/70 border border-cyan-500/30 rounded-xs shrink-0">
            {barHeights.map((h, idx) => (
              <div
                key={idx}
                style={{ height: `${h}px` }}
                className={`w-1 rounded-full transition-all duration-75 ${
                  sessionState === 'recording'
                    ? 'bg-rose-400 shadow-[0_0_4px_#f43f5e]'
                    : sessionState === 'speaking'
                    ? 'bg-purple-400 shadow-[0_0_4px_#c084fc]'
                    : 'bg-cyan-400 shadow-[0_0_4px_#22d3ee]'
                }`}
              />
            ))}
          </div>
        )}

        {/* Live Heard Transcript Feed */}
        {lastHeard && (
          <div className="hidden lg:flex items-center gap-1 px-2 py-0.5 bg-cyan-950/80 border border-cyan-400/40 rounded-xs text-cyan-300 text-[10px] truncate max-w-xs animate-fade-in shadow-[0_0_8px_rgba(0,240,255,0.2)]">
            <AudioLines className="w-3 h-3 text-cyan-400 shrink-0" />
            <span className="truncate italic">&quot;{lastHeard}&quot;</span>
          </div>
        )}
      </div>

      {/* Action Controls: Interrupt, Mic Toggle, Push To Talk */}
      <div className="flex items-center gap-1.5 ml-auto shrink-0">
        {/* Instant Interruption Button */}
        {sessionState === 'speaking' && (
          <button
            onClick={handleInterrupt}
            className="px-2 py-0.5 rounded-xs bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold text-[10px] flex items-center gap-1 shadow-[0_0_10px_rgba(244,63,94,0.6)] animate-pulse transition-all cursor-pointer"
            title="Interrupt and halt AI speech immediately"
          >
            <Square className="w-2.5 h-2.5 fill-current" />
            <span>INTERRUPT</span>
          </button>
        )}

        {/* Push to talk / Trigger session */}
        <button
          onClick={manualPushToTalk}
          className={`px-2 py-0.5 rounded-xs border text-[10px] font-bold flex items-center gap-1 transition-all ${
            sessionState === 'recording'
              ? 'bg-rose-500/20 text-rose-200 border-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.4)]'
              : 'bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border-cyan-500/40'
          }`}
          title="Manual Trigger / Record Voice"
        >
          <Radio className="w-3 h-3 text-cyan-400" />
          <span className="hidden md:inline">
            {sessionState === 'recording' ? 'STOP_REC' : 'TRIGGER_VOICE'}
          </span>
        </button>

        {/* Mute/Unmute Realtime Voice Listener */}
        <button
          onClick={toggleRealtime}
          className={`p-1 rounded-xs border text-[10px] transition-all ${
            realtimeEnabled
              ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400 shadow-[0_0_6px_rgba(0,240,255,0.3)]'
              : 'bg-zinc-900 text-zinc-500 border-zinc-700 hover:text-zinc-300'
          }`}
          title={realtimeEnabled ? 'Mute Background Voice Listening' : 'Enable Silent Background Listening'}
        >
          {realtimeEnabled ? <Mic className="w-3 h-3 text-cyan-300" /> : <MicOff className="w-3 h-3" />}
        </button>
      </div>
    </div>
  );
}
