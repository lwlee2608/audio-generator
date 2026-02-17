import { useEffect, useMemo, useRef, useState } from "react";

const MIN_FREQ = 10;
const MAX_FREQ = 25000;

function sliderToFrequency(value: number) {
  const ratio = value / 100;
  return MIN_FREQ * Math.pow(MAX_FREQ / MIN_FREQ, ratio);
}

function frequencyToSlider(freq: number) {
  return (Math.log(freq / MIN_FREQ) / Math.log(MAX_FREQ / MIN_FREQ)) * 100;
}

export default function App() {
  const [frequency, setFrequency] = useState(440);
  const [volume, setVolume] = useState(0.08);
  const [waveform, setWaveform] = useState<OscillatorType>("sine");
  const [isPlaying, setIsPlaying] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  const sliderValue = useMemo(() => frequencyToSlider(frequency), [frequency]);

  useEffect(() => {
    if (!oscillatorRef.current || !audioCtxRef.current) return;
    oscillatorRef.current.frequency.setValueAtTime(
      frequency,
      audioCtxRef.current.currentTime
    );
  }, [frequency]);

  useEffect(() => {
    if (!gainRef.current || !audioCtxRef.current) return;
    gainRef.current.gain.setValueAtTime(volume, audioCtxRef.current.currentTime);
  }, [volume]);

  useEffect(() => {
    if (!oscillatorRef.current || !audioCtxRef.current) return;
    oscillatorRef.current.type = waveform;
  }, [waveform]);

  useEffect(() => {
    return () => {
      oscillatorRef.current?.stop();
      oscillatorRef.current?.disconnect();
      gainRef.current?.disconnect();
      void audioCtxRef.current?.close();
    };
  }, []);

  const startTone = async () => {
    if (isPlaying) return;
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = waveform;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    gain.gain.setValueAtTime(volume, context.currentTime);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();

    audioCtxRef.current = context;
    oscillatorRef.current = oscillator;
    gainRef.current = gain;
    setIsPlaying(true);
  };

  const stopTone = async () => {
    oscillatorRef.current?.stop();
    oscillatorRef.current?.disconnect();
    gainRef.current?.disconnect();
    oscillatorRef.current = null;
    gainRef.current = null;
    await audioCtxRef.current?.close();
    audioCtxRef.current = null;
    setIsPlaying(false);
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#25193d_0%,_#100a1d_45%,_#07040f_100%)] px-5 py-10 font-body text-zinc-100 sm:px-8">
      <section className="mx-auto max-w-3xl rounded-3xl border border-white/15 bg-panel/70 p-6 shadow-[0_25px_90px_rgba(0,0,0,0.45)] backdrop-blur md:p-8">
        <p className="text-sm uppercase tracking-[0.24em] text-tone/90">
          Speaker Test Tool
        </p>
        <h1 className="mt-2 font-display text-5xl uppercase leading-none text-zinc-50 sm:text-7xl">
          Tone Generator
        </h1>
        <p className="mt-3 max-w-xl text-sm text-zinc-300 sm:text-base">
          Use the slider to move from low bass to high treble. Start with low
          volume to protect your ears and speakers.
        </p>

        <div className="mt-8 rounded-2xl border border-white/10 bg-black/30 p-5">
          <label className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-zinc-400">
            <span>Frequency</span>
            <span className="font-mono text-lg tracking-normal text-tone">
              {frequency >= 1000
                ? `${(frequency / 1000).toFixed(2)} kHz`
                : `${Math.round(frequency)} Hz`}
            </span>
          </label>
          <input
            aria-label="Frequency"
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={sliderValue}
            onChange={(e) => setFrequency(sliderToFrequency(Number(e.target.value)))}
            className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full bg-zinc-700 accent-accent"
          />
          <div className="mt-2 flex justify-between text-xs text-zinc-400">
            <span>{MIN_FREQ} Hz</span>
            <span>{MAX_FREQ / 1000} kHz</span>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <span className="text-xs uppercase tracking-[0.2em] text-zinc-400">
              Volume
            </span>
            <input
              aria-label="Volume"
              type="range"
              min={0.01}
              max={0.2}
              step={0.01}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-zinc-700 accent-tone"
            />
            <p className="mt-2 font-mono text-sm text-zinc-200">
              {Math.round(volume * 100)}%
            </p>
          </label>

          <label className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <span className="text-xs uppercase tracking-[0.2em] text-zinc-400">
              Waveform
            </span>
            <select
              value={waveform}
              onChange={(e) => setWaveform(e.target.value as OscillatorType)}
              className="mt-3 w-full rounded-xl border border-white/15 bg-zinc-900 p-2 text-zinc-100 outline-none ring-accent focus:ring"
            >
              <option value="sine">Sine</option>
              <option value="square">Square</option>
              <option value="triangle">Triangle</option>
              <option value="sawtooth">Sawtooth</option>
            </select>
          </label>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {!isPlaying ? (
            <button
              onClick={startTone}
              className="rounded-xl bg-accent px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[#ff6d6d]"
            >
              Start Tone
            </button>
          ) : (
            <button
              onClick={stopTone}
              className="rounded-xl bg-zinc-100 px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-zinc-900 transition hover:bg-white"
            >
              Stop Tone
            </button>
          )}
          <p className="self-center text-sm text-zinc-300">
            {isPlaying ? "Playing live tone..." : "Audio is stopped."}
          </p>
        </div>
      </section>
    </main>
  );
}
