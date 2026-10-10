import { ScreenSharePresets } from 'livekit-client';
import type { ScreenShareCaptureOptions, TrackPublishOptions } from 'livekit-client';

/** What the user asked the browser picker to open on. */
export type ShareSurface = 'monitor' | 'window' | 'browser';

/** detail = documents, code, slides (sharp text); motion = video, animation (smooth). */
export type ShareOptimization = 'detail' | 'motion';

export interface ScreenShareRequest {
  surface: ShareSurface;
  audio: boolean;
  optimizeFor: ShareOptimization;
}

export const SHARE_SURFACES: { id: ShareSurface; label: string; hint: string }[] = [
  { id: 'monitor', label: 'Entire screen', hint: 'Everything on one display' },
  { id: 'window', label: 'Window', hint: 'A single app window' },
  { id: 'browser', label: 'Browser tab', hint: 'One tab, with its sound' },
];

export function isScreenShareSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  return typeof navigator.mediaDevices?.getDisplayMedia === 'function';
}

const isSafari = () =>
  typeof navigator !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

export function buildCaptureOptions(req: ScreenShareRequest): ScreenShareCaptureOptions {
  const opts: ScreenShareCaptureOptions = {
    // Chrome/Edge preselect this tab of the picker; other browsers ignore it.
    video: { displaySurface: req.surface },
    audio: req.audio,
    systemAudio: req.audio ? 'include' : 'exclude',
    selfBrowserSurface: 'exclude',
    surfaceSwitching: 'include',
    contentHint: req.optimizeFor === 'motion' ? 'motion' : 'detail',
    suppressLocalAudioPlayback: false,
  };
  // Safari captures at low resolution whenever a resolution is specified.
  if (!isSafari()) {
    opts.resolution = (req.optimizeFor === 'motion'
      ? ScreenSharePresets.h1080fps30
      : ScreenSharePresets.h1080fps15).resolution;
  }
  return opts;
}

export function buildPublishOptions(req: ScreenShareRequest): TrackPublishOptions {
  const motion = req.optimizeFor === 'motion';
  return {
    screenShareEncoding: (motion ? ScreenSharePresets.h1080fps30 : ScreenSharePresets.h1080fps15).encoding,
    degradationPreference: motion ? 'maintain-framerate' : 'maintain-resolution',
  };
}

/**
 * Maps getDisplayMedia failures to a user-facing message.
 * Returns null when the user simply closed the picker.
 */
export function describeScreenShareError(err: unknown): string | null {
  const e = err as { name?: string; message?: string };
  const name = e?.name || '';
  const message = (e?.message || '').toLowerCase();

  if (name === 'NotAllowedError' || name === 'AbortError') {
    if (message.includes('system')) {
      const mac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || navigator.userAgent);
      return mac
        ? 'Your Mac is blocking screen recording. Open System Settings → Privacy & Security → Screen & System Audio Recording, allow your browser, then restart it.'
        : 'Your operating system blocked screen capture. Allow screen recording for your browser and try again.';
    }
    return null;
  }
  if (name === 'NotFoundError') return 'No screen or window is available to share.';
  if (name === 'NotReadableError') return 'Screen capture failed. Another app may be using it — close it and try again.';
  if (name === 'NotSupportedError' || name === 'TypeError') return 'This browser cannot share the screen. Use Chrome, Edge, Firefox or Safari on a computer.';
  return 'Screen sharing could not start. Please try again.';
}

export function readSharedSurface(track: MediaStreamTrack | undefined): ShareSurface | null {
  const surface = (track?.getSettings() as MediaTrackSettings & { displaySurface?: string })?.displaySurface;
  return surface === 'monitor' || surface === 'window' || surface === 'browser' ? surface : null;
}
