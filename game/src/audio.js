// Synthesised sound for Solara Bay: no audio files, everything is built
// from WebAudio oscillators and noise. The radio stations are tiny step
// sequencers playing different scales and tempos.

import { RADIO_STATIONS } from './config.js';

export function createAudio() {
  return {
    ctx: null,
    master: null,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenPhase: 0,
    muted: false,
    station: 0,
    radioTimer: 0,
    radioStep: 0,
    radioGain: null,
    started: false,
  };
}

export function ensureAudio(A) {
  if (A.started) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    A.ctx = new Ctx();
    A.master = A.ctx.createGain();
    A.master.gain.value = A.muted ? 0 : 0.5;
    A.master.connect(A.ctx.destination);

    A.engineOsc = A.ctx.createOscillator();
    A.engineOsc.type = 'sawtooth';
    A.engineOsc.frequency.value = 55;
    A.engineGain = A.ctx.createGain();
    A.engineGain.gain.value = 0;
    const engineFilter = A.ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    A.engineOsc.connect(engineFilter);
    engineFilter.connect(A.engineGain);
    A.engineGain.connect(A.master);
    A.engineOsc.start();

    A.sirenOsc = A.ctx.createOscillator();
    A.sirenOsc.type = 'triangle';
    A.sirenOsc.frequency.value = 660;
    A.sirenGain = A.ctx.createGain();
    A.sirenGain.gain.value = 0;
    A.sirenOsc.connect(A.sirenGain);
    A.sirenGain.connect(A.master);
    A.sirenOsc.start();

    A.radioGain = A.ctx.createGain();
    A.radioGain.gain.value = 0.16;
    A.radioGain.connect(A.master);
    A.started = true;
  } catch {
    A.started = false;
  }
}

export function setMuted(A, muted) {
  A.muted = muted;
  if (A.master && A.ctx) {
    A.master.gain.setTargetAtTime(muted ? 0 : 0.5, A.ctx.currentTime, 0.05);
  }
}

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function blip(A, freq, dur, type, vol, when = 0) {
  if (!A.ctx || !A.started) return;
  const t = A.ctx.currentTime + when;
  const osc = A.ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const g = A.ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g);
  g.connect(A.radioGain);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export function playShot(A) {
  if (!A.ctx || !A.started || A.muted) return;
  try {
    const t = A.ctx.currentTime;
    const len = Math.floor(A.ctx.sampleRate * 0.12);
    const buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = A.ctx.createBufferSource();
    src.buffer = buf;
    const g = A.ctx.createGain();
    g.gain.value = 0.5;
    const f = A.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 900;
    src.connect(f);
    f.connect(g);
    g.connect(A.master);
    src.start(t);
    void t;
  } catch {
    // Sound is garnish; never let it break the game.
  }
}

export function playPickup(A) {
  blip(A, 880, 0.12, 'sine', 0.5);
  blip(A, 1318, 0.18, 'sine', 0.4, 0.09);
}

export function playMissionDone(A) {
  const notes = [523, 659, 784, 1046];
  notes.forEach((f, i) => blip(A, f, 0.22, 'triangle', 0.45, i * 0.11));
}

export function playBusted(A) {
  const notes = [392, 330, 262, 196];
  notes.forEach((f, i) => blip(A, 0.3, 'sawtooth', 0.3, i * 0.16));
}

// Called every frame: engine pitch follows speed, sirens wail with the
// wanted level, and the radio steps through its pattern.
export function updateAudio(A, S, dt) {
  if (!A.started || !A.ctx) return;
  const p = S.player;
  const speed = p.speed || 0;
  const driving = p.vehicle || p.boat;
  if (A.engineOsc && A.engineGain) {
    const target = driving ? 0.05 + Math.min(0.16, speed / 4200) : 0;
    A.engineGain.gain.setTargetAtTime(target, A.ctx.currentTime, 0.1);
    A.engineOsc.frequency.setTargetAtTime(52 + speed * 0.14, A.ctx.currentTime, 0.08);
  }
  if (A.sirenOsc && A.sirenGain) {
    const wanted = S.wanted || 0;
    A.sirenPhase += dt * (wanted >= 4 ? 5.2 : 3.4);
    const twoTone = Math.sin(A.sirenPhase) > 0 ? 715 : 520;
    A.sirenOsc.frequency.setTargetAtTime(twoTone, A.ctx.currentTime, 0.05);
    A.sirenGain.gain.setTargetAtTime(wanted > 0 ? 0.028 + wanted * 0.006 : 0, A.ctx.currentTime, 0.2);
  }
  // Radio: one soft note per step, bass on the beat.
  const station = RADIO_STATIONS[A.station % RADIO_STATIONS.length];
  A.radioTimer -= dt;
  if (A.radioTimer <= 0) {
    A.radioTimer = 60 / station.bpm / 2;
    const step = A.radioStep++;
    const scale = station.scale;
    const degree = scale[step % scale.length] + 12 * Math.floor((step % 16) / scale.length);
    blip(A, midiToFreq(station.root + degree), 0.22, 'square', 0.10);
    if (step % 4 === 0) blip(A, midiToFreq(station.root - 12), 0.3, 'sine', 0.22);
  }
}

export function cycleStation(A) {
  A.station = (A.station + 1) % RADIO_STATIONS.length;
  return RADIO_STATIONS[A.station].name;
}

export function stationName(A) {
  return RADIO_STATIONS[A.station % RADIO_STATIONS.length].name;
}
