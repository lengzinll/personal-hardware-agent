'use client';

import { useAtomValue } from 'jotai';
import { Mic, MicOff, Send } from 'lucide-react';
import { engineModeAtom, selectedOllamaModelAtom } from '@/lib/atoms';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface ChatInputDockProps {
  isListening: boolean;
  toggleListening: () => void;
  inputText: string;
  setInputText: (text: string) => void;
  isLoading: boolean;
  handleSendMessage: () => void;
}

export function ChatInputDock({
  isListening,
  toggleListening,
  inputText,
  setInputText,
  isLoading,
  handleSendMessage,
}: ChatInputDockProps) {
  const engineMode = useAtomValue(engineModeAtom);
  const selectedOllamaModel = useAtomValue(selectedOllamaModelAtom);

  return (
    <div className="p-3 sm:p-4 border-t border-border bg-card text-card-foreground rounded-b-xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="flex items-center gap-2 sm:gap-3"
      >
        {/* STT Dictation Button */}
        <Button
          type="button"
          variant={isListening ? "destructive" : "outline"}
          onClick={toggleListening}
          className={`shrink-0 ${isListening ? 'animate-pulse' : ''}`}
          title={isListening ? 'Stop Listening' : 'Start Speech Dictation'}
          size={"icon"}
        >
          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </Button>

        {/* Text Input Box */}
        <div className="relative flex-1">
          <Input
            type="text"
            placeholder={
              isListening
                ? 'Listening...'
                : engineMode === 'ollama'
                  ? `Message AURA (${selectedOllamaModel})...`
                  : 'Message AURA (Gemini)...'
            }
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
        </div>

        {/* Send Button */}
        <Button
          type="submit"
          variant="default"
          disabled={isLoading || !inputText.trim()}
          className="shrink-0 flex items-center justify-center gap-2"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">Send</span>
        </Button>
      </form>
    </div>
  );
}
