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
import { useLedWebSocket } from '@/lib/useLedWebSocket';
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
      text: "👋 **Hello!** I'm your Johnwick Assistant. I can control your physical lights and relays via voice or chat.\n\n**Try saying or typing:**\n- *\"Turn on the green light\"*\n- *\"Turn on desk lamp\"*\n- *\"Run traffic cycle: green 10s, yellow 3s, red 5s\"*\n- *\"Check status\"*",
      modelUsed: 'Assistant',
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
  const [sessionState, setSessionState] = useAtom(realtimeSessionStateAtom);

  const { sendAgentCommand } = useLedWebSocket();
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
        const res = await fetch('/api/system/ollama/models');
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

  // Handle incoming / streaming message from realtime voice hook or WebSocket
  const handleNewRealtimeMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === msg.id);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...msg };
        return next;
      }
      return [...prev, msg];
    });
  }, []);

  // Handle transcript change from speech recognition
  const handleTranscriptChange = useCallback((liveText: string) => {
    setInputText(liveText);
  }, []);

  // Realtime two-way voice hook
  const { toggleRealtime, manualPushToTalk, handleInterrupt } = useRealtimeSession({
    onNewMessage: handleNewRealtimeMessage,
    onRefreshData,
    onTranscriptChange: handleTranscriptChange,
    sendAgentCommand,
    messages,
  });

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userText = inputText.trim();
    setInputText('');
    setIsLoading(true);
    setSessionState('processing');

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

    const agentMsgId = (Date.now() + 1).toString();
    const modelDisplayName = engineMode === 'ollama' ? `Ollama (${selectedOllamaModel})` : 'Gemini Flash';

    try {
      // Send agent command over WebSocket with real-time UI token streaming
      const data = await sendAgentCommand({
        command: userText,
        engineMode,
        ollamaModel: selectedOllamaModel,
        history: historyPayload,
        onStreamStart: () => {
          setSessionState('speaking');
          handleNewRealtimeMessage({
            id: agentMsgId,
            sender: 'agent',
            text: '',
            isStreaming: true,
            modelUsed: modelDisplayName,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          });
        },
        onStreamChunk: (_chunk, accumulated) => {
          handleNewRealtimeMessage({
            id: agentMsgId,
            sender: 'agent',
            text: accumulated,
            isStreaming: true,
            modelUsed: modelDisplayName,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          });
        },
        onActionTaken: (action, payload) => {
          handleNewRealtimeMessage({
            id: agentMsgId,
            sender: 'agent',
            text: '',
            isStreaming: true,
            actionTaken: action,
            toolPayload: payload,
            modelUsed: modelDisplayName,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          });
        },
      });

      const replyText = data.response || data.reply || data.text || '';
      const isSuccess = data.success === true || (data.success !== false && !data.error && !!replyText);

      if (isSuccess && replyText) {
        const agentMsg: ChatMessage = {
          id: agentMsgId,
          sender: 'agent',
          text: replyText,
          isStreaming: false,
          actionTaken: data.actionTaken,
          toolPayload: data.toolPayload || data.payload || data.result,
          modelUsed: modelDisplayName,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        };

        handleNewRealtimeMessage(agentMsg);

        if (data.actionTaken) {
          toast.success('Action executed', { description: replyText });
          if (onRefreshData) onRefreshData();
        }

        // Trigger TTS playback if enabled
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
      } else {
        const errMsg = data.error || data.message || 'Failed to process command';
        const errorAgentMsg: ChatMessage = {
          id: agentMsgId,
          sender: 'agent',
          text: `⚠️ **Error**: ${errMsg}`,
          isStreaming: false,
          modelUsed: modelDisplayName,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        };
        handleNewRealtimeMessage(errorAgentMsg);
        toast.error('Command failed', { description: errMsg });
      }
    } catch (err: any) {
      const errorAgentMsg: ChatMessage = {
        id: agentMsgId,
        sender: 'agent',
        text: `⚠️ **Connection Error**: ${err?.message || 'Could not reach server'}`,
        isStreaming: false,
        modelUsed: modelDisplayName,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      };
      handleNewRealtimeMessage(errorAgentMsg);
      toast.error('Network error', { description: err?.message || 'Please check connection' });
    } finally {
      setIsLoading(false);
      setSessionState('standby');
    }
  };

  const handleCopyMessage = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearChatHistory = () => {
    setMessages([
      {
        id: 'welcome_reset',
        sender: 'agent',
        text: 'Chat history cleared. How can I help you next?',
        modelUsed: 'Assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      },
    ]);
    toast.info('Chat history cleared');
  };

  return (
    <div className="flex flex-col h-full bg-[#202020] border border-[#2e2e2e] rounded-lg overflow-hidden shadow-xs">
      {/* Header */}
      <VoiceAgentHeader
        ollamaModels={ollamaModels}
        clearChatHistory={handleClearChatHistory}
      />

      {/* Realtime Status Bar */}
      <RealtimeStatusBar
        toggleRealtime={toggleRealtime}
        manualPushToTalk={manualPushToTalk}
        handleInterrupt={handleInterrupt}
      />

      {/* Messages */}
      <ChatMessageList
        messages={messages}
        isLoading={isLoading}
        copiedId={copiedId}
        copyToClipboard={handleCopyMessage}
        messagesEndRef={messagesEndRef}
      />

      {/* Input Dock */}
      <ChatInputDock
        inputText={inputText}
        setInputText={setInputText}
        isLoading={isLoading}
        handleSendMessage={handleSendMessage}
      />
    </div>
  );
}
