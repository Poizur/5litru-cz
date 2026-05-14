// MDX components registered for compileMDX(). Custom block components live here.
// Author-facing usage in MDX:
//   <Callout type="tip">…</Callout>
//   <FAQ items={[{question, answer}, …]} />

import type { MDXComponents } from 'mdx/types'
import { Callout } from '@/components/content/CalloutBox'
import { FAQ } from '@/components/content/FAQ'

export const mdxComponents: MDXComponents = {
  Callout,
  FAQ,
  // Product components added in sub-phase 4D.
}
