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
  ttsEnabledAtom,
  ttsSpeakingIdAtom,
} from '@/lib/atoms';
import { playBackendTTS, stopTTS } from '@/lib/tts';

interface VoiceAgentProps {
  onRefreshData?: () => void;
}

export function VoiceAgent({ onRefreshData }: VoiceAgentProps) {
  // Global Jotai Atoms
  const engineMode = useAtomValue(engineModeAtom);
  const [selectedOllamaModel, setSelectedOllamaModel] = useAtom(selectedOllamaModelAtom);
  const ttsEnabled = useAtomValue(ttsEnabledAtom);
  const [, setSpeakingId] = useAtom(ttsSpeakingIdAtom);

  // Local Component State
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'agent',
      text: "SYSTEM INITIALIZED: AURA Neural Interface Online. Ready to process voice & text hardware commands (e.g., 'Turn on lamp', 'Turn on red light', 'Run traffic cycle green 10s yellow 3s red 5s').",
      timestamp: 'SYS_BOOT',
      modelUsed: 'AURA_SYNAPSE_CORE',
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (msgText?: string) => {
    const textToSend = msgText || inputText;
    if (!textToSend.trim() || isLoading) return;

    // Stop any existing TTS speech when user sends a new message
    stopTTS();
    setSpeakingId(null);

    const userText = textToSend.trim();
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

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
          engineMode,
          ollamaModel: selectedOllamaModel,
          history: historyPayload,
        }),
      });

      const data = await res.json();
      const modelDisplayName = engineMode === 'ollama' ? `OLLAMA:${selectedOllamaModel}` : 'GEMINI_FLASH';
      const replyText = data.response || data.reply || data.text || 'No response text returned.';
      const agentMsgId = (Date.now() + 1).toString();

      if (data.success) {
        const agentMsg: ChatMessage = {
          id: agentMsgId,
          sender: 'agent',
          text: replyText,
          actionTaken: data.actionTaken,
          toolPayload: data.toolPayload || data.payload,
          modelUsed: modelDisplayName,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        };

        setMessages((prev) => [...prev, agentMsg]);

        // Trigger TTS if enabled
        if (ttsEnabled && replyText) {
          setSpeakingId(agentMsgId);
          playBackendTTS(replyText, 'en-US-JennyNeural', undefined, () => {
            setSpeakingId(null);
          });
        }

        if (data.actionTaken) {
          toast.success('⚡ HARDWARE_COMMITTED', { description: replyText });
          if (onRefreshData) onRefreshData();
        }
      } else {
        const errMsg = data.error || data.message || 'Failed to process command';
        const errorAgentMsg: ChatMessage = {
          id: agentMsgId,
          sender: 'agent',
          text: `⚠️ **EXECUTION_ERROR**: ${errMsg}`,
          modelUsed: modelDisplayName,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        };
        setMessages((prev) => [...prev, errorAgentMsg]);
        toast.error('COMMAND_FAILED', { description: errMsg });
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'agent',
        text: `⚠️ **COMMUNICATION_LINK_FAILURE**: ${err.message || 'Host offline'}`,
        modelUsed: 'BUS_ERROR',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
      toast.error('LINK_OFFLINE');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyMessage = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('BUFFER_COPIED');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearHistory = () => {
    stopTTS();
    setSpeakingId(null);
    setMessages([
      {
        id: 'welcome_reset',
        sender: 'agent',
        text: "LOGS PURGED. Neural registers clear.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: 'AURA_SYNAPSE_CORE',
      },
    ]);
    toast.info('BUFFER_PURGED');
  };

  return (
    <div className="hud-panel flex flex-col flex-1 h-full min-h-0 rounded-sm overflow-hidden">
      {/* Header */}
      <div className="shrink-0">
        <VoiceAgentHeader
          ollamaModels={ollamaModels}
          clearChatHistory={handleClearHistory}
        />
      </div>

      {/* Message Stream */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <ChatMessageList
          messages={messages}
          isLoading={isLoading}
          copiedId={copiedId}
          copyToClipboard={handleCopyMessage}
          messagesEndRef={messagesEndRef}
        />
      </div>

      {/* Input Dock */}
      <div className="shrink-0">
        <ChatInputDock
          inputText={inputText}
          setInputText={setInputText}
          isLoading={isLoading}
          handleSendMessage={() => handleSendMessage()}
        />
      </div>
    </div>
  );
}
