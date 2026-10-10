const SAMPLE_RATE = 16000;

export function int16ChunksToWav(chunks: ArrayBuffer[], sampleRate = SAMPLE_RATE): Blob {
  let totalLength = 0;
  for (const chunk of chunks) {
    totalLength += chunk.byteLength / 2;
  }

  const pcm = new Int16Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    const part = new Int16Array(chunk);
    pcm.set(part, offset);
    offset += part.length;
  }

  const buffer = new ArrayBuffer(44 + pcm.byteLength);
  const view = new DataView(buffer);

  const writeString = (pos: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(pos + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + pcm.byteLength, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, pcm.byteLength, true);

  new Uint8Array(buffer, 44).set(new Uint8Array(pcm.buffer));

  return new Blob([buffer], { type: 'audio/wav' });
}

export function estimateDurationMs(chunks: ArrayBuffer[], sampleRate = SAMPLE_RATE): number {
  let samples = 0;
  for (const chunk of chunks) {
    samples += chunk.byteLength / 2;
  }
  return Math.round((samples / sampleRate) * 1000);
}
