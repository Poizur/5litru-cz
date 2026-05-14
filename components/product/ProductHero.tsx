import Image from 'next/image'
import type { ProductRow } from '@/lib/content'
import { computeBadges, BadgeList } from './BadgeSystem'
import { RatingDisplay } from './RatingDisplay'

interface ProductHeroProps {
  product: Pick<
    ProductRow,
    'name' | 'brand' | 'origin_region' | 'origin_country' | 'variety'
    | 'volume_ml' | 'acidity_pct' | 'packaging' | 'rating' | 'hero_image'
  >
  /** Verdict text (1–2 sentence summary). Often pulled from review_frontmatter.description. */
  verdict?: string
  /** Number of customer reviews, e.g. 176. */
  reviewCount?: number
}

/**
 * Replaces the legacy `<section class="review-hero">` markup with a Tailwind
 * version. Used by NEW review content (admin-published from Phase 6/7).
 * Migrated WP reviews still render their original hero via legacy.css.
 */
export function ProductHero({ product, verdict, reviewCount }: ProductHeroProps) {
  const badges = computeBadges(product)

  return (
    <section className="relative overflow-hidden bg-[color:var(--color-dark)] px-5 py-16 md:px-10 md:py-24">
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 70% at 70% 50%, rgba(61,82,32,0.35) 0%, transparent 70%)',
        }}
      />
      <div className="relative z-10 mx-auto grid max-w-[1100px] items-start gap-12 md:grid-cols-[1fr_280px]">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[color:var(--color-gold)]">
            {[product.origin_region, product.variety].filter(Boolean).join(' · ')}
          </p>
          <h1 className="mt-4 font-serif text-[clamp(42px,6vw,72px)] font-bold leading-[1.05] text-white">
            {product.name}
          </h1>
          {product.brand && (
            <p className="mt-3 text-base text-[rgba(255,255,255,0.6)]">
              {product.brand} ·{' '}
              {product.packaging === 'plech' ? 'Plech' : product.packaging ?? ''}{' '}
              {product.volume_ml ? `${product.volume_ml / 1000} litrů` : ''}
            </p>
          )}

          {badges.length > 0 && (
            <div className="mt-8">
              <BadgeList badges={badges} dark />
            </div>
          )}

          {typeof product.rating === 'number' && (verdict || reviewCount) && (
            <div className="mt-10 grid items-center gap-6 md:grid-cols-[auto_1fr]">
              <div className="flex flex-col items-center">
                <span className="font-serif text-5xl font-bold text-[color:var(--color-gold-light)]">
                  {product.rating.toFixed(1)}
                </span>
                {typeof reviewCount === 'number' && (
                  <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.15em] text-[rgba(255,255,255,0.3)]">
                    {reviewCount} recenzí
                  </span>
                )}
              </div>
              {verdict && (
                <p className="text-base leading-relaxed text-[rgba(255,255,255,0.7)]">
                  {verdict}
                </p>
              )}
            </div>
          )}

          {typeof product.rating === 'number' && !verdict && !reviewCount && (
            <div className="mt-8">
              <RatingDisplay value={product.rating} dark size="lg" />
            </div>
          )}
        </div>

        {product.hero_image && (
          <div className="relative aspect-[3/4] w-full max-w-[280px] justify-self-center md:justify-self-end">
            <Image
              src={product.hero_image}
              alt={product.name}
              fill
              sizes="(min-width: 768px) 280px, 220px"
              className="object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
              priority
            />
          </div>
        )}
      </div>
    </section>
  )
}
