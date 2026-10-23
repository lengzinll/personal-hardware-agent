'use client';

import { useAtom } from 'jotai';
import { Volume2, VolumeX, Trash2 } from 'lucide-react';
import { engineModeAtom, selectedOllamaModelAtom, ttsEnabledAtom } from '@/lib/atoms';
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
    <div className="px-3.5 py-2.5 border-b border-[#2e2e2e] bg-[#202020] text-[#e3e2de] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
      {/* Title & Status Pills */}
      <div className="flex items-center gap-2">
        <span className="text-base select-none">💬</span>
        <h3 className="font-semibold text-sm text-[#ecebed]">
          Assistant Chat
        </h3>
        <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-[#282828] text-[#9b9a97] border border-[#333333]">
          {engineMode === 'ollama' ? 'Ollama' : 'Gemini'}
        </span>
        <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-[#282828] text-[#9b9a97] border border-[#333333]">
          Browser STT (en-US)
        </span>
      </div>

      {/* Control Actions & Selectors */}
      <div className="flex items-center justify-between sm:justify-end gap-1.5 overflow-x-auto pb-0.5 sm:pb-0 text-xs">
        {/* Engine Toggle */}
        <div className="bg-[#262626] p-0.5 rounded-md border border-[#333333] flex items-center shrink-0">
          <button
            onClick={() => setEngineMode('ollama')}
            className={`px-2 py-1 rounded-sm text-xs font-medium transition-all ${
              engineMode === 'ollama'
                ? 'bg-[#333333] text-[#ffffff] shadow-sm'
                : 'text-[#8f8e8a] hover:text-[#ecebed]'
            }`}
          >
            Ollama
          </button>
          <button
            onClick={() => setEngineMode('text_flash')}
            className={`px-2 py-1 rounded-sm text-xs font-medium transition-all ${
              engineMode === 'text_flash'
                ? 'bg-[#333333] text-[#ffffff] shadow-sm'
                : 'text-[#8f8e8a] hover:text-[#ecebed]'
            }`}
          >
            Gemini
          </button>
        </div>

        {/* Ollama Model Selector */}
        {engineMode === 'ollama' && (
          <div className="shrink-0 w-36 sm:w-40">
            <Select
              value={selectedOllamaModel}
              onValueChange={(val) => {
                if (val) setSelectedOllamaModel(val);
              }}
            >
              <SelectTrigger className="h-7 text-xs bg-[#262626] border-[#333333] text-[#ecebed] rounded-md font-sans focus:ring-0">
                <SelectValue placeholder="Model..." />
              </SelectTrigger>
              <SelectContent className="bg-[#252525] border-[#333333] text-[#ecebed]">
                {ollamaModels.length > 0 ? (
                  ollamaModels.map((model) => (
                    <SelectItem key={model} value={model} className="text-xs focus:bg-[#333333]">
                      {model}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="ornith-1.5:9b" className="text-xs">
                    ornith-1.5:9b
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* TTS Toggle */}
        <button
          onClick={toggleTts}
          className={`h-7 px-2.5 rounded-md border text-xs flex items-center gap-1.5 transition-all shrink-0 ${
            ttsEnabled
              ? 'bg-[#2a2a2a] text-[#ecebed] border-[#3d3d3d]'
              : 'bg-[#222222] text-[#666666] border-[#2e2e2e] hover:text-[#999999]'
          }`}
          title={ttsEnabled ? 'Mute Speech' : 'Enable Speech'}
        >
          {ttsEnabled ? (
            <>
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Voice</span>
            </>
          ) : (
            <>
              <VolumeX className="w-3.5 h-3.5" />
              <span>Muted</span>
            </>
          )}
        </button>

        {/* Clear Chat Button */}
        <button
          onClick={clearChatHistory}
          className="h-7 w-7 rounded-md border border-[#333333] bg-[#262626] text-[#8f8e8a] hover:text-[#ecebed] hover:bg-[#2e2e2e] flex items-center justify-center transition-all shrink-0"
          title="Clear Conversation"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
