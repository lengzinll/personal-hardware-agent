import { PcmRecorder, PcmPlayer } from "./pcm-audio-streamer";

export interface GeminiLiveOptions {
  apiKey: string;
  onStatusChange?: (status: 'disconnected' | 'connecting' | 'connected' | 'listening' | 'speaking' | 'executing_tool') => void;
  onTextReceived?: (text: string, role: 'user' | 'model') => void;
  onToolExecuted?: (toolName: string, args: any, result: any) => void;
  onDataRefresh?: () => void;
}

export class GeminiLiveClient {
  private ws: WebSocket | null = null;
  private recorder: PcmRecorder | null = null;
  private player: PcmPlayer | null = null;
  private apiKey: string;
  private isConnected: boolean = false;

  private onStatusChange?: (status: any) => void;
  private onTextReceived?: (text: string, role: 'user' | 'model') => void;
  private onToolExecuted?: (toolName: string, args: any, result: any) => void;
  private onDataRefresh?: () => void;

  constructor(options: GeminiLiveOptions) {
    this.apiKey = options.apiKey;
    this.onStatusChange = options.onStatusChange;
    this.onTextReceived = options.onTextReceived;
    this.onToolExecuted = options.onToolExecuted;
    this.onDataRefresh = options.onDataRefresh;
    this.player = new PcmPlayer(24000);
  }

  public connect() {
    if (!this.apiKey) {
      alert("Missing Gemini API Key! Please set NEXT_PUBLIC_GEMINI_API_KEY or enter your key.");
      return;
    }

    if (this.onStatusChange) this.onStatusChange('connecting');

    // WebSocket URL for Gemini Live Multimodal Bidirectional API
    const host = "generativelanguage.googleapis.com";
    const uri = `wss://${host}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;

    this.ws = new WebSocket(uri);

    this.ws.onopen = () => {
      this.isConnected = true;
      if (this.onStatusChange) this.onStatusChange('connected');

      // Send initial setup frame with system instruction & tool definitions
      this.sendSetupFrame();
      // Start recording microphone audio
      this.startAudioInput();
    };

    this.ws.onmessage = async (event) => {
      try {
        let text = '';
        if (typeof event.data === 'string') {
          text = event.data;
        } else if (event.data instanceof Blob) {
          text = await event.data.text();
        }

        if (!text) return;
        const msg = JSON.parse(text);

        // 1. Handle Model Turn (Audio & Text)
        if (msg.serverContent?.modelTurn?.parts) {
          for (const part of msg.serverContent.modelTurn.parts) {
            // Text Response
            if (part.text && this.onTextReceived) {
              this.onTextReceived(part.text, 'model');
            }
            // Inline PCM Audio Output
            if (part.inlineData && part.inlineData.data) {
              if (this.onStatusChange) this.onStatusChange('speaking');
              this.player?.playChunk(part.inlineData.data);
            }
          }
        }

        // 2. Handle Gemini Tool Call Requests (LED Hardware Operations)
        if (msg.toolCall?.functionCalls) {
          for (const call of msg.toolCall.functionCalls) {
            await this.handleToolCall(call.name, call.args, call.id);
          }
        }
      } catch (err) {
        console.error("Error parsing Gemini WebSocket message:", err);
      }
    };

    this.ws.onerror = (error) => {
      console.error("Gemini Live WebSocket error:", error);
      if (this.onStatusChange) this.onStatusChange('disconnected');
    };

    this.ws.onclose = () => {
      this.isConnected = false;
      if (this.onStatusChange) this.onStatusChange('disconnected');
      this.stopAudioInput();
    };
  }

  private sendSetupFrame() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const setupMsg = {
      setup: {
        model: "models/gemini-2.0-flash-exp",
        generationConfig: {
          responseModalities: ["AUDIO", "TEXT"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: "Aoede",
              },
            },
          },
        },
        systemInstruction: {
          parts: [
            {
              text: `You are AURA, an intelligent AI Copilot connected directly to an LED light hardware controller. You speak naturally, concisely, and conversationally. You can turn the LED light ON or OFF, or check its status using your tools.`,
            },
          ],
        },
        tools: [
          {
            functionDeclarations: [
              {
                name: "toggleLed",
                description: "Turns the LED light ON or OFF.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    state: { type: "STRING", enum: ["ON", "OFF", "TOGGLE"], description: "Desired state of the LED light" },
                  },
                  required: ["state"],
                },
              },
              {
                name: "getLedStatus",
                description: "Gets current LED light status (ON or OFF).",
                parameters: {
                  type: "OBJECT",
                  properties: {},
                },
              },
            ],
          },
        ],
      },
    };

    this.ws.send(JSON.stringify(setupMsg));
  }

  private async startAudioInput() {
    this.recorder = new PcmRecorder((base64Pcm) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

      const mediaMsg = {
        realtimeInput: {
          mediaChunks: [
            {
              mimeType: "audio/pcm;rate=16000",
              data: base64Pcm,
            },
          ],
        },
      };

      this.ws.send(JSON.stringify(mediaMsg));
    });

    try {
      await this.recorder.start();
      if (this.onStatusChange) this.onStatusChange('listening');
    } catch (err) {
      console.error("Failed to start audio recording:", err);
    }
  }

  private stopAudioInput() {
    if (this.recorder) {
      this.recorder.stop();
      this.recorder = null;
    }
    if (this.player) {
      this.player.stop();
    }
  }

  private async handleToolCall(name: string, args: any, callId: string) {
    if (this.onStatusChange) this.onStatusChange('executing_tool');
    let responseData: any = { success: true };

    try {
      if (name === "toggleLed") {
        const action = args?.state || "TOGGLE";
        const res = await fetch('/api/led', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        });
        responseData = await res.json();
      } else if (name === "getLedStatus") {
        const res = await fetch('/api/led');
        responseData = await res.json();
      }

      if (this.onToolExecuted) this.onToolExecuted(name, args, responseData);
      if (this.onDataRefresh) this.onDataRefresh();

      // Send tool response back to Gemini over WebSocket
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const toolResponseMsg = {
          toolResponse: {
            functionResponses: [
              {
                response: { output: responseData },
                id: callId,
              },
            ],
          },
        };
        this.ws.send(JSON.stringify(toolResponseMsg));
      }
    } catch (err) {
      console.error("Error executing live tool call:", err);
    } finally {
      if (this.onStatusChange) this.onStatusChange('listening');
    }
  }

  public disconnect() {
    this.stopAudioInput();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    if (this.onStatusChange) this.onStatusChange('disconnected');
  }
}
