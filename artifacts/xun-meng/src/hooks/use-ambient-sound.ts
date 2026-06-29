import { useRef, useCallback } from "react";

export type AmbientSoundType = "none" | "rain" | "night" | "ocean";

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

function buildOcean(ctx: AudioContext, gain: GainNode) {
  // Deep sea tides: slow pink noise swell
  const bufSize = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const d = buf.getChannelData(0);

  let last = 0;
  for (let i = 0; i < bufSize; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    d[i] = last * 0.8;
  }

  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;

  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 280;

  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 0.12;
  lfoGain.gain.value = 0.5;
  lfo.connect(lfoGain);
  lfoGain.connect(gain.gain);
  lfo.start();

  src.connect(lp);
  lp.connect(gain);
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

    // resume() is required in production HTTPS — browsers create AudioContext
    // in "suspended" state until explicitly resumed. Must be called inside a
    // user-gesture handler (which this always is) for browsers to allow it.
    ctx.resume().then(() => {
      // Fade in after context is running
      const targetVol = 0.05;
      gain.gain.setTargetAtTime(targetVol, ctx.currentTime, 0.8);

      let sources: (AudioBufferSourceNode | OscillatorNode)[];
      if (type === "rain")       sources = buildRain(ctx, gain);
      else if (type === "night") sources = buildNight(ctx, gain);
      else                       sources = buildOcean(ctx, gain);

      sourcesRef.current = sources;
    }).catch(err => {
      console.error("[ambient-sound] AudioContext resume failed:", err);
    });
  }, [stop]);

  const setVolume = useCallback((vol: number) => {
    if (gainRef.current && ctxRef.current) {
      gainRef.current.gain.setTargetAtTime(vol, ctxRef.current.currentTime, 0.3);
    }
  }, []);

  return { play, stop, setVolume };
}
