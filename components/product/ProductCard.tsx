import Link from 'next/link'
import Image from 'next/image'
import type { ProductRow } from '@/lib/content'
import { computeBadges, BadgeList } from './BadgeSystem'
import { RatingDisplay } from './RatingDisplay'

interface ProductCardProps {
  product: Pick<
    ProductRow,
    'slug' | 'review_slug' | 'name' | 'brand' | 'origin_region' | 'origin_country'
    | 'volume_ml' | 'acidity_pct' | 'packaging' | 'price_czk' | 'rating' | 'hero_image'
  >
  /** Visual emphasis — first card in a Top 3 row gets featured styling. */
  featured?: boolean
}

export function ProductCard({ product, featured }: ProductCardProps) {
  const badges = computeBadges(product)
  const href = product.review_slug ? `/${product.review_slug}/` : `/${product.slug}/`

  return (
    <article
      className={`group relative flex flex-col overflow-hidden rounded-[2px] border bg-white transition-all hover:border-[color:var(--color-olive)] ${
        featured
          ? 'border-[rgba(196,151,62,0.4)] shadow-[0_8px_24px_rgba(20,26,13,0.06)]'
          : 'border-[color:var(--color-border)]'
      }`}
    >
      <Link href={href} className="flex flex-1 flex-col">
        <div className="relative aspect-[4/3] overflow-hidden bg-[color:var(--color-olive-pale)]">
          {product.hero_image ? (
            <Image
              src={product.hero_image}
              alt={product.name}
              fill
              sizes="(min-width: 768px) 33vw, 100vw"
              className="object-contain p-6 transition-transform group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-5xl opacity-30">🫙</div>
          )}
          {featured && (
            <span className="absolute left-3 top-3 rounded-[2px] bg-[color:var(--color-gold)] px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-[color:var(--color-dark)]">
              Redakční výběr
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-3 p-5">
          <div>
            {product.brand && (
              <p className="font-mono text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">
                {product.brand}
              </p>
            )}
            <h3 className="mt-1 font-serif text-xl font-semibold text-[color:var(--color-text)]">
              {product.name}
            </h3>
            {product.origin_region && (
              <p className="mt-1 text-sm text-[color:var(--color-muted)]">
                {product.origin_country === 'Řecko' ? '🏔️ ' : ''}{product.origin_region}
              </p>
            )}
          </div>

          {typeof product.rating === 'number' && (
            <RatingDisplay value={product.rating} size="sm" />
          )}

          <div className="mt-auto flex items-end justify-between gap-3">
            {typeof product.price_czk === 'number' && (
              <div>
                <p className="font-serif text-2xl font-semibold text-[color:var(--color-text)]">
                  {Math.round(product.price_czk).toLocaleString('cs-CZ')} Kč
                </p>
                {product.volume_ml && (
                  <p className="font-mono text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">
                    {(product.price_czk / (product.volume_ml / 1000)).toFixed(0)} Kč / l
                  </p>
                )}
              </div>
            )}
            <span className="rounded-[2px] bg-[color:var(--color-olive)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-white transition-colors group-hover:bg-[color:var(--color-olive-2)]">
              Recenze →
            </span>
          </div>

          {badges.length > 0 && <BadgeList badges={badges.slice(0, 3)} />}
        </div>
      </Link>
    </article>
  )
}
