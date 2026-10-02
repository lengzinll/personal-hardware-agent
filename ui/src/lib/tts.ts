/**
 * Frontend Audio player for Backend TTS (edge-tts)
 */

let activeAudio: HTMLAudioElement | null = null;
let activeAudioUrl: string | null = null;

export function stopTTS(): void {
  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    } catch {
      // Ignore abort errors
    }
    activeAudio = null;
  }
  if (activeAudioUrl) {
    URL.revokeObjectURL(activeAudioUrl);
    activeAudioUrl = null;
  }
}

export async function playBackendTTS(
  text: string,
  voice: string = 'en-US-JennyNeural',
  onStart?: () => void,
  onEnd?: () => void,
  onError?: (err: any) => void
): Promise<void> {
  if (typeof window === 'undefined' || !text.trim()) return;

  stopTTS();

  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice }),
    });

    if (!res.ok) {
      throw new Error(`TTS synthesis failed with status ${res.status}`);
    }

    const blob = await res.blob();
    const audioUrl = URL.createObjectURL(blob);
    activeAudioUrl = audioUrl;

    const audio = new Audio(audioUrl);
    activeAudio = audio;

    audio.onplay = () => {
      if (onStart) onStart();
    };

    audio.onended = () => {
      stopTTS();
      if (onEnd) onEnd();
    };

    audio.onerror = (e) => {
      stopTTS();
      if (onError) onError(e);
      if (onEnd) onEnd();
    };

    await audio.play();
  } catch (err) {
    stopTTS();
    console.warn('[Backend TTS Playback Error]', err);
    if (onError) onError(err);
    if (onEnd) onEnd();
  }
}
