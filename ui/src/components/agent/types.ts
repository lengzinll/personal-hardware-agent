export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  actionTaken?: string;
  toolPayload?: any;
  modelUsed?: string;
  timestamp: string;
  isStreaming?: boolean;
}

export type EngineMode = 'ollama' | 'text_flash';
