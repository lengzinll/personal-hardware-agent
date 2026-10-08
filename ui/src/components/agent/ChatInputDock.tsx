'use client';

import { useAtomValue } from 'jotai';
import { Send, CornerDownLeft } from 'lucide-react';
import { engineModeAtom, selectedOllamaModelAtom } from '@/lib/atoms';

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
    <div className="p-2 sm:p-3 border-t border-cyan-500/30 bg-cyan-950/50 text-cyan-200">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="flex items-center gap-2"
      >
        {/* Terminal Command Input Prompt */}
        <div className="relative flex-1 flex items-center bg-slate-950/80 border border-cyan-500/40 rounded-xs focus-within:border-cyan-400 focus-within:shadow-[0_0_10px_rgba(0,240,255,0.3)] transition-all">
          <div className="px-2.5 text-cyan-400 font-mono text-xs font-bold shrink-0 select-none">
            JOHNWICK&gt;
          </div>
          <input
            type="text"
            className="w-full bg-transparent py-2 pr-3 text-xs text-cyan-100 font-mono placeholder:text-cyan-600/70 focus:outline-none"
            placeholder={
              engineMode === 'ollama'
                ? `EXECUTE_COMMAND (${selectedOllamaModel})...`
                : 'EXECUTE_COMMAND (GEMINI_FLASH)...'
            }
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
        </div>

        {/* Transmit Button */}
        <button
          type="submit"
          disabled={isLoading || !inputText.trim()}
          className="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-mono text-xs font-bold rounded-xs flex items-center gap-1.5 transition-all disabled:opacity-30 disabled:pointer-events-none hover:shadow-[0_0_12px_rgba(0,240,255,0.5)] shrink-0"
        >
          {isLoading ? (
            <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">TRANSMIT</span>
              <CornerDownLeft className="w-2.5 h-2.5 opacity-60 ml-0.5 hidden sm:inline" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
