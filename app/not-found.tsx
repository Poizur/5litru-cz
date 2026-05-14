import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-24 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-[color:var(--color-gold)]">
        404
      </p>
      <h1 className="mt-4 font-serif text-5xl font-semibold text-[color:var(--color-text)]">
        Stránka nenalezena
      </h1>
      <p className="mt-6 text-base text-[color:var(--color-muted)]">
        Hledaná stránka neexistuje nebo byla přesunuta. Zkuste se vrátit na
        hlavní stranu nebo na srovnání olejů.
      </p>
      <div className="mt-10 flex justify-center gap-4">
        <Link
          href="/"
          className="inline-flex items-center rounded-[2px] bg-[color:var(--color-gold)] px-7 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--color-dark)] transition-colors hover:bg-[color:var(--color-gold-light)]"
        >
          Na hlavní stranu
        </Link>
        <Link
          href="/nejlepsi-olivovy-olej-5l/"
          className="inline-flex items-center rounded-[2px] border border-[color:var(--color-border)] px-6 py-3 text-xs font-medium uppercase tracking-[0.08em] text-[color:var(--color-text)] transition-colors hover:border-[color:var(--color-olive)]"
        >
          Srovnat oleje
        </Link>
      </div>
    </main>
  )
}
