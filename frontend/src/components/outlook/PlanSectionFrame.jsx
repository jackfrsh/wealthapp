import React from 'react'
import Card from '../Card'
import { planTheme } from './planTheme'

const fallbackSectionCard =
  'rounded-[28px] border border-black/[.05] dark:border-white/[.06] bg-white dark:bg-surface-dark-2 overflow-hidden'

export default function PlanSectionFrame({
  header,
  icon: Icon,
  title,
  subtitle,
  badge = null,
  actions = null,
  children,
  className = '',
  bodyClassName = '',
}) {
  const sectionCard = planTheme.sectionCard || fallbackSectionCard

  return (
    <Card className={`${sectionCard} ${className}`}>
      <div className="px-5 sm:px-6 py-5">
        {header ? (
          header
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                {Icon ? <Icon size={16} className="text-accent" /> : null}
                <h3 className={planTheme.title}>{title}</h3>
                {badge}
              </div>

              {subtitle ? <div className={`mt-1 ${planTheme.body}`}>{subtitle}</div> : null}
            </div>

            {actions ? <div className="shrink-0">{actions}</div> : null}
          </div>
        )}
      </div>

      {children ? (
        <>
          <div className="mx-5 sm:mx-6 border-t border-black/[.06] dark:border-white/[.06]" />
          <div className={`px-5 sm:px-6 pt-5 pb-6 ${bodyClassName}`}>{children}</div>
        </>
      ) : null}
    </Card>
  )
}