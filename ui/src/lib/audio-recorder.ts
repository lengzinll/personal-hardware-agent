import { toast } from 'sonner';
import { encodeWAV, resampleAudioBuffer } from './wav-encoder';

export interface RecordedAudioResult {
  blob: Blob | null;
  durationMs: number;
  speechFramesCount: number;
  chunksCount?: number;
  isValidSpeech: boolean;
  rejectReason?: string;
}

export class AudioRecorder {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private highpassFilter: BiquadFilterNode | null = null;
  private lowpassFilter: BiquadFilterNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private analyserNode: AnalyserNode | null = null;

  private isRecording: boolean = false;
  private isPaused: boolean = false;
  private recordingStartTime: number = 0;
  private recordedChunks: Float32Array[] = [];
  private preRollBuffer: Float32Array[] = [];
  private speechFramesCount: number = 0;
  private onVolumeChange?: (level: number, isSpeech: boolean) => void;

  // Adaptive Noise Filter variables — Calibrated for intentional LOUD / clear speech
  private noiseFloor: number = 0.012;
  private minIntentionalThreshold: number = 0.055; // Increased from 0.024 -> 0.055 (requires clear, loud speech)
  private consecutiveSpeechFrames: number = 0;
  private readonly minFramesForSpeech: number = 3; // ~260ms sustained loud speech energy (rejects coughs, clicks, typing)
  private readonly minUtteranceDurationMs: number = 250;

  /**
   * Checks whether the browser and current context support mediaDevices.getUserMedia and Web Audio.
   */
  public static isSupported(): boolean {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return false;
    }
    const hasMediaDevices = !!(
      navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function'
    );
    const hasAudioContext = !!(
      window.AudioContext || (window as any).webkitAudioContext
    );
    return hasMediaDevices && hasAudioContext;
  }

  public async resumeAudioContext(): Promise<void> {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        console.log('[WebAudio] AudioContext successfully resumed from user gesture.');
      } catch (e) {
        console.warn('[WebAudio] AudioContext resume failed:', e);
      }
    }
  }

  public async initStream(onVolumeChange?: (level: number, isSpeech: boolean) => void): Promise<MediaStream> {
    this.onVolumeChange = onVolumeChange;

    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      throw new Error('AudioRecorder cannot run outside a browser environment.');
    }

    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      const isHttpsOrLocalhost =
        window.location.protocol === 'https:' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';

      if (!isHttpsOrLocalhost) {
        throw new Error(
          'Microphone access (navigator.mediaDevices.getUserMedia) is blocked because the app is running over insecure HTTP. Please use HTTPS or localhost (127.0.0.1).'
        );
      }
      throw new Error(
        'Microphone API (navigator.mediaDevices.getUserMedia) is not supported in this browser environment.'
      );
    }

    if (!this.mediaStream) {
      console.log('[WebAudio] Initializing mic with echo cancellation, noise suppression & AGC...');
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true, // Enabled for responsive voice pickup
          channelCount: 1,
        },
      });
      console.log('[WebAudio] Clean microphone stream acquired.');
    }

    if (!this.audioContext) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error('Web Audio API (AudioContext) is not supported in this browser.');
      }
      this.audioContext = new AudioContextClass();
    }

    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch {}
    }

    if (!this.sourceNode) {
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

      // 1. Highpass Filter: Cut low-frequency AC rumble, fan hum, & vibration (< 80 Hz)
      this.highpassFilter = this.audioContext.createBiquadFilter();
      this.highpassFilter.type = 'highpass';
      this.highpassFilter.frequency.setValueAtTime(140, this.audioContext.currentTime); // Cut AC/fan hum and desk vibration
      this.highpassFilter.Q.setValueAtTime(0.7, this.audioContext.currentTime);

      // 2. Lowpass Filter: Cut high-frequency hiss and room reflections (> 4200 Hz)
      this.lowpassFilter = this.audioContext.createBiquadFilter();
      this.lowpassFilter.type = 'lowpass';
      this.lowpassFilter.frequency.setValueAtTime(3600, this.audioContext.currentTime); // Cut high-frequency hiss
      this.lowpassFilter.Q.setValueAtTime(0.7, this.audioContext.currentTime);

      // 3. Dynamics Compressor: Smooth peaks and level intentional voice
      this.compressorNode = this.audioContext.createDynamicsCompressor();
      this.compressorNode.threshold.setValueAtTime(-32, this.audioContext.currentTime);
      this.compressorNode.knee.setValueAtTime(12, this.audioContext.currentTime);
      this.compressorNode.ratio.setValueAtTime(3.5, this.audioContext.currentTime);
      this.compressorNode.attack.setValueAtTime(0.003, this.audioContext.currentTime);
      this.compressorNode.release.setValueAtTime(0.25, this.audioContext.currentTime);

      // 4. Analyser Node for visualizer & RMS
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 512;
      this.analyserNode.smoothingTimeConstant = 0.3;

      // Connect DSP Filter Chain: Source -> Highpass -> Lowpass -> Compressor -> Analyser
      this.sourceNode.connect(this.highpassFilter);
      this.highpassFilter.connect(this.lowpassFilter);
      this.lowpassFilter.connect(this.compressorNode);
      this.compressorNode.connect(this.analyserNode);

      // 5. ScriptProcessor for PCM chunk buffering & Adaptive Noise Gating
      this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);
      this.processorNode.onaudioprocess = (e) => {
        if (this.isPaused) {
          if (this.onVolumeChange) this.onVolumeChange(0, false);
          return;
        }

        const inputChannel = e.inputBuffer.getChannelData(0);
        const chunkCopy = new Float32Array(inputChannel);

        // Calculate Root Mean Square (RMS) energy
        let sumSquares = 0;
        for (let i = 0; i < inputChannel.length; i++) {
          sumSquares += inputChannel[i] * inputChannel[i];
        }
        const rms = Math.sqrt(sumSquares / inputChannel.length);

        // Adaptive Noise Floor Calibration
        if (rms < this.minIntentionalThreshold) {
          this.noiseFloor = this.noiseFloor * 0.95 + rms * 0.05;
        }

        const dynamicSpeechThreshold = Math.max(
          this.minIntentionalThreshold,
          this.noiseFloor * 3.2
        );

        let isIntentionalSpeech = false;
        if (rms > dynamicSpeechThreshold) {
          this.consecutiveSpeechFrames++;
          if (this.consecutiveSpeechFrames >= this.minFramesForSpeech) {
            isIntentionalSpeech = true;
            if (this.isRecording) {
              this.speechFramesCount++;
            }
            if (this.speechFramesCount % 4 === 1) {
              console.log(`%c[🎙️ VOICE ENERGY]: RMS=${rms.toFixed(3)} | Threshold=${dynamicSpeechThreshold.toFixed(3)}`, 'color: #38bdf8;');
            }
          }
        } else {
          this.consecutiveSpeechFrames = 0;
        }

        if (this.onVolumeChange) {
          this.onVolumeChange(rms, isIntentionalSpeech);
        }

        // Maintain circular pre-roll buffer (3 chunks ~ 270ms)
        this.preRollBuffer.push(chunkCopy);
        if (this.preRollBuffer.length > 3) {
          this.preRollBuffer.shift();
        }

        if (this.isRecording) {
          this.recordedChunks.push(chunkCopy);
        }
      };

      this.compressorNode.connect(this.processorNode);
      this.processorNode.connect(this.audioContext.destination);
    }

    return this.mediaStream;
  }

  /**
   * Full pause: stops buffering AND disables mic track.
   * Use this when TTS is playing to prevent echo feedback.
   */
  public pauseListening(): void {
    this.isPaused = true;
    this.isRecording = false;
    this.recordedChunks = [];
    this.preRollBuffer = [];
    if (this.mediaStream) {
      this.mediaStream.getAudioTracks().forEach((t) => {
        t.enabled = false;
      });
    }
  }

  /**
   * Soft pause: stops buffering chunks but KEEPS the mic track alive.
   * VAD (onaudioprocess) keeps running so the next speech is detected immediately.
   * Use this during Whisper transcription so the user can speak again right after.
   */
  public stopBuffering(): void {
    this.isRecording = false;
    this.recordedChunks = [];
    this.preRollBuffer = [];
    // NOTE: mic track stays enabled, isPaused stays false — VAD keeps firing
    console.log('[WebAudio] stopBuffering: chunks cleared, mic & VAD still active.');
  }

  public resumeListening(): void {
    if (this.mediaStream) {
      this.mediaStream.getAudioTracks().forEach((t) => {
        t.enabled = true;
      });
    }
    this.isPaused = false;
    this.isRecording = false;
    this.recordedChunks = [];
    this.preRollBuffer = [];
  }

  public startRecording(): void {
    console.log(`[WebAudio] startRecording called — isRecording=${this.isRecording} isPaused=${this.isPaused} micEnabled=${this.mediaStream?.getAudioTracks()[0]?.enabled ?? 'n/a'}`);
    if (this.isRecording || this.isPaused) {
      console.warn(`[WebAudio] startRecording BAILED — isRecording=${this.isRecording} isPaused=${this.isPaused}`);
      return;
    }
    console.log('[WebAudio] Started buffering filtered audio for WAV export...');
    this.recordedChunks = [...this.preRollBuffer];
    this.speechFramesCount = this.preRollBuffer.length;
    this.recordingStartTime = Date.now();
    this.isRecording = true;
  }

  public stopRecording(): RecordedAudioResult {
    const chunksLen = this.recordedChunks.length;
    const wasRec = this.isRecording;
    this.isRecording = false;
    const durationMs = this.recordingStartTime ? Date.now() - this.recordingStartTime : 0;
    const speechFrames = this.speechFramesCount;

    console.log(`[WebAudio] stopRecording called — wasRecording=${wasRec}, chunks=${chunksLen}, duration=${durationMs}ms, speechFrames=${speechFrames}`);

    if (chunksLen === 0) {
      return {
        blob: null,
        durationMs: 0,
        speechFramesCount: 0,
        chunksCount: 0,
        isValidSpeech: false,
        rejectReason: 'empty_buffer',
      };
    }

    let totalLength = 0;
    for (const chunk of this.recordedChunks) {
      totalLength += chunk.length;
    }

    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of this.recordedChunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    this.recordedChunks = [];
    this.speechFramesCount = 0;

    // Minimum Duration: Discard accidental transient click (< 180ms or empty)
    if (durationMs < this.minUtteranceDurationMs || totalLength < 1600) {
      console.log(`[Noise Gate] 🚫 Discarded transient noise (Duration: ${durationMs}ms, Samples: ${totalLength}).`);
      return {
        blob: null,
        durationMs,
        speechFramesCount: speechFrames,
        isValidSpeech: false,
        rejectReason: 'too_short_transient_noise',
      };
    }

    const inputSampleRate = this.audioContext?.sampleRate || 44100;
    const resampled = resampleAudioBuffer(merged, inputSampleRate, 16000);
    const blob = encodeWAV(resampled, 16000);
    console.log(`[WebAudio] Filtered WAV generated: ${blob.size} bytes (${durationMs}ms duration, ${speechFrames} active frames).`);

    return {
      blob,
      durationMs,
      speechFramesCount: speechFrames,
      isValidSpeech: true,
    };
  }

  public getIsRecording(): boolean {
    return this.isRecording;
  }

  public playWakeChime(): void {
    try {
      if (typeof window === 'undefined') return;
      if (!this.audioContext) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;
        this.audioContext = new AudioContextClass();
      }
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      const now = this.audioContext.currentTime;
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880.0, now + 0.12); // A5

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(this.audioContext.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch {}
  }

  public cleanup(): void {
    this.isRecording = false;
    this.isPaused = false;
    this.recordedChunks = [];
    this.preRollBuffer = [];

    if (this.processorNode) {
      try {
        this.processorNode.disconnect();
      } catch {}
      this.processorNode = null;
    }

    if (this.compressorNode) {
      try {
        this.compressorNode.disconnect();
      } catch {}
      this.compressorNode = null;
    }

    if (this.lowpassFilter) {
      try {
        this.lowpassFilter.disconnect();
      } catch {}
      this.lowpassFilter = null;
    }

    if (this.highpassFilter) {
      try {
        this.highpassFilter.disconnect();
      } catch {}
      this.highpassFilter = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {}
      this.sourceNode = null;
    }

    if (this.analyserNode) {
      try {
        this.analyserNode.disconnect();
      } catch {}
      this.analyserNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }
  }
}
