'use client';

import { RefObject } from 'react';
import { Bot, User, CheckCircle2, Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatMessage } from './types';
import { Button } from '@/components/ui/button';

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
  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
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
                    <th className="px-3.5 py-2.5 font-semibold text-foreground border-r border-border last:border-r-0 whitespace-nowrap">{children}</th>
                  ),
                  td: ({ children }) => (
                    <td className="px-3.5 py-2 border-r border-border last:border-r-0 text-foreground/90 leading-normal">{children}</td>
                  ),
                }}
              >
                {msg.text}
              </ReactMarkdown>
            </div>

            {/* Action Badge for actual Tool Executions */}
            {msg.actionTaken && !['ollama_chat_response', 'chat_response', 'general_command_processed'].includes(msg.actionTaken) && (
              <div className="mt-3 pt-2 border-t border-border flex items-center justify-between text-xs">
                <span className="px-2.5 py-1 rounded-lg bg-muted border border-border text-foreground font-medium text-[10px] sm:text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>Tool Action: {msg.actionTaken}</span>
                </span>
              </div>
            )}

            {/* Toolbar Actions */}
            <div className="mt-2.5 flex items-center justify-end gap-1.5 pt-1.5 border-t border-border">
              <Button
                size="xs"
                variant="ghost"
                onClick={() => copyToClipboard(msg.text, msg.id)}
                className="gap-1 text-[10px] sm:text-xs"
                title="Copy message"
              >
                {copiedId === msg.id ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 shrink-0" />
                    <span>Copy</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      ))}

      {/* Loading indicator */}
      {isLoading && (
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center border border-border">
            <Bot className="w-4 h-4 text-primary animate-pulse" />
          </div>
          <div className="bg-card border border-border rounded-2xl rounded-tl-none p-3 text-xs text-muted-foreground flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-primary animate-ping" />
            <span>Thinking & processing command...</span>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}
