'use client';

import { useAtom } from 'jotai';
import { Cpu, Zap, MessageSquarePlus } from 'lucide-react';
import { engineModeAtom, selectedOllamaModelAtom } from '@/lib/atoms';
import { Button } from '@/components/ui/button';
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
            <p className="text-[11px] sm:text-xs text-muted-foreground">Conversational AI for Hardware & LED Control</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-2 overflow-x-auto pb-0.5 sm:pb-0">
        {/* Engine Selector */}
        <div className="bg-muted p-1 rounded-xl border border-border flex items-center gap-1 shrink-0">
          <Button
            size="xs"
            variant={engineMode === 'ollama' ? 'default' : 'ghost'}
            onClick={() => setEngineMode('ollama')}
            className="flex items-center gap-1 sm:gap-1.5 text-xs"
            title="Local Offline Ollama Models"
          >
            <Cpu className="w-3.5 h-3.5 shrink-0" />
            <span>Ollama</span>
          </Button>
          <Button
            size="xs"
            variant={engineMode === 'text_flash' ? 'default' : 'ghost'}
            onClick={() => setEngineMode('text_flash')}
            className="flex items-center gap-1 sm:gap-1.5 text-xs"
            title="Google Gemini Flash"
          >
            <Zap className="w-3.5 h-3.5 shrink-0" />
            <span>Gemini</span>
          </Button>
        </div>

        {/* Ollama Model Selector dropdown when Ollama is active */}
        {engineMode === 'ollama' && (
          <div className="shrink-0 w-36 sm:w-44">
            <Select
              value={selectedOllamaModel}
              onValueChange={(val) => {
                if (val) setSelectedOllamaModel(val);
              }}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="Select model..." />
              </SelectTrigger>
              <SelectContent>
                {ollamaModels.length > 0 ? (
                  ollamaModels.map((model) => (
                    <SelectItem key={model} value={model} className="text-xs">
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

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="icon"
            variant="outline"
            onClick={clearChatHistory}
            title="New Chat Session"
            className="h-7 w-7 sm:h-8 sm:w-8"
          >
            <MessageSquarePlus className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
