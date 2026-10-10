/**
 * SoundService - Generates Telegram-style sounds via Web Audio API.
 * No external files needed; all tones are synthesized programmatically.
 */

export type RingtoneId = 'telegram' | 'classic' | 'minimal' | 'pulse';
export type NotificationSoundId = 'message' | 'pop' | 'chime' | 'bell';

interface SoundSettings {
  ringtoneId: RingtoneId;
  notificationSoundId: NotificationSoundId;
  ringVolume: number;       // 0-1
  notifVolume: number;      // 0-1
  messageSentEnabled: boolean;
}

const DEFAULT_SETTINGS: SoundSettings = {
  ringtoneId: 'telegram',
  notificationSoundId: 'message',
  ringVolume: 0.7,
  notifVolume: 0.5,
  messageSentEnabled: true,
};

const SETTINGS_KEY = 'tg_sound_settings';

function loadSettings(): SoundSettings {
  try {
    const s = localStorage.getItem(SETTINGS_KEY);
    if (s) return { ...DEFAULT_SETTINGS, ...JSON.parse(s) };
  } catch {
    // ignore
  }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(s: SoundSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

class SoundService {
  private ctx: AudioContext | null = null;
  private ringInterval: ReturnType<typeof setInterval> | null = null;
  private settings: SoundSettings = loadSettings();

  private getCtx(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  getSettings(): SoundSettings {
    return { ...this.settings };
  }

  updateSettings(partial: Partial<SoundSettings>) {
    this.settings = { ...this.settings, ...partial };
    saveSettings(this.settings);
  }

  // ── Envelope helper ────────────────────────────────────────────────────────
  private envelope(
    gain: GainNode,
    attackTime: number,
    sustainTime: number,
    releaseTime: number,
    peakGain: number,
    startTime: number,
  ) {
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + attackTime);
    gain.gain.setValueAtTime(peakGain, startTime + attackTime + sustainTime);
    gain.gain.linearRampToValueAtTime(0, startTime + attackTime + sustainTime + releaseTime);
  }

  // ── Notification Sounds ────────────────────────────────────────────────────

  /** Default Telegram "ding" notification - two-tone ascending chime */
  private playMessageSound(volume: number) {
    const ctx = this.getCtx();
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.value = volume;
    masterGain.connect(ctx.destination);

    const tones = [
      { freq: 880, start: 0, duration: 0.12 },
      { freq: 1108, start: 0.1, duration: 0.18 },
    ];

    tones.forEach(({ freq, start, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(masterGain);
      this.envelope(gain, 0.005, duration * 0.6, duration * 0.4, 0.8, now + start);
      osc.start(now + start);
      osc.stop(now + start + duration + 0.05);
    });
  }

  /** Pop - single soft click */
  private playPopSound(volume: number) {
    const ctx = this.getCtx();
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.value = volume;
    masterGain.connect(ctx.destination);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.08);
    osc.connect(gain);
    gain.connect(masterGain);
    this.envelope(gain, 0.001, 0.03, 0.05, 0.9, now);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  /** Chime - three ascending tones */
  private playChimeSound(volume: number) {
    const ctx = this.getCtx();
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.value = volume;
    masterGain.connect(ctx.destination);

    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(masterGain);
      this.envelope(gain, 0.005, 0.1, 0.15, 0.7, now + i * 0.12);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.3);
    });
  }

  /** Bell - mellow single bell tone */
  private playBellSound(volume: number) {
    const ctx = this.getCtx();
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.value = volume;
    masterGain.connect(ctx.destination);

    [[659.25, 1.0], [1318.5, 0.4], [1979, 0.2]].forEach(([freq, gain]) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq as number;
      osc.connect(g);
      g.connect(masterGain);
      this.envelope(g, 0.002, 0.05, 0.5, gain as number, now);
      osc.start(now);
      osc.stop(now + 0.6);
    });
  }

  // ── Ringtones ──────────────────────────────────────────────────────────────

  /** Telegram default ringtone - iconic ascending arpeggio */
  private playTelegramRingOnce(volume: number) {
    const ctx = this.getCtx();
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.value = volume;
    masterGain.connect(ctx.destination);

    // Telegram signature: E4-A4-C#5-E5-A5 ascending with slight vibrato
    const notes = [
      { freq: 329.63, t: 0.00 },
      { freq: 440.00, t: 0.12 },
      { freq: 554.37, t: 0.24 },
      { freq: 659.25, t: 0.36 },
      { freq: 880.00, t: 0.50 },
      { freq: 659.25, t: 0.64 },
      { freq: 554.37, t: 0.76 },
      { freq: 440.00, t: 0.88 },
    ];

    notes.forEach(({ freq, t }) => {
      const osc = ctx.createOscillator();
      const vibratoOsc = ctx.createOscillator();
      const vibratoGain = ctx.createGain();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;
      vibratoOsc.type = 'sine';
      vibratoOsc.frequency.value = 5.5;
      vibratoGain.gain.value = 4;

      vibratoOsc.connect(vibratoGain);
      vibratoGain.connect(osc.frequency);
      osc.connect(gain);
      gain.connect(masterGain);

      this.envelope(gain, 0.01, 0.07, 0.03, 0.75, now + t);
      osc.start(now + t);
      vibratoOsc.start(now + t);
      osc.stop(now + t + 0.12);
      vibratoOsc.stop(now + t + 0.12);
    });
  }

  /** Classic - simple repeating beep-beep */
  private playClassicRingOnce(volume: number) {
    const ctx = this.getCtx();
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.value = volume;
    masterGain.connect(ctx.destination);

    [0, 0.18].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 440;
      osc.connect(gain);
      gain.connect(masterGain);
      this.envelope(gain, 0.005, 0.1, 0.06, 0.4, now + offset);
      osc.start(now + offset);
      osc.stop(now + offset + 0.17);
    });
  }

  /** Minimal - gentle pulse */
  private playMinimalRingOnce(volume: number) {
    const ctx = this.getCtx();
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.value = volume;
    masterGain.connect(ctx.destination);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 660;
    osc.connect(gain);
    gain.connect(masterGain);
    this.envelope(gain, 0.01, 0.2, 0.3, 0.6, now);
    osc.start(now);
    osc.stop(now + 0.55);
  }

  /** Pulse - rhythmic two-tone pulse */
  private playPulseRingOnce(volume: number) {
    const ctx = this.getCtx();
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.value = volume;
    masterGain.connect(ctx.destination);

    [[440, 0], [660, 0.15], [440, 0.30], [880, 0.45]].forEach(([freq, t]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq as number;
      osc.connect(gain);
      gain.connect(masterGain);
      this.envelope(gain, 0.005, 0.08, 0.05, 0.65, now + (t as number));
      osc.start(now + (t as number));
      osc.stop(now + (t as number) + 0.15);
    });
  }

  // ── Message sent subtle tick ───────────────────────────────────────────────
  playMessageSent() {
    if (!this.settings.messageSentEnabled) return;
    const ctx = this.getCtx();
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.25;
    masterGain.connect(ctx.destination);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 1200;
    osc.connect(gain);
    gain.connect(masterGain);
    this.envelope(gain, 0.002, 0.02, 0.04, 0.8, now);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  playNotification() {
    const v = this.settings.notifVolume;
    switch (this.settings.notificationSoundId) {
      case 'message': return this.playMessageSound(v);
      case 'pop': return this.playPopSound(v);
      case 'chime': return this.playChimeSound(v);
      case 'bell': return this.playBellSound(v);
    }
  }

  private playRingOnce() {
    const v = this.settings.ringVolume;
    switch (this.settings.ringtoneId) {
      case 'telegram': return this.playTelegramRingOnce(v);
      case 'classic': return this.playClassicRingOnce(v);
      case 'minimal': return this.playMinimalRingOnce(v);
      case 'pulse': return this.playPulseRingOnce(v);
    }
  }

  startRingtone() {
    this.stopRingtone();
    this.playRingOnce();
    const interval = this.settings.ringtoneId === 'telegram' ? 1800 : 1200;
    this.ringInterval = setInterval(() => this.playRingOnce(), interval);
  }

  stopRingtone() {
    if (this.ringInterval !== null) {
      clearInterval(this.ringInterval);
      this.ringInterval = null;
    }
  }

  /** Preview a specific tone for settings UI */
  previewRingtone(id: RingtoneId, volume = 0.5) {
    this.stopRingtone();
    const savedId = this.settings.ringtoneId;
    const savedVol = this.settings.ringVolume;
    this.settings.ringtoneId = id;
    this.settings.ringVolume = volume;
    this.playRingOnce();
    this.settings.ringtoneId = savedId;
    this.settings.ringVolume = savedVol;
  }

  previewNotificationSound(id: NotificationSoundId, volume = 0.5) {
    const savedId = this.settings.notificationSoundId;
    const savedVol = this.settings.notifVolume;
    this.settings.notificationSoundId = id;
    this.settings.notifVolume = volume;
    this.playNotification();
    this.settings.notificationSoundId = savedId;
    this.settings.notifVolume = savedVol;
  }
}

export const soundService = new SoundService();
