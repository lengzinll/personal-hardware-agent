'use client';

import { useAtom, useAtomValue } from 'jotai';
import { Cpu, Gauge } from 'lucide-react';
import { showSettingsAtom, selectedOllamaModelAtom, apiKeyAtom, speechRateAtom } from '@/lib/atoms';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface VoiceAgentSettingsProps {
  ollamaModels: string[];
}

export function VoiceAgentSettings({ ollamaModels }: VoiceAgentSettingsProps) {
  const showSettings = useAtomValue(showSettingsAtom);
  const [selectedOllamaModel, setSelectedOllamaModel] = useAtom(selectedOllamaModelAtom);
  const [apiKey, setApiKey] = useAtom(apiKeyAtom);
  const [speechRate, setSpeechRate] = useAtom(speechRateAtom);

  if (!showSettings) return null;

  return (
    <div className="p-4 bg-muted/40 border-b border-border space-y-4 animate-in fade-in slide-in-from-top-2">
      {/* Ollama Local Model Selector */}
      <div className="space-y-1.5">
        <label className="text-xs flex items-center gap-2 font-semibold text-muted-foreground uppercase tracking-wider">
          <Cpu className="w-3.5 h-3.5 text-primary" />
          <span> Local Ollama Model </span>
        </label>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Select
            value={selectedOllamaModel}
            onValueChange={(val) => {
              if (val) setSelectedOllamaModel(val);
            }}
          >
            <SelectTrigger className="flex-1 text-xs">
              <SelectValue placeholder="Select an Ollama model..." />
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
                  ornith-1.5:9b (Default)
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          <span className="text-[11px] text-muted-foreground bg-muted px-2.5 py-1 rounded-lg border border-border">
            Connected to http://localhost:11434
          </span>
        </div>
      </div>

      {/* Speech Playback Speed Setting */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs flex items-center gap-2 font-semibold text-muted-foreground uppercase tracking-wider">
            <Gauge className="w-3.5 h-3.5 text-primary" />
            <span>Speech Playback Speed</span>
          </label>
          <span className="text-xs font-mono font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
            {speechRate}x
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {[1.0, 1.15, 1.25, 1.5, 1.75, 2.0].map((rate) => (
            <button
              key={rate}
              type="button"
              onClick={() => setSpeechRate(rate)}
              className={`px-2.5 py-1 text-xs rounded-md border font-medium transition-colors ${
                speechRate === rate
                  ? 'bg-primary text-primary-foreground border-primary font-semibold shadow-xs'
                  : 'bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground'
              }`}
            >
              {rate}x{rate === 1.25 ? ' (Fast)' : rate === 1.0 ? ' (Normal)' : ''}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
