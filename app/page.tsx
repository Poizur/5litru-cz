export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-serif text-4xl font-bold">5litru.cz</h1>
      <p className="mt-4 text-neutral-600">
        Skeleton připravený. Skutečná homepage přijde ve Fázi 4 (Public site components).
      </p>
      <ul className="mt-8 list-disc pl-6 text-sm text-neutral-500">
        <li>Fáze 2 ✓ — Next.js + Supabase skeleton, DB schema, env šablona</li>
        <li>Fáze 3 — WordPress HTML → MDX (18 guides) + DB seed pro 10 recenzí + 32 obrázků</li>
        <li>Fáze 4 — Brand-perfect komponenty, [slug]/page.tsx routing</li>
        <li>Fáze 5 — SEO metadata + Schema.org JSON-LD</li>
        <li>Fáze 6 — Admin panel (4 záložky, magic link auth)</li>
        <li>Fáze 7 — AI review pipeline (Claude Sonnet)</li>
        <li>Fáze 8 — Railway deploy</li>
      </ul>
    </main>
  )
}
