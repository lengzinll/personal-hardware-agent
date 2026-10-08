'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { toast } from 'sonner';
import { AudioRecorder } from './audio-recorder';
import { playBackendTTS, stopTTS } from './tts';
import {
  realtimeEnabledAtom,
  realtimeSessionStateAtom,
  realtimeVolumeAtom,
  wakeWordAtom,
  lastHeardTranscriptAtom,
  engineModeAtom,
  selectedOllamaModelAtom,
  ttsEnabledAtom,
  ttsSpeakingIdAtom,
  RealtimeSessionState,
} from './atoms';
import { ChatMessage } from '@/components/agent/types';
import { AgentCommandOptions, AgentCommandResult } from './useLedWebSocket';

interface UseRealtimeSessionProps {
  onNewMessage?: (message: ChatMessage) => void;
  onRefreshData?: () => void;
  onTranscriptChange?: (transcript: string) => void;
  sendAgentCommand?: (options: AgentCommandOptions) => Promise<AgentCommandResult>;
  messages: ChatMessage[];
}

export function useRealtimeSession({
  onNewMessage,
  onRefreshData,
  onTranscriptChange,
  sendAgentCommand,
  messages,
}: UseRealtimeSessionProps) {
  const [realtimeEnabled, setRealtimeEnabled] = useAtom(realtimeEnabledAtom);
  const [sessionState, setSessionState] = useAtom(realtimeSessionStateAtom);
  const [, setVolume] = useAtom(realtimeVolumeAtom);
  const wakeWord = useAtomValue(wakeWordAtom);
  const [, setLastHeard] = useAtom(lastHeardTranscriptAtom);
  const engineMode = useAtomValue(engineModeAtom);
  const selectedOllamaModel = useAtomValue(selectedOllamaModelAtom);
  const ttsEnabled = useAtomValue(ttsEnabledAtom);
  const [speakingId, setSpeakingId] = useAtom(ttsSpeakingIdAtom);

  const recorderRef = useRef<AudioRecorder | null>(null);
  const recognitionRef = useRef<any>(null);
  const isRecognitionRunningRef = useRef<boolean>(false);
  const speechRecognitionFailedRef = useRef<boolean>(false);
  const isTtsPlayingRef = useRef<boolean>(false);
  const speakingIdRef = useRef<string | null>(speakingId);
  speakingIdRef.current = speakingId;
  const prevSpeakingIdRef = useRef<string | null>(null);

  const onTranscriptChangeRef = useRef(onTranscriptChange);
  onTranscriptChangeRef.current = onTranscriptChange;
  const onNewMessageRef = useRef(onNewMessage);
  onNewMessageRef.current = onNewMessage;
  const onRefreshDataRef = useRef(onRefreshData);
  onRefreshDataRef.current = onRefreshData;
  const sendAgentCommandRef = useRef(sendAgentCommand);
  sendAgentCommandRef.current = sendAgentCommand;

  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSpeechTimestampRef = useRef<number>(0);
  const latestLiveTranscriptRef = useRef<string>('');
  const isStartedRef = useRef<boolean>(false);
  const isProcessingRef = useRef<boolean>(false);
  const sessionStateRef = useRef<RealtimeSessionState>(sessionState);
  sessionStateRef.current = sessionState;

  const messagesRef = useRef<ChatMessage[]>(messages);
  messagesRef.current = messages;

  // Wake word regex matcher
  const getWakeWordRegex = useCallback(() => {
    return new RegExp(`^\\b(hello\\s+johnwick|hey\\s+johnwick|johnwick|hello\\s+john|hey\\s+john|john|hello\\s+aura|aura|hey\\s+jarvis|jarvis)\\b[,\\s]*`, 'i');
  }, []);

  // Clean wake word out of utterance if spoken as prefix
  const stripWakeWord = useCallback((text: string) => {
    return text.replace(getWakeWordRegex(), '').replace(/^[\s,!?-]+/, '').trim();
  }, [getWakeWordRegex]);

  // Stop speech recognition instance immediately
  const stopSpeechRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
    }
    isRecognitionRunningRef.current = false;
  }, []);

  // Start speech recognition instance safely
  const startSpeechRecognition = useCallback(() => {
    if (typeof window === 'undefined') return;
    const currentState = sessionStateRef.current as RealtimeSessionState;
    if (
      isRecognitionRunningRef.current ||
      isTtsPlayingRef.current ||
      speakingIdRef.current ||
      currentState === 'speaking' ||
      currentState === 'muted' ||
      isProcessingRef.current
    ) {
      return;
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      speechRecognitionFailedRef.current = true;
      return;
    }

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }

      const recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        isRecognitionRunningRef.current = true;
        console.log('[SpeechRecognition] Online & Listening for user voice...');
      };

      recognition.onresult = (event: any) => {
        const liveState = sessionStateRef.current as RealtimeSessionState;
        // Strict Echo Guard: If AI is speaking via TTS or processing, ignore completely
        if (
          isTtsPlayingRef.current ||
          liveState === 'speaking' ||
          speakingIdRef.current ||
          isProcessingRef.current
        ) {
          return;
        }

        let interimTranscript = '';
        let finalTranscript = '';
        for (let i = 0; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + ' ';
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const liveText = (finalTranscript + interimTranscript).trim();
        if (liveText) {
          const currentLiveState = sessionStateRef.current as RealtimeSessionState;
          if (
            isTtsPlayingRef.current ||
            currentLiveState === 'speaking' ||
            speakingIdRef.current ||
            isProcessingRef.current
          ) {
            return;
          }

          latestLiveTranscriptRef.current = liveText;
          setLastHeard(liveText);
          if (onTranscriptChangeRef.current) {
            onTranscriptChangeRef.current(liveText);
          }

          console.log(
            '%c[🎙️ USER SPEECH]:',
            'color: #00f0ff; font-weight: bold; background: #082f49; padding: 2px 6px; border-radius: 3px;',
            liveText
          );

          if (currentLiveState !== 'recording' && currentLiveState !== 'processing') {
            setSessionState('recording');
          }

          // Start 1.0s countdown from the moment this word was spoken
          resetSilenceTimer();
        }
      };

      recognition.onerror = (e: any) => {
        isRecognitionRunningRef.current = false;
        if (e.error === 'no-speech') {
          return;
        }
        if (e.error === 'network' || e.error === 'service-not-allowed') {
          if (!speechRecognitionFailedRef.current) {
            speechRecognitionFailedRef.current = true;
            console.warn('[SpeechRecognition] Browser network recognition unavailable in this origin. Audio VAD fallback active.');
          }
          return;
        }
        console.warn('[SpeechRecognition Error]:', e.error);
      };

      recognition.onend = () => {
        isRecognitionRunningRef.current = false;
        const liveState = sessionStateRef.current as RealtimeSessionState;
        if (
          realtimeEnabled &&
          !speechRecognitionFailedRef.current &&
          !isTtsPlayingRef.current &&
          !speakingIdRef.current &&
          liveState !== 'muted' &&
          liveState !== 'speaking' &&
          !isProcessingRef.current
        ) {
          setTimeout(() => {
            const endState = sessionStateRef.current as RealtimeSessionState;
            if (
              !isRecognitionRunningRef.current &&
              !isTtsPlayingRef.current &&
              !speakingIdRef.current &&
              endState !== 'speaking' &&
              !isProcessingRef.current
            ) {
              try { recognition.start(); } catch {}
            }
          }, 150);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      isRecognitionRunningRef.current = false;
      console.warn('[SpeechRecognition Start Exception]:', err);
    }
  }, [realtimeEnabled, setLastHeard, setSessionState]);

  // React to TTS Speaking State changes to pause/resume listening
  useEffect(() => {
    const wasSpeaking = !!prevSpeakingIdRef.current;
    prevSpeakingIdRef.current = speakingId;

    if (speakingId) {
      // AI started speaking -> completely pause microphone and speech recognition
      isTtsPlayingRef.current = true;
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      stopSpeechRecognition();
      if (recorderRef.current) {
        recorderRef.current.pauseListening();
      }
      latestLiveTranscriptRef.current = '';
      if (onTranscriptChangeRef.current) {
        onTranscriptChangeRef.current('');
      }
      if (sessionStateRef.current !== 'speaking') {
        setSessionState('speaking');
      }
    } else if (wasSpeaking) {
      // AI JUST finished speaking (speakingId transitioned from string to null)
      if (sessionStateRef.current === 'speaking') {
        setSessionState('standby');
      }
      latestLiveTranscriptRef.current = '';
      if (onTranscriptChangeRef.current) {
        onTranscriptChangeRef.current('');
      }

      const cooldownTimer = setTimeout(() => {
        isTtsPlayingRef.current = false;
        const stateAfterCooldown = sessionStateRef.current as RealtimeSessionState;
        if (
          realtimeEnabled &&
          stateAfterCooldown !== 'muted' &&
          !speakingIdRef.current &&
          !isProcessingRef.current
        ) {
          if (recorderRef.current) {
            recorderRef.current.resumeListening();
          }
          startSpeechRecognition();
        }
      }, 400);

      return () => clearTimeout(cooldownTimer);
    }
  }, [
    speakingId,
    realtimeEnabled,
    setSessionState,
    stopSpeechRecognition,
    startSpeechRecognition,
  ]);

  // Transmit voice text or WAV audio directly to backend
  const transmitAudioToBackend = useCallback(async (
    wavBlob: Blob | null,
    transcriptText: string
  ) => {
    if (isProcessingRef.current) return;
    const cleanCommand = transcriptText.trim();
    if (!cleanCommand && !wavBlob) return;

    isProcessingRef.current = true;
    setSessionState('processing');
    stopSpeechRecognition();
    if (recorderRef.current) {
      recorderRef.current.pauseListening();
    }

    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    console.log(
      '%c[🚀 TRANSMITTING COMMAND TO SERVER]',
      'color: #38bdf8; font-weight: bold; background: #082f49; padding: 4px 10px; border-radius: 4px; font-size: 12px;',
      {
        timestamp: `${nowTime}.${String(Date.now() % 1000).padStart(3, '0')}`,
        command: cleanCommand || '(Raw WAV audio)',
        engineMode,
        ollamaModel: selectedOllamaModel,
      }
    );

    // Show user message in chat feed immediately
    const userMsgText = cleanCommand || '🎙️ [Voice Audio Transmission]';
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: userMsgText,
      timestamp: nowTime,
    };
    if (onNewMessageRef.current) onNewMessageRef.current(userMsg);

    const historyPayload = messagesRef.current
      .filter((m) => m.id !== 'welcome' && m.id !== 'welcome_reset' && m.text && m.text.trim())
      .slice(-10)
      .map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));

    const agentMsgId = (Date.now() + 1).toString();
    const modelDisplayName = engineMode === 'ollama' ? `OLLAMA:${selectedOllamaModel || 'local'}` : 'GEMINI_CLOUD';

    try {
      let data: any;

      if (cleanCommand) {
        // Transmit via WebSocket ws.send() with real-time UI token streaming
        if (sendAgentCommandRef.current) {
          data = await sendAgentCommandRef.current({
            command: cleanCommand,
            engineMode,
            ollamaModel: selectedOllamaModel,
            history: historyPayload,
            onStreamStart: () => {
              if (onNewMessageRef.current) {
                onNewMessageRef.current({
                  id: agentMsgId,
                  sender: 'agent',
                  text: '',
                  isStreaming: true,
                  modelUsed: modelDisplayName,
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                });
              }
            },
            onStreamChunk: (_chunk, accumulated) => {
              if (onNewMessageRef.current) {
                onNewMessageRef.current({
                  id: agentMsgId,
                  sender: 'agent',
                  text: accumulated,
                  isStreaming: true,
                  modelUsed: modelDisplayName,
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                });
              }
            },
            onActionTaken: (action, payload) => {
              if (onNewMessageRef.current) {
                onNewMessageRef.current({
                  id: agentMsgId,
                  sender: 'agent',
                  text: '',
                  isStreaming: true,
                  actionTaken: action,
                  toolPayload: payload,
                  modelUsed: modelDisplayName,
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                });
              }
            },
          });
        } else {
          const res = await fetch('/api/agent/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              command: cleanCommand,
              engineMode,
              ollamaModel: selectedOllamaModel,
              history: historyPayload,
            }),
          });
          data = await res.json();
        }
      } else if (wavBlob) {
        // Form-data upload for raw WAV audio if SpeechRecognition produced no text
        const formData = new FormData();
        formData.append('file', wavBlob, 'recording.wav');
        formData.append('engineMode', engineMode);
        formData.append('ollamaModel', selectedOllamaModel || '');
        formData.append('history', JSON.stringify(historyPayload));

        const res = await fetch('/api/realtime/audio', {
          method: 'POST',
          body: formData,
        });
        data = await res.json();
      } else {
        setSessionState('standby');
        isProcessingRef.current = false;
        if (recorderRef.current) recorderRef.current.resumeListening();
        startSpeechRecognition();
        return;
      }

      const replyText = data.response || data.reply || data.text || (data.success ? 'Command executed successfully.' : 'Action processed.');
      const isSuccess = data.success === true || (data.success !== false && !data.error && !!replyText);

      console.log(
        '%c[🤖 AGENT RESPONSE RECEIVED]',
        'color: #38ef7d; font-weight: bold; background: #064e3b; padding: 4px 10px; border-radius: 4px; font-size: 12px;',
        replyText
      );

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

        if (onNewMessageRef.current) onNewMessageRef.current(agentMsg);

        if (data.actionTaken) {
          toast.success('⚡ HARDWARE_COMMITTED', { description: replyText });
          if (onRefreshDataRef.current) onRefreshDataRef.current();
        }

        // Trigger TTS playback ONLY AFTER streaming is fully finished
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
        } else {
          setSessionState('standby');
          latestLiveTranscriptRef.current = '';
          if (onTranscriptChangeRef.current) onTranscriptChangeRef.current('');
          if (recorderRef.current) recorderRef.current.resumeListening();
          startSpeechRecognition();
        }
      } else {
        const errMsg = data.error || data.message || 'Failed to process voice command';
        const errorAgentMsg: ChatMessage = {
          id: agentMsgId,
          sender: 'agent',
          text: `⚠️ **EXECUTION_ERROR**: ${errMsg}`,
          isStreaming: false,
          modelUsed: modelDisplayName,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        };
        if (onNewMessageRef.current) onNewMessageRef.current(errorAgentMsg);
        setSessionState('standby');
        if (onTranscriptChangeRef.current) onTranscriptChangeRef.current('');
        if (recorderRef.current) recorderRef.current.resumeListening();
        startSpeechRecognition();
      }
    } catch (err: any) {
      console.error('[Voice Command Transmission Error]:', err);
      setSessionState('standby');
      if (onTranscriptChangeRef.current) onTranscriptChangeRef.current('');
      if (recorderRef.current) recorderRef.current.resumeListening();
      startSpeechRecognition();
    } finally {
      isProcessingRef.current = false;
      latestLiveTranscriptRef.current = '';
    }
  }, [engineMode, selectedOllamaModel, ttsEnabled, setSessionState, setSpeakingId, stopSpeechRecognition, startSpeechRecognition]);

  // Handle finalize after 1.0s of continuous silence (Sentence Completed -> Auto Send)
  const handleFinalizeRecording = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    let wavBlob: Blob | null = null;
    if (recorderRef.current) {
      const audioResult = recorderRef.current.stopRecording();
      wavBlob = audioResult.blob;
    }

    const rawSentence = latestLiveTranscriptRef.current.trim();
    latestLiveTranscriptRef.current = '';
    if (onTranscriptChangeRef.current) onTranscriptChangeRef.current('');

    if (!rawSentence && !wavBlob) {
      const liveState = sessionStateRef.current as RealtimeSessionState;
      if (liveState === 'recording') {
        setSessionState('standby');
      }
      return;
    }

    // If user said "Hello Johnwick" at the start, clean it or use directly
    const cleanCommand = stripWakeWord(rawSentence) || rawSentence;

    // Send immediately to backend
    transmitAudioToBackend(wavBlob, cleanCommand);
  }, [transmitAudioToBackend, stripWakeWord, setSessionState]);

  // Reset silence timer: Wait 1000ms (1.0s) after user stops talking, then auto-send
  const resetSilenceTimer = useCallback(() => {
    const liveState = sessionStateRef.current as RealtimeSessionState;
    if (isTtsPlayingRef.current || speakingIdRef.current || isProcessingRef.current || liveState === 'speaking') return;
    lastSpeechTimestampRef.current = Date.now();
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }

    silenceTimerRef.current = setTimeout(() => {
      const elapsedMs = Date.now() - lastSpeechTimestampRef.current;
      console.log(
        `%c[⏱️ 1.0s SILENCE ELAPSED (${elapsedMs}ms) ➔ AUTO-SENDING NOW]`,
        'color: #38ef7d; font-weight: bold; background: #064e3b; padding: 4px 10px; border-radius: 4px; font-size: 13px;'
      );
      handleFinalizeRecording();
    }, 1000);
  }, [handleFinalizeRecording]);

  // Interrupt active speech
  const handleInterrupt = useCallback(() => {
    stopTTS();
    setSpeakingId(null);
    isTtsPlayingRef.current = false;
    if (recorderRef.current) {
      recorderRef.current.resumeListening();
    }
    setSessionState('standby');
    latestLiveTranscriptRef.current = '';
    if (onTranscriptChangeRef.current) onTranscriptChangeRef.current('');
    startSpeechRecognition();
    toast.info('INTERRUPT_TRIGGERED', { description: 'Halting AI transmission' });
  }, [setSpeakingId, setSessionState, startSpeechRecognition]);

  // Initialize Audio & Speech Recognition on mount / user trigger
  const initRealtimeListener = useCallback(async () => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
    if (isStartedRef.current) return;

    if (!AudioRecorder.isSupported()) {
      const isHttpsOrLocalhost =
        window.location.protocol === 'https:' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';

      const desc = !isHttpsOrLocalhost
        ? 'Microphone requires HTTPS or localhost. Insecure HTTP contexts block audio input.'
        : 'Microphone API (navigator.mediaDevices.getUserMedia) is not supported in this browser.';

      console.warn('[Audio Init Check]:', desc);
      toast.error('MICROPHONE_UNAVAILABLE', { description: desc });
      setSessionState('muted');
      setRealtimeEnabled(false);
      return;
    }

    isStartedRef.current = true;

    try {
      console.log('[Realtime Voice] Initializing voice listener with DSP noise filters...');
      const recorder = new AudioRecorder();
      recorderRef.current = recorder;

      // Initialize Web Audio stream for visualizer only
      await recorder.initStream((vol: number, isSpeech: boolean) => {
        setVolume(vol);

        // Fallback VAD recording only if SpeechRecognition is failed/unsupported
        if (speechRecognitionFailedRef.current && isSpeech) {
          const streamState = sessionStateRef.current as RealtimeSessionState;
          if (
            !isTtsPlayingRef.current &&
            !speakingIdRef.current &&
            streamState !== 'speaking' &&
            !isProcessingRef.current
          ) {
            if (streamState !== 'recording') {
              setSessionState('recording');
            }
            if (recorderRef.current) {
              recorderRef.current.startRecording();
            }
            resetSilenceTimer();
          }
        }
      });

      // Start Browser SpeechRecognition
      startSpeechRecognition();

      toast.success('VOICE_LISTENER_ONLINE', { description: 'Speak anytime — auto-sends 1s after you stop!' });
      setSessionState('standby');
    } catch (err: any) {
      console.error('[Audio Init Failed]:', err);
      const isDenied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
      toast.error(isDenied ? 'MICROPHONE_DENIED' : 'MICROPHONE_ERROR', {
        description: isDenied
          ? 'Microphone permission was denied. Please allow microphone access in browser settings.'
          : (err.message || 'Check microphone permissions and settings'),
      });
      setSessionState('muted');
      setRealtimeEnabled(false);
    }
  }, [
    setRealtimeEnabled,
    setSessionState,
    setVolume,
    resetSilenceTimer,
    startSpeechRecognition,
  ]);

  // Auto initialize on mount if realtime enabled
  useEffect(() => {
    if (realtimeEnabled) {
      initRealtimeListener();
    }

    // Heartbeat check every 3s to ensure speech recognition stays active when not speaking TTS
    const heartbeatInterval = setInterval(() => {
      const liveState = sessionStateRef.current as RealtimeSessionState;
      if (
        realtimeEnabled &&
        !isTtsPlayingRef.current &&
        !speakingIdRef.current &&
        liveState !== 'muted' &&
        liveState !== 'speaking' &&
        !isProcessingRef.current &&
        !isRecognitionRunningRef.current
      ) {
        startSpeechRecognition();
      }
    }, 3000);

    return () => {
      clearInterval(heartbeatInterval);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (recorderRef.current) {
        recorderRef.current.cleanup();
        recorderRef.current = null;
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
        recognitionRef.current = null;
      }
    };
  }, [realtimeEnabled, initRealtimeListener, startSpeechRecognition]);

  const toggleRealtime = () => {
    if (realtimeEnabled) {
      stopTTS();
      setSpeakingId(null);
      isTtsPlayingRef.current = false;
      if (recorderRef.current) recorderRef.current.cleanup();
      stopSpeechRecognition();
      setSessionState('muted');
      setRealtimeEnabled(false);
      toast.info('VOICE_MUTED');
    } else {
      if (!AudioRecorder.isSupported()) {
        const isHttpsOrLocalhost =
          typeof window !== 'undefined' &&
          (window.location.protocol === 'https:' ||
            window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1');

        toast.error('MICROPHONE_UNAVAILABLE', {
          description: !isHttpsOrLocalhost
            ? 'Microphone requires HTTPS or localhost. Insecure HTTP contexts block audio input.'
            : 'Microphone API is not supported in this browser.',
        });
        return;
      }
      setRealtimeEnabled(true);
      isStartedRef.current = false;
      initRealtimeListener();
    }
  };

  const manualPushToTalk = () => {
    if (!realtimeEnabled) {
      if (!AudioRecorder.isSupported()) {
        const isHttpsOrLocalhost =
          typeof window !== 'undefined' &&
          (window.location.protocol === 'https:' ||
            window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1');

        toast.error('MICROPHONE_UNAVAILABLE', {
          description: !isHttpsOrLocalhost
            ? 'Microphone requires HTTPS or localhost. Insecure HTTP contexts block audio input.'
            : 'Microphone API is not supported in this browser.',
        });
        return;
      }
      setRealtimeEnabled(true);
      isStartedRef.current = false;
      initRealtimeListener();
    } else {
      setSessionState('recording');
      latestLiveTranscriptRef.current = '';
      if (onTranscriptChangeRef.current) onTranscriptChangeRef.current('');
      startSpeechRecognition();
      resetSilenceTimer();
      toast.info('LISTENING', { description: 'Speak your command...' });
    }
  };

  return {
    toggleRealtime,
    manualPushToTalk,
    handleInterrupt,
  };
}
