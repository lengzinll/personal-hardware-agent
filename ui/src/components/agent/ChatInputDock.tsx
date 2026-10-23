'use client';

import { useAtomValue } from 'jotai';
import { CornerDownLeft, Sparkles } from 'lucide-react';
import { realtimeSessionStateAtom } from '@/lib/atoms';

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
  const sessionState = useAtomValue(realtimeSessionStateAtom);
  const isHearingVoice = sessionState === 'recording';

  return (
    <div className="p-3 border-t border-[#2e2e2e] bg-[#202020] text-[#e3e2de]">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="flex items-center gap-2"
      >
        {/* Notion-style AI Prompt Bar */}
        <div className={`relative flex-1 flex items-center bg-[#252525] border rounded-lg transition-all ${
          isHearingVoice
            ? 'border-emerald-500/70 shadow-sm'
            : 'border-[#333333] focus-within:border-[#4d4d4d] focus-within:bg-[#282828]'
        }`}>
          <div className="pl-3 pr-1 text-[#8f8e8a] shrink-0 select-none">
            <Sparkles className="w-3.5 h-3.5 text-[#9b9a97]" />
          </div>

          <div className="flex-1 flex items-center min-w-0 pr-2">
            <input
              type="text"
              className="w-full bg-transparent py-2.5 px-2 text-xs sm:text-sm text-[#ecebed] placeholder:text-[#787774] focus:outline-none font-sans"
              placeholder={
                isHearingVoice
                  ? 'Listening to speech...'
                  : 'Ask AI or type a hardware command (e.g. "turn on green light")...'
              }
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
            {isHearingVoice && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#1d2d1d] text-[#4ade80] border border-[#254d25] text-xs shrink-0 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                <span>Listening</span>
              </div>
            )}
          </div>
        </div>

        {/* Send Button */}
        <button
          type="submit"
          disabled={isLoading || !inputText.trim()}
          className="px-3.5 py-2.5 bg-[#ecebed] hover:bg-white text-[#191919] font-medium text-xs sm:text-sm rounded-lg flex items-center gap-1.5 transition-all disabled:opacity-30 disabled:pointer-events-none shrink-0 cursor-pointer"
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-[#191919] border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <span>Send</span>
              <CornerDownLeft className="w-3 h-3 opacity-60 hidden sm:inline" />
            </>
          )}
        </button>
      </form>

      {/* Footer Helper Note */}
      <div className="flex items-center justify-between text-xs text-[#787774] mt-2 px-1 select-none">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>
            {isHearingVoice
              ? 'Hearing voice — pause for 1s to auto-send'
              : 'Press Enter to send or speak with microphone'}
          </span>
        </span>
      </div>
    </div>
  );
}
