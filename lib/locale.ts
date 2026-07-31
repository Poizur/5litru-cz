import type { Market } from './market'

// All user-visible strings that differ between 5litru.cz (CZ) and 5litrov.sk (SK).
// Import getLocale(market) and use the returned object wherever market-aware UI is rendered.

const CZ_STRINGS = {
  buy: 'Koupit →',
  buyAt: 'Koupit na reckonasbavi.cz →',
  soldOut: 'Momentálně vyprodáno',
  fullReview: 'Celá recenze →',
  footerDisclaimer:
    'Tento web používá affiliate odkazy. Pokud zakoupíte produkt přes odkaz na 5litru.cz, může web obdržet provizi bez jakýchkoli dalších nákladů pro vás.',
  footerAboutText: 'Více o nás',
  footerAboutHref: '/o-webu/',
  siteTitle: '5litru.cz — olivový olej v 5L balení',
  siteDescription:
    'Niche srovnávač olivových olejů v 5litrovém balení. Recenze řeckých olejů, průvodce výběrem, aktuální ceny.',
  siteName: '5litru.cz',
  lang: 'cs',
  locale: 'cs_CZ',
  breadcrumbReviews: 'Recenze',
  breadcrumbGuides: 'Průvodci',
  breadcrumbComparison: 'Srovnání',
  tableHeadProduct: 'Produkt',
  tableHeadRegion: 'Region',
  tableHeadAcidity: 'Acidita',
  tableHeadPrice: 'Cena',
  tableHeadPerLiter: 'Kč/litr',
  priceLabel: 'Cena 5l',
  perLabel: 'Cena/litr',
  formatPrice: (czk: number) => `${Math.round(czk).toLocaleString('cs-CZ')} Kč`,
  formatPerLiter: (czk: number) => `${Math.round(czk)} Kč/l`,
  formatPerLiterWithSize: (czk: number) => `${Math.round(czk)} Kč/l · plech 5l`,
}

const SK_STRINGS = {
  buy: 'Kúpiť →',
  buyAt: 'Kúpiť na reckonasbavi.cz →',
  soldOut: 'Momentálne vypredané',
  fullReview: 'Celá recenzia →',
  footerDisclaimer:
    'Táto stránka používa affiliate odkazy. Ak zakúpite produkt cez odkaz na 5litrov.sk, web môže získať províziu bez akýchkoľvek dodatočných nákladov pre vás.',
  footerAboutText: 'Viac o nás',
  footerAboutHref: '/o-webu/',
  siteTitle: '5litrov.sk — olivový olej v 5L balení',
  siteDescription:
    'Porovnávač olivových olejov v 5-litrovom balení. Recenzie gréckych olejov, sprievodca výberom, aktuálne ceny.',
  siteName: '5litrov.sk',
  lang: 'sk',
  locale: 'sk_SK',
  breadcrumbReviews: 'Recenzie',
  breadcrumbGuides: 'Sprievodcovia',
  breadcrumbComparison: 'Porovnanie',
  tableHeadProduct: 'Produkt',
  tableHeadRegion: 'Región',
  tableHeadAcidity: 'Acidita',
  tableHeadPrice: 'Cena',
  tableHeadPerLiter: '€/liter',
  priceLabel: 'Cena 5l',
  perLabel: 'Cena/liter',
  formatPrice: (eur: number) => `${eur.toFixed(2).replace('.', ',')} €`,
  formatPerLiter: (eur: number) => `${eur.toFixed(2).replace('.', ',')} €/l`,
  formatPerLiterWithSize: (eur: number) => `${eur.toFixed(2).replace('.', ',')} €/l · plech 5l`,
}

export type LocaleStrings = typeof CZ_STRINGS

export function getLocale(market: Market): LocaleStrings {
  return market === 'SK' ? (SK_STRINGS as LocaleStrings) : CZ_STRINGS
}
