'use client';

import { RefObject } from 'react';
import { Bot, User, CheckCircle2, Copy, Check, Volume2, Square, Terminal, ShieldAlert } from 'lucide-react';
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
    <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3 font-mono">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex items-start gap-2.5 ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
        >
          {/* Avatar Tag */}
          <div
            className={`w-7 h-7 rounded-xs flex items-center justify-center shrink-0 border text-xs font-bold ${
              msg.sender === 'user'
                ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400 shadow-[0_0_8px_rgba(0,240,255,0.4)]'
                : 'bg-cyan-950/80 text-cyan-300 border-cyan-500/50 shadow-[0_0_8px_rgba(0,240,255,0.2)]'
            }`}
          >
            {msg.sender === 'user' ? 'USR' : 'AI'}
          </div>

          {/* Holographic Chat Bubble */}
          <div
            className={`max-w-[90%] sm:max-w-[85%] rounded-xs p-3 border transition-all text-xs relative ${
              msg.sender === 'user'
                ? 'bg-cyan-950/60 text-cyan-100 border-cyan-500/60 shadow-[0_0_10px_rgba(0,240,255,0.15)]'
                : 'bg-slate-950/80 text-cyan-200 border-cyan-500/30'
            }`}
          >
            {/* Header Line */}
            <div className="flex items-center justify-between gap-4 mb-1.5 pb-1 border-b border-cyan-500/20 text-[10px]">
              <span className="font-bold flex items-center gap-1.5 text-cyan-300">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_4px_#00f0ff]" />
                {msg.sender === 'user' ? 'OPERATOR_TRANSMISSION' : 'JOHNWICK_SYNAPSE_CORE'}
                {msg.modelUsed && (
                  <span className="text-xs text-cyan-500/80 font-mono hidden sm:inline">[{msg.modelUsed}]</span>
                )}
              </span>
            </div>

            {/* Content: If empty / waiting for first token, show SYNAPSE_PROCESSING in place */}
            {!msg.text ? (
              <div className="flex items-center gap-2 text-cyan-300 py-1">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
                <span className="tracking-wider text-[11px] animate-pulse text-cyan-300 font-bold">
                  SYNAPSE_PROCESSING...
                </span>
              </div>
            ) : (
              <div className="prose prose-invert max-w-full leading-relaxed wrap-break-word text-cyan-100 text-xs">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    table: ({ children }) => (
                      <div className="my-2 overflow-x-auto rounded-xs border border-cyan-500/40 bg-cyan-950/40">
                        <table className="w-full text-left text-[11px] border-collapse divide-y divide-cyan-500/30">{children}</table>
                      </div>
                    ),
                    thead: ({ children }) => (
                      <thead className="bg-cyan-900/40 text-cyan-300 uppercase font-semibold text-[10px] tracking-wider">{children}</thead>
                    ),
                    tbody: ({ children }) => (
                      <tbody className="divide-y divide-cyan-500/20 bg-slate-950/40">{children}</tbody>
                    ),
                    tr: ({ children }) => (
                      <tr className="hover:bg-cyan-500/10 transition-colors">{children}</tr>
                    ),
                    th: ({ children }) => (
                      <th className="px-2 py-1.5 text-[10px] font-semibold text-cyan-200">{children}</th>
                    ),
                    td: ({ children }) => (
                      <td className="px-2 py-1.5 text-cyan-100 font-mono text-[10px]">{children}</td>
                    ),
                    p: ({ children }) => (
                      <p className="mb-1.5 last:mb-0 leading-normal">
                        {children}
                        {msg.isStreaming && (
                          <span className="inline-block w-1.5 h-3 bg-cyan-400 animate-pulse ml-1 align-middle shadow-[0_0_6px_#00f0ff]" />
                        )}
                      </p>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc pl-4 mb-1.5 space-y-0.5 text-cyan-200">{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal pl-4 mb-1.5 space-y-0.5 text-cyan-200">{children}</ol>
                    ),
                    li: ({ children }) => (
                      <li className="text-inherit">{children}</li>
                    ),
                    code: ({ children }) => (
                      <code className="px-1 py-0.5 rounded-xs bg-cyan-950 border border-cyan-500/40 font-mono text-[10px] text-cyan-300">{children}</code>
                    ),
                  }}
                >
                  {msg.text}
                </ReactMarkdown>
              </div>
            )}

            {/* Hardware State Execution Pill */}
            {msg.actionTaken && (
              <div className="mt-2 pt-1.5 border-t border-cyan-500/30 flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-1.5 text-emerald-300 font-bold">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 animate-pulse" />
                  <span>HARDWARE_REGISTERS_UPDATED</span>
                </div>
              </div>
            )}

            {/* Action Bar: Shown when not streaming and has text */}
            {!msg.isStreaming && msg.text && (
              <div className="mt-1.5 pt-1 flex items-center justify-end gap-1.5 border-t border-cyan-500/20 text-cyan-500">
                <button
                  type="button"
                  onClick={() => handlePlayVoice(msg.id, msg.text)}
                  title={speakingId === msg.id ? "HALT_SYNTH_VOICE" : "READ_AUDIO_TRANSMISSION"}
                  className={`p-1 rounded-xs hover:bg-cyan-500/20 hover:text-cyan-200 transition-colors cursor-pointer ${
                    speakingId === msg.id ? "text-cyan-300 bg-cyan-500/30" : ""
                  }`}
                >
                  {speakingId === msg.id ? (
                    <Square className="w-3 h-3 fill-current animate-pulse text-cyan-400" />
                  ) : (
                    <Volume2 className="w-3 h-3" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => copyToClipboard(msg.text, msg.id)}
                  title="COPY_PAYLOAD"
                  className="p-1 rounded-xs hover:bg-cyan-500/20 hover:text-cyan-200 transition-colors cursor-pointer"
                >
                  {copiedId === msg.id ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
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
