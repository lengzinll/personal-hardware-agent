export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  actionTaken?: string;
  toolPayload?: any;
  modelUsed?: string;
  timestamp: string;
}

export type EngineMode = 'ollama' | 'text_flash' | 'gemini_live' | 'browser_speech';
