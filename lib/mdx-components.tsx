// MDX components registered for compileMDX(). Custom block components live here.
// Author-facing usage in MDX:
//   <Callout type="tip">…</Callout>
//   <FAQ items={[{question, answer}, …]} />

import type { MDXComponents } from 'mdx/types'
import { Callout } from '@/components/content/CalloutBox'
import { FAQ } from '@/components/content/FAQ'
import { RatingBars } from '@/components/product/RatingBars'
import { RatingDisplay } from '@/components/product/RatingDisplay'
import { ProductCard } from '@/components/product/ProductCard'
import { ProductHero } from '@/components/product/ProductHero'

export const mdxComponents: MDXComponents = {
  Callout,
  FAQ,
  RatingBars,
  RatingDisplay,
  ProductCard,
  ProductHero,
}
