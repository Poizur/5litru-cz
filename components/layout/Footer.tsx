import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t border-[rgba(255,255,255,0.04)] bg-[color:var(--color-dark-2)] px-5 py-14 text-[rgba(255,255,255,0.5)] md:px-10">
      <div className="mx-auto grid max-w-[1100px] gap-10 md:grid-cols-3">
        <div>
          <Link
            href="/"
            className="font-serif text-2xl font-bold text-[color:var(--color-gold-light)]"
          >
            5litru<span className="font-normal opacity-50">.cz</span>
          </Link>
          <p className="mt-3 max-w-[280px] text-sm leading-relaxed">
            Niche srovnávač olivových olejů v 5litrovém balení. Recenze řeckých
            olejů, průvodci a aktuální ceny.
          </p>
        </div>

        <div>
          <h2 className="font-mono text-[10px] uppercase tracking-[0.25em] text-[color:var(--color-gold)]">
            Navigace
          </h2>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link href="/nejlepsi-olivovy-olej-5l/" className="hover:text-[color:var(--color-gold-light)] transition-colors">
                Srovnání 10 olejů
              </Link>
            </li>
            <li>
              <Link href="/recky-olivovy-olej-5l/" className="hover:text-[color:var(--color-gold-light)] transition-colors">
                Řecké oleje 5l
              </Link>
            </li>
            <li>
              <Link href="/acidita-olivoveho-oleje/" className="hover:text-[color:var(--color-gold-light)] transition-colors">
                Průvodce kvalitou
              </Link>
            </li>
            <li>
              <Link href="/o-webu/" className="hover:text-[color:var(--color-gold-light)] transition-colors">
                O webu
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="font-mono text-[10px] uppercase tracking-[0.25em] text-[color:var(--color-gold)]">
            Top recenze
          </h2>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link href="/motakis-recenze/" className="hover:text-[color:var(--color-gold-light)] transition-colors">
                Motakis Kréta 5l
              </Link>
            </li>
            <li>
              <Link href="/sitia-premium-gold-recenze/" className="hover:text-[color:var(--color-gold-light)] transition-colors">
                SITIA Gold 0,2 % 5l
              </Link>
            </li>
            <li>
              <Link href="/orino-sitia-recenze/" className="hover:text-[color:var(--color-gold-light)] transition-colors">
                Orino Sitia P.D.O. 5l
              </Link>
            </li>
            <li>
              <Link href="/neotis-manaki-recenze/" className="hover:text-[color:var(--color-gold-light)] transition-colors">
                Neotis Manaki 5l
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-12 flex max-w-[1100px] flex-col gap-2 border-t border-[rgba(255,255,255,0.06)] pt-6 text-[11px] text-[rgba(255,255,255,0.35)] sm:flex-row sm:justify-between">
        <p>© {new Date().getFullYear()} 5litru.cz</p>
        <p>
          Web obsahuje affiliate odkazy. Při nákupu přes naše odkazy získáme
          provizi bez navýšení ceny pro vás.
        </p>
      </div>
    </footer>
  )
}
