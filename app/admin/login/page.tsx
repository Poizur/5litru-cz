import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { isAdminAuthenticated } from '@/lib/admin-auth'

export const metadata: Metadata = {
  title: 'Admin · přihlášení',
  robots: { index: false, follow: false },
}

interface PageProps {
  searchParams: Promise<{ redirect?: string; error?: string; locked?: string }>
}

export default async function LoginPage({ searchParams }: PageProps) {
  if (await isAdminAuthenticated()) redirect('/admin/')
  const sp = await searchParams

  const errorMsg =
    sp.locked
      ? `Příliš mnoho neúspěšných pokusů. Zkus to znovu za ${sp.locked} minut.`
      : sp.error === 'invalid'
        ? 'Špatné heslo.'
        : null

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-dark)', padding: '0 20px' }}>
      <div style={{ width: '100%', maxWidth: '384px', borderRadius: '4px', border: '1px solid rgba(196,151,62,0.15)', background: 'rgba(255,255,255,0.04)', padding: '32px' }}>
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[color:var(--color-gold)]">
          Admin
        </p>
        <h1 className="mt-2 font-serif text-3xl font-bold text-white">
          5litru<span className="font-normal text-white/40">.cz</span>
        </h1>
        <p className="mt-4 text-sm text-white/60">
          Vstup do administračního rozhraní. Zadej admin heslo.
        </p>

        <form method="POST" action="/api/admin/login" className="mt-8 space-y-4">
          <input type="hidden" name="redirect" value={sp.redirect ?? '/admin/'} />
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            autoFocus
            placeholder="Heslo"
            className="w-full rounded-[2px] border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)] px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-[color:var(--color-gold)]"
          />
          {errorMsg && (
            <p role="alert" className="text-sm text-[#f87171]">
              {errorMsg}
            </p>
          )}
          <button
            type="submit"
            className="w-full rounded-[2px] bg-[color:var(--color-gold)] px-6 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--color-dark)] transition-colors hover:bg-[color:var(--color-gold-light)]"
          >
            Přihlásit
          </button>
        </form>
      </div>
    </div>
  )
}
