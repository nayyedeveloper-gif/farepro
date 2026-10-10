import { RecordingPresets, AudioQuality, IOSOutputFormat } from 'expo-audio';
import type { RecordingOptions } from 'expo-audio';
import {
  cacheDirectory,
  copyAsync,
  getInfoAsync,
  readAsStringAsync,
  EncodingType,
} from 'expo-file-system/legacy';

/** Voice-optimized; document dir avoids unreadable Expo Go cache paths on Android */
export const PTT_RECORDING_OPTIONS: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  directory: 'document',
  extension: '.m4a',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 64000,
  android: {
    extension: '.m4a',
    sampleRate: 16000,
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
  },
  ios: {
    extension: '.m4a',
    sampleRate: 16000,
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.MEDIUM,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Read recorder output with retries; copies to app cache when direct read fails (Android Expo Go). */
export async function readRecordingAsBase64(sourceUri: string): Promise<string> {
  const copyDest = `${cacheDirectory}ptt_send_${Date.now()}.m4a`;
  let lastError: unknown;

  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      const info = await getInfoAsync(sourceUri);
      if (!info.exists || (info.size !== undefined && info.size === 0)) {
        await sleep(50 * (attempt + 1));
        continue;
      }

      try {
        await copyAsync({ from: sourceUri, to: copyDest });
        return await readAsStringAsync(copyDest, { encoding: EncodingType.Base64 });
      } catch {
        return await readAsStringAsync(sourceUri, { encoding: EncodingType.Base64 });
      }
    } catch (err) {
      lastError = err;
      await sleep(50 * (attempt + 1));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Recording file not readable');
}

export async function resolveRecordingUri(
  getUri: () => string | null,
): Promise<string | null> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const uri = getUri();
    if (uri) {
      try {
        const info = await getInfoAsync(uri);
        if (info.exists && (info.size === undefined || info.size > 0)) return uri;
      } catch {
        // keep polling
      }
    }
    await sleep(50 * (attempt + 1));
  }
  return getUri();
}
