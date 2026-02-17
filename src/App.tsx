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

function frequencyToNoteLabel(freq: number) {
  const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const midi = Math.round(12 * Math.log2(freq / 440) + 69);
  const note = notes[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  const target = 440 * Math.pow(2, (midi - 69) / 12);
  const cents = Math.round(1200 * Math.log2(freq / target));
  const centsSign = cents > 0 ? `+${cents}` : `${cents}`;
  return `${note}${octave} (${centsSign}c)`;
}

function formatFreq(freq: number) {
  return freq >= 1000
    ? `${(freq / 1000).toFixed(2)} kHz`
    : `${Math.round(freq)} Hz`;
}

const WAVEFORMS: OscillatorType[] = ["sine", "square", "triangle", "sawtooth"];

const WAVEFORM_ICONS: Partial<Record<OscillatorType, string>> = {
  sine: "~",
  square: "[]",
  triangle: "/\\",
  sawtooth: "/|"
};

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
  const noteLabel = useMemo(() => frequencyToNoteLabel(frequency), [frequency]);

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
        ctx.fillStyle = "#080a14";
        ctx.fillRect(0, 0, width, height);

        // Grid lines
        ctx.strokeStyle = "rgba(0, 229, 255, 0.06)";
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
          ctx.fillStyle = "rgba(0, 229, 255, 0.3)";
          ctx.font = "500 13px 'Inter', sans-serif";
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

          // Gradient bars: cyan at bottom, magenta at top
          const gradient = ctx.createLinearGradient(x, height, x, y);
          gradient.addColorStop(0, "rgba(0, 229, 255, 0.9)");
          gradient.addColorStop(0.5, "rgba(0, 229, 255, 0.6)");
          gradient.addColorStop(1, "rgba(224, 64, 251, 0.8)");
          ctx.fillStyle = gradient;
          ctx.fillRect(x, y, Math.max(1, barWidth - 2), barHeight);

          // Glow effect on top of bars
          if (normalized > 0.3) {
            ctx.shadowColor = "rgba(0, 229, 255, 0.4)";
            ctx.shadowBlur = 8;
            ctx.fillRect(x, y, Math.max(1, barWidth - 2), 2);
            ctx.shadowBlur = 0;
          }
        }

        // Frequency marker
        const markerX =
          (Math.log(frequency / MIN_FREQ) / Math.log(MAX_FREQ / MIN_FREQ)) * width;
        ctx.strokeStyle = "rgba(224, 64, 251, 0.8)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(markerX, 0);
        ctx.lineTo(markerX, height);
        ctx.stroke();
        ctx.setLineDash([]);
      });
    };

    const drawLogMap = (time: number) => {
      const canvas = logCanvasRef.current;
      if (!canvas) return;

      drawOnCanvas(canvas, (ctx, width, height) => {
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = "#080a14";
        ctx.fillRect(0, 0, width, height);

        const freqToX = (freq: number) =>
          (Math.log(freq / MIN_FREQ) / Math.log(MAX_FREQ / MIN_FREQ)) * width;

        // Frequency grid
        const ticks = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
        ctx.strokeStyle = "rgba(0, 229, 255, 0.06)";
        ctx.lineWidth = 1;
        ticks.forEach((tick) => {
          const x = freqToX(tick);
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        });

        // Baseline
        ctx.strokeStyle = "rgba(0, 229, 255, 0.15)";
        ctx.beginPath();
        ctx.moveTo(0, height - 20);
        ctx.lineTo(width, height - 20);
        ctx.stroke();

        // Tick labels
        ctx.fillStyle = "rgba(136, 146, 176, 0.5)";
        ctx.font = "10px 'JetBrains Mono', monospace";
        [100, 1000, 10000].forEach((tick) => {
          const x = freqToX(tick);
          const label = tick >= 1000 ? `${tick / 1000}k` : `${tick}`;
          ctx.fillText(label, x - 6, height - 6);
        });

        const amplitude = Math.min(1, volume / MAX_VOLUME);
        const pulse = isPlaying ? 0.9 + Math.sin(time / 420) * 0.1 : 0.55;

        // Fill area under curve
        ctx.beginPath();
        for (let x = 0; x <= width; x += 1) {
          const currentFreq =
            MIN_FREQ * Math.pow(MAX_FREQ / MIN_FREQ, x / Math.max(1, width));
          const distance = Math.log2(currentFreq / frequency);
          const envelope = Math.exp(-(distance * distance) / (2 * 0.23 * 0.23));
          const y =
            height - 20 - envelope * amplitude * pulse * Math.max(24, height - 44);

          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.lineTo(width, height - 20);
        ctx.lineTo(0, height - 20);
        ctx.closePath();
        const fillGrad = ctx.createLinearGradient(0, 0, 0, height);
        fillGrad.addColorStop(0, "rgba(0, 229, 255, 0.15)");
        fillGrad.addColorStop(1, "rgba(0, 229, 255, 0.02)");
        ctx.fillStyle = fillGrad;
        ctx.fill();

        // Curve line
        ctx.strokeStyle = "rgba(0, 229, 255, 0.85)";
        ctx.lineWidth = 2;
        ctx.shadowColor = "rgba(0, 229, 255, 0.5)";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        for (let x = 0; x <= width; x += 1) {
          const currentFreq =
            MIN_FREQ * Math.pow(MAX_FREQ / MIN_FREQ, x / Math.max(1, width));
          const distance = Math.log2(currentFreq / frequency);
          const envelope = Math.exp(-(distance * distance) / (2 * 0.23 * 0.23));
          const y =
            height - 20 - envelope * amplitude * pulse * Math.max(24, height - 44);

          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Peak marker
        const markerX = freqToX(frequency);
        const markerY =
          height - 20 - amplitude * pulse * Math.max(24, height - 44);
        ctx.fillStyle = "#00e5ff";
        ctx.shadowColor = "rgba(0, 229, 255, 0.8)";
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(markerX, markerY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
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
    <main className="relative min-h-screen overflow-hidden bg-[#060810] px-4 py-8 font-body text-white sm:px-8">
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,_rgba(0,229,255,0.08)_0%,_transparent_50%),radial-gradient(ellipse_at_80%_100%,_rgba(224,64,251,0.06)_0%,_transparent_50%)]" />
        <div className="absolute left-1/2 top-0 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
      </div>

      <section className="relative mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-accent/70">
              Synth Lab
            </p>
            <h1 className="mt-2 text-4xl font-semibold uppercase tracking-[0.2em] sm:text-5xl">
              <span className="text-white">Tone</span>
              <span className="text-accent">
                {" "}Generator
              </span>
            </h1>
            <p className="mt-3 max-w-lg text-sm text-muted">
              Precision waveform synthesis with real-time spectral analysis.
            </p>
          </div>

          {/* Live note badge */}
          <div className="rounded-xl border border-accent/20 bg-accent/5 px-5 py-3 backdrop-blur">
            <p className="text-[10px] uppercase tracking-[0.2em] text-accent/60">Live Note</p>
            <p className="mt-1 font-mono text-lg font-semibold text-accent">{noteLabel}</p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          {/* Controls panel */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 backdrop-blur-xl">
            {/* Frequency */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <label className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                <span>Frequency</span>
                <span className="font-mono text-lg tracking-normal text-accent">
                  {formatFreq(frequency)}
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
                className="mt-4 w-full"
              />
              <div className="mt-3 flex justify-between font-mono text-[10px] text-muted/60">
                <span>{MIN_FREQ} Hz</span>
                <span>{MAX_FREQ / 1000} kHz</span>
              </div>
            </div>

            {/* Volume + Waveform */}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                  Output Level
                </span>
                <input
                  aria-label="Volume"
                  type="range"
                  min={0.01}
                  max={0.2}
                  step={0.01}
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="accent-tone mt-3 w-full"
                />
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-tone/80 to-tone transition-all duration-150"
                      style={{ width: `${(volume / MAX_VOLUME) * 100}%` }}
                    />
                  </div>
                  <span className="font-mono text-xs text-tone">
                    {Math.round(volume * 100)}%
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                  Waveform
                </span>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {WAVEFORMS.map((w) => (
                    <button
                      key={w}
                      onClick={() => setWaveform(w)}
                      className={`rounded-lg border px-3 py-2 font-mono text-xs transition-all ${
                        waveform === w
                          ? "border-accent/50 bg-accent/10 text-accent shadow-[0_0_12px_rgba(0,229,255,0.15)]"
                          : "border-white/[0.06] bg-white/[0.02] text-muted hover:border-white/10 hover:text-white/80"
                      }`}
                    >
                      <span className="block text-base leading-none">{WAVEFORM_ICONS[w]}</span>
                      <span className="mt-1 block capitalize">{w}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Play/Stop */}
            <div className="mt-5 flex items-center gap-4">
              {!isPlaying ? (
                <button
                  onClick={startTone}
                  className="group relative rounded-xl bg-accent px-6 py-3 text-sm font-bold uppercase tracking-[0.15em] text-[#060810] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(0,229,255,0.4)] animate-glow-pulse"
                >
                  <span className="relative z-10">Start Tone</span>
                </button>
              ) : (
                <button
                  onClick={stopTone}
                  className="rounded-xl border border-red-500/30 bg-red-500/10 px-6 py-3 text-sm font-bold uppercase tracking-[0.15em] text-red-400 transition-all duration-300 hover:bg-red-500/20 hover:shadow-[0_0_20px_rgba(239,68,68,0.2)]"
                >
                  Stop Tone
                </button>
              )}
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    isPlaying
                      ? "animate-pulse bg-accent shadow-[0_0_8px_rgba(0,229,255,0.6)]"
                      : "bg-muted/40"
                  }`}
                />
                <span className="text-sm text-muted">
                  {isPlaying ? "Signal active" : "Signal idle"}
                </span>
              </div>
            </div>
          </div>

          {/* Monitor panel */}
          <aside className="rounded-2xl border border-accent/10 bg-gradient-to-br from-[#0a0f1e] to-[#0d1225] p-5 backdrop-blur-xl">
            <p className="text-[10px] uppercase tracking-[0.25em] text-accent/50">Monitor</p>

            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-5xl font-semibold uppercase tracking-[0.2em] leading-none text-white">
                {frequency >= 1000
                  ? `${(frequency / 1000).toFixed(2)}k`
                  : `${Math.round(frequency)}`}
              </span>
              <span className="text-lg font-semibold uppercase tracking-[0.2em] text-accent/70">Hz</span>
            </div>

            <p className="mt-2 font-mono text-sm text-secondary/80">{noteLabel}</p>

            <div className="mt-5 space-y-2">
              {[
                { label: "Wave", value: waveform, color: "text-accent" },
                { label: "Level", value: `${Math.round(volume * 100)}%`, color: "text-tone" },
                { label: "Status", value: isPlaying ? "Running" : "Standby", color: isPlaying ? "text-accent" : "text-muted" }
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2.5"
                >
                  <span className="text-xs text-muted/70">{row.label}</span>
                  <span className={`font-mono text-sm font-semibold capitalize ${row.color}`}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Mini waveform preview */}
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2.5">
              <span className="text-xs text-muted/70">Output</span>
              <div className="flex flex-1 items-center justify-center gap-[2px]">
                {Array.from({ length: 20 }).map((_, i) => {
                  const h = isPlaying
                    ? 4 + Math.abs(Math.sin((i / 20) * Math.PI * 2)) * 16
                    : 4;
                  return (
                    <div
                      key={i}
                      className="w-1 rounded-full bg-accent/40 transition-all duration-300"
                      style={{ height: `${h}px` }}
                    />
                  );
                })}
              </div>
            </div>
          </aside>
        </div>

        {/* Visualizer canvases */}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                Spectrum Analyzer
              </p>
              <p className="font-mono text-[10px] text-accent/40">FFT</p>
            </div>
            <canvas
              ref={spectrumCanvasRef}
              className="h-48 w-full rounded-xl border border-white/[0.04] bg-[#080a14]"
            />
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                Frequency Response
              </p>
              <p className="font-mono text-[10px] text-accent/40">10 Hz — 25 kHz</p>
            </div>
            <canvas
              ref={logCanvasRef}
              className="h-48 w-full rounded-xl border border-white/[0.04] bg-[#080a14]"
            />
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center font-mono text-[10px] tracking-widest text-muted/30">
          SYNTH LAB v1.0
        </p>
      </section>
    </main>
  );
}
