'use client';

import { useAtom } from 'jotai';
import { Bot, Cpu, Zap, Mic, Volume2, VolumeX, MessageSquarePlus, Settings } from 'lucide-react';
import { engineModeAtom, autoSpeakAtom, showSettingsAtom } from '@/lib/atoms';
import { Button } from '@/components/ui/button';

interface VoiceAgentHeaderProps {
  isSpeaking: boolean;
  stopSpeaking: () => void;
  clearChatHistory: () => void;
}

export function VoiceAgentHeader({
  isSpeaking,
  stopSpeaking,
  clearChatHistory,
}: VoiceAgentHeaderProps) {
  const [engineMode, setEngineMode] = useAtom(engineModeAtom);
  const [autoSpeak, setAutoSpeak] = useAtom(autoSpeakAtom);
  const [showSettings, setShowSettings] = useAtom(showSettingsAtom);

  return (
    <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-border bg-card text-card-foreground flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h3 className="font-bold text-foreground text-sm sm:text-base tracking-wide">AURA Agent</h3>
              <span className="px-2 py-0.5 rounded-full bg-muted border border-border text-[9px] sm:text-[10px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                {engineMode === 'ollama' ? 'Ollama' : 'Gemini'}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-muted-foreground">Conversational AI with SQLite Database Tools</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-2 overflow-x-auto pb-0.5 sm:pb-0">
        {/* Engine Selector */}
        <div className="bg-muted p-1 sm:p-1.5 rounded-xl border border-border flex items-center gap-1 shrink-0">
          <Button
            size="xs"
            variant={engineMode === 'ollama' ? 'default' : 'ghost'}
            onClick={() => setEngineMode('ollama')}
            className="flex items-center gap-1 sm:gap-1.5"
            title="Local Offline Ollama Models"
          >
            <Cpu className="w-3.5 h-3.5 shrink-0" />
            <span>Ollama</span>
          </Button>
          <Button
            size="xs"
            variant={engineMode === 'text_flash' ? 'default' : 'ghost'}
            onClick={() => setEngineMode('text_flash')}
            className="flex items-center gap-1 sm:gap-1.5"
          >
            <Zap className="w-3.5 h-3.5 shrink-0" />
            <span>Gemini</span>
          </Button>
          <Button
            size="xs"
            variant={engineMode === 'gemini_live' ? 'default' : 'ghost'}
            onClick={() => setEngineMode('gemini_live')}
            className="flex items-center gap-1 sm:gap-1.5"
          >
            <Mic className="w-3.5 h-3.5 shrink-0" />
            <span>Live</span>
          </Button>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Auto TTS Speech Response Toggle */}
          <Button
            size="icon"
            variant={autoSpeak ? 'secondary' : 'outline'}
            onClick={() => setAutoSpeak(!autoSpeak)}
            title={autoSpeak ? 'Auto Voice Feedback Enabled (TTS)' : 'Auto Voice Feedback Muted'}
          >
            {autoSpeak ? <Volume2 className="w-4 h-4 text-primary" /> : <VolumeX className="w-4 h-4 text-muted-foreground" />}
          </Button>

          {/* Stop Speaking Button when speech is active */}
          {isSpeaking && (
            <Button
              size="sm"
              variant="destructive"
              onClick={stopSpeaking}
              className="gap-1.5 animate-pulse"
              title="Stop current voice playback"
            >
              <VolumeX className="w-4 h-4 shrink-0" />
              <span>Stop</span>
            </Button>
          )}

          <Button
            size="icon"
            variant="outline"
            onClick={clearChatHistory}
            title="New Chat Session"
          >
            <MessageSquarePlus className="w-4 h-4" />
          </Button>

          <Button
            size="icon"
            variant={showSettings ? 'secondary' : 'outline'}
            onClick={() => setShowSettings((prev) => !prev)}
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
