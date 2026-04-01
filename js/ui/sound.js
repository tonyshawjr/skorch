// js/ui/sound.js - Procedural sound effects

let ctx = null;
let muted = false;

const MUTE_KEY = 'skorch_muted';

function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
}

function ensureResumed() {
    const c = getCtx();
    if (c.state === 'suspended') c.resume();
}

export function initSound() {
    muted = localStorage.getItem(MUTE_KEY) === 'true';
}

export function toggleMute() {
    muted = !muted;
    localStorage.setItem(MUTE_KEY, muted.toString());
    return muted;
}

export function isMuted() { return muted; }

// --- SOUND GENERATORS ---

export function playCardSnap() {
    if (muted) return;
    ensureResumed();
    const c = getCtx();
    const t = c.currentTime;
    // Short noise burst for card snap
    const bufferSize = c.sampleRate * 0.05;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const source = c.createBufferSource();
    source.buffer = buffer;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    const filter = c.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2000;
    source.connect(filter).connect(gain).connect(c.destination);
    source.start(t);
}

export function playCardStack() {
    if (muted) return;
    // Multiple snaps in quick succession
    playCardSnap();
    setTimeout(() => playCardSnap(), 40);
    setTimeout(() => playCardSnap(), 80);
}

export function playCardDraw() {
    if (muted) return;
    ensureResumed();
    const c = getCtx();
    const t = c.currentTime;
    // Soft slide sound
    const bufferSize = c.sampleRate * 0.1;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.sin(i / bufferSize * Math.PI);
    }
    const source = c.createBufferSource();
    source.buffer = buffer;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3000;
    source.connect(filter).connect(gain).connect(c.destination);
    source.start(t);
}

export function playPickup() {
    if (muted) return;
    ensureResumed();
    const c = getCtx();
    const t = c.currentTime;
    // Shuffling sound - longer noise with filter sweep
    const bufferSize = c.sampleRate * 0.4;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize) * 0.5;
    }
    const source = c.createBufferSource();
    source.buffer = buffer;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1000, t);
    filter.frequency.linearRampToValueAtTime(4000, t + 0.2);
    filter.frequency.linearRampToValueAtTime(1500, t + 0.4);
    source.connect(filter).connect(gain).connect(c.destination);
    source.start(t);
}

export function playSkorch() {
    if (muted) return;
    ensureResumed();
    const c = getCtx();
    const t = c.currentTime;
    // Fire whoosh - rising noise + low rumble
    const bufferSize = c.sampleRate * 0.6;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1);
    }
    const source = c.createBufferSource();
    source.buffer = buffer;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.4, t + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(500, t);
    filter.frequency.exponentialRampToValueAtTime(3000, t + 0.15);
    filter.frequency.exponentialRampToValueAtTime(200, t + 0.6);
    source.connect(filter).connect(gain).connect(c.destination);
    source.start(t);
    // Low rumble
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(60, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.5);
    const oscGain = c.createGain();
    oscGain.gain.setValueAtTime(0.3, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(oscGain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.6);
}

export function playShield() {
    if (muted) return;
    ensureResumed();
    const c = getCtx();
    const t = c.currentTime;
    // Metallic clang
    const osc = c.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.15);
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.3);
    // High ping
    const osc2 = c.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = 1200;
    const gain2 = c.createGain();
    gain2.gain.setValueAtTime(0.15, t);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc2.connect(gain2).connect(c.destination);
    osc2.start(t);
    osc2.stop(t + 0.25);
}

export function playDemoter() {
    if (muted) return;
    ensureResumed();
    const c = getCtx();
    const t = c.currentTime;
    // Power-down sweep
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.3);
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.4);
}

export function playElude() {
    if (muted) return;
    ensureResumed();
    const c = getCtx();
    const t = c.currentTime;
    // Quick whoosh
    const bufferSize = c.sampleRate * 0.15;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.sin(i / bufferSize * Math.PI);
    }
    const source = c.createBufferSource();
    source.buffer = buffer;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    const filter = c.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(500, t);
    filter.frequency.exponentialRampToValueAtTime(5000, t + 0.1);
    source.connect(filter).connect(gain).connect(c.destination);
    source.start(t);
}

export function playUndead() {
    if (muted) return;
    ensureResumed();
    const c = getCtx();
    const t = c.currentTime;
    // Dark eerie tone
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.linearRampToValueAtTime(120, t + 0.4);
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.linearRampToValueAtTime(0.25, t + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.5);
    // Dissonant overtone
    const osc2 = c.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = 185;
    const gain2 = c.createGain();
    gain2.gain.setValueAtTime(0.1, t);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc2.connect(gain2).connect(c.destination);
    osc2.start(t);
    osc2.stop(t + 0.45);
}

export function playError() {
    if (muted) return;
    ensureResumed();
    const c = getCtx();
    const t = c.currentTime;
    // Buzzer
    const osc = c.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 200;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.setValueAtTime(0, t + 0.1);
    gain.gain.setValueAtTime(0.15, t + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.3);
}

export function playVictory() {
    if (muted) return;
    ensureResumed();
    const c = getCtx();
    const t = c.currentTime;
    // Ascending fanfare
    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
        const osc = c.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const gain = c.createGain();
        const start = t + i * 0.15;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.2, start + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
        osc.connect(gain).connect(c.destination);
        osc.start(start);
        osc.stop(start + 0.5);
    });
}

export function playTurnDing() {
    if (muted) return;
    ensureResumed();
    const c = getCtx();
    const t = c.currentTime;
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 880;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.3);
}

export function playDefeat() {
    if (muted) return;
    ensureResumed();
    const c = getCtx();
    const t = c.currentTime;
    // Descending sad tones
    const notes = [440, 370, 311, 261]; // A4, F#4, D#4, C4
    notes.forEach((freq, i) => {
        const osc = c.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const gain = c.createGain();
        const start = t + i * 0.25;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.15, start + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.6);
        osc.connect(gain).connect(c.destination);
        osc.start(start);
        osc.stop(start + 0.6);
    });
}
