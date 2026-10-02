'use client';

import { useAtomValue } from 'jotai';
import { Send } from 'lucide-react';
import { engineModeAtom, selectedOllamaModelAtom } from '@/lib/atoms';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface ChatInputDockProps {
  inputText: string;
  setInputText: (text: string) => void;
  isLoading: boolean;
  handleSendMessage: () => void;
}

export function ChatInputDock({
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
        {/* Text Input Box */}
        <div className="relative flex-1">
          <Input
            type="text"
            placeholder={
              engineMode === 'ollama'
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
