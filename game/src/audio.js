// All sound is synthesised with WebAudio: engine hum, sirens, gunshots,
// pickups and a little radio music. No audio files, nothing downloaded.
const STATIONS = [
  { name: 'SOLARA FM 88.4', bass: [55, 55, 65.4, 49], tempo: 112 },
  { name: 'PALMA BEATS 101.1', bass: [55, 49, 55, 82.4], tempo: 128 },
  { name: 'BAY CLASSICS 94.7', bass: [65.4, 58.3, 49, 58.3], tempo: 96 },
  { name: 'NIGHT DRIVE 106.9', bass: [49, 49, 58.3, 43.7], tempo: 88 },
];

export function createAudio() {
  const audio = {
    ctx: null, master: null, muted: false, station: 0,
    engineOsc: null, engineGain: null, sirenOsc: null, sirenGain: null,
    musicTimer: null, musicStep: 0, started: false,
  };
  audio.ensure = function ensure() {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume();
      return;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audio.ctx = new Ctx();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.5;
      audio.master.connect(audio.ctx.destination);
      // Engine: a low sawtooth whose pitch follows speed.
      audio.engineOsc = audio.ctx.createOscillator();
      audio.engineOsc.type = 'sawtooth';
      audio.engineOsc.frequency.value = 55;
      audio.engineGain = audio.ctx.createGain();
      audio.engineGain.gain.value = 0;
      const engineFilter = audio.ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      audio.engineOsc.connect(engineFilter);
      engineFilter.connect(audio.engineGain);
      audio.engineGain.connect(audio.master);
      audio.engineOsc.start();
      // Siren: two-tone square wave, quiet until wanted.
      audio.sirenOsc = audio.ctx.createOscillator();
      audio.sirenOsc.type = 'square';
      audio.sirenOsc.frequency.value = 700;
      audio.sirenGain = audio.ctx.createGain();
      audio.sirenGain.gain.value = 0;
      audio.sirenOsc.connect(audio.sirenGain);
      audio.sirenGain.connect(audio.master);
      audio.sirenOsc.start();
      audio.started = true;
      audio.startMusic();
    } catch (err) {
      audio.ctx = null;
    }
  };
  audio.setEngine = function setEngine(speedRatio, driving) {
    if (!audio.ctx || audio.muted) return;
    const target = driving ? 0.05 + 0.05 * speedRatio : 0;
    audio.engineGain.gain.setTargetAtTime(target, audio.ctx.currentTime, 0.1);
    audio.engineOsc.frequency.setTargetAtTime(52 + 130 * speedRatio, audio.ctx.currentTime, 0.08);
  };
  audio.setSiren = function setSiren(wanted, near) {
    if (!audio.ctx) return;
    const on = wanted > 0 && near;
    audio.sirenGain.gain.setTargetAtTime(on ? 0.018 : 0, audio.ctx.currentTime, 0.2);
    if (on) {
      // The siren climbs with the wanted level: more stars, more urgency.
      const t = audio.ctx.currentTime;
      const base = 620 + wanted * 40;
      audio.sirenOsc.frequency.setTargetAtTime(t % 1 < 0.5 ? base : base + 220, t, 0.05);
    }
  };
  audio.blip = function blip(freq, dur, type, vol) {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime;
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol || 0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + (dur || 0.12));
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start(t);
    osc.stop(t + (dur || 0.12));
  };
  audio.noise = function noise(dur, vol, filterFreq) {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime;
    const len = Math.floor(audio.ctx.sampleRate * dur);
    const buffer = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = audio.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1800;
    const gain = audio.ctx.createGain();
    gain.gain.value = vol || 0.2;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(audio.master);
    src.start(t);
  };
  audio.shot = function shot() { audio.noise(0.14, 0.28, 3200); audio.blip(180, 0.08, 'square', 0.08); };
  audio.punch = function punch() { audio.noise(0.08, 0.16, 900); };
  audio.pickup = function pickup() { audio.blip(660, 0.09, 'sine', 0.14); setTimeout(() => audio.blip(990, 0.14, 'sine', 0.14), 80); };
  // Supply crates each get their own little chime.
  audio.supply = function supply(kind) {
    if (kind === 'health') { audio.blip(523, 0.12, 'sine', 0.15); setTimeout(() => audio.blip(784, 0.18, 'sine', 0.15), 90); }
    else if (kind === 'armor') { audio.blip(392, 0.12, 'triangle', 0.15); setTimeout(() => audio.blip(587, 0.18, 'triangle', 0.15), 90); }
    else { audio.blip(880, 0.08, 'square', 0.1); setTimeout(() => audio.blip(1174, 0.12, 'square', 0.1), 70); }
  };
  audio.crash = function crash() { audio.noise(0.22, 0.22, 700); };
  audio.missionDone = function missionDone() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => audio.blip(f, 0.22, 'triangle', 0.16), i * 110));
  };
  // Two-note confirm when the player picks a difficulty on the title screen.
  audio.select = function select() {
    audio.blip(740, 0.08, 'sine', 0.12);
    setTimeout(() => audio.blip(988, 0.1, 'sine', 0.12), 70);
  };
  audio.busted = function busted() {
    [392, 330, 262].forEach((f, i) => setTimeout(() => audio.blip(f, 0.3, 'sawtooth', 0.1), i * 160));
  };
  audio.toggleMute = function toggleMute() {
    audio.muted = !audio.muted;
    if (audio.master) audio.master.gain.value = audio.muted ? 0 : 0.5;
    return audio.muted;
  };
  audio.cycleStation = function cycleStation() {
    audio.station = (audio.station + 1) % STATIONS.length;
    audio.musicStep = 0;
    return STATIONS[audio.station].name;
  };
  audio.stationName = function stationName() { return STATIONS[audio.station].name; };
  // A tiny sequencer: bass notes + a hat tick, looped per station.
  audio.startMusic = function startMusic() {
    if (!audio.ctx || audio.musicTimer) return;
    const station = () => STATIONS[audio.station];
    audio.musicTimer = setInterval(() => {
      if (!audio.ctx || audio.muted) return;
      const st = station();
      const beat = 60000 / st.tempo / 2;
      const note = st.bass[audio.musicStep % st.bass.length];
      audio.blip(note, 0.22, 'triangle', 0.07);
      if (audio.musicStep % 2 === 0) audio.noise(0.03, 0.03, 6000);
      audio.musicStep += 1;
      void beat;
    }, 60000 / STATIONS[0].tempo / 2);
  };
  return audio;
}
