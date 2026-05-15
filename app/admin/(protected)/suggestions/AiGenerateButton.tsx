'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  suggestionId: string
  productName: string
  estimatedCostUsd: number
}

type Phase = 'idle' | 'confirm' | 'generating' | 'done' | 'error'

export function AiGenerateButton({ suggestionId, productName, estimatedCostUsd }: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [overrideCost, setOverrideCost] = useState(false)
  const router = useRouter()

  async function runGeneration() {
    setPhase('generating')
    setErrorMsg('')
    try {
      const res = await fetch('/api/admin/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestion_id: suggestionId, override_cost_limit: overrideCost }),
      })
      const data = await res.json()

      if (res.status === 402) {
        // Daily cost limit — ask for confirmation
        setOverrideCost(true)
        setErrorMsg(data.detail ?? 'Denní limit nákladů překročen. Potvrďte pokračování.')
        setPhase('confirm')
        return
      }
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Generování selhalo')
        setPhase('error')
        return
      }
      setPhase('done')
      // Redirect to draft edit page
      router.push(data.edit_url)
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Síťová chyba')
      setPhase('error')
    }
  }

  if (phase === 'generating') {
    return (
      <div className="flex flex-1 items-center justify-center border-r border-[color:var(--color-border)] py-3">
        <span className="text-xs text-[color:var(--color-muted)]">
          <span className="inline-block animate-spin mr-1.5">⟳</span>
          Generuji… (~60 s)
        </span>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center border-r border-[color:var(--color-border)] px-2 py-2 gap-1">
        <span className="text-[10px] text-red-600 text-center leading-tight">{errorMsg.slice(0, 80)}</span>
        <button
          onClick={() => setPhase('idle')}
          className="text-[10px] text-[color:var(--color-muted)] underline"
        >
          Zkusit znovu
        </button>
      </div>
    )
  }

  if (phase === 'confirm' || phase === 'idle') {
    const showConfirmText = phase === 'confirm'
    return (
      <>
        <button
          onClick={() => setPhase('confirm')}
          className="flex-1 border-r border-[color:var(--color-border)] py-3 text-xs font-semibold uppercase tracking-wider text-[color:var(--color-gold)] transition-colors hover:bg-[color:var(--color-gold)] hover:text-[color:var(--color-dark)]"
        >
          AI recenze ✦
        </button>

        {phase === 'confirm' && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={e => { if (e.target === e.currentTarget) setPhase('idle') }}
          >
            <div className="w-full max-w-sm rounded-[4px] border border-[color:var(--color-border)] bg-white p-6 shadow-xl">
              <h3 className="font-serif text-lg font-bold text-[color:var(--color-text)]">
                Generovat AI recenzi?
              </h3>
              <p className="mt-2 text-sm text-[color:var(--color-muted)] leading-relaxed">
                <strong className="text-[color:var(--color-text)]">{productName.slice(0, 60)}</strong>
              </p>
              {showConfirmText && overrideCost && errorMsg && (
                <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded p-2">{errorMsg}</p>
              )}
              <div className="mt-3 rounded-[2px] border border-[color:var(--color-border)] bg-[color:var(--color-olive-pale)] px-4 py-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-[color:var(--color-muted)]">Odhadovaná cena</span>
                  <span className="font-mono font-semibold text-[color:var(--color-text)]">
                    ~${estimatedCostUsd.toFixed(2)}
                  </span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span className="text-[color:var(--color-muted)]">Výstup</span>
                  <span className="text-[color:var(--color-text)]">Draft (lidská kontrola povinná)</span>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-[color:var(--color-muted)]">
                Recenze bude vytvořena jako <strong>draft</strong>. Bez manuálního schválení a publikace nebude viditelná.
              </p>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={runGeneration}
                  className="flex-1 rounded-[2px] bg-[color:var(--color-olive)] px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:bg-[color:var(--color-olive-2)]"
                >
                  {overrideCost ? 'Potvrdit a pokračovat' : 'Vygenerovat →'}
                </button>
                <button
                  onClick={() => { setPhase('idle'); setOverrideCost(false); setErrorMsg('') }}
                  className="rounded-[2px] border border-[color:var(--color-border)] px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[color:var(--color-muted)] transition-colors hover:border-[color:var(--color-text)]"
                >
                  Zrušit
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  return null
}
