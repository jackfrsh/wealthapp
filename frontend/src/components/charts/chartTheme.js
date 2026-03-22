/**
 * Shared Recharts theme — single source of truth for chart styling.
 *
 * NOTE: Axis/grid/margin props evaluate isMobile dynamically (not at import time)
 * so charts reflow correctly on resize/orientation change.
 */

function getIsMobile() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(max-width: 639px)').matches
}

function readCssVar(name, fallback) {
  if (typeof window === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name)?.trim()
  return v || fallback
}

function rgbToHex(rgbString) {
  const parts = (rgbString || '').split(/\s+/).map((n) => Number(n))
  if (parts.length !== 3 || parts.some((x) => !Number.isFinite(x))) return null
  const toHex = (n) => n.toString(16).padStart(2, '0')
  return `#${toHex(parts[0])}${toHex(parts[1])}${toHex(parts[2])}`
}

function getAccentHex() {
  const rgb = readCssVar('--accent-rgb', '')
  const hex = rgbToHex(rgb)
  if (hex) return hex
  const raw = readCssVar('--accent', '')
  return raw || '#78A9E6'
}

function getCardFill() {
  const raw = readCssVar('--bg-card', '#FFFFFF')
  return raw
}

/* ── Dynamic axis/grid helpers (fresh isMobile per call) ── */

function _xAxis() {
  const m = getIsMobile()
  return {
    axisLine: false,
    tickLine: false,
    interval: 'preserveStartEnd',
    tick: { fontSize: m ? 10 : 11, fill: 'currentColor', fillOpacity: m ? 0.42 : 0.5 },
    minTickGap: m ? 20 : 18,
    tickMargin: m ? 8 : 10,
  }
}
function _yAxis() {
  const m = getIsMobile()
  return {
    axisLine: false,
    tickLine: false,
    width: m ? 48 : 58,
    tick: { fontSize: m ? 11 : 12, fill: 'currentColor', fillOpacity: m ? 0.42 : 0.5 },
    tickMargin: m ? 6 : 10,
  }
}
function _grid() {
  const m = getIsMobile()
  return {
    vertical: false,
    strokeDasharray: m ? '2 8' : '3 6',
    stroke: 'currentColor',
    strokeOpacity: m ? 0.03 : 0.04,
  }
}
function _margin() {
  return getIsMobile()
    ? { top: 6, right: 6, left: 0, bottom: 0 }
    : { top: 10, right: 16, left: 0, bottom: 0 }
}

// Proxy wrappers: when spread via {...xAxisProps}, evaluate isMobile at that moment.
function lazyProps(factory) {
  return new Proxy(
    {},
    {
      get: (_, key) => (key === Symbol.toPrimitive ? undefined : factory()[key]),
      ownKeys: () => Object.keys(factory()),
      getOwnPropertyDescriptor: (_, key) => {
        const v = factory()[key]
        return v !== undefined ? { value: v, enumerable: true, configurable: true } : undefined
      },
    }
  )
}

export const xAxisProps = lazyProps(_xAxis)
export const yAxisProps = lazyProps(_yAxis)
export const gridProps = lazyProps(_grid)
export const chartMargin = lazyProps(_margin)

/* ── Static helpers ─────────────────────────────────────── */

export function compactTickFormatter(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return v
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(0)}K`
  return n
}

export const tooltipProps = {
  cursor: { stroke: 'currentColor', strokeOpacity: 0.1, strokeWidth: 1 },
}

export const ACCENT_STROKE = getAccentHex()

export function areaGradient(id, color = ACCENT_STROKE, topOpacity = 0.08) {
  return { id, color, topOpacity }
}

export const primaryLineProps = {
  type: 'monotone',
  stroke: ACCENT_STROKE,
  strokeWidth: 2,
  dot: false,
}

export const secondaryLineProps = {
  type: 'monotone',
  stroke: 'currentColor',
  strokeWidth: 1.5,
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
