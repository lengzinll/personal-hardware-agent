/**
 * PCM Audio Recorder & Player for Gemini 3.5 Flash Native Audio Live API
 * Gemini Live API expects 16kHz 16-bit Mono PCM input and returns 24kHz 16-bit Mono PCM audio output.
 */

export class PcmRecorder {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private isRecording: boolean = false;
  private onAudioData: (base64Pcm: string) => void;

  constructor(onAudioData: (base64Pcm: string) => void) {
    this.onAudioData = onAudioData;
  }

  public async start(): Promise<void> {
    if (this.isRecording) return;

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000, // Request 16kHz
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.audioContext = new AudioContextClass({ sampleRate: 16000 });

    this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
    // Buffer size 2048 samples = ~128ms chunks at 16kHz
    this.processor = this.audioContext.createScriptProcessor(2048, 1, 1);

    this.processor.onaudioprocess = (e) => {
      if (!this.isRecording) return;
      const inputBuffer = e.inputBuffer.getChannelData(0);

      // Convert Float32 [-1.0, 1.0] to 16-bit PCM Int16
      const pcm16 = new Int16Array(inputBuffer.length);
      for (let i = 0; i < inputBuffer.length; i++) {
        const s = Math.max(-1, Math.min(1, inputBuffer[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }

      // Convert Int16Array to Base64
      const uint8Bytes = new Uint8Array(pcm16.buffer);
      let binary = '';
      for (let i = 0; i < uint8Bytes.byteLength; i++) {
        binary += String.fromCharCode(uint8Bytes[i]);
      }
      const base64Pcm = btoa(binary);

      this.onAudioData(base64Pcm);
    };

    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
    this.isRecording = true;
  }

  public stop(): void {
    this.isRecording = false;
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

export class PcmPlayer {
  private audioContext: AudioContext | null = null;
  private sampleRate: number = 24000; // Gemini Live API outputs 24kHz PCM
  private nextStartTime: number = 0;

  constructor(sampleRate: number = 24000) {
    this.sampleRate = sampleRate;
  }

  private initAudioContext() {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass({ sampleRate: this.sampleRate });
      this.nextStartTime = this.audioContext.currentTime;
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  public playChunk(base64Pcm: string) {
    this.initAudioContext();
    if (!this.audioContext) return;

    // Decode Base64 to Int16 PCM
    const binary = atob(base64Pcm);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const int16Array = new Int16Array(bytes.buffer);

    // Convert Int16 to Float32 [-1.0, 1.0]
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768;
    }

    // Create AudioBuffer
    const audioBuffer = this.audioContext.createBuffer(1, float32Array.length, this.sampleRate);
    audioBuffer.getChannelData(0).set(float32Array);

    const sourceNode = this.audioContext.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.connect(this.audioContext.destination);

    const currentTime = this.audioContext.currentTime;
    if (this.nextStartTime < currentTime) {
      this.nextStartTime = currentTime;
    }

    sourceNode.start(this.nextStartTime);
    this.nextStartTime += audioBuffer.duration;
  }

  public stop() {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.nextStartTime = 0;
  }
}
