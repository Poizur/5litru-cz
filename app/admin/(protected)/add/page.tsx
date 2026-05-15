export const dynamic = 'force-dynamic'

export default function AddPage() {
  return (
    <>
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[color:var(--color-gold)]">
          Přidat z URL
        </p>
        <h1 className="mt-1 font-serif text-3xl font-bold text-[color:var(--color-text)] md:text-4xl">
          Import nového oleje
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-[color:var(--color-muted)]">
          Vlož URL produktu na retailer webu (např. shop.reckonasbavi.cz).
          Backend stáhne stránku, vytáhne OG metadata / JSON-LD Product
          schema, vytvoří draft v <code className="rounded bg-[color:var(--color-olive-pale)] px-1.5 py-0.5 font-mono text-xs">products</code>{' '}
          a spustí AI generování recenze přes Claude.
        </p>
      </div>

      <form method="POST" action="/api/admin/add-from-url" className="mt-10 max-w-2xl">
        <label htmlFor="url" className="block font-mono text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">
          Retailer product URL
        </label>
        <input
          id="url"
          name="url"
          type="url"
          required
          placeholder="https://shop.reckonasbavi.cz/..."
          className="mt-2 w-full rounded-[2px] border border-[color:var(--color-border)] bg-white px-4 py-3 text-sm outline-none focus:border-[color:var(--color-olive)]"
        />
        <button
          type="submit"
          disabled
          className="mt-4 cursor-not-allowed rounded-[2px] bg-[color:var(--color-olive)] px-6 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-white opacity-60"
        >
          Naskenovat + vytvořit draft → Fáze 7
        </button>
        <p className="mt-3 text-xs text-[color:var(--color-muted)]">
          Funkčnost se aktivuje až s AI review pipeline ve Fázi 7. Backend
          endpoint{' '}
          <code className="rounded bg-[color:var(--color-olive-pale)] px-1.5 py-0.5 font-mono">
            /api/admin/add-from-url
          </code>{' '}
          zatím není implementován.
        </p>
      </form>
    </>
  )
}
