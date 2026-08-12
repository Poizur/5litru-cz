/**
 * Output language validator — UZÁVĚRA-4.
 * Volej na výstupu každého generátoru před uložením do DB.
 */

const CYRILLIC_RE = /[Ѐ-ӿ]/
const EN_STOPWORDS = /\b(the|and|of|for|with|that|this|from|are|was|been|have|will|they|their|there|which|about|would|could|should|also|more|some|than|then|when|into|over|after|such|most|other)\b/gi
const CS_MARKERS = /\b(olivový|olej|kyselost|polyfenoly|extra|panenský|cena|litr|sklizeň|kvalita|doporučujeme|nejlepší|srovnání|hodnocení)\b/gi
const SK_MARKERS = /\b(olivový|olej|kyslost|polyfenoly|extra|panenský|cena|liter|zber|kvalita|odporúčame|najlepší|porovnanie|hodnotenie)\b/gi

export interface LanguageValidationResult {
  ok: boolean
  issues: string[]
}

export function validateOutputLanguage(text: string, target: 'cs' | 'sk'): LanguageValidationResult {
  const issues: string[] = []
  if (CYRILLIC_RE.test(text)) issues.push('Cyrilice detekována')
  const enCount = (text.match(EN_STOPWORDS) ?? []).length
  if (enCount > 8) issues.push(`${enCount} anglických stopwords — možná EN výstup místo ${target.toUpperCase()}`)
  const markerCount = (text.match(target === 'cs' ? CS_MARKERS : SK_MARKERS) ?? []).length
  if (markerCount < 3 && text.length > 200) issues.push(`Málo ${target.toUpperCase()} markerů (${markerCount})`)
  return { ok: issues.length === 0, issues }
}

export function logLanguageValidation(text: string, target: 'cs' | 'sk', context: string): void {
  const r = validateOutputLanguage(text, target)
  if (!r.ok) console.warn(`[validate-language] ⚠ ${context}: ${r.issues.join('; ')}`)
}
