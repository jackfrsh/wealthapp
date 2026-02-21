/**
 * Shared Recharts theme — single source of truth for chart styling.
 *
 * Usage:
 *   import { xAxisProps, yAxisProps, gridProps, tooltipProps, areaFill, activeDotStyle } from '../components/charts/chartTheme'
 */

/* ── Axis props ──────────────────────────────────────── */

export const xAxisProps = {
  axisLine: false,
  tickLine: false,
  interval: 'preserveStartEnd',
  tick: { fontSize: 12, fill: 'currentColor', fillOpacity: 0.5 },
}

export const yAxisProps = {
  axisLine: false,
  tickLine: false,
  width: 58,
  tick: { fontSize: 12, fill: 'currentColor', fillOpacity: 0.5 },
}

/** Default Y-axis formatter: 1,200,000 → 1.2M, 45,000 → 45K */
export function compactTickFormatter(v) {
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`
  return v
}

/* ── Grid ─────────────────────────────────────────────── */

export const gridProps = {
  vertical: false,
  strokeDasharray: '3 6',
  stroke: 'currentColor',
  strokeOpacity: 0.04,
}

/* ── Tooltip ──────────────────────────────────────────── */

export const tooltipProps = {
  cursor: { stroke: 'rgba(255,255,255,0.08)' },
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
  return {
    id,
    color,
    topOpacity,
  }
}

/** Shared primary line styling */
export const primaryLineProps = {
  type: 'monotone',
  stroke: ACCENT_STROKE,
  strokeWidth: 2,
  dot: false,
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

/** Standard chart margins */
export const chartMargin = { top: 10, right: 10, bottom: 0, left: 10 }
