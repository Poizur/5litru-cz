// Zjevní boti jdou z /go/ rovnou do obchodu bez eHUBu (click fraud) a ukládají se jako is_test.
// Stejná pravidla jako Olivátor (lib/go-target.ts).

const BOT_WORDS = /bot|crawler|spider|jscrawler|meta-webindexer|semrush|ahref/i
const HEADLESS = /headless|phantomjs|puppeteer|playwright|selenium|python-requests|python-urllib|aiohttp|go-http-client|axios|node-fetch|undici|okhttp|java\/|libwww|wget|httpclient|scrapy/i
const MAX_OUTDATED_IOS = 14
const MIN_CURRENT_CHROME = 120
const MAX_SUSPICIOUS_CHROME_WITHOUT_ORIGIN = 142

export function botReason(userAgent: string, hasOrigin: boolean): string | null {
  const ua = userAgent.trim()
  if (!ua || ua === 'node' || ua.startsWith('curl/')) return 'bez prohlížeče'
  if (BOT_WORDS.test(ua)) return 'bot v user-agentu'
  if (HEADLESS.test(ua)) return 'headless / knihovna'
  const ios = ua.match(/(?:iPhone|CPU) OS (\d+)_/)
  if (ios && Number(ios[1]) <= MAX_OUTDATED_IOS) return `zastaralý iOS ${ios[1]}`
  const chrome = ua.match(/(?:Chrome|CriOS)\/(\d+)/)
  if (chrome) {
    const v = Number(chrome[1])
    if (v < MIN_CURRENT_CHROME) return `zastaralý Chrome ${v}`
    if (v <= MAX_SUSPICIOUS_CHROME_WITHOUT_ORIGIN && !hasOrigin) return `Chrome ${v} bez původu`
  }
  return null
}
