'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { COLORS } from '../../_components/tokens'

interface Props {
  productId: string
  status: string
  reviewSlug: string | null
}

type Phase = 'idle' | 'publishing' | 'deleting' | 'regenerating' | 'uploading' | 'published'

export function PreviewToolbar({ productId, status, reviewSlug }: Props) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('idle')
  const [showRegen, setShowRegen] = useState(false)
  const [showPublish, setShowPublish] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [showImage, setShowImage] = useState(false)
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null)

  const isPublished = status === 'published'
  const busy = phase !== 'idle' && phase !== 'published'

  function reloadIframe() {
    const iframe = document.querySelector('iframe') as HTMLIFrameElement | null
    if (!iframe) return
    const src = iframe.src
    iframe.src = ''
    setTimeout(() => { iframe.src = src }, 50)
  }

  async function doUploadImage(file: File) {
    setShowImage(false)
    setPhase('uploading')
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`/api/admin/products/${productId}/hero-image`, {
        method: 'POST',
        body: form,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      setToast({
        msg: data.mdx_replaced
          ? 'Fotka nahrána a aktualizována i v recenzi.'
          : 'Fotka nahrána.',
        kind: 'ok',
      })
      setPhase('idle')
      router.refresh()
      reloadIframe()
    } catch (e) {
      setPhase('idle')
      setToast({ msg: e instanceof Error ? e.message : 'Upload selhal', kind: 'err' })
    }
  }

  async function doPublish() {
    setShowPublish(false)
    setPhase('publishing')
    try {
      const res = await fetch(`/api/admin/products/${productId}/publish`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Publish failed')
      setPhase('published')
      setToast({ msg: 'Recenze publikována — Railway redeploy spuštěn.', kind: 'ok' })
      setTimeout(() => router.push('/admin/catalog/'), 800)
    } catch (e) {
      setPhase('idle')
      setToast({ msg: e instanceof Error ? e.message : 'Publikace selhala', kind: 'err' })
    }
  }

  async function doDelete() {
    setShowDelete(false)
    setPhase('deleting')
    try {
      const res = await fetch(`/api/admin/products/${productId}/delete`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Delete failed')
      }
      setToast({ msg: 'Draft smazán.', kind: 'ok' })
      setTimeout(() => router.push('/admin/drafts/'), 500)
    } catch (e) {
      setPhase('idle')
      setToast({ msg: e instanceof Error ? e.message : 'Smazání selhalo', kind: 'err' })
    }
  }

  async function doRegenerate(instructions: string) {
    setShowRegen(false)
    setPhase('regenerating')
    try {
      const res = await fetch(`/api/admin/products/${productId}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructions }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Regenerate failed')
      setToast({ msg: `Vygenerováno znovu (${data.cost_usd?.toFixed(3) ?? '—'} $).`, kind: 'ok' })
      setPhase('idle')
      router.refresh()
      reloadIframe()
    } catch (e) {
      setPhase('idle')
      setToast({ msg: e instanceof Error ? e.message : 'Regenerace selhala', kind: 'err' })
    }
  }

  return (
    <>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
        {reviewSlug && (
          <a
            href={`/${reviewSlug}/`}
            target="_blank"
            rel="noopener noreferrer"
            style={btnSecondary}
          >Otevřít na webu ↗</a>
        )}
        <button
          onClick={() => setShowImage(true)}
          disabled={busy}
          style={btnSecondary}
        >Vyměnit fotku</button>
        <button
          onClick={() => setShowRegen(true)}
          disabled={busy}
          style={btnSecondary}
        >Přegenerovat</button>
        <button
          onClick={() => setShowDelete(true)}
          disabled={busy}
          style={btnDanger}
        >Smazat</button>
        {!isPublished && (
          <button
            onClick={() => setShowPublish(true)}
            disabled={busy}
            style={btnPrimary}
          >{phase === 'publishing' ? 'Publikuji…' : 'Publikovat'}</button>
        )}
        {isPublished && (
          <span style={{
            fontSize: '12px',
            fontWeight: 500,
            padding: '6px 12px',
            background: COLORS.publishedBg,
            color: COLORS.published,
            borderRadius: '6px',
          }}>✓ Publikováno</span>
        )}
      </div>

      {phase === 'regenerating' && <LoadingOverlay label="Generuji novou verzi — může trvat 30–60 s…" />}
      {phase === 'publishing' && <LoadingOverlay label="Publikuji recenzi…" />}
      {phase === 'uploading' && <LoadingOverlay label="Nahrávám fotku…" />}

      {showImage && (
        <ImageUploadModal
          onCancel={() => setShowImage(false)}
          onSubmit={doUploadImage}
        />
      )}

      {showRegen && (
        <RegenerateModal
          onCancel={() => setShowRegen(false)}
          onSubmit={doRegenerate}
        />
      )}

      {showPublish && (
        <ConfirmModal
          title="Publikovat draft?"
          body={reviewSlug
            ? <>Recenze bude veřejně dostupná na <code style={codeStyle}>/{reviewSlug}/</code> a spustí se Railway redeploy.</>
            : 'Recenze bude publikována.'}
          confirmLabel="Publikovat"
          confirmKind="primary"
          onCancel={() => setShowPublish(false)}
          onConfirm={doPublish}
        />
      )}

      {showDelete && (
        <ConfirmModal
          title={isPublished ? 'Smazat publikovanou recenzi?' : 'Smazat draft?'}
          body="Tato akce je nevratná."
          confirmLabel="Smazat"
          confirmKind="danger"
          onCancel={() => setShowDelete(false)}
          onConfirm={doDelete}
        />
      )}

      {toast && (
        <Toast
          msg={toast.msg}
          kind={toast.kind}
          onDismiss={() => setToast(null)}
        />
      )}
    </>
  )
}

// ─────── UI bits ───────

function ImageUploadModal({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void
  onSubmit: (file: File) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState('')

  function handleFile(f: File | null | undefined) {
    if (!f) return
    if (!['image/webp', 'image/jpeg', 'image/png'].includes(f.type)) {
      setError('Povolen je webp, jpg nebo png.')
      return
    }
    if (f.size > 5 * 1024 * 1024) {
      setError(`Soubor je ${(f.size / 1024 / 1024).toFixed(1)} MB, limit 5 MB.`)
      return
    }
    setError('')
    setFile(f)
    setPreviewUrl(URL.createObjectURL(f))
  }

  return (
    <Modal onClose={onCancel}>
      <h2 style={{
        fontSize: '17px',
        fontWeight: 600,
        color: COLORS.text,
        margin: '0 0 4px',
        letterSpacing: '-0.01em',
      }}>Vyměnit hero fotku</h2>
      <p style={{
        fontSize: '13px',
        color: COLORS.textSubtle,
        margin: '0 0 16px',
      }}>
        webp / jpg / png, max 5 MB. Doporučeno čtverec ~800 px.
        Fotka se uloží do Supabase Storage a zaktualizuje i v MDX recenze.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/webp,image/jpeg,image/png"
        onChange={e => handleFile(e.target.files?.[0])}
        style={{ display: 'none' }}
      />

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault() }}
        onDrop={e => {
          e.preventDefault()
          handleFile(e.dataTransfer.files?.[0])
        }}
        style={{
          border: `2px dashed ${COLORS.border}`,
          borderRadius: '8px',
          padding: previewUrl ? '12px' : '32px 16px',
          textAlign: 'center',
          cursor: 'pointer',
          background: COLORS.surface,
          transition: 'border-color 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = COLORS.olive }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = COLORS.border }}
      >
        {previewUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={previewUrl}
            alt="Náhled"
            style={{
              maxWidth: '100%',
              maxHeight: '240px',
              objectFit: 'contain',
              borderRadius: '4px',
            }}
          />
        ) : (
          <>
            <div style={{ fontSize: '13px', color: COLORS.text, marginBottom: '4px', fontWeight: 500 }}>
              Klikni nebo přetáhni fotku sem
            </div>
            <div style={{ fontSize: '12px', color: COLORS.textSubtle }}>
              webp · jpg · png · max 5 MB
            </div>
          </>
        )}
      </div>

      {file && (
        <div style={{
          fontSize: '12px',
          color: COLORS.textMuted,
          margin: '8px 0 0',
        }}>
          {file.name} · {(file.size / 1024).toFixed(0)} KB
        </div>
      )}

      {error && (
        <div style={{
          fontSize: '12px',
          color: COLORS.danger,
          margin: '8px 0 0',
        }}>{error}</div>
      )}

      <div style={{
        display: 'flex',
        gap: '8px',
        justifyContent: 'flex-end',
        marginTop: '20px',
      }}>
        <button onClick={onCancel} style={btnSecondary}>Zrušit</button>
        <button
          onClick={() => file && onSubmit(file)}
          disabled={!file}
          style={{ ...btnPrimary, opacity: file ? 1 : 0.5 }}
        >Nahrát</button>
      </div>
    </Modal>
  )
}

function RegenerateModal({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void
  onSubmit: (instructions: string) => void
}) {
  const [text, setText] = useState('')

  return (
    <Modal onClose={onCancel}>
      <h2 style={{
        fontSize: '17px',
        fontWeight: 600,
        color: COLORS.text,
        margin: '0 0 4px',
        letterSpacing: '-0.01em',
      }}>Přegenerovat recenzi</h2>
      <p style={{
        fontSize: '13px',
        color: COLORS.textSubtle,
        margin: '0 0 16px',
      }}>
        Popiš co chceš změnit. AI vytvoří novou verzi a nahradí draft.
      </p>
      <textarea
        autoFocus
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="např. udělej kratší úvod, přidej víc o aciditě, změň tone na storytellingovější…"
        rows={5}
        style={{
          width: '100%',
          padding: '10px 12px',
          fontSize: '13px',
          fontFamily: 'inherit',
          border: `1px solid ${COLORS.border}`,
          borderRadius: '6px',
          outline: 'none',
          resize: 'vertical',
          color: COLORS.text,
          background: '#FFFFFF',
          lineHeight: 1.5,
        }}
        onFocus={e => { e.currentTarget.style.borderColor = COLORS.olive }}
        onBlur={e => { e.currentTarget.style.borderColor = COLORS.border }}
      />
      <div style={{
        fontSize: '11px',
        color: COLORS.textSubtle,
        margin: '8px 0 0',
      }}>~$0,07 za regeneraci · Claude Sonnet 4.5</div>

      <div style={{
        display: 'flex',
        gap: '8px',
        justifyContent: 'flex-end',
        marginTop: '20px',
      }}>
        <button onClick={onCancel} style={btnSecondary}>Zrušit</button>
        <button
          onClick={() => onSubmit(text.trim())}
          disabled={text.trim().length < 3}
          style={{ ...btnPrimary, opacity: text.trim().length < 3 ? 0.5 : 1 }}
        >Vygenerovat</button>
      </div>
    </Modal>
  )
}

function ConfirmModal({
  title,
  body,
  confirmLabel,
  confirmKind,
  onCancel,
  onConfirm,
}: {
  title: string
  body: React.ReactNode
  confirmLabel: string
  confirmKind: 'primary' | 'danger'
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Modal onClose={onCancel}>
      <h2 style={{
        fontSize: '17px',
        fontWeight: 600,
        color: COLORS.text,
        margin: '0 0 8px',
        letterSpacing: '-0.01em',
      }}>{title}</h2>
      <div style={{
        fontSize: '13px',
        color: COLORS.textMuted,
        margin: '0 0 20px',
        lineHeight: 1.55,
      }}>{body}</div>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={btnSecondary}>Zrušit</button>
        <button
          autoFocus
          onClick={onConfirm}
          style={confirmKind === 'danger' ? btnDangerSolid : btnPrimary}
        >{confirmLabel}</button>
      </div>
    </Modal>
  )
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.32)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: '20px',
      }}
    >
      <div style={{
        background: '#FFFFFF',
        borderRadius: '10px',
        padding: '24px',
        width: '100%',
        maxWidth: '440px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.18)',
      }}>{children}</div>
    </div>
  )
}

function LoadingOverlay({ label }: { label: string }) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(255,255,255,0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: '14px',
      zIndex: 200,
      pointerEvents: 'all',
    }}>
      <div style={{
        width: '32px',
        height: '32px',
        border: `3px solid ${COLORS.border}`,
        borderTopColor: COLORS.olive,
        borderRadius: '50%',
        animation: 'admin-spin 0.8s linear infinite',
      }} />
      <div style={{ fontSize: '13px', color: COLORS.textMuted }}>{label}</div>
      <style>{`@keyframes admin-spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function Toast({ msg, kind, onDismiss }: { msg: string; kind: 'ok' | 'err'; onDismiss: () => void }) {
  return (
    <div
      onClick={onDismiss}
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: kind === 'ok' ? '#18181B' : COLORS.danger,
        color: '#FFFFFF',
        padding: '10px 18px',
        borderRadius: '8px',
        fontSize: '13px',
        boxShadow: '0 6px 20px rgba(0,0,0,0.2)',
        zIndex: 300,
        cursor: 'pointer',
        maxWidth: '480px',
      }}
    >{msg}</div>
  )
}

// ─────── Styles ───────

const btnBase: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 500,
  padding: '6px 12px',
  borderRadius: '6px',
  border: '1px solid',
  cursor: 'pointer',
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  lineHeight: 1.4,
  transition: 'background 0.12s, border-color 0.12s',
}

const btnPrimary: React.CSSProperties = {
  ...btnBase,
  background: COLORS.olive,
  borderColor: COLORS.olive,
  color: '#FFFFFF',
}

const btnSecondary: React.CSSProperties = {
  ...btnBase,
  background: '#FFFFFF',
  borderColor: COLORS.border,
  color: COLORS.text,
}

const btnDanger: React.CSSProperties = {
  ...btnBase,
  background: '#FFFFFF',
  borderColor: COLORS.border,
  color: COLORS.danger,
}

const btnDangerSolid: React.CSSProperties = {
  ...btnBase,
  background: COLORS.danger,
  borderColor: COLORS.danger,
  color: '#FFFFFF',
}

const codeStyle: React.CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: '12px',
  padding: '1px 5px',
  background: COLORS.surfaceAlt,
  borderRadius: '3px',
  color: COLORS.text,
}
