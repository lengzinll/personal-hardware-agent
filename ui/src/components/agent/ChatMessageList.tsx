'use client';

import { RefObject } from 'react';
import { Bot, User, CheckCircle2, Copy, Check, Volume2, Square } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAtom } from 'jotai';
import { ChatMessage } from './types';
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
    <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 space-y-3.5 font-sans">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex items-start gap-2.5 ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
        >
          {/* Avatar Tag */}
          <div
            className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 border text-xs font-medium select-none ${
              msg.sender === 'user'
                ? 'bg-[#2a2a2a] text-[#ecebed] border-[#383838]'
                : 'bg-[#262626] text-[#ecebed] border-[#333333]'
            }`}
          >
            {msg.sender === 'user' ? '👤' : '🤖'}
          </div>

          {/* Notion Message Bubble */}
          <div
            className={`max-w-[90%] sm:max-w-[85%] rounded-xl p-3 sm:p-3.5 border transition-all text-sm leading-relaxed ${
              msg.sender === 'user'
                ? 'bg-[#272727] text-[#ecebed] border-[#383838]'
                : 'bg-[#202020] text-[#e3e2de] border-[#2e2e2e]'
            }`}
          >
            {/* Header Line */}
            <div className="flex items-center justify-between gap-3 mb-1.5 pb-1 border-b border-[#2e2e2e] text-xs">
              <span className="font-medium text-[#ecebed] flex items-center gap-1.5">
                {msg.sender === 'user' ? 'You' : 'Johnwick'}
                {msg.modelUsed && (
                  <span className="text-[11px] text-[#8f8e8a] font-normal hidden sm:inline">• {msg.modelUsed}</span>
                )}
              </span>
              <span className="text-[11px] text-[#787774]">{msg.timestamp}</span>
            </div>

            {/* Content: If empty / waiting for first token */}
            {!msg.text ? (
              <div className="flex items-center gap-2 text-[#9b9a97] py-1 text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                <span className="animate-pulse">Thinking & generating response...</span>
              </div>
            ) : (
              <div className="prose prose-invert max-w-full text-xs sm:text-sm leading-relaxed text-[#e3e2de] space-y-2">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    table: ({ children }) => (
                      <div className="my-2 overflow-x-auto rounded-md border border-[#333333] bg-[#242424]">
                        <table className="w-full text-left text-xs border-collapse divide-y divide-[#333333]">{children}</table>
                      </div>
                    ),
                    thead: ({ children }) => (
                      <thead className="bg-[#2a2a2a] text-[#ecebed] font-medium text-xs">{children}</thead>
                    ),
                    tbody: ({ children }) => (
                      <tbody className="divide-y divide-[#2e2e2e]">{children}</tbody>
                    ),
                    tr: ({ children }) => (
                      <tr className="hover:bg-[#282828] transition-colors">{children}</tr>
                    ),
                    th: ({ children }) => (
                      <th className="px-2.5 py-1.5 font-medium text-[#ecebed]">{children}</th>
                    ),
                    td: ({ children }) => (
                      <td className="px-2.5 py-1.5 text-[#e3e2de] font-mono text-xs">{children}</td>
                    ),
                    p: ({ children }) => (
                      <p className="mb-1.5 last:mb-0 leading-normal">
                        {children}
                        {msg.isStreaming && (
                          <span className="inline-block w-1.5 h-3.5 bg-emerald-400 animate-pulse ml-1 align-middle" />
                        )}
                      </p>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc pl-5 mb-2 space-y-1 text-[#e3e2de]">{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal pl-5 mb-2 space-y-1 text-[#e3e2de]">{children}</ol>
                    ),
                    li: ({ children }) => (
                      <li className="text-inherit">{children}</li>
                    ),
                    code: ({ children }) => (
                      <code className="px-1.5 py-0.5 rounded bg-[#272727] text-[#eb5757] font-mono text-xs border border-[#383838]">{children}</code>
                    ),
                  }}
                >
                  {msg.text}
                </ReactMarkdown>
              </div>
            )}

            {/* Hardware State Execution Pill (Notion Callout) */}
            {msg.actionTaken && (
              <div className="mt-2.5 pt-2 border-t border-[#2e2e2e] flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-[#81c784] font-medium bg-[#1e2920] px-2.5 py-1 rounded-md border border-[#2e4030]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Hardware updated: {msg.actionTaken}</span>
                </div>
              </div>
            )}

            {/* Action Bar: Copy & Speak buttons */}
            {!msg.isStreaming && msg.text && (
              <div className="mt-2 pt-1.5 flex items-center justify-end gap-1.5 border-t border-[#2a2a2a] text-[#787774]">
                <button
                  type="button"
                  onClick={() => handlePlayVoice(msg.id, msg.text)}
                  title={speakingId === msg.id ? "Stop voice" : "Read aloud"}
                  className={`p-1 rounded-md hover:bg-[#2c2c2c] hover:text-[#ecebed] transition-colors cursor-pointer ${
                    speakingId === msg.id ? "text-emerald-400 bg-[#282828]" : ""
                  }`}
                >
                  {speakingId === msg.id ? (
                    <Square className="w-3.5 h-3.5 fill-current text-emerald-400" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => copyToClipboard(msg.text, msg.id)}
                  title="Copy text"
                  className="p-1 rounded-md hover:bg-[#2c2c2c] hover:text-[#ecebed] transition-colors cursor-pointer"
                >
                  {copiedId === msg.id ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      ))}

      <div ref={messagesEndRef} />
    </div>
  );
}
