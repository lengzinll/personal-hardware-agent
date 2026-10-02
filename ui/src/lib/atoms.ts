import { atom } from 'jotai';
import { EngineMode } from '@/components/agent/types';
import { env } from '@/env';

export const engineModeAtom = atom<EngineMode>('ollama');
export const selectedOllamaModelAtom = atom<string>('ornith-1.5:9b');
export const apiKeyAtom = atom<string>(env.NEXT_PUBLIC_GEMINI_API_KEY);
export const autoSpeakAtom = atom<boolean>(true);
export const showSettingsAtom = atom<boolean>(false);
export const speechRateAtom = atom<number>(1.25);

// LED State Atoms (Global)
export interface LedStates {
  red: 'ON' | 'OFF';
  yellow: 'ON' | 'OFF';
  green: 'ON' | 'OFF';
}

export const ledStatesAtom = atom<LedStates>({
  red: 'OFF',
  yellow: 'OFF',
  green: 'OFF',
});

export const ledWebSocketConnectedAtom = atom<boolean>(false);
