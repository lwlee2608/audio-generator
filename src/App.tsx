import { useEffect, useMemo, useRef, useState } from "react";

const MIN_FREQ = 10;
const MAX_FREQ = 25000;
const MAX_VOLUME = 0.2;
const SPECTRUM_BARS = 72;

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
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const spectrumCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const logCanvasRef = useRef<HTMLCanvasElement | null>(null);

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
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      oscillatorRef.current?.stop();
      oscillatorRef.current?.disconnect();
      gainRef.current?.disconnect();
      analyserRef.current?.disconnect();
      void audioCtxRef.current?.close();
    };
  }, []);

  useEffect(() => {
    const drawOnCanvas = (
      canvas: HTMLCanvasElement,
      draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void
    ) => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const dpr = window.devicePixelRatio || 1;
      const displayWidth = Math.floor(rect.width * dpr);
      const displayHeight = Math.floor(rect.height * dpr);

      if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(ctx, rect.width, rect.height);
    };

    const drawSpectrum = () => {
      const canvas = spectrumCanvasRef.current;
      if (!canvas) return;

      drawOnCanvas(canvas, (ctx, width, height) => {
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = "#f8fbff";
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = "rgba(148, 163, 184, 0.25)";
        ctx.lineWidth = 1;
        for (let i = 1; i < 5; i += 1) {
          const y = (height / 5) * i;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }

        const analyser = analyserRef.current;
        if (!analyser || !isPlaying) {
          ctx.fillStyle = "#64748b";
          ctx.font = "500 13px 'Plus Jakarta Sans', sans-serif";
          ctx.fillText("Start tone to view live spectrum", 14, height / 2);
          return;
        }

        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);

        const nyquist = (audioCtxRef.current?.sampleRate ?? 48000) / 2;
        const barWidth = width / SPECTRUM_BARS;

        for (let i = 0; i < SPECTRUM_BARS; i += 1) {
          const fromFreq = MIN_FREQ * Math.pow(MAX_FREQ / MIN_FREQ, i / SPECTRUM_BARS);
          const toFreq =
            MIN_FREQ * Math.pow(MAX_FREQ / MIN_FREQ, (i + 1) / SPECTRUM_BARS);
          const fromIndex = Math.max(
            0,
            Math.floor((fromFreq / nyquist) * data.length)
          );
          const toIndex = Math.min(
            data.length - 1,
            Math.ceil((toFreq / nyquist) * data.length)
          );

          let bucketMax = 0;
          for (let j = fromIndex; j <= toIndex; j += 1) {
            bucketMax = Math.max(bucketMax, data[j]);
          }

          const normalized = bucketMax / 255;
          const barHeight = normalized * (height - 28);
          const x = i * barWidth + 1;
          const y = height - barHeight - 2;

          ctx.fillStyle = "rgba(53, 95, 214, 0.85)";
          ctx.fillRect(x, y, Math.max(1, barWidth - 2), barHeight);
        }

        const markerX =
          (Math.log(frequency / MIN_FREQ) / Math.log(MAX_FREQ / MIN_FREQ)) * width;
        ctx.strokeStyle = "rgba(20, 118, 166, 0.95)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(markerX, 0);
        ctx.lineTo(markerX, height);
        ctx.stroke();
      });
    };

    const drawLogMap = (time: number) => {
      const canvas = logCanvasRef.current;
      if (!canvas) return;

      drawOnCanvas(canvas, (ctx, width, height) => {
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = "#f8fbff";
        ctx.fillRect(0, 0, width, height);

        const freqToX = (freq: number) =>
          (Math.log(freq / MIN_FREQ) / Math.log(MAX_FREQ / MIN_FREQ)) * width;

        const ticks = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
        ctx.strokeStyle = "rgba(148, 163, 184, 0.28)";
        ctx.lineWidth = 1;
        ticks.forEach((tick) => {
          const x = freqToX(tick);
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        });

        ctx.strokeStyle = "rgba(71, 85, 105, 0.45)";
        ctx.beginPath();
        ctx.moveTo(0, height - 20);
        ctx.lineTo(width, height - 20);
        ctx.stroke();

        const amplitude = Math.min(1, volume / MAX_VOLUME);
        const pulse = isPlaying ? 0.9 + Math.sin(time / 420) * 0.1 : 0.55;

        ctx.strokeStyle = "rgba(20, 118, 166, 0.95)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = 0; x <= width; x += 1) {
          const currentFreq =
            MIN_FREQ * Math.pow(MAX_FREQ / MIN_FREQ, x / Math.max(1, width));
          const distance = Math.log2(currentFreq / frequency);
          const envelope = Math.exp(-(distance * distance) / (2 * 0.23 * 0.23));
          const y =
            height -
            20 -
            envelope * amplitude * pulse * Math.max(24, height - 44);

          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();

        const markerX = freqToX(frequency);
        const markerY =
          height - 20 - amplitude * pulse * Math.max(24, height - 44);
        ctx.fillStyle = "#355fd6";
        ctx.beginPath();
        ctx.arc(markerX, markerY, 4, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    const render = (time: number) => {
      drawSpectrum();
      drawLogMap(time);
      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [frequency, isPlaying, volume]);

  const startTone = async () => {
    if (isPlaying) return;
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const analyser = context.createAnalyser();

    analyser.fftSize = 4096;
    analyser.smoothingTimeConstant = 0.82;

    oscillator.type = waveform;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    gain.gain.setValueAtTime(volume, context.currentTime);

    oscillator.connect(gain);
    gain.connect(analyser);
    analyser.connect(context.destination);
    oscillator.start();

    audioCtxRef.current = context;
    oscillatorRef.current = oscillator;
    gainRef.current = gain;
    analyserRef.current = analyser;
    setIsPlaying(true);
  };

  const stopTone = async () => {
    oscillatorRef.current?.stop();
    oscillatorRef.current?.disconnect();
    gainRef.current?.disconnect();
    analyserRef.current?.disconnect();
    oscillatorRef.current = null;
    gainRef.current = null;
    analyserRef.current = null;
    await audioCtxRef.current?.close();
    audioCtxRef.current = null;
    setIsPlaying(false);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[linear-gradient(145deg,_#f4f8ff_0%,_#eaf1ff_46%,_#e8f2fb_100%)] px-5 py-10 font-body text-slate-900 sm:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-[radial-gradient(circle,_rgba(108,144,255,0.35)_0%,_rgba(108,144,255,0)_72%)]" />
        <div className="absolute -right-20 bottom-8 h-80 w-80 rounded-full bg-[radial-gradient(circle,_rgba(103,181,227,0.32)_0%,_rgba(103,181,227,0)_72%)]" />
      </div>

      <section className="relative mx-auto max-w-3xl rounded-[2rem] border border-slate-200/80 bg-white/82 p-6 shadow-[0_22px_65px_rgba(38,67,126,0.16)] backdrop-blur md:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.19em] text-accent">
          Speaker Test Tool
        </p>
        <h1 className="mt-3 font-display text-5xl leading-[0.95] text-slate-900 sm:text-6xl">
          Tone Generator
        </h1>
        <p className="mt-4 max-w-xl text-sm text-slate-600 sm:text-base">
          Sweep from deep bass to high treble with smooth logarithmic control.
          Keep the volume low when you begin to protect your ears and speakers.
        </p>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
          <label className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            <span>Frequency</span>
            <span className="font-mono text-lg tracking-normal text-accent">
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
            className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-accent"
          />
          <div className="mt-3 flex justify-between text-xs text-slate-500">
            <span>{MIN_FREQ} Hz</span>
            <span>{MAX_FREQ / 1000} kHz</span>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_25px_rgba(15,23,42,0.06)]">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
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
              className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-tone"
            />
            <p className="mt-2 font-mono text-sm text-slate-700">
              {Math.round(volume * 100)}%
            </p>
          </label>

          <label className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_25px_rgba(15,23,42,0.06)]">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Waveform
            </span>
            <select
              value={waveform}
              onChange={(e) => setWaveform(e.target.value as OscillatorType)}
              className="mt-3 w-full rounded-xl border border-slate-300 bg-slate-50 p-2 text-slate-800 outline-none ring-accent/80 transition focus:ring"
            >
              <option value="sine">Sine</option>
              <option value="square">Square</option>
              <option value="triangle">Triangle</option>
              <option value="sawtooth">Sawtooth</option>
            </select>
          </label>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {!isPlaying ? (
            <button
              onClick={startTone}
              className="rounded-xl bg-accent px-5 py-3 text-sm font-semibold uppercase tracking-[0.11em] text-white transition duration-200 hover:bg-[#245fd0]"
            >
              Start Tone
            </button>
          ) : (
            <button
              onClick={stopTone}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold uppercase tracking-[0.11em] text-white transition duration-200 hover:bg-slate-700"
            >
              Stop Tone
            </button>
          )}
          <p className="text-sm text-slate-600">
            {isPlaying ? "Playing live tone..." : "Audio is stopped."}
          </p>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/85 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Spectrum Visualizer
              </p>
              <p className="text-xs text-slate-500">Realtime FFT</p>
            </div>
            <canvas
              ref={spectrumCanvasRef}
              className="h-44 w-full rounded-xl border border-slate-200 bg-[#f8fbff]"
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/85 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Log Frequency Graph
              </p>
              <p className="text-xs text-slate-500">10 Hz - 25 kHz</p>
            </div>
            <canvas
              ref={logCanvasRef}
              className="h-44 w-full rounded-xl border border-slate-200 bg-[#f8fbff]"
            />
          </div>
        </div>
      </section>
    </main>
  );
}
