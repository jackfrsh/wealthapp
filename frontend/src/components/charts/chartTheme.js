/**
 * Shared Recharts theme — single source of truth for chart styling.
 *
 * Usage:
 *   import {
 *     xAxisProps, yAxisProps, gridProps, tooltipProps, chartMargin,
 *     compactTickFormatter, ACCENT_STROKE,
 *     areaGradient, primaryLineProps, secondaryLineProps, projectedLineProps, activeDotStyle
 *   } from '../components/charts/chartTheme'
 */

const isMobile =
  typeof window !== 'undefined'
    ? window.matchMedia('(max-width: 639px)').matches
    : false

function readCssVar(name, fallback) {
  if (typeof window === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name)?.trim()
  return v || fallback
}

function rgbToHex(rgbString) {
  // expects "r g b"
  const parts = (rgbString || '').split(/\s+/).map((n) => Number(n))
  if (parts.length !== 3 || parts.some((x) => !Number.isFinite(x))) return null
  const toHex = (n) => n.toString(16).padStart(2, '0')
  return `#${toHex(parts[0])}${toHex(parts[1])}${toHex(parts[2])}`
}

function getAccentHex() {
  // Prefer the rgb token
  const rgb = readCssVar('--accent-rgb', '')
  const hex = rgbToHex(rgb)
  if (hex) return hex

  // Fallback to --accent which is a hex string in your CSS
  const raw = readCssVar('--accent', '')
  return raw || '#4B79A8'
}

function getCardFill() {
  // Use card background for active dot fill (works in both themes)
  const raw = readCssVar('--bg-card', '#FFFFFF')
  return raw
}

/* ── Axis props ──────────────────────────────────────── */

export const xAxisProps = {
  axisLine: false,
  tickLine: false,
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
  width: isMobile ? 48 : 58,
  tick: {
    fontSize: isMobile ? 11 : 12,
    fill: 'currentColor',
    fillOpacity: isMobile ? 0.42 : 0.5,
  },
  tickMargin: isMobile ? 6 : 10,
}

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
  strokeDasharray: isMobile ? '2 8' : '3 6',
  stroke: 'currentColor',
  strokeOpacity: isMobile ? 0.03 : 0.04,
}

/* ── Tooltip ──────────────────────────────────────────── */

export const tooltipProps = {
  cursor: {
    stroke: 'currentColor',
    strokeOpacity: isMobile ? 0.08 : 0.1,
    strokeWidth: 1,
  },
}

/* ── Line / Area defaults ─────────────────────────────── */

export const ACCENT_STROKE = getAccentHex()

export function areaGradient(id, color = ACCENT_STROKE, topOpacity = 0.08) {
  return { id, color, topOpacity }
}

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

export const projectedLineProps = {
  ...primaryLineProps,
  strokeWidth: 2,
  strokeDasharray: '6 4',
}

export const activeDotStyle = {
  r: 4,
  stroke: ACCENT_STROKE,
  strokeWidth: 2,
  fill: getCardFill(),
}

/* ── Margins ──────────────────────────────────────────── */

export const chartMargin = isMobile
  ? { top: 6, right: 6, left: 0, bottom: 0 }
  : { top: 10, right: 16, left: 0, bottom: 0 }