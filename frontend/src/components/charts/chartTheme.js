/**
 * Shared Recharts theme — single source of truth for chart styling.
 *
 * Usage:
 *   import { xAxisProps, yAxisProps, gridProps, tooltipProps, chartMargin, compactTickFormatter, ACCENT_STROKE } from '../components/charts/chartTheme'
 */

/* ── Responsive helper ───────────────────────────────── */

const isMobile =
  typeof window !== 'undefined'
    ? window.matchMedia('(max-width: 639px)').matches
    : false

/* ── Axis props ──────────────────────────────────────── */

export const xAxisProps = {
  axisLine: false,
  tickLine: false,

  // Smart compromise
  interval: isMobile ? 'preserveStartEnd' : 'preserveStartEnd',

  tick: {
    fontSize: isMobile ? 10 : 11,
    fill: 'currentColor',
    fillOpacity: isMobile ? 0.42 : 0.5,
  },

  minTickGap: isMobile ? 20 : 18,
  tickMargin: isMobile ? 8 : 10,
}

export const yAxisProps = {
  axisLine: false,
  tickLine: false,

  // Mobile: reclaim width for plot area
  width: isMobile ? 48 : 58,

  tick: {
    fontSize: isMobile ? 11 : 12,
    fill: 'currentColor',
    fillOpacity: isMobile ? 0.42 : 0.5,
  },

  tickMargin: isMobile ? 6 : 10,
}

/** Default Y-axis formatter: 1,200,000 → 1.2M, 45,000 → 45K */
export function compactTickFormatter(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return v
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(0)}K`
  return n
}

/* ── Grid ─────────────────────────────────────────────── */

export const gridProps = {
  vertical: false,
  strokeDasharray: isMobile ? '2 8' : '3 6', // lighter on mobile
  stroke: 'currentColor',
  strokeOpacity: isMobile ? 0.03 : 0.04, // faint like you wanted
}

/* ── Tooltip ──────────────────────────────────────────── */

export const tooltipProps = {
  // Very subtle crosshair so it doesn't overpower dark mode
  cursor: {
    stroke: 'currentColor',
    strokeOpacity: isMobile ? 0.08 : 0.10,
    strokeWidth: 1,
  },
}

/* ── Line / Area defaults ─────────────────────────────── */

export const ACCENT_STROKE = '#3b7cc4'

/**
 * Returns the <defs><linearGradient> pair for area fills.
 * @param {string} id   – unique gradient id (e.g. 'stratFill')
 * @param {string} color – hex colour (defaults to accent)
 * @param {number} topOpacity – max opacity (≤ 0.12)
 */
export function areaGradient(id, color = ACCENT_STROKE, topOpacity = 0.08) {
  return { id, color, topOpacity }
}

/** Shared primary line styling */
export const primaryLineProps = {
  type: 'monotone',
  stroke: ACCENT_STROKE,
  strokeWidth: isMobile ? 2.25 : 2,
  dot: false,
}

export const secondaryLineProps = {
  type: 'monotone',
  stroke: 'currentColor',
  strokeWidth: isMobile ? 1.75 : 1.5,
  strokeOpacity: 0.12,
  strokeDasharray: '6 4',
  fill: 'none',
  dot: false,
  connectNulls: true,
}

/** Projected / secondary line styling (dashed) */
export const projectedLineProps = {
  ...primaryLineProps,
  strokeWidth: 2,
  strokeDasharray: '6 4',
}

/** Active dot shown on hover */
export const activeDotStyle = {
  r: 4,
  stroke: ACCENT_STROKE,
  strokeWidth: 2,
  fill: 'white',
}

/* ── Margins ──────────────────────────────────────────── */

export const chartMargin = isMobile
  ? { top: 6, right: 6, left: 0, bottom: 0 }
  : { top: 10, right: 16, left: 0, bottom: 0 }