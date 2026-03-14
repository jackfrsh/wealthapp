import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react';

const slides = [
  {
    id: 1,
    eyebrow: 'Opening',
    title: 'See your wealth clearly',
    body:
      'A calm, premium view of your financial world — designed to make your numbers feel understandable at a glance.',
    accent: 'from-sky-400/25 via-blue-500/10 to-transparent',
    imageLabel: 'Replace with: logo + dashboard tease',
    metricA: 'Total wealth',
    metricB: '£94,500',
    metricC: '+8.4% YoY',
  },
  {
    id: 2,
    eyebrow: 'Accounts',
    title: 'Bring everything into one place',
    body:
      'Show how adding cash, ISA, pension, and other accounts feels simple, controlled, and premium.',
    accent: 'from-emerald-400/20 via-cyan-400/10 to-transparent',
    imageLabel: 'Replace with: add account flow',
    metricA: 'Accounts',
    metricB: '4 connected manually',
    metricC: 'GBP / USD / EUR',
  },
  {
    id: 3,
    eyebrow: 'Dashboard',
    title: 'Know your number',
    body:
      'The homepage is the hero: total wealth, progress, and the signal that matters most in one clear surface.',
    accent: 'from-blue-400/25 via-indigo-400/10 to-transparent',
    imageLabel: 'Replace with: home dashboard',
    metricA: 'Net worth',
    metricB: '£94,500',
    metricC: 'Goal 37.8%',
  },
  {
    id: 4,
    eyebrow: 'Goal',
    title: 'Track progress toward your goal',
    body:
      'Keep one meaningful target in view so the product feels directional, not just informational.',
    accent: 'from-violet-400/20 via-fuchsia-400/10 to-transparent',
    imageLabel: 'Replace with: goal progress card',
    metricA: 'Target',
    metricB: '£250,000',
    metricC: '37.8% complete',
  },
  {
    id: 5,
    eyebrow: 'Outlook',
    title: 'Project your future with confidence',
    body:
      'Use a projection chart to suggest momentum and long-term clarity without overwhelming the user.',
    accent: 'from-cyan-400/20 via-sky-400/10 to-transparent',
    imageLabel: 'Replace with: projection chart',
    metricA: '10Y projection',
    metricB: '£211,300',
    metricC: 'Based on current inputs',
  },
  {
    id: 6,
    eyebrow: 'Control',
    title: 'Built for real-world tracking',
    body:
      'Hint at settings, currency control, and the product’s privacy-first, trust-first posture.',
    accent: 'from-slate-300/10 via-slate-100/5 to-transparent',
    imageLabel: 'Replace with: settings / currency',
    metricA: 'Base currency',
    metricB: 'GBP',
    metricC: 'Privacy-first',
  },
  {
    id: 7,
    eyebrow: 'Close',
    title: 'Know your number. Build your future.',
    body:
      'End on the strongest frame and a clean brand moment. This can loop as a premium homepage hero.',
    accent: 'from-sky-400/25 via-indigo-400/10 to-transparent',
    imageLabel: 'Replace with: best dashboard frame',
    metricA: 'Paddock',
    metricB: 'Premium wealth clarity',
    metricC: 'Join early',
  },
];

function MockPhoneFrame({ slide }) {
  return (
    <div className="relative mx-auto w-full max-w-[420px] rounded-[2rem] border border-white/10 bg-[#0b1220] p-3 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
      <div className="mx-auto mb-3 h-1.5 w-24 rounded-full bg-white/10" />
      <div className="overflow-hidden rounded-[1.5rem] border border-white/8 bg-[#08101c]">
        <div className="border-b border-white/8 bg-white/[0.03] px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">{slide.eyebrow}</div>
              <div className="mt-1 text-sm font-medium text-white/85">Paddock Preview</div>
            </div>
            <div className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/60">Demo</div>
          </div>
        </div>

        <div className="p-4">
          <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">{slide.metricA}</div>
            <div className="mt-2 text-3xl font-semibold tracking-tight text-white">{slide.metricB}</div>
            <div className="mt-1 text-sm text-emerald-300/80">{slide.metricC}</div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
              <div className="h-2 w-14 rounded-full bg-white/10" />
              <div className="mt-3 h-7 w-20 rounded-lg bg-white/10" />
              <div className="mt-4 h-16 rounded-2xl bg-gradient-to-br from-white/8 to-white/[0.03]" />
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
              <div className="h-2 w-12 rounded-full bg-white/10" />
              <div className="mt-3 h-7 w-16 rounded-lg bg-white/10" />
              <div className="mt-4 h-16 rounded-2xl bg-gradient-to-br from-white/8 to-white/[0.03]" />
            </div>
          </div>

          <div className="mt-4 rounded-3xl border border-dashed border-white/15 bg-white/[0.02] p-5">
            <div className="text-center text-sm font-medium text-white/80">{slide.imageLabel}</div>
            <div className="mt-2 text-center text-xs text-white/45">Drop a real screenshot or short video frame here later</div>
            <div className="mt-5 h-32 rounded-2xl border border-white/8 bg-gradient-to-b from-sky-400/10 to-transparent" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PaddockHeroSlideshow() {
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  const activeSlide = useMemo(() => slides[index], [index]);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length);
    }, 4200);
    return () => clearInterval(timer);
  }, [isPlaying]);

  const goPrev = () => setIndex((prev) => (prev - 1 + slides.length) % slides.length);
  const goNext = () => setIndex((prev) => (prev + 1) % slides.length);

  return (
    <section className="relative overflow-hidden bg-[#060b13] text-white">
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${activeSlide.accent}`} />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_35%)]" />

      <div className="mx-auto grid min-h-[760px] max-w-7xl grid-cols-1 gap-12 px-6 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:px-10 xl:px-12">
        <div className="relative flex flex-col justify-center">
          <motion.div
            key={activeSlide.id}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="max-w-xl"
          >
            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-white/55">
              {activeSlide.eyebrow}
            </div>

            <h1 className="mt-6 text-4xl font-semibold leading-[1.02] tracking-tight text-white sm:text-5xl lg:text-6xl">
              {activeSlide.title}
            </h1>

            <p className="mt-6 max-w-lg text-base leading-7 text-white/65 sm:text-lg">
              {activeSlide.body}
            </p>
          </motion.div>

          <div className="mt-10 flex items-center gap-3">
            <button
              onClick={goPrev}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/75 transition hover:bg-white/[0.06]"
              aria-label="Previous slide"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => setIsPlaying((v) => !v)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/75 transition hover:bg-white/[0.06]"
              aria-label={isPlaying ? 'Pause slideshow' : 'Play slideshow'}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button
              onClick={goNext}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/75 transition hover:bg-white/[0.06]"
              aria-label="Next slide"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-8 flex flex-wrap gap-2">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${i === index ? 'w-12 bg-white' : 'w-6 bg-white/20 hover:bg-white/35'}`}
                aria-label={`Go to slide ${slide.id}`}
              />
            ))}
          </div>
        </div>

        <div className="relative flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSlide.id}
              initial={{ opacity: 0, scale: 0.98, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.01, y: -10 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
              className="w-full"
            >
              <MockPhoneFrame slide={activeSlide} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
