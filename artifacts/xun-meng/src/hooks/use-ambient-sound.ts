import { useRef, useCallback } from "react";

export type AmbientSoundType = "none" | "rain" | "night" | "fire";

function buildRain(ctx: AudioContext, gain: GainNode) {
  // Two layers of filtered noise for rain texture
  const bufSize = ctx.sampleRate * 4;

  const makeNoise = () => {
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    return src;
  };

  // Layer 1: high-frequency hiss (rain on glass)
  const src1 = makeNoise();
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 4000;
  hp.Q.value = 0.3;
  const g1 = ctx.createGain();
  g1.gain.value = 0.6;
  src1.connect(hp);
  hp.connect(g1);
  g1.connect(gain);

  // Layer 2: mid-frequency body (rain rumble)
  const src2 = makeNoise();
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1200;
  bp.Q.value = 0.4;
  const g2 = ctx.createGain();
  g2.gain.value = 0.35;
  src2.connect(bp);
  bp.connect(g2);
  g2.connect(gain);

  src1.start();
  src2.start();
  return [src1, src2];
}

function buildNight(ctx: AudioContext, gain: GainNode) {
  // Very soft low-frequency ambient hum
  const bufSize = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;

  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;

  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 320;
  lp.Q.value = 0.5;

  src.connect(lp);
  lp.connect(gain);
  src.start();
  return [src];
}

function buildFire(ctx: AudioContext, gain: GainNode) {
  // Crackling fire: amplitude-modulated low-pass noise
  const bufSize = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const d = buf.getChannelData(0);

  // Brownian / pink-ish noise for warmth
  let last = 0;
  for (let i = 0; i < bufSize; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.08 * white) / 1.08;
    d[i] = last * 18; // amplify
  }

  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;

  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 600;

  // LFO for crackling flicker
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 3.5;
  lfoGain.gain.value = 0.3;
  lfo.connect(lfoGain);

  src.connect(lp);
  lp.connect(gain);
  lfo.start();
  src.start();
  return [src, lfo as unknown as AudioBufferSourceNode];
}

export function useAmbientSound() {
  const ctxRef     = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<(AudioBufferSourceNode | OscillatorNode)[]>([]);
  const gainRef    = useRef<GainNode | null>(null);

  const stop = useCallback(() => {
    sourcesRef.current.forEach(s => {
      try { s.stop(); } catch { /* already stopped */ }
    });
    sourcesRef.current = [];
    if (gainRef.current) {
      gainRef.current.disconnect();
      gainRef.current = null;
    }
    if (ctxRef.current) {
      ctxRef.current.close().catch(() => {});
      ctxRef.current = null;
    }
  }, []);

  const play = useCallback((type: AmbientSoundType) => {
    stop();
    if (type === "none") return;

    const ctx = new AudioContext();
    ctxRef.current = ctx;

    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(ctx.destination);
    gainRef.current = gain;

    // Fade in
    const targetVol = type === "rain" ? 0.07 : type === "night" ? 0.06 : 0.05;
    gain.gain.setTargetAtTime(targetVol, ctx.currentTime, 0.8);

    let sources: (AudioBufferSourceNode | OscillatorNode)[];
    if (type === "rain")  sources = buildRain(ctx, gain);
    else if (type === "night") sources = buildNight(ctx, gain);
    else sources = buildFire(ctx, gain);

    sourcesRef.current = sources;
  }, [stop]);

  const setVolume = useCallback((vol: number) => {
    if (gainRef.current && ctxRef.current) {
      gainRef.current.gain.setTargetAtTime(vol, ctxRef.current.currentTime, 0.3);
    }
  }, []);

  return { play, stop, setVolume };
}
