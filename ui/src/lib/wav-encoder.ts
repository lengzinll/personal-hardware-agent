/**
 * Audio to WAV Encoder
 * Converts raw PCM audio samples into a standard 16-bit PCM WAV Blob.
 */

export function encodeWAV(samples: Float32Array, sampleRate: number = 16000): Blob {
  const numChannels = 1;
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, byteRate, true); // ByteRate
  view.setUint16(32, blockAlign, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample (16 bits)

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write PCM audio samples (float32 to 16-bit signed integer)
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([view], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Resamples audio buffer to target sample rate (default 16000 Hz for speech recognition)
 */
export function resampleAudioBuffer(
  inputData: Float32Array,
  inputSampleRate: number,
  targetSampleRate: number = 16000
): Float32Array {
  if (inputSampleRate === targetSampleRate) {
    return inputData;
  }

  const ratio = inputSampleRate / targetSampleRate;
  const outputLength = Math.round(inputData.length / ratio);
  const result = new Float32Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const targetIndex = i * ratio;
    const index1 = Math.floor(targetIndex);
    const index2 = Math.min(index1 + 1, inputData.length - 1);
    const fraction = targetIndex - index1;

    // Linear interpolation
    result[i] = inputData[index1] * (1 - fraction) + inputData[index2] * fraction;
  }

  return result;
}
