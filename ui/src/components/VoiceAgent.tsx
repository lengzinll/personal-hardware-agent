'use client';

import { useState, useEffect, useRef } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { toast } from 'sonner';
import { ChatMessage } from './agent/types';
import { VoiceAgentHeader } from './agent/VoiceAgentHeader';
import { ChatMessageList } from './agent/ChatMessageList';
import { ChatInputDock } from './agent/ChatInputDock';
import {
  engineModeAtom,
  selectedOllamaModelAtom,
  apiKeyAtom,
} from '@/lib/atoms';

interface VoiceAgentProps {
  onRefreshData?: () => void;
}

export function VoiceAgent({ onRefreshData }: VoiceAgentProps) {
  // Global Jotai Atoms
  const engineMode = useAtomValue(engineModeAtom);
  const [selectedOllamaModel, setSelectedOllamaModel] = useAtom(selectedOllamaModelAtom);
  const apiKey = useAtomValue(apiKeyAtom);

  // Local Component State
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'agent',
      text: "Hello! I'm AURA, your AI Hardware Agent. You can send commands to control the LED lights (e.g., 'Turn on red light', 'Turn off all lights', or 'Traffic sequence: green 10s then yellow 3s then red 5s').",
      timestamp: 'Just now',
      modelUsed: 'AURA Agent Engine',
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Fetch local Ollama models on mount
  useEffect(() => {
    fetch('/api/ollama/models')
      .then((res) => res.json())
      .then((data) => {
        if (data.models && data.models.length > 0) {
          const names = data.models.map((m: any) => (typeof m === 'string' ? m : m.name || m.model || String(m)));
          setOllamaModels(names);
          if (names.includes('ornith-1.5:9b')) {
            setSelectedOllamaModel('ornith-1.5:9b');
          } else if (names[0]) {
            setSelectedOllamaModel(names[0]);
          }
        }
      })
      .catch(() => { });
  }, [setSelectedOllamaModel]);

  const showSuccessToast = (title: string, message: string) => {
    toast.success(title, {
      description: message,
    });
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (msgText?: string) => {
    const textToSend = msgText || inputText;
    if (!textToSend.trim() || isLoading) return;

    const userText = textToSend.trim();
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: userText,
      timestamp: nowTime,
    };

    const historyPayload = messages
      .filter((m) => m.id !== 'welcome' && m.id !== 'welcome_reset' && m.text && m.text.trim())
      .slice(-10)
      .map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/agent/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: userText,
          apiKey: apiKey.trim(),
          engineMode,
          ollamaModel: selectedOllamaModel,
          history: historyPayload,
        }),
      });

      const data = await res.json();
      const modelDisplayName = engineMode === 'ollama' ? `Ollama (${selectedOllamaModel})` : 'Gemini Flash';
      const replyText = data.response || data.reply || data.text || 'No response text returned.';

      if (data.success) {
        const agentMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: 'agent',
          text: replyText,
          actionTaken: data.actionTaken,
          toolPayload: data.toolPayload || data.payload,
          modelUsed: modelDisplayName,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setMessages((prev) => [...prev, agentMsg]);

        if (data.actionTaken && !['ollama_chat_response', 'chat_response', 'general_command_processed'].includes(data.actionTaken)) {
          showSuccessToast('⚡ Action Executed', `Executed ${data.actionTaken} successfully.`);
          if (onRefreshData) onRefreshData();
        }
      } else {
        const errorMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: 'agent',
          text: `⚠️ ${data.error || 'Failed to process command. Make sure Ollama is running or Gemini API Key is set.'}`,
          modelUsed: modelDisplayName,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'agent',
        text: '❌ Network error connecting to AURA agent API.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const copyMessageToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: 'welcome_reset',
        sender: 'agent',
        text: 'Chat history cleared. How can I assist you with LED control?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: 'AURA Agent',
      },
    ]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-160px)] min-h-[500px] max-h-[850px] rounded-2xl border border-border bg-card/60 backdrop-blur-sm overflow-hidden shadow-sm">
      <VoiceAgentHeader
        ollamaModels={ollamaModels}
        clearChatHistory={handleClearHistory}
      />

      <ChatMessageList
        messages={messages}
        isLoading={isLoading}
        copiedId={copiedId}
        copyToClipboard={(text, id) => copyMessageToClipboard(id, text)}
        messagesEndRef={messagesEndRef}
      />

      <ChatInputDock
        inputText={inputText}
        setInputText={setInputText}
        isLoading={isLoading}
        handleSendMessage={() => handleSendMessage()}
      />
    </div>
  );
}
