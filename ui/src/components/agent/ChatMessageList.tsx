'use client';

import { RefObject } from 'react';
import { Bot, User, CheckCircle2, Copy, Check, Volume2, Square } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAtom } from 'jotai';
import { ChatMessage } from './types';
import { Button } from '@/components/ui/button';
import { ttsSpeakingIdAtom } from '@/lib/atoms';
import { playBackendTTS, stopTTS } from '@/lib/tts';

interface ChatMessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  copiedId: string | null;
  copyToClipboard: (text: string, id: string) => void;
  messagesEndRef: RefObject<HTMLDivElement | null>;
}

export function ChatMessageList({
  messages,
  isLoading,
  copiedId,
  copyToClipboard,
  messagesEndRef,
}: ChatMessageListProps) {
  const [speakingId, setSpeakingId] = useAtom(ttsSpeakingIdAtom);

  const handlePlayVoice = (msgId: string, text: string) => {
    if (speakingId === msgId) {
      stopTTS();
      setSpeakingId(null);
      return;
    }

    setSpeakingId(msgId);
    playBackendTTS(
      text,
      'en-US-JennyNeural',
      undefined,
      () => setSpeakingId(null),
      () => setSpeakingId(null)
    );
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex items-start gap-2.5 sm:gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
        >
          {/* Avatar Icon */}
          <div
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 border border-border ${
              msg.sender === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground'
            }`}
          >
            {msg.sender === 'user' ? <User className="w-4 h-4 sm:w-5 sm:h-5" /> : <Bot className="w-4 h-4 sm:w-5 sm:h-5" />}
          </div>

          {/* Bubble */}
          <div
            className={`max-w-[88%] sm:max-w-[80%] rounded-2xl p-3.5 sm:p-4 border transition-all ${
              msg.sender === 'user'
                ? 'bg-primary text-primary-foreground border-primary rounded-tr-none'
                : 'bg-card text-card-foreground border-border rounded-tl-none'
            }`}
          >
            <div className="flex items-center justify-between gap-4 mb-1.5 pb-1.5 border-b border-border text-[10px] sm:text-xs">
              <span className="font-semibold flex items-center gap-1 truncate">
                {msg.sender === 'user' ? 'You' : 'AURA Agent'}
                {msg.modelUsed && (
                  <span className="text-[9px] sm:text-[10px] text-muted-foreground font-mono hidden sm:inline">({msg.modelUsed})</span>
                )}
              </span>
              <span className="text-muted-foreground font-mono text-[9px] sm:text-[10px] shrink-0">{msg.timestamp}</span>
            </div>

            {/* Message Content */}
            <div className="prose prose-xs sm:prose-sm max-w-full overflow-x-auto leading-relaxed wrap-break-word">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  table: ({ children }) => (
                    <div className="my-3 overflow-x-auto rounded-lg border border-border bg-card shadow-xs">
                      <table className="w-full text-left text-xs border-collapse divide-y divide-border">{children}</table>
                    </div>
                  ),
                  thead: ({ children }) => (
                    <thead className="bg-muted/80 text-muted-foreground uppercase font-semibold text-[11px] tracking-wider">{children}</thead>
                  ),
                  tbody: ({ children }) => (
                    <tbody className="divide-y divide-border bg-card/50">{children}</tbody>
                  ),
                  tr: ({ children }) => (
                    <tr className="hover:bg-muted/30 transition-colors">{children}</tr>
                  ),
                  th: ({ children }) => (
                    <th className="px-3 py-2 text-[11px] font-semibold text-foreground/80">{children}</th>
                  ),
                  td: ({ children }) => (
                    <td className="px-3 py-2 text-foreground/90 font-mono text-[11px]">{children}</td>
                  ),
                  p: ({ children }) => (
                    <p className="mb-2 last:mb-0">{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>
                  ),
                  li: ({ children }) => (
                    <li className="text-inherit">{children}</li>
                  ),
                  code: ({ children }) => (
                    <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-[11px] text-primary">{children}</code>
                  ),
                }}
              >
                {msg.text}
              </ReactMarkdown>
            </div>

            {/* Hardware Action Pill */}
            {msg.actionTaken && (
              <div className="mt-2.5 pt-2 border-t border-border/80 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1 text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Hardware State Applied</span>
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="mt-2 pt-1.5 flex items-center justify-end gap-1 border-t border-border/40 text-muted-foreground">
              {/* Play Audio Button */}
              <button
                type="button"
                onClick={() => handlePlayVoice(msg.id, msg.text)}
                title={speakingId === msg.id ? "Stop voice" : "Read message aloud"}
                className={`p-1.5 rounded-lg hover:bg-muted/80 transition-colors ${
                  speakingId === msg.id ? "text-primary bg-primary/10" : ""
                }`}
              >
                {speakingId === msg.id ? (
                  <Square className="w-3.5 h-3.5 fill-current animate-pulse" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5" />
                )}
              </button>

              {/* Copy text button */}
              <button
                type="button"
                onClick={() => copyToClipboard(msg.text, msg.id)}
                title="Copy text"
                className="p-1.5 rounded-lg hover:bg-muted/80 transition-colors"
              >
                {copiedId === msg.id ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Loading indicator */}
      {isLoading && (
        <div className="flex items-start gap-2.5 sm:gap-3">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-muted border border-border flex items-center justify-center shrink-0">
            <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground animate-pulse" />
          </div>
          <div className="bg-card border border-border rounded-2xl rounded-tl-none p-3.5 sm:p-4 text-xs text-muted-foreground flex items-center gap-2 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
            <span>AURA is reasoning & contacting hardware...</span>
          </div>
        </div>
      )}

      {/* Auto-scroll target */}
      <div ref={messagesEndRef} />
    </div>
  );
}
