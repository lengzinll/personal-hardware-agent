'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { toast } from 'sonner';
import {
  engineModeAtom,
  selectedOllamaModelAtom,
  ttsEnabledAtom,
  ttsSpeakingIdAtom,
  realtimeSessionStateAtom,
} from '@/lib/atoms';
import { playBackendTTS, stopTTS } from '@/lib/tts';
import { useRealtimeSession } from '@/lib/useRealtimeSession';
import { ChatMessage } from './agent/types';
import { VoiceAgentHeader } from './agent/VoiceAgentHeader';
import { ChatMessageList } from './agent/ChatMessageList';
import { ChatInputDock } from './agent/ChatInputDock';
import { RealtimeStatusBar } from './agent/RealtimeStatusBar';

interface VoiceAgentProps {
  onRefreshData?: () => void;
}

export function VoiceAgent({ onRefreshData }: VoiceAgentProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'agent',
      text: "SYSTEM INITIALIZED: Johnwick Neural Interface Online. Speak any command (e.g. 'Turn on lamp', 'Turn on red light', 'Run traffic cycle green 10s yellow 3s red 5s').",
      modelUsed: 'JOHNWICK_SYNAPSE_CORE',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const engineMode = useAtomValue(engineModeAtom);
  const [selectedOllamaModel, setSelectedOllamaModel] = useAtom(selectedOllamaModelAtom);
  const ttsEnabled = useAtomValue(ttsEnabledAtom);
  const [, setSpeakingId] = useAtom(ttsSpeakingIdAtom);
  const sessionState = useAtomValue(realtimeSessionStateAtom);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, sessionState]);

  // Fetch Ollama models
  useEffect(() => {
    async function fetchModels() {
      try {
        const res = await fetch('/api/system/ollama-models');
        if (res.ok) {
          const data = await res.json();
          if (data.models && data.models.length > 0) {
            setOllamaModels(data.models);
            if (!selectedOllamaModel || !data.models.includes(selectedOllamaModel)) {
              setSelectedOllamaModel(data.models[0]);
            }
          }
        }
      } catch (err) {
        console.warn('Could not fetch Ollama models:', err);
      }
    }
    fetchModels();
  }, [setSelectedOllamaModel, selectedOllamaModel]);

  // Handle incoming message from realtime voice hook
  const handleNewRealtimeMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  // Handle transcript change from speech recognition
  const handleTranscriptChange = useCallback((liveText: string) => {
    setInputText(liveText);
  }, []);

  // Realtime two-way voice hook with auto-fill into input box
  const { toggleRealtime, manualPushToTalk, handleInterrupt } = useRealtimeSession({
    onNewMessage: handleNewRealtimeMessage,
    onRefreshData,
    onTranscriptChange: handleTranscriptChange,
    messages,
  });

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userText = inputText.trim();
    setInputText('');
    setIsLoading(true);

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);

    const historyPayload = messages
      .filter((m) => m.id !== 'welcome' && m.id !== 'welcome_reset' && m.text && m.text.trim())
      .slice(-10)
      .map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));

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
      const replyText = data.response || data.reply || data.text || '';
      const isSuccess = data.success === true || (data.success !== false && !data.error && !!replyText);
      const agentMsgId = (Date.now() + 1).toString();

      if (isSuccess && replyText) {
        const agentMsg: ChatMessage = {
          id: agentMsgId,
          sender: 'agent',
          text: replyText,
          actionTaken: data.actionTaken,
          toolPayload: data.toolPayload || data.payload || data.result,
          modelUsed: modelDisplayName,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        };

        setMessages((prev) => [...prev, agentMsg]);

        // Trigger TTS if enabled
        if (ttsEnabled && replyText) {
          setSpeakingId(agentMsgId);
          playBackendTTS(
            replyText,
            'en-US-JennyNeural',
            undefined,
            () => {
              setSpeakingId(null);
            },
            () => {
              setSpeakingId(null);
            }
          );
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
        text: `⚠️ **SYSTEM_FAULT**: ${err.message || 'Network failure'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyMessage = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('COPIED_TO_CLIPBOARD');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearChatHistory = () => {
    stopTTS();
    setSpeakingId(null);
    setMessages([
      {
        id: 'welcome_reset',
        sender: 'agent',
        text: 'LOGS PURGED. Neural registers clear. Speak any command anytime.',
        modelUsed: 'JOHNWICK_SYNAPSE_CORE',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      },
    ]);
    toast.info('BUFFER_RESET');
  };

  return (
    <div className="flex flex-col h-full bg-slate-950/90 border border-cyan-500/40 rounded-xs overflow-hidden shadow-[0_0_20px_rgba(0,240,255,0.15)] backdrop-blur-md">
      {/* HUD Header */}
      <VoiceAgentHeader
        ollamaModels={ollamaModels}
        clearChatHistory={handleClearChatHistory}
      />

      {/* Realtime Status Ribbon */}
      <RealtimeStatusBar
        toggleRealtime={toggleRealtime}
        manualPushToTalk={manualPushToTalk}
        handleInterrupt={handleInterrupt}
      />

      {/* Main Terminal Message Feed */}
      <ChatMessageList
        messages={messages}
        isLoading={isLoading}
        copiedId={copiedId}
        copyToClipboard={handleCopyMessage}
        messagesEndRef={messagesEndRef}
      />

      {/* Command Input Dock */}
      <ChatInputDock
        inputText={inputText}
        setInputText={setInputText}
        isLoading={isLoading}
        handleSendMessage={handleSendMessage}
      />
    </div>
  );
}
