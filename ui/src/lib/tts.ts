/**
 * Browser-native Web Speech API Text-to-Speech (speechSynthesis)
 * Uses high-quality UK English (en-GB) voices and natural unit expansion.
 */

let activeUtterance: SpeechSynthesisUtterance | null = null;

export function stopTTS(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
  activeUtterance = null;
}

/**
 * Finds the highest-quality native UK English voice available on the device
 */
export function getBestUkVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  // Filter for British / UK English voices
  const ukVoices = voices.filter(
    (v) =>
      v.lang.toLowerCase().startsWith('en-gb') ||
      v.lang.toLowerCase().startsWith('en-uk') ||
      v.lang.toLowerCase() === 'en_gb'
  );

  // Prioritize premium/natural British voices (Google, Microsoft, Apple, Daniel, Serena, etc.)
  const premiumUkVoice = ukVoices.find((v) =>
    /(natural|neural|google|daniel|serena|oliver|arthur|sonia|ryan|hazel|george|susan|libby)/i.test(
      v.name
    )
  );

  if (premiumUkVoice) return premiumUkVoice;
  if (ukVoices.length > 0) return ukVoices[0];

  // Fallback to any English voice
  return voices.find((v) => v.lang.toLowerCase().startsWith('en')) || null;
}

/**
 * Strips markdown, emojis, code blocks, and expands abbreviations & units (e.g. 10s -> 10 seconds, e.g. -> for example)
 */
export function cleanTextForSpeech(text: string): string {
  let clean = text;

  // 1. Remove code blocks, inline code, and URLs
  clean = clean.replace(/```[\s\S]*?```/g, ' ');
  clean = clean.replace(/`([^`]+)`/g, '$1');
  clean = clean.replace(/https?:\/\/\S+/g, ' ');

  // 2. Expand common Latin and tech abbreviations
  clean = clean.replace(/\be\.g\.[,\s]*/gi, 'for example, ');
  clean = clean.replace(/\bi\.e\.[,\s]*/gi, 'that is, ');
  clean = clean.replace(/\bvs\.\b|\bvs\b/gi, 'versus');
  clean = clean.replace(/\bapprox\.\b/gi, 'approximately');
  clean = clean.replace(/\betc\.\b|\betc\b/gi, 'and so on');
  clean = clean.replace(/\bGPIO\b/g, 'G P I O');

  // 3. Expand time units into full words (e.g. "10s" -> "10 seconds", "1s" -> "1 second")
  clean = clean.replace(/\b1\s*s\b/gi, '1 second');
  clean = clean.replace(/\b(\d+)\s*s\b/gi, '$1 seconds');
  clean = clean.replace(/\b1\s*sec\b/gi, '1 second');
  clean = clean.replace(/\b(\d+)\s*(sec|secs)\b/gi, '$1 seconds');
  clean = clean.replace(/\b1\s*min\b/gi, '1 minute');
  clean = clean.replace(/\b(\d+)\s*(min|mins)\b/gi, '$1 minutes');
  clean = clean.replace(/\b(\d+)\s*ms\b/gi, '$1 milliseconds');

  // 4. Format list and preset status lines into natural spoken sentences
  clean = clean.replace(/\bStop\s*\((Red)\)/gi, 'Stop light $1');
  clean = clean.replace(/\bCaution\s*\((Yellow)\)/gi, 'Caution light $1');
  clean = clean.replace(/\bGo\s*\((Green)\)/gi, 'Go light $1');
  clean = clean.replace(/\b(red|yellow|green|lamp)\s*:\s*OFF\b/gi, '$1 is off.');
  clean = clean.replace(/\b(red|yellow|green|lamp)\s*:\s*ON\b/gi, '$1 is on.');

  // 5. Remove markdown headers, bold/italic, bullet symbols, quotes
  clean = clean.replace(/\*\*([^*]+)\*\*/g, '$1');
  clean = clean.replace(/\*([^*]+)\*/g, '$1');
  clean = clean.replace(/#+\s*/g, '');
  clean = clean.replace(/['"“”‘’]/g, '');
  clean = clean.replace(/[•\-\[\]\(\)\{\}\<\>\|\~\^\_\\]/g, ' ');

  // 6. Strip emojis & pictographs
  try {
    clean = clean.replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2702}-\u{27B0}\u{24C2}-\u{1F251}\u{2600}-\u{26FF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}]/gu,
      ' '
    );
  } catch {}

  // 7. Remove residual spoken sign artifacts
  clean = clean.replace(/\b(stop sign|warning sign|caution sign|active sign|high voltage sign|traffic light sign)\b/gi, ' ');

  return clean.replace(/\s+/g, ' ').trim();
}

/**
 * Plays speech directly in the browser using window.speechSynthesis with native UK voice
 */
export async function playBackendTTS(
  text: string,
  _voice?: string,
  onStart?: () => void,
  onEnd?: () => void,
  onError?: (err: any) => void
): Promise<void> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (onEnd) onEnd();
    return;
  }

  const cleanText = cleanTextForSpeech(text);
  if (!cleanText) {
    if (onEnd) onEnd();
    return;
  }

  // Halt any current speech
  stopTTS();

  try {
    const utterance = new SpeechSynthesisUtterance(cleanText);
    activeUtterance = utterance;

    // Set UK English
    utterance.lang = 'en-GB';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Assign the best available native British voice
    const bestVoice = getBestUkVoice();
    if (bestVoice) {
      utterance.voice = bestVoice;
    }

    let hasEnded = false;
    const safeEnd = () => {
      if (!hasEnded) {
        hasEnded = true;
        activeUtterance = null;
        if (onEnd) onEnd();
      }
    };

    utterance.onstart = () => {
      if (onStart) onStart();
    };

    utterance.onend = () => {
      safeEnd();
    };

    utterance.onerror = (e) => {
      console.warn('[Browser SpeechSynthesis Error]:', e);
      if (onError) onError(e);
      safeEnd();
    };

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.error('[Browser SpeechSynthesis Exception]:', err);
    if (onError) onError(err);
    if (onEnd) onEnd();
  }
}
