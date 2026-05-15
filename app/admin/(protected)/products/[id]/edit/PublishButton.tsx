'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  productId: string
  currentStatus: string
  fullWidth?: boolean
}

export function PublishButton({ productId, currentStatus, fullWidth }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  if (currentStatus === 'published') {
    return (
      <span className={`inline-flex items-center justify-center rounded-[2px] bg-green-600 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-white ${fullWidth ? 'w-full' : ''}`}>
        ✓ Publikováno
      </span>
    )
  }

  async function publish() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/products/${productId}/publish`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Chyba'); setLoading(false); return }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Síťová chyba')
      setLoading(false)
    }
  }

  return (
    <div className={fullWidth ? 'w-full' : ''}>
      <button
        onClick={publish}
        disabled={loading}
        className={`inline-flex items-center justify-center gap-2 rounded-[2px] bg-[color:var(--color-olive)] px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:bg-[color:var(--color-olive-2)] disabled:opacity-60 ${fullWidth ? 'w-full' : ''}`}
      >
        {loading ? '⟳ Publikuji…' : 'Publikovat'}
      </button>
      {error && <p className="mt-1 text-[10px] text-red-600">{error}</p>}
    </div>
  )
}
