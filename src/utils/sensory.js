/**
 * Zero-Dependency Web Audio API Music Sequencer + Tactile Foley SFX + Haptics Engine
 */

const PENTATONIC_HZ = [
  523.25, // C5
  587.33, // D5
  659.25, // E5
  783.99, // G5
  880.0,  // A5
  1046.5, // C6
  1174.66,// D6
  1318.51 // E6
];

// Note frequencies helper (Hz)
const N = {
  C3: 130.81, D3: 146.83, Eb3: 155.56, E3: 164.81, F3: 174.61, G3: 196.0, Ab3: 207.65, A3: 220.0, Bb3: 233.08, B3: 246.94,
  C4: 261.63, D4: 293.66, Eb4: 311.13, E4: 329.63, F4: 349.23, Gb4: 369.99, G4: 392.0, Ab4: 415.3, A4: 440.0, Bb4: 466.16, B4: 493.88,
  C5: 523.25, D5: 587.33, Eb5: 622.25, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0, Bb5: 932.33, B5: 987.77,
  C6: 1046.5, D6: 1174.66, E6: 1318.51
};

let audioCtx = null;
let muted = false;
let musicDucked = false;

// Active background music state
let activeTheme = null;
let musicTimer = null;
let musicStep = 0;

export function setSensoryMuted(isMuted) {
  muted = Boolean(isMuted);
  if (muted) {
    pauseMusicTimer();
  } else if (activeTheme) {
    resumeMusicTimer();
  }
}

export function isSensoryMuted() {
  return muted;
}

export function setMusicDucked(isDucked) {
  musicDucked = Boolean(isDucked);
}

function getContext() {
  if (muted || typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) {
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function vibrate(pattern) {
  try {
    if (!muted && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // Haptics optional
  }
}

/* ==========================================================================
   Procedural Music Synth Helper
   ========================================================================== */

function playMusicTone(ctx, freq, { type = 'sine', gain = 0.035, dur = 0.22, delay = 0, filterHz = null } = {}) {
  if (!freq || !ctx) return;
  const now = ctx.currentTime + delay;
  const vol = musicDucked ? gain * 0.2 : gain;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);

  g.gain.setValueAtTime(0.0005, now);
  g.gain.linearRampToValueAtTime(vol, now + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0005, now + dur);

  if (filterHz) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(filterHz, now);
    osc.connect(f);
    f.connect(g);
  } else {
    osc.connect(g);
  }
  g.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + dur + 0.02);
}

function playSoftHat(ctx, gain = 0.014) {
  const now = ctx.currentTime;
  const vol = musicDucked ? gain * 0.2 : gain;
  const len = Math.floor(ctx.sampleRate * 0.028);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.setValueAtTime(6500, now);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, now);
  g.gain.exponentialRampToValueAtTime(0.0005, now + 0.028);
  src.connect(hp);
  hp.connect(g);
  g.connect(ctx.destination);
  src.start(now);
}

/* ==========================================================================
   6 Bespoke Per-Game Background Music Loops
   ========================================================================== */

const MUSIC_THEMES = {
  // 1. Story Comprehension: Cozy Music-Box Lullaby (gentle, non-distracting)
  story: {
    stepMs: 360,
    playStep(ctx, step) {
      const s = step % 16;
      const melody = [N.E5, N.G5, N.C6, N.G5, N.F5, N.A5, N.C6, N.A5, N.D5, N.G5, N.B5, N.G5, N.E5, N.G5, N.A5, N.G5];
      const bass = [N.C4, 0, 0, 0, N.F3, 0, 0, 0, N.G3, 0, 0, 0, N.C4, 0, 0, 0];
      playMusicTone(ctx, melody[s], { type: 'sine', gain: 0.024, dur: 0.48 });
      if (bass[s]) playMusicTone(ctx, bass[s], { type: 'triangle', gain: 0.022, dur: 0.9, filterHz: 600 });
    }
  },

  // 2. PHONIX Remi: Cozy Wooden Marimba & Upright Bass Tabletop Groove
  remi: {
    stepMs: 280,
    playStep(ctx, step) {
      const s = step % 16;
      const marimba = [N.G4, 0, N.A4, N.C5, 0, N.E5, N.D5, 0, N.C5, 0, N.A4, N.G4, 0, N.A4, N.G4, 0];
      const bass = [N.C3, 0, 0, N.G3, N.A3, 0, 0, N.E3, N.F3, 0, 0, N.C3, N.G3, 0, N.D3, 0];
      if (marimba[s]) playMusicTone(ctx, marimba[s], { type: 'triangle', gain: 0.036, dur: 0.2, filterHz: 1800 });
      if (bass[s]) playMusicTone(ctx, bass[s], { type: 'sine', gain: 0.04, dur: 0.32 });
      if (s % 4 === 2) playSoftHat(ctx, 0.01);
    }
  },

  // 3. Direction Pig: Upbeat Bouncy Nintendo-Style Marimba/Pluck Loop
  pig: {
    stepMs: 240,
    playStep(ctx, step) {
      const s = step % 16;
      const lead = [N.C5, N.E5, N.G5, 0, N.A5, N.G5, N.E5, 0, N.D5, N.F5, N.A5, 0, N.G5, N.E5, N.D5, 0];
      const bass = [N.C3, 0, N.G3, 0, N.A3, 0, N.E3, 0, N.F3, 0, N.C3, 0, N.G3, 0, N.G3, 0];
      if (lead[s]) playMusicTone(ctx, lead[s], { type: 'triangle', gain: 0.034, dur: 0.18 });
      if (bass[s]) playMusicTone(ctx, bass[s], { type: 'sine', gain: 0.038, dur: 0.22 });
      if (s % 2 === 1) playSoftHat(ctx, 0.012);
    }
  },

  // 4. Odd One Out (Dark Casino): Smooth Vegas Lounge Jazz Rhodes & Walking Bass
  casino: {
    stepMs: 270,
    playStep(ctx, step) {
      const s = step % 16;
      // Smooth Dmin9 -> G13 -> Cmaj9 lounge chords
      const walkBass = [N.D3, 0, N.F3, 0, N.G3, 0, N.B3, 0, N.C3, 0, N.E3, 0, N.A3, 0, N.G3, 0];
      const chordMap = {
        0: [N.F4, N.A4, N.C5, N.E5],
        4: [N.F4, N.A4, N.B4, N.E5],
        8: [N.E4, N.G4, N.B4, N.D5],
        12: [N.E4, N.G4, N.A4, N.C5]
      };
      if (walkBass[s]) playMusicTone(ctx, walkBass[s], { type: 'triangle', gain: 0.042, dur: 0.34, filterHz: 520 });
      if (chordMap[s]) {
        chordMap[s].forEach((hz, i) => {
          playMusicTone(ctx, hz, { type: 'sine', gain: 0.018, dur: 0.72, delay: i * 0.025 });
        });
      }
      if (s % 4 === 2 || s % 4 === 3) playSoftHat(ctx, 0.013);
    }
  },

  // 5. Tetris (Am/Is/Are & Have/Has): Retro 8-Bit Chiptune Arcade Groove
  tetris: {
    stepMs: 215,
    playStep(ctx, step) {
      const s = step % 16;
      const lead = [N.E5, N.B4, N.C5, N.D5, N.C5, N.B4, N.A4, N.A4, N.C5, N.E5, N.D5, N.C5, N.B4, N.C5, N.D5, N.E5];
      const bass = [N.E3, 0, N.E3, 0, N.A3, 0, N.A3, 0, N.F3, 0, N.G3, 0, N.E3, 0, N.B3, 0];
      playMusicTone(ctx, lead[s], { type: 'square', gain: 0.017, dur: 0.17, filterHz: 1500 });
      if (bass[s]) playMusicTone(ctx, bass[s], { type: 'triangle', gain: 0.036, dur: 0.19 });
      if (s % 2 === 1) playSoftHat(ctx, 0.011);
    }
  },

  // 6. Blank Space Sentences: Calm Lo-Fi Study Rhodes Pulse
  sentences: {
    stepMs: 330,
    playStep(ctx, step) {
      const s = step % 16;
      const chords = {
        0: [N.C4, N.E4, N.G4, N.B4],
        8: [N.F4, N.A4, N.C5, N.E5]
      };
      const melody = [0, 0, N.E5, 0, N.G5, 0, 0, N.D5, 0, 0, N.C5, 0, N.A4, 0, N.G4, 0];
      if (chords[s]) {
        chords[s].forEach((hz, i) => {
          playMusicTone(ctx, hz, { type: 'sine', gain: 0.018, dur: 1.2, delay: i * 0.03 });
        });
      }
      if (melody[s]) playMusicTone(ctx, melody[s], { type: 'triangle', gain: 0.024, dur: 0.38, filterHz: 1200 });
    }
  }
};

function pauseMusicTimer() {
  if (musicTimer) {
    clearInterval(musicTimer);
    musicTimer = null;
  }
}

function resumeMusicTimer() {
  pauseMusicTimer();
  if (muted || !activeTheme) return;
  const spec = MUSIC_THEMES[activeTheme];
  if (!spec) return;

  musicTimer = setInterval(() => {
    if (muted || !activeTheme) return;
    const ctx = getContext();
    if (!ctx || ctx.state !== 'running') return;
    spec.playStep(ctx, musicStep);
    musicStep += 1;
  }, spec.stepMs);
}

export function startGameMusic(theme) {
  activeTheme = theme;
  musicStep = 0;
  if (!muted) {
    getContext();
    resumeMusicTimer();
  }
}

export function stopGameMusic() {
  activeTheme = null;
  pauseMusicTimer();
}

export function unlockAudioOnGesture() {
  if (muted) return;
  const ctx = getContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  if (activeTheme && !musicTimer) {
    resumeMusicTimer();
  }
}

/* ==========================================================================
   Core & Game-Specific Satisfying Foley Sound Effects
   ========================================================================== */

export function playTap() {
  vibrate(10);
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(820, now);
  osc.frequency.exponentialRampToValueAtTime(580, now + 0.016);
  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.018);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.02);
}

export function playCardSwipe() {
  vibrate(10);
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const bufferSize = Math.floor(ctx.sampleRate * 0.042);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1250, now);
  filter.Q.setValueAtTime(1.4, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.11, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.042);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start(now);
}

// Story Comprehension: Gentle storybook page turn
export function playPageTurn() {
  vibrate(8);
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const len = Math.floor(ctx.sampleRate * 0.11);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) {
    const env = Math.sin((i / len) * Math.PI);
    data[i] = (Math.random() * 2 - 1) * env;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(900, now);
  filter.frequency.exponentialRampToValueAtTime(2200, now + 0.11);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.08, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
  src.connect(filter);
  filter.connect(g);
  g.connect(ctx.destination);
  src.start(now);
}

// PHONIX Remi: Crisp wooden Rummikub tile clack
export function playWoodClack() {
  vibrate(12);
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  [920, 1480].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = i === 0 ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.55, now + 0.045);
    g.gain.setValueAtTime(i === 0 ? 0.14 : 0.07, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.055);
  });
}

// PHONIX Remi: Satisfying tile slide & clack combo onto board
export function playTileSlide() {
  playCardSwipe();
  setTimeout(() => playWoodClack(), 35);
}

// Direction Pig: Playful bouncy bubble pop
export function playPigPop() {
  vibrate(12);
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(320, now);
  osc.frequency.exponentialRampToValueAtTime(760, now + 0.065);
  g.gain.setValueAtTime(0.11, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.08);
}

// Odd One Out (Dark Casino): Mechanical slot lever ratchet pull
export function playSlotLever() {
  vibrate([15, 25, 25]);
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  // 4 quick mechanical ratchet clicks + low spring clunk
  [0, 0.045, 0.09, 0.14].forEach((offset, idx) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520 - idx * 55, now + offset);
    g.gain.setValueAtTime(0.09, now + offset);
    g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.032);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now + offset);
    osc.stop(now + offset + 0.035);
  });
  const clunk = ctx.createOscillator();
  const cg = ctx.createGain();
  clunk.type = 'sine';
  clunk.frequency.setValueAtTime(160, now + 0.18);
  clunk.frequency.exponentialRampToValueAtTime(90, now + 0.28);
  cg.gain.setValueAtTime(0.13, now + 0.18);
  cg.gain.exponentialRampToValueAtTime(0.001, now + 0.29);
  clunk.connect(cg);
  cg.connect(ctx.destination);
  clunk.start(now + 0.18);
  clunk.stop(now + 0.3);
}

// Odd One Out (Dark Casino): Crisp reel stop mechanical click
export function playSlotTick(reelIdx = 0) {
  vibrate(14);
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(620 + reelIdx * 120, now);
  osc.frequency.exponentialRampToValueAtTime(340 + reelIdx * 60, now + 0.055);
  g.gain.setValueAtTime(0.12, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.065);
}

// Odd One Out (Dark Casino): Shimmering coin cascade jackpot
export function playSlotWin() {
  vibrate([20, 35, 20, 35, 65]);
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const notes = [N.C5, N.E5, N.G5, N.C6, N.E6, N.G5, N.C6];
  notes.forEach((freq, i) => {
    const start = now + i * 0.06;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(0.001, start);
    g.gain.linearRampToValueAtTime(0.11, start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, start + 0.36);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.38);
  });
}

// Odd One Out (Dark Casino): Soft low reset womp on red aura
export function playSlotFail() {
  vibrate([35, 25, 45]);
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  [260, 210].forEach((freq, i) => {
    const start = now + i * 0.13;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, start);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.78, start + 0.14);
    g.gain.setValueAtTime(0.11, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + 0.15);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.16);
  });
}

// Retro Tetris: Classic 8-bit move blip
export function playTetrisMove() {
  vibrate(8);
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(440, now);
  osc.frequency.setValueAtTime(560, now + 0.02);
  g.gain.setValueAtTime(0.045, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.05);
}

// Retro Tetris: Crisp 8-bit drop whoosh/thump
export function playTetrisDrop() {
  vibrate(14);
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(380, now);
  osc.frequency.exponentialRampToValueAtTime(140, now + 0.08);
  g.gain.setValueAtTime(0.055, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.095);
}

// Retro Tetris: 8-bit ascending power-up chime
export function playTetrisClear(combo = 1) {
  vibrate([15, 20, 15]);
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const baseIdx = Math.min(Math.max(0, combo - 1), PENTATONIC_HZ.length - 3);
  const notes = [PENTATONIC_HZ[baseIdx], PENTATONIC_HZ[baseIdx + 1], PENTATONIC_HZ[baseIdx + 2]];
  notes.forEach((freq, i) => {
    const start = now + i * 0.045;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(0.045, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + 0.14);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.15);
  });
}

export function playCorrect(combo = 1) {
  vibrate([15, 25, 15]);
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const idx = Math.min(Math.max(0, combo - 1), PENTATONIC_HZ.length - 1);
  const freq = PENTATONIC_HZ[idx];

  ['sine', 'triangle'].forEach((type, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(i === 0 ? 0.095 : 0.048, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.29);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  });
}

export function playNearMiss() {
  vibrate([35, 20, 35]);
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.exponentialRampToValueAtTime(115, now + 0.12);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(340, now);

  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.14);
}

export function playJackpot() {
  vibrate([20, 40, 20, 40, 70]);
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 987.77, 1174.66]; // C5 E5 G5 B5 D6

  notes.forEach((freq, i) => {
    const start = now + i * 0.065;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(0.095, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.42);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.44);
  });
}
