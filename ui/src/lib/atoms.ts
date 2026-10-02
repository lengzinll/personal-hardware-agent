import { atom } from 'jotai';
import { EngineMode } from '@/components/agent/types';

export const engineModeAtom = atom<EngineMode>('ollama');
export const selectedOllamaModelAtom = atom<string>('ornith-1.5:9b');
export const apiKeyAtom = atom<string>(process.env.NEXT_PUBLIC_GEMINI_API_KEY ?? '');

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
