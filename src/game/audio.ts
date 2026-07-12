import type { Ability } from './rules';

export const HERO_THEME = [
  220,
  261.63,
  329.63,
  392,
  440,
  392,
  329.63,
  261.63,
  293.66,
  349.23,
  440,
  523.25,
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
  private musicFilter: BiquadFilterNode | null = null;
  private sfxFilter: BiquadFilterNode | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;

  start() {
    if (this.context) {
      void this.context.resume();
      return;
    }
    this.context = new AudioContext();
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = 0.72;
    this.masterGain.connect(this.context.destination);

    this.musicGain = this.context.createGain();
    this.musicGain.gain.value = 0.3;
    this.musicFilter = this.context.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 2800;
    this.musicGain.connect(this.musicFilter).connect(this.masterGain);
    this.sfxGain = this.context.createGain();
    this.sfxGain.gain.value = 0.64;
    this.sfxFilter = this.context.createBiquadFilter();
    this.sfxFilter.type = 'lowpass';
    this.sfxFilter.frequency.value = 5200;
    this.sfxGain.connect(this.sfxFilter).connect(this.masterGain);

    this.scheduleThemeStep();
    this.musicTimer = window.setInterval(() => this.scheduleThemeStep(), 420);
    void this.context.resume();
  }

  tone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    delay = 0,
    gain = 0.02,
  ) {
    if (!this.context || !this.sfxGain) return;
    const softenedType = type === 'square' || type === 'sawtooth' ? 'triangle' : type;
    this.sweep(frequency, frequency, duration, softenedType, gain, delay, this.sfxGain);
  }

  play(cue: AudioCue) {
    if (!this.context || !this.sfxGain) return;
    switch (cue) {
      case 'punch':
        this.sweep(180, 78, 0.13, 'sine', 0.052);
        this.noise(0.055, 0.022, 720);
        break;
      case 'kick':
        this.sweep(125, 48, 0.22, 'sine', 0.062);
        this.noise(0.09, 0.028, 560);
        break;
      case 'boomerang':
        this.sweep(460, 980, 0.34, 'sine', 0.045);
        this.sweep(720, 1240, 0.25, 'triangle', 0.018, 0.04);
        break;
      case 'delacium':
        this.sweep(105, 290, 0.42, 'triangle', 0.055);
        this.sweep(210, 120, 0.28, 'sine', 0.024, 0.05);
        break;
      case 'zeperion':
        this.sweep(270, 860, 0.44, 'sine', 0.058);
        this.sweep(540, 1280, 0.32, 'triangle', 0.025, 0.05);
        break;
      case 'runboldt':
        this.sweep(380, 1120, 0.36, 'triangle', 0.054);
        this.sweep(760, 1480, 0.24, 'sine', 0.018, 0.05);
        break;
      case 'evolution-ray':
        this.sweep(440, 880, 0.48, 'sine', 0.06);
        this.sweep(660, 1320, 0.4, 'triangle', 0.028, 0.06);
        break;
      case 'super-lightning':
        this.sweep(160, 940, 0.38, 'triangle', 0.064);
        this.noise(0.18, 0.028, 1800);
        break;
      case 'start':
        this.sweep(220, 440, 0.3, 'sine', 0.032);
        this.sweep(330, 660, 0.34, 'triangle', 0.026, 0.13);
        break;
      case 'transform':
        this.sweep(260, 1040, 0.64, 'sine', 0.065);
        this.sweep(390, 1560, 0.5, 'triangle', 0.03, 0.15);
        break;
      case 'shield':
        this.sweep(330, 190, 0.24, 'sine', 0.052);
        this.sweep(660, 460, 0.16, 'triangle', 0.018, 0.02);
        break;
      case 'monster-hit':
        this.noise(0.07, 0.024, 360);
        this.sweep(130, 72, 0.14, 'sine', 0.03);
        break;
      case 'monster-attack':
        this.sweep(105, 48, 0.24, 'triangle', 0.05);
        this.noise(0.12, 0.026, 280);
        break;
      case 'defeat':
        this.sweep(360, 128, 0.44, 'sine', 0.05);
        break;
      case 'explosion':
        this.noise(0.46, 0.07, 160);
        this.sweep(170, 38, 0.56, 'sine', 0.075);
        this.sweep(340, 80, 0.36, 'triangle', 0.026, 0.02);
        break;
      case 'revive':
      case 'flashlight':
        this.sweep(260, 520, 0.7, 'sine', 0.052);
        this.sweep(390, 780, 0.62, 'triangle', 0.026, 0.16);
        break;
      case 'stone':
        this.sweep(180, 42, 0.8, 'triangle', 0.05);
        break;
      case 'demogea-burst':
        this.sweep(120, 1320, 0.62, 'triangle', 0.075);
        this.noise(0.42, 0.075, 1800);
        this.sweep(660, 1320, 0.42, 'sine', 0.045, 0.08);
        break;
    }
  }

  private scheduleThemeStep() {
    if (!this.context || !this.musicGain) return;
    const note = HERO_THEME[this.musicStep % HERO_THEME.length];
    this.sweep(note, note * 1.01, 0.34, 'triangle', 0.052, 0, this.musicGain);
    if (this.musicStep % 4 === 0) {
      this.sweep(note / 2, note / 2, 0.4, 'sine', 0.042, 0, this.musicGain);
    }
    if (this.musicStep % 8 === 4) {
      this.sweep(note * 1.5, note * 1.5, 0.36, 'sine', 0.018, 0, this.musicGain);
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
