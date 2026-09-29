/**
 * Web Audio 程序化音效 + 跟踏频的生成式配乐
 * 全程合成，无音频文件
 */
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.ready = false;
    this.musicTimer = 0;
    this.nextNoteTime = 0;
    this.beat = 0;
    this.scale = [0, 3, 5, 7, 10, 12, 15, 17]; // minor pentatonic-ish
    this.rootHz = 110;
    this.nodes = {};
  }

  async start() {
    if (this.ready) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);

    // compressor glue
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    comp.connect(this.master);
    this.bus = comp;

    // --- Wind ---
    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.05;
    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 420;
    windFilter.Q.value = 0.7;
    const noiseBuf = this.makeNoise(2);
    const windSrc = this.ctx.createBufferSource();
    windSrc.buffer = noiseBuf;
    windSrc.loop = true;
    windSrc.connect(windFilter);
    windFilter.connect(this.windGain);
    this.windGain.connect(this.bus);
    windSrc.start();
    this.nodes.windFilter = windFilter;

    // --- Ocean wash ---
    this.oceanGain = this.ctx.createGain();
    this.oceanGain.gain.value = 0.08;
    const oceanFilter = this.ctx.createBiquadFilter();
    oceanFilter.type = 'lowpass';
    oceanFilter.frequency.value = 280;
    const oceanSrc = this.ctx.createBufferSource();
    oceanSrc.buffer = noiseBuf;
    oceanSrc.loop = true;
    oceanSrc.connect(oceanFilter);
    oceanFilter.connect(this.oceanGain);
    this.oceanGain.connect(this.bus);
    oceanSrc.start();
    this.nodes.oceanFilter = oceanFilter;

    // --- Tire hum ---
    this.tireGain = this.ctx.createGain();
    this.tireGain.gain.value = 0.0;
    const tireOsc = this.ctx.createOscillator();
    tireOsc.type = 'sawtooth';
    tireOsc.frequency.value = 48;
    const tireFilter = this.ctx.createBiquadFilter();
    tireFilter.type = 'lowpass';
    tireFilter.frequency.value = 180;
    tireOsc.connect(tireFilter);
    tireFilter.connect(this.tireGain);
    this.tireGain.connect(this.bus);
    tireOsc.start();

    // --- Music pad ---
    this.padGain = this.ctx.createGain();
    this.padGain.gain.value = 0.08;
    const padFilter = this.ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 900;
    this.padGain.connect(padFilter);
    padFilter.connect(this.bus);
    this.nodes.padFilter = padFilter;

    // three pad oscillators
    this.padOscs = [];
    for (let i = 0; i < 3; i++) {
      const o = this.ctx.createOscillator();
      o.type = i === 2 ? 'triangle' : 'sine';
      o.frequency.value = this.rootHz * [1, 1.5, 2][i];
      const g = this.ctx.createGain();
      g.gain.value = [0.5, 0.28, 0.16][i];
      o.connect(g);
      g.connect(this.padGain);
      o.start();
      this.padOscs.push({ o, g });
    }

    // pluck scheduler will run in update
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.ready = true;
  }

  makeNoise(seconds = 1) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ctx.currentTime, 0.05);
    }
  }

  /** 每帧：根据速度/踏频驱动音色 */
  update(dt, speed, cadence, nightMix, mode) {
    if (!this.ready || this.muted) return;
    const t = this.ctx.currentTime;
    const s = Math.min(Math.max(speed, 0), 28);

    // wind
    this.windGain.gain.setTargetAtTime(0.03 + s * 0.012, t, 0.1);
    this.nodes.windFilter.frequency.setTargetAtTime(300 + s * 22, t, 0.15);

    // ocean
    this.oceanGain.gain.setTargetAtTime(0.06 + nightMix * 0.04, t, 0.2);
    this.nodes.oceanFilter.frequency.setTargetAtTime(220 + Math.sin(t * 0.3) * 40, t, 0.2);

    // tire
    this.tireGain.gain.setTargetAtTime(s > 0.5 ? 0.012 + s * 0.0018 : 0, t, 0.1);

    // pad filter brightness with speed
    this.nodes.padFilter.frequency.setTargetAtTime(500 + s * 45 + (1 - nightMix) * 200, t, 0.2);

    // schedule notes (tempo follows cadence)
    const bpm = 56 + cadence * 1.35;
    const spb = 60 / bpm;
    while (this.nextNoteTime < t + 0.15) {
      this.scheduleBeat(this.nextNoteTime, spb, speed);
      this.nextNoteTime += spb / 2;
      this.beat++;
    }
  }

  scheduleBeat(when, spb, speed) {
    // bass on downbeats
    if (this.beat % 4 === 0) {
      this.pluck(when, this.rootHz / 2, 0.12, 'triangle', 0.35);
    }
    // melody arpeggio
    if (this.beat % 2 === 0 || Math.random() > 0.55) {
      const deg = this.scale[this.beat % this.scale.length];
      const oct = Math.random() > 0.7 ? 2 : 1;
      const hz = this.rootHz * oct * Math.pow(2, deg / 12);
      this.pluck(when, hz, 0.18 + Math.min(speed / 40, 0.1), 'sine', 0.22);
    }
    // sparkle high
    if (this.beat % 8 === 3) {
      this.pluck(when, this.rootHz * 4, 0.08, 'square', 0.08);
    }
  }

  pluck(when, freq, dur, type = 'sine', gain = 0.2) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g);
    g.connect(this.bus);
    o.start(when);
    o.stop(when + dur + 0.05);
  }

  // ---- SFX ----
  catchFish() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.pluck(t, 660, 0.15, 'triangle', 0.28);
    this.pluck(t + 0.07, 880, 0.18, 'triangle', 0.24);
    this.pluck(t + 0.14, 1174, 0.22, 'sine', 0.2);
  }

  jump() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(660, t + 0.18);
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    o.connect(g);
    g.connect(this.bus);
    o.start(t);
    o.stop(t + 0.3);
  }

  wing() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.makeNoise(0.5);
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(1200, t + 0.35);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    src.connect(f);
    f.connect(g);
    g.connect(this.bus);
    src.start(t);
  }

  achievement() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    [523, 659, 784, 1046].forEach((hz, i) => {
      this.pluck(t + i * 0.09, hz, 0.28, 'triangle', 0.22);
    });
  }

  lane() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.pluck(t, 392, 0.08, 'square', 0.1);
    this.pluck(t + 0.05, 494, 0.1, 'square', 0.08);
  }
}
