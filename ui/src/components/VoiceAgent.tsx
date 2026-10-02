'use client';

import { useState, useEffect, useRef } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { GeminiLiveClient } from '@/lib/gemini-live-client';
import { toast } from 'sonner';
import { ChatMessage } from './agent/types';
import { VoiceAgentHeader } from './agent/VoiceAgentHeader';
import { VoiceAgentSettings } from './agent/VoiceAgentSettings';
import { ChatMessageList } from './agent/ChatMessageList';
import { ChatInputDock } from './agent/ChatInputDock';
import {
  engineModeAtom,
  selectedOllamaModelAtom,
  apiKeyAtom,
  autoSpeakAtom,
  showSettingsAtom,
  speechRateAtom,
} from '@/lib/atoms';

interface VoiceAgentProps {
  onRefreshData?: () => void;
}

export function VoiceAgent({ onRefreshData }: VoiceAgentProps) {
  // Global Jotai Atoms
  const engineMode = useAtomValue(engineModeAtom);
  const [selectedOllamaModel, setSelectedOllamaModel] = useAtom(selectedOllamaModelAtom);
  const apiKey = useAtomValue(apiKeyAtom);
  const autoSpeak = useAtomValue(autoSpeakAtom);
  const setShowSettings = useSetAtom(showSettingsAtom);
  const speechRate = useAtomValue(speechRateAtom);

  // Local Component State
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [geminiStatus, setGeminiStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'listening' | 'speaking' | 'executing_tool'>('disconnected');
  const geminiClientRef = useRef<GeminiLiveClient | null>(null);

  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeSpeakingMsgId, setActiveSpeakingMsgId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [inputText, setInputText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'agent',
      text: "Hello! I'm AURA, your personal AI Copilot. You can talk to me via voice or chat to control the LED light (e.g., 'Turn on the light', 'Turn off the light', or 'Check light status').",
      timestamp: 'Just now',
      modelUsed: 'FastAPI Agent Engine',
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);

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

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const updateVoices = () => {
      const availVoices = window.speechSynthesis.getVoices();
      setVoices(availVoices);
      const englishVoice = availVoices.find((v) => v.lang.includes('en') && (v.name.includes('Google') || v.name.includes('Natural')));
      if (englishVoice) setSelectedVoice(englishVoice);
    };

    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;
  }, []);

  const toggleGeminiLive = async () => {
    if (geminiStatus === 'connected' || geminiStatus === 'listening' || geminiStatus === 'speaking') {
      geminiClientRef.current?.disconnect();
      geminiClientRef.current = null;
      setGeminiStatus('disconnected');
    } else {
      if (!apiKey.trim()) {
        setShowSettings(true);
        alert('Please enter your Gemini API Key in settings to enable Gemini Live Audio!');
        return;
      }

      const client = new GeminiLiveClient({
        apiKey,
        onStatusChange: (status) => setGeminiStatus(status),
        onToolExecuted: (toolName, args, result) => {
          const agentMsg: ChatMessage = {
            id: Date.now().toString(),
            sender: 'agent',
            text: `⚡ Executed tool function: ${toolName}`,
            actionTaken: `tool_${toolName}`,
            toolPayload: result,
            modelUsed: 'Gemini Live Audio',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          setMessages((prev) => [...prev, agentMsg]);
          showSuccessToast('⚡ Gemini Tool Executed', `Executed ${toolName}`);
        },
        onDataRefresh: () => {
          if (onRefreshData) onRefreshData();
        },
      });

      client.connect();
      geminiClientRef.current = client;
    }
  };

  const toggleListening = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. You can type commands directly in the input box.');
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (err) { }
      recognitionRef.current = null;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let fullTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          fullTranscript += event.results[i][0].transcript;
        }
        setTranscript(fullTranscript);
        setInputText(fullTranscript);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        toast.error('Speech recognition error: ' + event.error);
        if (event.error !== 'aborted') {
          setIsListening(false);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      setTranscript('');
      setInputText('');
      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setIsListening(false);
    }
  };

  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  const splitTextIntoChunks = (text: string, maxLength = 170): string[] => {
    if (!text || text.trim().length === 0) return [];
    const rawSegments = text.split(/(?<=[.!?:\\n;—])\s+/);
    const chunks: string[] = [];
    let current = '';

    for (const segment of rawSegments) {
      const cleanSeg = segment.trim();
      if (!cleanSeg) continue;
      if ((current + ' ' + cleanSeg).trim().length <= maxLength) {
        current = (current + ' ' + cleanSeg).trim();
      } else {
        if (current.trim()) chunks.push(current.trim());
        current = cleanSeg;
      }
    }
    if (current.trim()) chunks.push(current.trim());

    const finalChunks: string[] = [];
    for (const c of chunks) {
      if (c.length <= maxLength) {
        finalChunks.push(c);
      } else {
        const words = c.split(' ');
        let temp = '';
        for (const w of words) {
          if ((temp + ' ' + w).trim().length <= maxLength) {
            temp = (temp + ' ' + w).trim();
          } else {
            if (temp.trim()) finalChunks.push(temp.trim());
            temp = w;
          }
        }
        if (temp.trim()) finalChunks.push(temp.trim());
      }
    }

    return finalChunks.filter((chunk) => chunk.trim().length > 0);
  };

  const isStopRef = useRef(false);

  const stopSpeaking = () => {
    isStopRef.current = true;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current.currentTime = 0;
      activeAudioRef.current = null;
    }
    setIsSpeaking(false);
    setActiveSpeakingMsgId(null);
  };

  const playAudioChunk = (text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (isStopRef.current) {
        resolve();
        return;
      }
      try {
        const audioUrl = `/api/tts?text=${encodeURIComponent(text)}`;
        const audio = new Audio(audioUrl);
        audio.playbackRate = speechRate;
        audio.defaultPlaybackRate = speechRate;
        activeAudioRef.current = audio;

        audio.onended = () => {
          activeAudioRef.current = null;
          resolve();
        };

        audio.onerror = () => {
          activeAudioRef.current = null;
          fallbackWebSpeechChunk(text).then(resolve);
        };

        audio.play().catch(() => {
          fallbackWebSpeechChunk(text).then(resolve);
        });
      } catch (err) {
        fallbackWebSpeechChunk(text).then(resolve);
      }
    });
  };

  const fallbackWebSpeechChunk = (text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (isStopRef.current || typeof window === 'undefined' || !('speechSynthesis' in window)) {
        resolve();
        return;
      }

      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();

      const utterance = new SpeechSynthesisUtterance(text);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      } else {
        const avail = window.speechSynthesis.getVoices();
        const enVoice = avail.find((v) => v.lang.includes('en'));
        if (enVoice) utterance.voice = enVoice;
      }
      utterance.rate = speechRate;
      utterance.pitch = 1.0;

      utterance.onend = () => resolve();
      utterance.onerror = (e) => {
        if (e.error !== 'canceled' && e.error !== 'interrupted') {
          console.warn('SpeechSynthesis fallback error:', e.error);
        }
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  };

  const speakText = async (text: string, msgId?: string) => {
    if (activeSpeakingMsgId === msgId && isSpeaking) {
      stopSpeaking();
      return;
    }

    stopSpeaking();
    isStopRef.current = false;

    if (!text || !text.trim()) return;

    const cleanedText = text
      .replace(/[\*\_\\#\`\-\+\>]/g, ' ')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanedText) return;

    setIsSpeaking(true);
    if (msgId) setActiveSpeakingMsgId(msgId);

    const chunks = splitTextIntoChunks(cleanedText, 170);

    for (const chunk of chunks) {
      if (isStopRef.current) break;
      await playAudioChunk(chunk);
    }

    if (!isStopRef.current) {
      setIsSpeaking(false);
      setActiveSpeakingMsgId(null);
    }
  };

  const handleSendMessage = async (msgText?: string) => {
    const textToSend = msgText || inputText;
    if (!textToSend.trim() || isLoading) return;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (err) { }
      recognitionRef.current = null;
    }
    setIsListening(false);

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
    setTranscript('');
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

        if (autoSpeak && replyText) {
          speakText(replyText, agentMsg.id);
        }
      } else {
        const errorMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: 'agent',
          text: `⚠️ ${data.error || 'Failed to process command. Make sure Ollama or Gemini API Key is configured.'}`,
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
        text: 'Chat history cleared. How can I assist you with your LED light control?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: 'AURA Agent',
      },
    ]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-160px)] min-h-[500px] max-h-[850px] rounded-2xl border border-border bg-card/60 backdrop-blur-sm overflow-hidden shadow-sm">
      <VoiceAgentHeader
        isSpeaking={isSpeaking}
        stopSpeaking={stopSpeaking}
        clearChatHistory={handleClearHistory}
      />

      <VoiceAgentSettings
        ollamaModels={ollamaModels}
      />

      <ChatMessageList
        messages={messages}
        isLoading={isLoading}
        activeSpeakingMsgId={activeSpeakingMsgId}
        isSpeaking={isSpeaking}
        copiedId={copiedId}
        speakText={speakText}
        stopSpeaking={stopSpeaking}
        copyToClipboard={(text, id) => copyMessageToClipboard(id, text)}
        messagesEndRef={messagesEndRef}
      />

      <ChatInputDock
        isListening={isListening}
        toggleListening={toggleListening}
        inputText={inputText}
        setInputText={setInputText}
        isLoading={isLoading}
        handleSendMessage={() => handleSendMessage()}
      />
    </div>
  );
}
