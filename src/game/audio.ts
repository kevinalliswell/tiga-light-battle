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
  private sfxGain: GainNode | null = null;
  private sfxFilter: BiquadFilterNode | null = null;
  private muted = false;
  private readonly song = new Audio();
  private songUrl: string | null = null;
  private climax = false;
  private musicGain:GainNode|null=null;
  private nextBeat=0;
  private beat=0;

  setSong(file: File) {
    this.song.pause();
    if (this.songUrl) URL.revokeObjectURL(this.songUrl);
    this.songUrl = URL.createObjectURL(file);
    this.song.src = this.songUrl;
    this.song.loop = true;
    this.song.volume = 0.58;
    this.song.muted = this.muted;
    this.updateMusicGain();
    if (this.climax) void this.song.play().catch(() => undefined);
  }

  setClimax(active: boolean) {
    if (active === this.climax) return;
    this.climax = active;
    this.updateMusicGain();
    if (active && this.songUrl) void this.song.play().catch(() => undefined);
    else this.song.pause();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.song.muted = muted;
    if (this.masterGain) this.masterGain.gain.value = muted ? 0 : 0.68;
  }

  isMuted() {
    return this.muted;
  }

  start() {
    if (this.context) {
      void this.context.resume();
      return;
    }
    this.context = new AudioContext();
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 0.68;
    this.masterGain.connect(this.context.destination);

    this.sfxGain = this.context.createGain();
    this.sfxGain.gain.value = 0.48;
    this.sfxFilter = this.context.createBiquadFilter();
    this.sfxFilter.type = 'lowpass';
    this.sfxFilter.frequency.value = 3600;
    this.sfxGain.connect(this.sfxFilter).connect(this.masterGain);
    this.musicGain=this.context.createGain();
    this.musicGain.gain.value=0;
    this.musicGain.connect(this.masterGain);
    window.setInterval(()=>this.scheduleScore(),120);

    void this.context.resume();
  }

  private updateMusicGain() {
    if(!this.context||!this.musicGain)return;
    this.musicGain.gain.setTargetAtTime(this.climax&&!this.songUrl?1:0,this.context.currentTime,.5);
  }

  /** An original layered score; importing a recording replaces this accompaniment. */
  private scheduleScore() {
    if(!this.context||!this.musicGain)return;
    if(!this.climax||this.songUrl){this.nextBeat=this.context.currentTime;return;}
    this.updateMusicGain();
    if(this.nextBeat<this.context.currentTime)this.nextBeat=this.context.currentTime+.05;
    const chords=[[220,261.63,329.63],[174.61,220,261.63],[196,246.94,293.66],[164.81,196,246.94]];
    while(this.nextBeat<this.context.currentTime+.45) {
      const step=this.beat%16,chord=chords[Math.floor(this.beat/16)%4];
      const delay=this.nextBeat-this.context.currentTime;
      if(step%4===0)for(const frequency of chord) {
        this.sweep(frequency,frequency,1.5,'sine',.018,delay,this.musicGain);
        this.sweep(frequency*2,frequency*2,1.3,'triangle',.006,delay,this.musicGain);
      }
      this.sweep(chord[0]/2,chord[0]/2,.42,'sine',.033,delay,this.musicGain);
      this.sweep(HERO_THEME[this.beat%HERO_THEME.length]*2,HERO_THEME[this.beat%HERO_THEME.length]*2,.48,'sine',.017,delay,this.musicGain);
      if(step%4===0)this.sweep(110,42,.18,'sine',.055,delay,this.musicGain);
      this.nextBeat+=.28;this.beat++;
    }
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
        this.sweep(170, 58, 0.15, 'sine', 0.078);
        this.sweep(520, 180, 0.1, 'triangle', 0.04, 0.01);
        this.noise(0.05, 0.034, 2500, 'bandpass');
        break;
      case 'kick':
        this.sweep(240, 52, 0.22, 'sine', 0.095);
        this.sweep(760, 160, 0.28, 'triangle', 0.052, 0.015);
        this.noise(0.16, 0.044, 4300, 'bandpass');
        this.sweep(92, 44, 0.26, 'sine', 0.072, 0.025);
        break;
      case 'boomerang':
        this.sweep(360, 980, 0.34, 'sine', 0.05);
        this.sweep(720, 1480, 0.25, 'triangle', 0.028, 0.04);
        this.noise(0.16, 0.016, 3800, 'highpass');
        break;
      case 'delacium':
        this.sweep(86, 260, 0.4, 'triangle', 0.068);
        this.sweep(170, 92, 0.26, 'sine', 0.032, 0.06);
        this.noise(0.18, 0.026, 1800, 'lowpass');
        break;
      case 'zeperion':
      case 'tiga-freeze':
      case 'tiga-slash':
      case 'flying-charge':
        this.sweep(230, 940, 0.46, 'sine', 0.074);
        this.sweep(520, 1460, 0.34, 'triangle', 0.032, 0.05);
        this.noise(0.11, 0.018, 5200, 'highpass');
        break;
      case 'runboldt':
        this.sweep(330, 1240, 0.38, 'triangle', 0.07);
        this.sweep(740, 1680, 0.26, 'sine', 0.024, 0.05);
        this.noise(0.12, 0.022, 4400, 'bandpass');
        break;
      case 'evolution-ray':
        this.sweep(360, 920, 0.5, 'sine', 0.078);
        this.sweep(660, 1560, 0.44, 'triangle', 0.04, 0.06);
        this.noise(0.14, 0.018, 5600, 'highpass');
        break;
      case 'super-lightning':
        this.sweep(120, 1020, 0.4, 'triangle', 0.082);
        this.sweep(620, 1880, 0.3, 'sine', 0.032, 0.08);
        this.noise(0.22, 0.04, 2400, 'bandpass');
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
        this.noise(0.08, 0.04, 520, 'lowpass');
        this.sweep(148, 62, 0.18, 'sine', 0.06);
        this.sweep(860, 220, 0.08, 'triangle', 0.026, 0.015);
        break;
      case 'monster-attack':
        this.sweep(120, 46, 0.28, 'triangle', 0.07);
        this.sweep(270, 88, 0.24, 'sine', 0.035, 0.04);
        this.noise(0.14, 0.036, 420, 'lowpass');
        break;
      case 'defeat':
        this.sweep(360, 128, 0.44, 'sine', 0.05);
        break;
      case 'explosion':
        this.noise(0.5, 0.1, 180, 'lowpass');
        this.sweep(180, 36, 0.62, 'sine', 0.1);
        this.sweep(340, 76, 0.4, 'triangle', 0.04, 0.02);
        this.noise(0.22, 0.026, 2600, 'highpass');
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
        this.sweep(100, 1420, 0.68, 'triangle', 0.1);
        this.noise(0.46, 0.1, 1900, 'bandpass');
        this.sweep(620, 1460, 0.46, 'sine', 0.06, 0.08);
        this.sweep(72, 30, 0.8, 'sine', 0.06, 0.18);
        break;
    }
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

  private noise(
    duration: number,
    gainValue: number,
    filterFrequency: number,
    filterType: BiquadFilterType = 'lowpass',
  ) {
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
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFrequency, now);
    envelope.gain.setValueAtTime(gainValue, now);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter).connect(envelope).connect(this.sfxGain);
    source.start(now);
    source.stop(now + duration);
  }
}
