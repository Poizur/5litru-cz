// Debug: call Claude with the review prompt and print raw output to diagnose JSON parse issues.
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { load as cheerioLoad } from 'cheerio'

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  // Fetch top suggestion
  const { data: sug } = await sb
    .from('olivator_suggestions')
    .select('*')
    .eq('olivator_product_id', '02337eb2-1b87-49d9-94ad-bd01d122d0be')
    .single()
  if (!sug) throw new Error('suggestion not found')

  // Quick eshop scrape
  let desc = ''
  try {
    const res = await fetch(sug.primary_offer_url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' },
      signal: AbortSignal.timeout(10_000)
    })
    const html = await res.text()
    const $ = cheerioLoad(html)
    desc = $('h1').first().text().trim()
    const descEl = $('.product-detail__description, .description-detail').first().text().trim()
    if (descEl.length > 50) desc += '\n' + descEl.slice(0, 600)
  } catch (e) { console.warn('eshop scrape failed:', (e as Error).message) }

  // Minimal prompt to test JSON output
  const prompt = `Napiš stručnou testovací recenzi olivového oleje pro 5litru.cz.

PRODUKT: CORINTO Peloponés BIO Extra panenský olivový olej (MANAKI) 0,4% 5l
Značka: corinto | Region: Peloponés | Odrůda: Manaki | Acidita: 0,42 % | BIO: Ano | Cena: 1990 Kč
Olivator skóre: 68/100

Eshop info: ${desc.slice(0, 400) || '(nepodařilo se načíst)'}

Vrať POUZE JSON v code blocku (\`\`\`json ... \`\`\`):
{
  "title": "SEO title (max 70 znaků)",
  "description": "meta description (150-160 znaků)",
  "schema_review_body": "2 věty bez HTML",
  "schema_rating": 4.2,
  "intro_heading": "H2 nadpis",
  "intro": "<p>Odstavec 1</p><p>Odstavec 2</p>",
  "pros": ["výhoda 1", "výhoda 2", "výhoda 3"],
  "cons": ["nevýhoda 1", "nevýhoda 2"],
  "specs_note": "1 věta o parametrech",
  "sensory_heading": "H2 pro senzoriku",
  "sensory": "<p>Chuť odstavec</p><p>Vůně odstavec</p>",
  "comparison": "<p>Porovnání s jinými oleji</p>",
  "conclusion": "<p>Závěr odstavec 1</p><p>Závěr odstavec 2</p>",
  "faq": [{"q": "Otázka 1?", "a": "Odpověď 1"}, {"q": "Otázka 2?", "a": "Odpověď 2"}]
}`

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  console.log('Calling Claude claude-sonnet-4-5...\n')

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4000,
    system: 'Jsi copywriter pro 5litru.cz. Vrátis POUZE JSON v code blocku.',
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = message.content.map(b => b.type === 'text' ? b.text : '').join('')
  console.log('=== RAW OUTPUT (first 3000 chars) ===')
  console.log(raw.slice(0, 3000))
  console.log('\n=== USAGE ===')
  console.log(`input: ${message.usage.input_tokens} | output: ${message.usage.output_tokens}`)

  // Try parsing
  const match = raw.match(/```json\s*([\s\S]*?)\s*```/)
  if (match) {
    try {
      const parsed = JSON.parse(match[1])
      console.log('\n=== PARSED OK ===')
      console.log('title:', parsed.title)
      console.log('faq count:', parsed.faq?.length)
    } catch (e) {
      console.error('\n=== PARSE FAILED ===', (e as Error).message)
      console.log('Extracted JSON:\n', match[1].slice(0, 500))
    }
  } else {
    console.error('\n=== NO JSON BLOCK FOUND ===')
  }
}

main().catch(e => { console.error(e); process.exit(1) })
