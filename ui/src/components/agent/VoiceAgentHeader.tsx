'use client';

import { useAtom } from 'jotai';
import { Cpu, Zap, MessageSquarePlus, Volume2, VolumeX, Terminal, ShieldAlert } from 'lucide-react';
import { engineModeAtom, selectedOllamaModelAtom, ttsEnabledAtom } from '@/lib/atoms';
import { Button } from '@/components/ui/button';
import { stopTTS } from '@/lib/tts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface VoiceAgentHeaderProps {
  ollamaModels: string[];
  clearChatHistory: () => void;
}

export function VoiceAgentHeader({
  ollamaModels,
  clearChatHistory,
}: VoiceAgentHeaderProps) {
  const [engineMode, setEngineMode] = useAtom(engineModeAtom);
  const [selectedOllamaModel, setSelectedOllamaModel] = useAtom(selectedOllamaModelAtom);
  const [ttsEnabled, setTtsEnabled] = useAtom(ttsEnabledAtom);

  const toggleTts = () => {
    if (ttsEnabled) {
      stopTTS();
    }
    setTtsEnabled(!ttsEnabled);
  };

  return (
    <div className="px-3 sm:px-4 py-2.5 border-b border-cyan-500/30 bg-cyan-950/40 text-cyan-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 font-mono">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-xs bg-cyan-950 border border-cyan-400/40 text-cyan-300">
            <Terminal className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-cyan-300 text-xs sm:text-sm font-heading tracking-wider hud-glow-cyan">
                JOHNWICK
              </h3>
              <span className="px-1.5 py-0.2 rounded-xs bg-cyan-500/20 border border-cyan-400/40 text-[9px] text-cyan-200 font-bold uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_6px_#00f0ff]" />
                {engineMode === 'ollama' ? 'LOCAL_OLLAMA' : 'GEMINI_CLOUD'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-1.5 overflow-x-auto pb-0.5 sm:pb-0">
        {/* Engine Mode Toggle */}
        <div className="bg-cyan-950/60 p-0.5 rounded-xs border border-cyan-500/30 flex items-center gap-1 shrink-0">
          <button
            onClick={() => setEngineMode('ollama')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-xs text-[10px] font-mono transition-all ${
              engineMode === 'ollama'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_8px_rgba(0,240,255,0.7)]'
                : 'text-cyan-400 hover:text-cyan-200'
            }`}
          >
            <Cpu className="w-3 h-3 shrink-0" />
            <span>OLLAMA</span>
          </button>
          <button
            onClick={() => setEngineMode('text_flash')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-xs text-[10px] font-mono transition-all ${
              engineMode === 'text_flash'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_8px_rgba(0,240,255,0.7)]'
                : 'text-cyan-400 hover:text-cyan-200'
            }`}
          >
            <Zap className="w-3 h-3 shrink-0" />
            <span>GEMINI</span>
          </button>
        </div>

        {/* Ollama Model Selector dropdown */}
        {engineMode === 'ollama' && (
          <div className="shrink-0 w-36 sm:w-44">
            <Select
              value={selectedOllamaModel}
              onValueChange={(val) => {
                if (val) setSelectedOllamaModel(val);
              }}
            >
              <SelectTrigger className="h-6.5 text-[10px] bg-cyan-950/70 border-cyan-500/40 text-cyan-200 font-mono rounded-xs">
                <SelectValue placeholder="MODEL..." />
              </SelectTrigger>
              <SelectContent className="bg-slate-950 border-cyan-500/50 text-cyan-200 font-mono">
                {ollamaModels.length > 0 ? (
                  ollamaModels.map((model) => (
                    <SelectItem key={model} value={model} className="text-[11px] focus:bg-cyan-500/20 focus:text-cyan-100">
                      {model}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="ornith-1.5:9b" className="text-[11px]">
                    ornith-1.5:9b
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* TTS Voice Output Toggle */}
        <button
          onClick={toggleTts}
          className={`h-6.5 px-2 rounded-xs border text-[10px] font-mono flex items-center gap-1 transition-all shrink-0 ${
            ttsEnabled
              ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400 shadow-[0_0_8px_rgba(0,240,255,0.4)]'
              : 'bg-cyan-950/40 text-cyan-600 border-cyan-800/50 hover:text-cyan-400'
          }`}
        >
          {ttsEnabled ? (
            <>
              <Volume2 className="w-3 h-3 text-cyan-300 animate-pulse" />
              <span>SYNTH_VOICE: ON</span>
            </>
          ) : (
            <>
              <VolumeX className="w-3 h-3" />
              <span>SYNTH_VOICE: MUTED</span>
            </>
          )}
        </button>

        {/* Clear History Button */}
        <button
          onClick={clearChatHistory}
          className="h-6.5 px-2 rounded-xs border border-cyan-500/30 bg-cyan-950/40 text-cyan-400 hover:text-cyan-100 hover:border-cyan-400 flex items-center justify-center transition-all shrink-0"
          title="PURGE CONVERSATION LOGS"
        >
          <MessageSquarePlus className="w-3.5 h-3.5 mr-1" />
          <span className="text-[10px]">PURGE</span>
        </button>
      </div>
    </div>
  );
}
