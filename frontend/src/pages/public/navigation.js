import { useApp } from '../../App'

const PATH_TO_PAGE = {
  '/': 'landing',
  '/auth': 'auth',
  '/privacy': 'privacy',
  '/security': 'security',
  '/terms': 'terms',
  '/support': 'support',
  '/tools': 'tools_index',
  '/tools/pension-drawdown-calculator': 'tool_pension_drawdown',
  '/tools/fire-number-calculator': 'tool_fire_number',
  '/tools/isa-growth-calculator': 'tool_isa_growth',
  '/tools/net-worth-calculator': 'tool_net_worth',
  '/guides': 'guides_index',
  '/guides/how-long-will-my-pension-last': 'guide_pension_longevity',
  '/best-net-worth-tracking-apps-uk': 'best_net_worth_apps_uk',
  '/why-i-track-wealth-manually-instead-of-using-open-banking-apps': 'manual_tracking',
}

export function usePublicNavigation() {
  const { setPage, authed } = useApp()

  const navigateTo = (path) => {
    const next = PATH_TO_PAGE[path] || 'landing'
    setPage(next)
  }

  const openPaddock = () => {
    setPage(authed ? 'plan' : 'auth')
  }

  return { authed, navigateTo, openPaddock }
}
