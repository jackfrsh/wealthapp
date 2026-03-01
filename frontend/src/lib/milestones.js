export const MAJOR_MILESTONES = [
  10000,
  25000,
  50000,
  100000,
  250000,
  500000,
  1000000,
  2000000,
  5000000,
  10000000,
]

export function getCurrentMajor(total) {
  return (
    MAJOR_MILESTONES
      .filter(m => total >= m)
      .pop() || 0
  )
}

export function getNextMajor(total) {
  return MAJOR_MILESTONES.find(m => m > total) || null
}

export function getProgressToNext(total) {
  const current = getCurrentMajor(total)
  const next = getNextMajor(total)

  if (!next) return { current, next: null, progress: 1 }

  const range = next - current
  const progress = (total - current) / range

  return { current, next, progress }
}