'use client';

import { useAtomValue } from 'jotai';
import { Mic, MicOff, Square, Radio, AudioLines } from 'lucide-react';
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
        label: 'Microphone Muted',
        color: 'text-[#8f8e8a] bg-[#262626] border-[#333333]',
        dot: 'bg-[#555555]',
      };
    }
    if (sessionState === 'standby') {
      return {
        label: `Listening for "${wakeWord}"`,
        color: 'text-[#81c784] bg-[#1e2920] border-[#2e4030]',
        dot: 'bg-emerald-400',
      };
    }
    if (sessionState === 'session_active') {
      return {
        label: 'Active • Listening for command',
        color: 'text-[#81c784] bg-[#1e2920] border-[#2e4030]',
        dot: 'bg-emerald-400 animate-pulse',
      };
    }
    if (sessionState === 'recording') {
      return {
        label: 'Listening to your voice...',
        color: 'text-[#f87171] bg-[#2c1d1d] border-[#4d2828]',
        dot: 'bg-rose-500 animate-ping',
      };
    }
    if (sessionState === 'processing') {
      return {
        label: 'Processing command...',
        color: 'text-[#fbbf24] bg-[#2a241b] border-[#40341e]',
        dot: 'bg-amber-400 animate-spin',
      };
    }
    if (sessionState === 'speaking') {
      return {
        label: 'Speaking (Click interrupt to halt)',
        color: 'text-[#a78bfa] bg-[#241f2e] border-[#3a304a]',
        dot: 'bg-purple-400 animate-pulse',
      };
    }
    return {
      label: 'Voice Ready',
      color: 'text-[#8f8e8a] bg-[#262626] border-[#333333]',
      dot: 'bg-[#666666]',
    };
  };

  const badge = getStatusBadge();

  // Compute 8 visualizer bar heights
  const barHeights = Array.from({ length: 8 }).map((_, i) => {
    if (!realtimeEnabled || sessionState === 'muted') return 3;
    const factor = Math.sin((i + 1) * 0.8) * 0.5 + 0.5;
    const h = Math.max(3, Math.min(20, Math.round(volume * 100 * factor + 3)));
    return h;
  });

  return (
    <div className="px-3.5 py-1.5 border-b border-[#2e2e2e] bg-[#242424] text-[#e3e2de] flex flex-wrap items-center justify-between gap-2 text-xs">
      {/* Status Badge */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div className={`px-2 py-0.5 rounded-md border flex items-center gap-1.5 ${badge.color} shrink-0 text-xs font-medium`}>
          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
          <span className="truncate">{badge.label}</span>
        </div>

        {/* Minimal Audio Level Bars */}
        {realtimeEnabled && (
          <div className="hidden sm:flex items-center gap-0.5 h-4 px-1.5 bg-[#1e1e1e] border border-[#2e2e2e] rounded-sm shrink-0">
            {barHeights.map((h, idx) => (
              <div
                key={idx}
                style={{ height: `${h}px` }}
                className={`w-1 rounded-full transition-all duration-75 ${
                  sessionState === 'recording'
                    ? 'bg-rose-400'
                    : sessionState === 'speaking'
                    ? 'bg-purple-400'
                    : 'bg-[#8f8e8a]'
                }`}
              />
            ))}
          </div>
        )}

        {/* Live Heard Transcript Feed */}
        {lastHeard && (
          <div className="hidden lg:flex items-center gap-1.5 px-2 py-0.5 bg-[#202020] border border-[#333333] rounded-md text-[#9b9a97] text-xs truncate max-w-sm">
            <AudioLines className="w-3.5 h-3.5 text-[#787774] shrink-0" />
            <span className="truncate italic">&quot;{lastHeard}&quot;</span>
          </div>
        )}
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-1.5 ml-auto shrink-0">
        {/* Instant Interruption Button */}
        {sessionState === 'speaking' && (
          <button
            onClick={handleInterrupt}
            className="px-2.5 py-1 rounded-md bg-[#381f1f] hover:bg-[#472525] text-[#f87171] border border-[#5c2a2a] text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
            title="Halt AI speech"
          >
            <Square className="w-3 h-3 fill-current" />
            <span>Stop Speech</span>
          </button>
        )}

        {/* Push to talk / Trigger session */}
        <button
          onClick={manualPushToTalk}
          className={`px-2.5 py-1 rounded-md border text-xs font-medium flex items-center gap-1.5 transition-colors ${
            sessionState === 'recording'
              ? 'bg-[#3b1d1d] text-[#f87171] border-[#5c2a2a]'
              : 'bg-[#2a2a2a] hover:bg-[#333333] text-[#ecebed] border-[#383838]'
          }`}
          title="Record or speak command"
        >
          <Radio className="w-3 h-3 text-[#9b9a97]" />
          <span>{sessionState === 'recording' ? 'Stop' : 'Speak'}</span>
        </button>

        {/* Mute/Unmute Realtime Voice Listener */}
        <button
          onClick={toggleRealtime}
          className={`p-1.5 rounded-md border text-xs transition-colors ${
            realtimeEnabled
              ? 'bg-[#2a2a2a] text-[#ecebed] border-[#383838]'
              : 'bg-[#202020] text-[#666666] border-[#2e2e2e] hover:text-[#999999]'
          }`}
          title={realtimeEnabled ? 'Mute Mic' : 'Enable Mic'}
        >
          {realtimeEnabled ? <Mic className="w-3.5 h-3.5 text-emerald-400" /> : <MicOff className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}
