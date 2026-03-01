export function resetCelebrations() {
  try {
    const keys = Object.keys(localStorage)
    for (const k of keys) {
      if (k.startsWith('milestone:')) localStorage.removeItem(k)
    }
    // if you used a single key before, nuke it too
    localStorage.removeItem('milestones_seen')
    localStorage.removeItem('milestone_seen')
    localStorage.removeItem('celebrations_disabled')
  } catch {}
}