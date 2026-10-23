import { atom } from 'jotai';
import { EngineMode } from '@/components/agent/types';

export const engineModeAtom = atom<EngineMode>('ollama');
export const selectedOllamaModelAtom = atom<string>('ornith-1.5:9b');

// STT Engine: Browser native Web Speech API (English)
export type SttEngine = 'browser';
export const sttEngineAtom = atom<SttEngine>('browser');

// TTS Atoms
export const ttsEnabledAtom = atom<boolean>(true);
export const ttsSpeakingIdAtom = atom<string | null>(null);

// LED & Lamp State Atoms (Global)
export interface LedStates {
  red: 'ON' | 'OFF';
  yellow: 'ON' | 'OFF';
  green: 'ON' | 'OFF';
  lamp: 'ON' | 'OFF';
}

export const ledStatesAtom = atom<LedStates>({
  red: 'OFF',
  yellow: 'OFF',
  green: 'OFF',
  lamp: 'OFF',
});

export const ledWebSocketConnectedAtom = atom<boolean>(false);

// Realtime Voice & Wake Word Conversation Atoms
export type RealtimeSessionState =
  | 'uninitialized'
  | 'standby'        // Silently listening for wake word or voice
  | 'session_active' // Session active, listening for commands
  | 'recording'      // Actively hearing user voice
  | 'processing'     // Processing command with AI
  | 'speaking'       // AI is answering (barge-in interruptible)
  | 'muted';

export const realtimeEnabledAtom = atom<boolean>(true);
export const realtimeSessionStateAtom = atom<RealtimeSessionState>('uninitialized');
export const realtimeVolumeAtom = atom<number>(0);
export const wakeWordAtom = atom<string>('hello johnwick');
export const lastHeardTranscriptAtom = atom<string>('');
