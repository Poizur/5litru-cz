import Link from 'next/link'
import { redirect } from 'next/navigation'
import { isAdminAuthenticated } from '@/lib/admin-auth'

// Defense-in-depth: middleware also gates /admin/*, but this server-rendered
// check covers any edge case where the middleware matcher missed.
export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdminAuthenticated())) redirect('/admin/login')

  return (
    <div className="min-h-screen bg-[color:var(--color-cream)]">
      <header className="border-b border-[color:var(--color-border)] bg-[color:var(--color-dark)] px-5 md:px-10">
        <div className="mx-auto flex h-14 max-w-[1100px] items-center justify-between gap-4">
          <Link href="/admin/" className="flex items-baseline gap-3">
            <span className="font-serif text-lg text-[color:var(--color-gold-light)]">5litru<span className="font-normal opacity-50">.cz</span></span>
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-[color:var(--color-gold)]">admin</span>
          </Link>
          <nav className="hidden gap-6 md:flex">
            <AdminLink href="/admin/catalog/">Katalog</AdminLink>
            <AdminLink href="/admin/add/">Přidat z URL</AdminLink>
            <AdminLink href="/admin/retailers/">Retailers</AdminLink>
          </nav>
          <form method="POST" action="/api/admin/logout">
            <button
              type="submit"
              className="text-xs font-medium uppercase tracking-wider text-white/55 transition-colors hover:text-[color:var(--color-gold-light)]"
            >
              Odhlásit
            </button>
          </form>
        </div>
        <nav className="flex gap-5 overflow-x-auto pb-3 pt-1 md:hidden">
          <AdminLink href="/admin/catalog/">Katalog</AdminLink>
          <AdminLink href="/admin/add/">Přidat</AdminLink>
          <AdminLink href="/admin/retailers/">Retailers</AdminLink>
        </nav>
      </header>
      <main className="mx-auto max-w-[1100px] px-5 py-8 md:px-10 md:py-12">{children}</main>
    </div>
  )
}

function AdminLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-sm font-medium tracking-wider text-white/60 transition-colors hover:text-[color:var(--color-gold-light)]"
    >
      {children}
    </Link>
  )
}
