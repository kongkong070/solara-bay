// Synthesised sound for Solara Bay: everything is WebAudio oscillators
// and filtered noise, so the game ships no audio files at all.
import { clamp } from './util.js';

// Short note lines per radio station, as [midi, beats] pairs.
const STATION_TUNES = [
  // SUNSET FM — breezy major-key line.
  [[69, 1], [72, 1], [76, 1], [74, 0.5], [72, 0.5], [69, 1], [67, 2]],
  // BAY WAVE — laid-back minor groove.
  [[62, 1], [65, 1], [69, 1], [67, 1], [65, 1], [62, 2], [60, 1]],
  // PALM TREE — bouncy island feel.
  [[72, 0.5], [74, 0.5], [76, 1], [79, 1], [76, 0.5], [74, 0.5], [72, 2]],
  // NIGHT DRIVE — moody synth line.
  [[57, 1.5], [60, 1], [63, 1], [65, 1.5], [63, 1], [60, 2]],
];

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    muted: false,
    station: 0,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenLfo: null,
    radioTimer: 0,
    radioStep: 0,
    radioNext: 0,
  };

  audio.ensure = function ensure() {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    audio.ctx = ctx;
    audio.master = ctx.createGain();
    audio.master.gain.value = 0.5;
    audio.master.connect(ctx.destination);
    // Engine hum: a low sawtooth whose pitch follows speed.
    audio.engineOsc = ctx.createOscillator();
    audio.engineOsc.type = 'sawtooth';
    audio.engineOsc.frequency.value = 55;
    audio.engineGain = ctx.createGain();
    audio.engineGain.gain.value = 0;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    audio.engineOsc.connect(engineFilter);
    engineFilter.connect(audio.engineGain);
    audio.engineGain.connect(audio.master);
    audio.engineOsc.start();
    // Police siren: a sine that wails between two pitches.
    audio.sirenOsc = ctx.createOscillator();
    audio.sirenOsc.type = 'sine';
    audio.sirenOsc.frequency.value = 780;
    audio.sirenGain = ctx.createGain();
    audio.sirenGain.gain.value = 0;
    audio.sirenLfo = ctx.createOscillator();
    audio.sirenLfo.type = 'sine';
    audio.sirenLfo.frequency.value = 0.7;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 240;
    audio.sirenLfo.connect(lfoGain);
    lfoGain.connect(audio.sirenOsc.frequency);
    audio.sirenOsc.connect(audio.sirenGain);
    audio.sirenGain.connect(audio.master);
    audio.sirenOsc.start();
    audio.sirenLfo.start();
  };

  audio.setMuted = function setMuted(muted) {
    audio.muted = muted;
    if (audio.master) audio.master.gain.value = muted ? 0 : 0.5;
  };

  audio.toggleMute = function toggleMute() {
    audio.setMuted(!audio.muted);
    return audio.muted;
  };

  audio.setEngine = function setEngine(speedRatio, driving) {
    if (!audio.ctx) return;
    const target = driving ? 0.045 + 0.05 * clamp(speedRatio, 0, 1) : 0.0;
    audio.engineGain.gain.setTargetAtTime(target, audio.ctx.currentTime, 0.08);
    audio.engineOsc.frequency.setTargetAtTime(
      52 + 130 * clamp(speedRatio, 0, 1), audio.ctx.currentTime, 0.1);
  };

  audio.setSiren = function setSiren(wanted) {
    if (!audio.ctx) return;
    const level = wanted > 0 ? 0.02 + 0.012 * wanted : 0;
    audio.sirenGain.gain.setTargetAtTime(level, audio.ctx.currentTime, 0.2);
    audio.sirenLfo.frequency.setTargetAtTime(0.55 + 0.18 * wanted, audio.ctx.currentTime, 0.2);
  };

  function blip(freq, dur, type, vol, when) {
    if (!audio.ctx) return;
    const t = audio.ctx.currentTime + (when || 0);
    const osc = audio.ctx.createOscillator();
    osc.type = type || 'square';
    osc.frequency.value = freq;
    const g = audio.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(audio.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  audio.shot = function shot() {
    if (!audio.ctx) return;
    const dur = 0.09;
    const t = audio.ctx.currentTime;
    const buffer = audio.ctx.createBuffer(1, audio.ctx.sampleRate * dur, audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = audio.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 900;
    const g = audio.ctx.createGain();
    g.gain.value = 0.22;
    src.connect(filter);
    filter.connect(g);
    g.connect(audio.master);
    src.start(t);
  };

  audio.punch = function punch() {
    blip(140, 0.08, 'sine', 0.2);
    blip(90, 0.12, 'sine', 0.16, 0.02);
  };

  audio.chime = function chime() {
    blip(880, 0.14, 'sine', 0.14);
    blip(1318, 0.2, 'sine', 0.12, 0.09);
  };

  audio.select = function select() {
    blip(660, 0.08, 'sine', 0.12);
    blip(990, 0.12, 'sine', 0.1, 0.06);
  };

  audio.busted = function busted() {
    blip(392, 0.3, 'triangle', 0.16);
    blip(311, 0.3, 'triangle', 0.16, 0.22);
    blip(233, 0.5, 'triangle', 0.16, 0.44);
  };

  audio.cash = function cash() {
    blip(1046, 0.1, 'sine', 0.12);
    blip(1568, 0.18, 'sine', 0.1, 0.07);
  };

  audio.nextStation = function nextStation() {
    audio.station = (audio.station + 1) % STATION_TUNES.length;
    audio.radioStep = 0;
    audio.radioNext = 0;
    audio.select();
    return audio.station;
  };

  // Advance the radio: schedule the next note of the current station.
  audio.update = function update(dt) {
    if (!audio.ctx || audio.muted) return;
    audio.radioTimer += dt;
    if (audio.radioTimer < audio.radioNext) return;
    const tune = STATION_TUNES[audio.station];
    const [midi, beats] = tune[audio.radioStep % tune.length];
    const beatLen = 0.42;
    blip(midiToFreq(midi), beatLen * beats * 0.92, 'triangle', 0.055);
    audio.radioNext = audio.radioTimer + beatLen * beats;
    audio.radioStep += 1;
  };

  return audio;
}
