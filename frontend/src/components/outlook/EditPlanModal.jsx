import React from 'react'
import { Save, X } from 'lucide-react'
import { planTheme } from './planTheme'

export default function EditPlanModal({
  open,
  editForm,
  updateEdit,
  editValid,
  editSaving,
  onClose,
  onSave,
  ccy,
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60]">
      <button
        type="button"
        aria-label="Close edit plan modal"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
      />

      <div className="absolute inset-0 overflow-y-auto">
        <div className="min-h-full px-4 pt-20 sm:pt-24 pb-6 flex items-start justify-center">
          <div className={`relative w-full max-w-[560px] ${planTheme.sectionCard} shadow-[0_24px_80px_rgba(0,0,0,0.24)] p-6 sm:p-7`}>
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className={planTheme.eyebrow}>Edit plan</div>
                <div className={`mt-1 ${planTheme.body}`}>
                  Update your target, timeline and assumptions.
                </div>
              </div>

              <button
                onClick={onClose}
                className={planTheme.iconButton}
                aria-label="Close"
                type="button"
              >
                <X size={18} className="text-ink dark:text-white" />
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className={planTheme.fieldLabel}>Goal name</label>
                <input
                  value={editForm.name}
                  onChange={(e) => updateEdit('name', e.target.value)}
                  className={planTheme.fieldInput}
                  placeholder="Retirement"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={planTheme.fieldLabel}>Your current age</label>
                  <input
                    value={editForm.current_age}
                    onChange={(e) => updateEdit('current_age', e.target.value)}
                    className={planTheme.fieldInput}
                    placeholder="32"
                    inputMode="numeric"
                  />
                </div>

                <div>
                  <label className={planTheme.fieldLabel}>Target age</label>
                  <input
                    value={editForm.target_age}
                    onChange={(e) => updateEdit('target_age', e.target.value)}
                    className={planTheme.fieldInput}
                    placeholder="60"
                    inputMode="numeric"
                  />
                </div>
              </div>

              <div>
                <label className={planTheme.fieldLabel}>Target amount ({ccy})</label>
                <input
                  value={editForm.target_amount}
                  onChange={(e) => updateEdit('target_amount', e.target.value)}
                  className={planTheme.fieldInput}
                  placeholder="1,000,000"
                  inputMode="decimal"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={planTheme.fieldLabel}>Monthly contribution ({ccy})</label>
                  <input
                    value={editForm.monthly_contribution}
                    onChange={(e) => updateEdit('monthly_contribution', e.target.value)}
                    className={planTheme.fieldInput}
                    placeholder="500"
                    inputMode="decimal"
                  />
                </div>

                <div>
                  <label className={planTheme.fieldLabel}>Expected annual return (%)</label>
                  <input
                    value={editForm.expected_annual_return_pct}
                    onChange={(e) => updateEdit('expected_annual_return_pct', e.target.value)}
                    className={planTheme.fieldInput}
                    placeholder="7"
                    inputMode="decimal"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button onClick={onClose} className={planTheme.buttonSecondary} type="button">
                  Cancel
                </button>

                <button
                  onClick={onSave}
                  disabled={!editValid || editSaving}
                  className={`${planTheme.buttonPrimary} disabled:opacity-40`}
                  type="button"
                >
                  <Save size={16} /> {editSaving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}