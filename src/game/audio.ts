import type { Ability } from './rules';

export const HERO_THEME = [
  220,
  261.63,
  329.63,
  392,
  329.63,
  261.63,
  293.66,
  349.23,
  440,
  349.23,
  293.66,
  261.63,
] as const;

export type AudioCue =
  | Ability
  | 'start'
  | 'transform'
  | 'shield'
  | 'monster-hit'
  | 'monster-attack'
  | 'defeat'
  | 'explosion'
  | 'revive'
  | 'flashlight'
  | 'stone'
  | 'demogea-burst';

export class BattleAudio {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;

  start() {
    if (this.context) {
      void this.context.resume();
      return;
    }
    this.context = new AudioContext();
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = 0.68;
    this.masterGain.connect(this.context.destination);

    this.musicGain = this.context.createGain();
    this.musicGain.gain.value = 0.24;
    this.musicGain.connect(this.masterGain);
    this.sfxGain = this.context.createGain();
    this.sfxGain.gain.value = 0.72;
    this.sfxGain.connect(this.masterGain);

    this.scheduleThemeStep();
    this.musicTimer = window.setInterval(() => this.scheduleThemeStep(), 360);
    void this.context.resume();
  }

  tone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    delay = 0,
    gain = 0.045,
  ) {
    if (!this.context || !this.sfxGain) return;
    this.sweep(frequency, frequency, duration, type, gain, delay, this.sfxGain);
  }

  play(cue: AudioCue) {
    if (!this.context || !this.sfxGain) return;
    switch (cue) {
      case 'punch':
        this.sweep(180, 72, 0.13, 'square', 0.08);
        this.noise(0.07, 0.045, 900);
        break;
      case 'kick':
        this.sweep(130, 48, 0.18, 'sawtooth', 0.09);
        this.noise(0.1, 0.055, 720);
        break;
      case 'boomerang':
        this.sweep(480, 1120, 0.3, 'triangle', 0.06);
        break;
      case 'delacium':
        this.sweep(92, 240, 0.38, 'sawtooth', 0.075);
        this.noise(0.16, 0.035, 420);
        break;
      case 'zeperion':
        this.sweep(260, 920, 0.42, 'sine', 0.07);
        this.sweep(520, 1040, 0.3, 'triangle', 0.035, 0.04);
        break;
      case 'runboldt':
        this.sweep(420, 1320, 0.3, 'triangle', 0.062);
        this.noise(0.12, 0.025, 1800);
        break;
      case 'evolution-ray':
        this.sweep(440, 880, 0.45, 'sine', 0.065);
        this.sweep(660, 1320, 0.38, 'triangle', 0.035, 0.06);
        break;
      case 'super-lightning':
        this.sweep(150, 1080, 0.32, 'sawtooth', 0.075);
        this.noise(0.24, 0.06, 2600);
        break;
      case 'start':
        this.sweep(220, 440, 0.24, 'triangle', 0.045);
        this.sweep(330, 660, 0.28, 'sine', 0.035, 0.12);
        break;
      case 'transform':
        this.sweep(260, 1040, 0.58, 'sine', 0.08);
        this.sweep(390, 1560, 0.44, 'triangle', 0.04, 0.14);
        break;
      case 'shield':
        this.sweep(260, 74, 0.2, 'square', 0.055);
        this.noise(0.12, 0.04, 520);
        break;
      case 'monster-hit':
        this.noise(0.08, 0.04, 380);
        this.sweep(110, 65, 0.12, 'sawtooth', 0.04);
        break;
      case 'monster-attack':
        this.sweep(100, 42, 0.2, 'sawtooth', 0.065);
        this.noise(0.14, 0.045, 300);
        break;
      case 'defeat':
        this.sweep(360, 120, 0.38, 'triangle', 0.06);
        break;
      case 'explosion':
        this.noise(0.42, 0.1, 170);
        this.sweep(190, 38, 0.52, 'sawtooth', 0.095);
        break;
      case 'revive':
      case 'flashlight':
        this.sweep(260, 520, 0.62, 'sine', 0.06);
        this.sweep(390, 780, 0.58, 'triangle', 0.035, 0.16);
        break;
      case 'stone':
        this.sweep(180, 42, 0.72, 'sawtooth', 0.06);
        break;
      case 'demogea-burst':
        this.sweep(120, 1480, 0.56, 'sawtooth', 0.09);
        this.noise(0.48, 0.12, 2200);
        this.sweep(740, 1480, 0.38, 'sine', 0.06, 0.08);
        break;
    }
  }

  private scheduleThemeStep() {
    if (!this.context || !this.musicGain) return;
    const note = HERO_THEME[this.musicStep % HERO_THEME.length];
    this.sweep(note, note * 1.01, 0.28, 'triangle', 0.045, 0, this.musicGain);
    if (this.musicStep % 4 === 0) {
      this.sweep(note / 2, note / 2, 0.34, 'sine', 0.035, 0, this.musicGain);
    }
    this.musicStep += 1;
  }

  private sweep(
    startFrequency: number,
    endFrequency: number,
    duration: number,
    type: OscillatorType,
    gainValue: number,
    delay = 0,
    output: GainNode = this.sfxGain as GainNode,
  ) {
    if (!this.context || !output) return;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    const startAt = this.context.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(20, startFrequency), startAt);
    if (Math.abs(endFrequency - startFrequency) > 0.5) {
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(20, endFrequency),
        startAt + duration,
      );
    }
    envelope.gain.setValueAtTime(0.0001, startAt);
    envelope.gain.exponentialRampToValueAtTime(gainValue, startAt + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    oscillator.connect(envelope).connect(output);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.03);
  }

  private noise(duration: number, gainValue: number, filterFrequency: number) {
    if (!this.context || !this.sfxGain) return;
    const frameCount = Math.max(1, Math.floor(this.context.sampleRate * duration));
    const buffer = this.context.createBuffer(1, frameCount, this.context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < frameCount; index += 1) {
      channel[index] = Math.random() * 2 - 1;
    }
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const envelope = this.context.createGain();
    const now = this.context.currentTime;
    source.buffer = buffer;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFrequency, now);
    envelope.gain.setValueAtTime(gainValue, now);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter).connect(envelope).connect(this.sfxGain);
    source.start(now);
    source.stop(now + duration);
  }
}
