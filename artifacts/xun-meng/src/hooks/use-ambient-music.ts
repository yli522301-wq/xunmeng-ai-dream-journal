import { useRef, useCallback } from "react";

export type MusicType = "none" | "piano" | "fog" | "strings" | "piano-rain";

// ── Piano builder (pentatonic note sequencer) ──────────────────────────────
function buildPiano(ctx: AudioContext, master: GainNode, freqs: number[]) {
  let idx = 0;
  let stopped = false;

  const scheduleNext = () => {
    if (stopped || ctx.state === "closed") return;

    const f = freqs[idx % freqs.length];
    idx++;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = f;

    // Soft harmonic on top
    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = f * 2;

    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.001, ctx.currentTime);
    ng.gain.exponentialRampToValueAtTime(0.65, ctx.currentTime + 0.55);
    ng.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 3.8);

    const ng2 = ctx.createGain();
    ng2.gain.setValueAtTime(0.001, ctx.currentTime);
    ng2.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.55);
    ng2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 3.0);

    osc.connect(ng);  ng.connect(master);
    osc2.connect(ng2); ng2.connect(master);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 4.5);
    osc2.start(ctx.currentTime);
    osc2.stop(ctx.currentTime + 4);

    const wait = 2800 + Math.random() * 1800;
    if (!stopped) setTimeout(scheduleNext, wait);
  };

  scheduleNext();
  return { stop: () => { stopped = true; } };
}

// ── Pad/Drone builder ──────────────────────────────────────────────────────
function buildFogAmbient(ctx: AudioContext, master: GainNode) {
  const freqs = [220, 220.35, 219.65, 440, 330];
  const oscs = freqs.map((f, i) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = f;

    const g = ctx.createGain();
    g.gain.value = i < 3 ? 0.22 : 0.06;

    // Slow LFO on each voice
    const lfo = ctx.createOscillator();
    const lfoG = ctx.createGain();
    lfo.frequency.value = 0.04 + i * 0.01;
    lfoG.gain.value = 0.08;
    lfo.connect(lfoG);
    lfoG.connect(g.gain);

    osc.connect(g); g.connect(master);
    osc.start(); lfo.start();
    return { osc, g, lfo };
  });

  return {
    stop: () => oscs.forEach(({ osc, lfo }) => {
      try { osc.stop(); lfo.stop(); } catch { /* ignore */ }
    }),
  };
}

// ── Strings (filtered saw) ─────────────────────────────────────────────────
function buildStrings(ctx: AudioContext, master: GainNode) {
  const chordFreqs = [146.83, 220, 293.66, 349.23]; // D3, A3, D4, F4 — Dm add9

  const sources = chordFreqs.map((f, i) => {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = f;

    // String-like: heavy lowpass + slight resonance
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 500 + i * 80;
    lp.Q.value = 1.2;

    const g = ctx.createGain();
    g.gain.value = 0.18;

    // Slow swell LFO
    const lfo = ctx.createOscillator();
    const lfoG = ctx.createGain();
    lfo.frequency.value = 0.03 + i * 0.005;
    lfoG.gain.value = 0.06;
    lfo.connect(lfoG); lfoG.connect(g.gain);

    osc.connect(lp); lp.connect(g); g.connect(master);
    osc.start(); lfo.start();
    return { osc, lfo };
  });

  return {
    stop: () => sources.forEach(({ osc, lfo }) => {
      try { osc.stop(); lfo.stop(); } catch { /* ignore */ }
    }),
  };
}

// ────────────────────────────────────────────────────────────────────────────

// C major pentatonic
const C_PENTA = [261.63, 329.63, 392.00, 440.00, 523.25];
// A minor pentatonic (darker, rain mood)
const A_MINOR_PENTA = [220.00, 261.63, 293.66, 329.63, 392.00];

export function useAmbientMusic() {
  const ctxRef   = useRef<AudioContext | null>(null);
  const gainRef  = useRef<GainNode | null>(null);
  const handleRef = useRef<{ stop: () => void } | null>(null);

  const stop = useCallback(() => {
    handleRef.current?.stop();
    handleRef.current = null;

    if (gainRef.current && ctxRef.current) {
      gainRef.current.gain.setTargetAtTime(0, ctxRef.current.currentTime, 0.6);
      setTimeout(() => {
        ctxRef.current?.close().catch(() => {});
        ctxRef.current = null;
        gainRef.current = null;
      }, 1200);
    }
  }, []);

  const play = useCallback((type: MusicType) => {
    stop();
    if (type === "none") return;

    setTimeout(() => {
      const ctx = new AudioContext();
      ctxRef.current = ctx;

      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(ctx.destination);
      gainRef.current = gain;

      const vol = type === "strings" ? 0.055 : 0.06;
      gain.gain.setTargetAtTime(vol, ctx.currentTime, 1.2);

      let handle: { stop: () => void };
      if (type === "piano")       handle = buildPiano(ctx, gain, C_PENTA);
      else if (type === "fog")    handle = buildFogAmbient(ctx, gain);
      else if (type === "strings") handle = buildStrings(ctx, gain);
      else /* piano-rain */       handle = buildPiano(ctx, gain, A_MINOR_PENTA);

      handleRef.current = handle;
    }, 100); // small delay for cleaner fade-in after context creation
  }, [stop]);

  return { play, stop };
}
