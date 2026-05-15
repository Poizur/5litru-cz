// AI-powered review draft generation for 5litru.cz.
//
// Pipeline:
//   1. Load suggestion + style samples from DB
//   2. Scrape eshop page via fetch + cheerio
//   3. Search Heureka (best-effort, 5 s delay, graceful fail)
//   4. Call Claude Sonnet to generate structured review content (JSON)
//   5. Assemble full HTML review document from template
//   6. Download hero image to public/images/products/
//   7. Insert draft product row + flip suggestion to imported
//   8. Log ai_jobs entry (cost tracking)
//   9. Send admin notification email

import Anthropic from '@anthropic-ai/sdk'
import { load as cheerioLoad } from 'cheerio'
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { supabaseAdmin } from './supabase'
import { buildAffiliateUrl } from './affiliate'
import { sendViaResend, renderAdminAlertHtml } from './email'
import type { Retailer } from './types'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface SuggestionRow {
  olivator_product_id: string
  olivator_slug: string
  name: string
  brand_slug: string | null
  origin_country: string | null
  origin_region: string | null
  variety: string | null
  type: string | null
  volume_ml: number | null
  acidity: number | null
  polyphenols: number | null
  olivator_score: number | null
  image_url: string | null
  primary_retailer_slug: string
  primary_offer_price: number | null
  primary_offer_url: string
}

interface EshopScrape {
  title: string | null
  description: string | null
  specs: Array<{ label: string; value: string }>
  reviews: Array<{ author: string; rating: number; text: string; date: string }>
  heroImageUrl: string | null
}

interface HeurekaScrape {
  averageRating: number | null
  reviewCount: number | null
  reviews: Array<{ author: string; rating: number; text: string; date: string }>
}

interface ReviewContent {
  title: string
  description: string
  schema_review_body: string
  schema_rating: number
  intro_heading: string
  intro: string
  pros: string[]
  cons: string[]
  specs_note: string
  sensory_heading: string
  sensory: string
  comparison: string
  conclusion: string
  faq: Array<{ q: string; a: string }>
}

export interface ReviewDraftResult {
  product_id: string
  job_id: string
  slug: string
  review_slug: string
  input_tokens: number
  output_tokens: number
  cost_usd: number
  warnings: string[]
}

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; reason: string }

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

// claude-sonnet-4-5 pricing: $3/MTok input, $15/MTok output
const COST_INPUT = 3 / 1_000_000
const COST_OUTPUT = 15 / 1_000_000
const RATE_LIMIT_PER_HOUR = 5
const DAILY_COST_WARN_USD = 1.0

const COUNTRY_NAMES: Record<string, string> = {
  GR: 'Řecko', IT: 'Itálie', ES: 'Španělsko', PT: 'Portugalsko',
  HR: 'Chorvatsko', TR: 'Turecko', TN: 'Tunisko', MA: 'Maroko', CY: 'Kypr',
}

// Complete 5litru review page CSS — mirrors the migrated WP reviews
const REVIEW_CSS = `:root{--olive:#3d5220;--olive2:#5a7830;--olive-pale:#eef3e4;--gold:#c4973e;--gold-light:#e8c97a;--dark:#141a0d;--dark2:#1e2913;--cream:#f8f6f0;--text:#2a3318;--muted:#7a8a65;--border:rgba(61,82,32,0.1);}
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box;}
html{scroll-behavior:smooth;}
body{font-family:'Jost',sans-serif;font-size:18px;background:var(--cream);color:var(--text);overflow-x:hidden;}
nav{position:fixed;top:0;left:0;right:0;z-index:999999;height:60px;padding:0 40px;display:flex;align-items:center;justify-content:space-between;background:rgba(20,26,13,0.98);border-bottom:1px solid rgba(196,151,62,0.12);}
.nav-logo{font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:700;color:var(--gold-light);text-decoration:none;}
.nav-logo span{color:rgba(255,255,255,0.4);font-weight:400;}
.nav-link{color:rgba(255,255,255,0.55);text-decoration:none;font-size:15px;font-weight:500;transition:color .2s;}
.nav-link:hover{color:var(--gold-light);}
.review-hero{background:var(--dark);padding:100px 40px 64px;position:relative;overflow:hidden;}
.review-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 60% 70% at 70% 50%,rgba(61,82,32,0.35) 0%,transparent 70%);pointer-events:none;}
.review-hero-inner{max-width:1100px;margin:0 auto;display:grid;grid-template-columns:1fr auto;gap:48px;align-items:start;position:relative;z-index:1;}
.hero-breadcrumb{font-family:'DM Mono',monospace;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.35);margin-bottom:20px;}
.hero-breadcrumb a{color:rgba(255,255,255,0.35);text-decoration:none;}
.hero-region{font-family:'DM Mono',monospace;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin-bottom:12px;}
.review-hero h1{font-family:'Cormorant Garamond',serif;font-size:clamp(42px,6vw,72px);font-weight:700;color:#fff;line-height:1.05;margin-bottom:8px;}
.hero-sub{font-size:16px;color:rgba(255,255,255,0.45);margin-bottom:28px;}
.hero-badges{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:32px;}
.badge{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);border-radius:2px;font-size:13px;color:rgba(255,255,255,0.7);}
.badge-gold{background:rgba(196,151,62,0.15);border-color:rgba(196,151,62,0.3);color:var(--gold-light);}
.badge-warn{background:rgba(180,120,30,0.15);border-color:rgba(180,120,30,0.3);color:#e8c060;}
.hero-verdict{display:flex;gap:20px;align-items:center;padding:20px 24px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:4px;}
.verdict-score{font-family:'Cormorant Garamond',serif;font-size:52px;font-weight:700;color:var(--gold-light);line-height:1;flex-shrink:0;}
.verdict-label{font-size:11px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;}
.verdict-text{font-size:15px;color:rgba(255,255,255,0.6);line-height:1.6;}
.hero-product-img{width:260px;flex-shrink:0;display:flex;align-items:center;justify-content:center;}
.hero-product-img img{max-width:100%;max-height:340px;object-fit:contain;filter:drop-shadow(0 20px 40px rgba(0,0,0,0.4));}
.buy-bar{background:var(--dark2);border-bottom:1px solid rgba(255,255,255,0.04);padding:20px 40px;position:sticky;top:60px;z-index:100;}
.buy-bar-inner{max-width:1100px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:20px;}
.buy-bar-name{font-size:16px;font-weight:600;color:rgba(255,255,255,0.8);}
.buy-bar-price{font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:700;color:#fff;}
.buy-bar-per{font-size:13px;color:rgba(255,255,255,0.35);}
.btn-buy-bar{display:inline-flex;align-items:center;gap:8px;padding:12px 28px;background:var(--gold);color:var(--dark);text-decoration:none;font-size:13px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;border-radius:2px;transition:all .2s;white-space:nowrap;}
.btn-buy-bar:hover{background:var(--gold-light);}
.review-content{max-width:1100px;margin:0 auto;padding:64px 40px;}
.content-grid{display:grid;grid-template-columns:1fr 320px;gap:48px;align-items:start;}
.section-label{display:flex;align-items:center;gap:10px;margin-bottom:12px;}
.section-label-line{width:20px;height:1px;background:var(--gold);}
.section-label-text{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:var(--gold);}
.content-h2{font-family:'Cormorant Garamond',serif;font-size:34px;font-weight:700;color:var(--dark);margin-bottom:20px;line-height:1.1;}
.content-h3{font-family:'Cormorant Garamond',serif;font-size:24px;font-weight:700;color:var(--dark);margin-bottom:12px;margin-top:32px;line-height:1.1;}
.content-p{font-size:17px;line-height:1.85;color:var(--text);margin-bottom:20px;}
.content-section{margin-bottom:52px;}
.pros-cons{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:24px 0;}
.pros{background:#f0f7ea;border:1px solid rgba(61,82,32,0.12);padding:20px 24px;border-radius:4px;}
.cons{background:#fdf6ef;border:1px solid rgba(196,120,40,0.12);padding:20px 24px;border-radius:4px;}
.pros-cons-title{font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin-bottom:14px;}
.pros .pros-cons-title{color:var(--olive);}
.cons .pros-cons-title{color:#8a5a20;}
.pros-cons-list{list-style:none;display:flex;flex-direction:column;gap:9px;}
.pros-cons-list li{display:flex;gap:10px;font-size:15px;color:var(--text);line-height:1.5;}
.pros .pros-cons-list li::before{content:'✓';color:var(--olive);font-weight:600;flex-shrink:0;}
.cons .pros-cons-list li::before{content:'—';color:#8a5a20;flex-shrink:0;}
.rating-item{margin-bottom:16px;}
.rating-label{display:flex;justify-content:space-between;margin-bottom:6px;font-size:15px;}
.rating-label span:first-child{color:var(--text);}
.rating-label span:last-child{font-weight:600;color:var(--olive);}
.rating-bar{height:6px;background:rgba(61,82,32,0.1);border-radius:3px;overflow:hidden;}
.rating-fill{height:100%;background:var(--olive);border-radius:3px;}
.info-box{display:flex;gap:14px;padding:18px 20px;border-radius:4px;margin:24px 0;font-size:16px;line-height:1.7;}
.info-box.tip{background:#f0f7ea;border-left:3px solid var(--olive);}
.info-box.warning{background:#fdf9ef;border-left:3px solid var(--gold);}
.info-box-icon{font-size:20px;flex-shrink:0;margin-top:2px;}
.reviews-summary{display:flex;gap:32px;align-items:center;padding:24px 28px;background:#fff;border:1px solid var(--border);border-radius:4px;margin-bottom:20px;}
.reviews-score-big{text-align:center;flex-shrink:0;}
.reviews-score-num{font-family:'Cormorant Garamond',serif;font-size:64px;font-weight:700;color:var(--dark);line-height:1;}
.reviews-score-stars{display:flex;gap:2px;justify-content:center;margin:4px 0;}
.star{color:var(--gold);font-size:18px;}
.reviews-score-count{font-size:13px;color:var(--muted);}
.reviews-bars{flex:1;}
.rbar-row{display:flex;align-items:center;gap:10px;margin-bottom:8px;}
.rbar-label{font-family:'DM Mono',monospace;font-size:11px;color:var(--muted);width:20px;text-align:right;flex-shrink:0;}
.rbar-track{flex:1;height:6px;background:rgba(61,82,32,0.1);border-radius:3px;overflow:hidden;}
.rbar-fill{height:100%;border-radius:3px;background:var(--olive);}
.rbar-count{font-size:12px;color:var(--muted);width:28px;text-align:right;flex-shrink:0;}
.reviews-source{flex-shrink:0;text-align:center;}
.reviews-source-logo{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);margin-bottom:6px;}
.reviews-source-link{display:inline-block;padding:8px 16px;border:1px solid var(--border);border-radius:2px;font-size:12px;font-weight:600;color:var(--olive);text-decoration:none;transition:all .2s;}
.reviews-source-link:hover{background:var(--olive-pale);border-color:var(--olive);}
.reviews-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:4px;}
.review-card{background:#fff;border:1px solid var(--border);border-radius:4px;padding:18px 20px;position:relative;}
.review-card-stars{display:flex;gap:2px;margin-bottom:8px;}
.review-card-text{font-size:15px;color:var(--text);line-height:1.7;margin-bottom:12px;font-style:italic;}
.review-card-meta{display:flex;justify-content:space-between;align-items:center;}
.review-card-author{font-size:12px;font-weight:600;color:var(--dark);}
.review-card-date{font-family:'DM Mono',monospace;font-size:10px;color:var(--muted);}
.review-card-badge{position:absolute;top:14px;right:14px;font-size:10px;font-family:'DM Mono',monospace;letter-spacing:1px;text-transform:uppercase;padding:2px 8px;border-radius:2px;background:rgba(61,82,32,0.08);color:var(--olive);}
.reviews-cta-link{display:inline-flex;align-items:center;gap:6px;margin-top:16px;font-size:14px;color:var(--muted);text-decoration:none;transition:color .2s;}
.reviews-cta-link:hover{color:var(--olive);}
.faq-list{margin-top:24px;}
.faq-item{border-bottom:1px solid var(--border);overflow:hidden;}
.faq-q{display:flex;justify-content:space-between;align-items:center;padding:18px 0;cursor:pointer;font-size:17px;font-weight:500;color:var(--dark);list-style:none;}
.faq-q::-webkit-details-marker{display:none;}
.faq-q::after{content:'+';font-size:22px;color:var(--gold);flex-shrink:0;font-weight:300;}
details[open] .faq-q::after{content:'−';}
.faq-a{padding:0 0 18px;font-size:16px;color:var(--text);line-height:1.8;}
.sidebar{position:sticky;top:120px;}
.sidebar-card{background:#fff;border:1px solid var(--border);border-radius:4px;overflow:hidden;margin-bottom:16px;}
.sidebar-card-img{background:var(--olive-pale);padding:32px 24px;display:flex;align-items:center;justify-content:center;min-height:200px;}
.sidebar-card-img img{max-height:200px;object-fit:contain;}
.sidebar-card-body{padding:20px 24px 24px;}
.sidebar-product-name{font-family:'Cormorant Garamond',serif;font-size:24px;font-weight:700;color:var(--dark);margin-bottom:4px;}
.sidebar-product-sub{font-size:13px;color:var(--muted);margin-bottom:16px;}
.sidebar-specs{display:flex;flex-direction:column;gap:0;margin-bottom:20px;}
.sidebar-spec{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border);font-size:14px;}
.sidebar-spec:last-child{border-bottom:none;}
.sidebar-spec-label{color:var(--muted);}
.sidebar-spec-value{font-weight:600;color:var(--dark);}
.sidebar-rating{display:flex;align-items:center;gap:10px;padding:14px 0;border-top:1px solid var(--border);margin-top:4px;}
.sidebar-rating-num{font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:700;color:var(--dark);line-height:1;}
.sidebar-rating-stars{display:flex;gap:1px;}
.sidebar-rating-stars span{color:var(--gold);font-size:13px;}
.sidebar-rating-count{font-size:12px;color:var(--muted);}
.sidebar-price{font-family:'Cormorant Garamond',serif;font-size:36px;font-weight:700;color:var(--dark);line-height:1;margin-bottom:4px;}
.sidebar-price-per{font-size:13px;color:var(--muted);margin-bottom:4px;}
.sidebar-price-note{font-size:12px;color:var(--muted);font-style:italic;margin-bottom:20px;}
.btn-buy-full{display:flex;align-items:center;justify-content:center;gap:8px;padding:14px 20px;background:var(--olive);color:#fff;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;border-radius:2px;transition:all .2s;}
.btn-buy-full:hover{background:var(--olive2);}
.sidebar-disclaimer{font-size:11px;color:var(--muted);text-align:center;margin-top:10px;line-height:1.5;}
.compare-box{background:#fff;border:1px solid var(--border);border-radius:4px;padding:20px 24px;}
.compare-box-title{font-size:13px;font-weight:600;color:var(--dark);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:16px;}
.compare-item{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);text-decoration:none;color:inherit;transition:opacity .2s;}
.compare-item:hover{opacity:0.7;}
.compare-item:last-child{border-bottom:none;}
.compare-item-name{font-size:14px;font-weight:500;color:var(--dark);}
.compare-item-price{font-size:14px;color:var(--muted);}
.compare-item-arr{font-size:12px;color:var(--olive);}
.cta-section{background:var(--olive);padding:64px 40px;text-align:center;position:relative;overflow:hidden;}
.cta-section::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 50% 80% at 50% 50%,rgba(0,0,0,0.1) 0%,transparent 70%);}
.cta-inner{max-width:600px;margin:0 auto;position:relative;}
.cta-title{font-family:'Cormorant Garamond',serif;font-size:clamp(28px,4vw,44px);font-weight:700;color:#fff;margin-bottom:12px;line-height:1.1;}
.cta-desc{font-size:16px;color:rgba(255,255,255,0.6);margin-bottom:28px;line-height:1.7;}
.btn-cta{display:inline-flex;align-items:center;gap:8px;padding:14px 36px;background:#fff;color:var(--olive);text-decoration:none;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;border-radius:2px;transition:all .25s;}
.btn-cta:hover{background:var(--gold-light);color:var(--dark);}
footer{background:var(--dark);padding:52px 40px 36px;}
.footer-inner{max-width:1100px;margin:0 auto;}
.footer-grid{display:grid;grid-template-columns:1.5fr 1fr 1fr;gap:48px;padding-bottom:40px;border-bottom:1px solid rgba(255,255,255,0.06);margin-bottom:28px;}
.footer-logo{font-family:'Cormorant Garamond',serif;font-size:24px;font-weight:700;color:var(--gold-light);margin-bottom:10px;}
.footer-desc{font-size:14px;color:rgba(255,255,255,0.35);line-height:1.7;}
.footer-col h4{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.25);margin-bottom:14px;}
.footer-col ul{list-style:none;display:flex;flex-direction:column;gap:8px;}
.footer-col a{color:rgba(255,255,255,0.45);text-decoration:none;font-size:14px;transition:color .2s;}
.footer-col a:hover{color:var(--gold-light);}
.footer-bottom{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;font-size:11px;color:rgba(255,255,255,0.2);}
.affiliate-note{max-width:420px;line-height:1.6;}
@media(max-width:860px){nav{padding:0 20px;}.review-hero{padding:90px 20px 48px;}.review-hero-inner{grid-template-columns:1fr;}.hero-product-img{display:none;}.buy-bar{padding:16px 20px;}.buy-bar-inner{flex-wrap:wrap;gap:10px;}.review-content{padding:40px 20px;}.content-grid{grid-template-columns:1fr;}.sidebar{position:static;}.pros-cons{grid-template-columns:1fr;}.reviews-summary{flex-direction:column;gap:20px;text-align:center;}.reviews-grid{grid-template-columns:1fr;}.footer-grid{grid-template-columns:1fr;gap:32px;}}`

// ─────────────────────────────────────────────────────────────
// Rate limiting + cost helpers
// ─────────────────────────────────────────────────────────────

export async function checkRateLimit(): Promise<RateLimitResult> {
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString()
  const { count } = await supabaseAdmin
    .from('ai_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('job_type', 'review_draft')
    .gte('created_at', hourAgo)
  const used = count ?? 0
  if (used >= RATE_LIMIT_PER_HOUR) {
    return { ok: false, reason: `Rate limit: ${used}/${RATE_LIMIT_PER_HOUR} generací za hodinu` }
  }
  return { ok: true, remaining: RATE_LIMIT_PER_HOUR - used }
}

export async function getDailyCostUsd(): Promise<number> {
  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)
  const { data } = await supabaseAdmin
    .from('ai_jobs')
    .select('cost_usd')
    .gte('created_at', dayStart.toISOString())
    .not('cost_usd', 'is', null)
  return (data ?? []).reduce((sum: number, r: { cost_usd: number | null }) => sum + (r.cost_usd ?? 0), 0)
}

// ─────────────────────────────────────────────────────────────
// Eshop scraping (Shoptet — shop.reckonasbavi.cz)
// ─────────────────────────────────────────────────────────────

async function scrapeEshopPage(url: string): Promise<EshopScrape> {
  const result: EshopScrape = { title: null, description: null, specs: [], reviews: [], heroImageUrl: null }
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; 5litru-review-bot/1.0; +https://5litru.cz)',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'cs-CZ,cs;q=0.9',
      },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const html = await res.text()
    const $ = cheerioLoad(html)

    result.title = $('h1').first().text().trim() || null

    for (const sel of ['.product-detail__description', '.description-detail', '.product-description']) {
      const text = $(sel).text().trim()
      if (text.length > 50) { result.description = text.slice(0, 2000); break }
    }
    if (!result.description) {
      $('p').each((_, el) => {
        const text = $(el).text().trim()
        if (!result.description && text.length > 100) result.description = text.slice(0, 1000)
      })
    }

    for (const sel of ['.product-detail__params table', '.params-list', '.product-params']) {
      $(sel).find('tr').each((_, row) => {
        const cells = $(row).find('td, th')
        if (cells.length >= 2) {
          const label = $(cells[0]).text().trim().replace(/:$/, '')
          const value = $(cells[1]).text().trim()
          if (label && value) result.specs.push({ label, value })
        }
      })
      if (result.specs.length > 0) break
    }

    for (const sel of ['.product-detail__main-image img', '.product-gallery__main img', '.product-image img']) {
      const src = $(sel).first().attr('src')
      if (src?.startsWith('http')) { result.heroImageUrl = src; break }
    }

    $('.product-reviews__item, .review-item').each((i, el) => {
      if (i >= 5) return
      const text = $(el).find('.product-reviews__message, .review-text').text().trim()
      const author = $(el).find('.product-reviews__author, .review-author').text().trim() || 'Ověřený zákazník'
      const dateStr = $(el).find('.product-reviews__date, .review-date').text().trim()
      const filled = $(el).find('.product-reviews__star--active, .stars .active').length
      if (text.length > 10) result.reviews.push({ author, rating: filled || 5, text, date: dateStr })
    })
  } catch (e) {
    console.warn('[ai-review] eshop scrape failed:', (e as Error).message)
  }
  return result
}

// ─────────────────────────────────────────────────────────────
// Heureka (best-effort — 5 s delays, graceful on 403/captcha)
// ─────────────────────────────────────────────────────────────

async function scrapeHeureka(productName: string): Promise<HeurekaScrape | null> {
  const delay = (ms: number) => new Promise(r => setTimeout(r, ms))
  try {
    await delay(5000)
    const searchUrl = `https://www.heureka.cz/?h%5Bfraze%5D=${encodeURIComponent(productName)}&lang=1`
    const searchRes = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; 5litru-review-bot/1.0; +https://5litru.cz)',
        Accept: 'text/html',
        'Accept-Language': 'cs-CZ,cs;q=0.9',
      },
      signal: AbortSignal.timeout(12_000),
    })
    if (!searchRes.ok) {
      console.warn(`[ai-review] Heureka search HTTP ${searchRes.status} — skipping`)
      return null
    }
    const searchHtml = await searchRes.text()
    if (searchHtml.includes('captcha') || searchHtml.includes('robot')) {
      console.warn('[ai-review] Heureka: captcha/bot check — skipping')
      return null
    }
    const $s = cheerioLoad(searchHtml)
    const firstLink = $s('.product-title a, .name a, [data-testid="product-title"] a').first().attr('href')
    if (!firstLink) {
      console.warn('[ai-review] Heureka: no product found for:', productName.slice(0, 60))
      return null
    }
    const productUrl = firstLink.startsWith('http') ? firstLink : `https://www.heureka.cz${firstLink}`

    await delay(5000)
    const detailRes = await fetch(productUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; 5litru-review-bot/1.0; +https://5litru.cz)',
        Accept: 'text/html',
        'Accept-Language': 'cs-CZ,cs;q=0.9',
      },
      signal: AbortSignal.timeout(12_000),
    })
    if (!detailRes.ok) return null
    const detailHtml = await detailRes.text()
    const $d = cheerioLoad(detailHtml)

    const result: HeurekaScrape = { averageRating: null, reviewCount: null, reviews: [] }
    const ratingText = $d('[itemprop="ratingValue"], .rating-value').first().text().trim()
    const reviewCountText = $d('[itemprop="reviewCount"], .rating-count').first().text().trim()
    const avg = parseFloat(ratingText.replace(',', '.'))
    const cnt = parseInt(reviewCountText.replace(/\D/g, ''))
    if (!isNaN(avg)) result.averageRating = Math.min(5, Math.max(1, avg))
    if (!isNaN(cnt)) result.reviewCount = cnt

    $d('.review, .reviews__item, [itemprop="review"]').each((i, el) => {
      if (i >= 6) return
      const text = $d('[itemprop="reviewBody"], .review__text', el).text().trim()
      const author = $d('[itemprop="author"], .review__author', el).text().trim() || 'Zákazník'
      const dateStr = $d('[itemprop="datePublished"]', el).attr('datetime') || $d('.review__date', el).text().trim()
      const ratingVal = parseFloat($d('[itemprop="ratingValue"]', el).text().trim().replace(',', '.'))
      if (text.length > 10) {
        result.reviews.push({
          author: author.slice(0, 50),
          rating: isNaN(ratingVal) ? 5 : Math.min(5, Math.max(1, ratingVal)),
          text: text.slice(0, 400),
          date: dateStr,
        })
      }
    })
    return result.averageRating !== null || result.reviews.length > 0 ? result : null
  } catch (e) {
    console.warn('[ai-review] Heureka scrape failed:', (e as Error).message)
    return null
  }
}

// ─────────────────────────────────────────────────────────────
// Style samples from DB (text only — strips HTML for token efficiency)
// ─────────────────────────────────────────────────────────────

async function loadStyleSamples(): Promise<string> {
  const { data } = await supabaseAdmin
    .from('products')
    .select('name, review_mdx')
    .eq('status', 'published')
    .not('review_mdx', 'is', null)
    .limit(3)
  if (!data?.length) return ''

  return (data as Array<{ name: string; review_mdx: string | null }>).map(p => {
    const mdx = p.review_mdx ?? ''
    const bodyStart = mdx.indexOf('\n---\n', 3)
    const body = bodyStart >= 0 ? mdx.slice(bodyStart + 5) : mdx
    const text = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1200)
    return `\n\n=== VZOR: ${p.name} ===\n${text}`
  }).join('')
}

// ─────────────────────────────────────────────────────────────
// Claude prompt
// ─────────────────────────────────────────────────────────────

function buildReviewPrompt(
  s: SuggestionRow,
  eshop: EshopScrape,
  heureka: HeurekaScrape | null,
  styleSamples: string,
): string {
  const country = s.origin_country ? (COUNTRY_NAMES[s.origin_country] ?? s.origin_country) : 'Řecko'
  const isBio = s.name.toUpperCase().includes('BIO') || s.olivator_slug?.includes('bio')

  const eshopSpecsText = eshop.specs.map(sp => `${sp.label}: ${sp.value}`).join('\n') || '(žádné specs)'
  const eshopDescText = eshop.description?.slice(0, 800) || '(bez popisu z eshopu)'
  const eshopReviewsText = eshop.reviews
    .map(r => `- "${r.text.slice(0, 200)}" — ${r.author} (${r.rating}/5)`)
    .join('\n') || '(bez recenzí ze shopu)'

  const heurText = heureka
    ? `Heureka.cz: průměr ${heureka.averageRating ?? '—'}/5 (${heureka.reviewCount ?? '?'} recenzí)\n` +
      heureka.reviews.map(r => `- "${r.text}" — ${r.author} (${r.rating}/5)`).join('\n')
    : '(Heureka: žádná data)'

  return `Napiš detailní recenzi olivového oleje pro 5litru.cz.

PRODUKT:
- Název: ${s.name}
- Značka: ${s.brand_slug ?? '—'}
- Země: ${country}
- Region: ${s.origin_region ?? '—'}
- Odrůda: ${s.variety ?? '—'}
- Acidita: ${s.acidity != null ? `${s.acidity.toFixed(2)} %` : '—'}
- Polyfenoly: ${s.polyphenols != null ? `${s.polyphenols} mg/kg` : '—'}
- Objem: ${s.volume_ml ?? 5000} ml
- BIO certifikace: ${isBio ? 'Ano' : 'Ne / neznámo'}
- Cena: ${s.primary_offer_price != null ? `${Math.round(s.primary_offer_price)} Kč` : '—'}
- Olivator skóre: ${s.olivator_score ?? '—'}/100

POPIS Z ESHOPU:
${eshopDescText}

PARAMETRY Z ESHOPU:
${eshopSpecsText}

RECENZE ZE SHOPU (max 5):
${eshopReviewsText}

${heurText}

STYL — ukázky z existujících recenzí na 5litru.cz:
${styleSamples}

POKYNY:
- Pis česky, přirozeně — informovaný nadšenec, ne marketér
- Celkem ~2000 slov v sekcích intro + sensory + comparison + conclusion
- Buď konkrétní: odrůda, acidita, region, co z toho plyne pro chuť
- Nepoužívej: "zlatavá barva", "tekuté zlato", "výjimečná kvalita", "prémiový"
- Senzorický profil: konkrétně popis chuti, vůně, hořkost, štiplavost, dochuť
- Comparison: porovnej s dalšími 5L oleji z pohledu cena/výkon (obecně)
- FAQ: praktické otázky — skladování, vaření, srovnání s extra light, vhodnost
- Závěr: KDO by měl koupit a KDO ne

Vrať POUZE JSON v code blocku (\`\`\`json ... \`\`\`):
{
  "title": "(max 70 znaků, SEO)",
  "description": "(150-160 znaků, meta)",
  "schema_review_body": "(2-3 věty bez HTML pro schema.org)",
  "schema_rating": 4.2,
  "intro_heading": "(kreativní H2)",
  "intro": "<p>...</p><p>...</p><p>...</p>",
  "pros": ["max 4 výhody"],
  "cons": ["max 3 nevýhody"],
  "specs_note": "(1 věta o parametrech)",
  "sensory_heading": "(H2 pro senzoriku)",
  "sensory": "<p>...</p><p>...</p><p>...</p>",
  "comparison": "<p>...</p>",
  "conclusion": "<p>...</p><p>...</p>",
  "faq": [{"q": "...", "a": "..."}, {"q": "...", "a": "..."}]
}`
}

function sanitizeJsonString(jsonStr: string): string {
  // Remove BOM / zero-width chars that can appear in long LLM outputs
  return jsonStr
    .replace(/^﻿/, '')
    .replace(/[​-‍﻿]/g, '')
    // Normalise Windows line endings
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
}

function parseReviewContent(raw: string): ReviewContent {
  const match = raw.match(/```json\s*([\s\S]*?)\s*```/)
  const jsonStr = match ? match[1] : raw.trim()

  const cleaned = sanitizeJsonString(jsonStr)
  try {
    return JSON.parse(cleaned) as ReviewContent
  } catch (firstErr) {
    // Log what failed (first 600 chars) to help diagnose
    console.error('[ai-review] JSON parse failed at first attempt. Excerpt:\n', cleaned.slice(0, 600))

    // Last-resort: try stripping trailing comma before } or ]
    const repaired = cleaned
      .replace(/,\s*([}\]])/g, '$1')   // trailing commas
      .replace(/([{,]\s*)"([^"]+)":\s*undefined/g, '') // undefined values
    try {
      return JSON.parse(repaired) as ReviewContent
    } catch {
      throw new Error(`JSON parse failed: ${(firstErr as Error).message}. Raw excerpt: ${cleaned.slice(0, 300)}`)
    }
  }
}

// ─────────────────────────────────────────────────────────────
// HTML assembly
// ─────────────────────────────────────────────────────────────

function stars(count = 5): string {
  return '<span class="star">★</span>'.repeat(Math.round(Math.min(5, Math.max(1, count))))
}

function buildHeurekaSummaryHtml(h: HeurekaScrape, slug: string): string {
  if (!h.averageRating && !h.reviews.length) return ''
  const avg = h.averageRating ?? 5
  const cnt = h.reviewCount ?? h.reviews.length
  const pct5 = cnt > 0 && h.reviews.length > 0 ? Math.round((h.reviews.filter(r => r.rating >= 4.5).length / h.reviews.length) * 100) : 80
  const reviewCards = h.reviews.slice(0, 4).map(r => `
    <div class="review-card">
      <div class="review-card-stars">${stars(r.rating)}</div>
      <p class="review-card-text">„${r.text.replace(/"/g, '&quot;')}"</p>
      <div class="review-card-meta">
        <span class="review-card-author">${r.author}</span>
        <span class="review-card-date">${r.date}</span>
      </div>
    </div>`).join('')

  return `
      <div class="content-section" id="recenze-zakazniku">
        <div class="section-label"><div class="section-label-line"></div><div class="section-label-text">Zákazníci hodnotí</div></div>
        <h2 class="content-h2">Co říkají zákazníci?</h2>
        <div class="reviews-summary">
          <div class="reviews-score-big">
            <div class="reviews-score-num">${avg.toFixed(1).replace('.', ',')}</div>
            <div class="reviews-score-stars">${stars(avg)}</div>
            <div class="reviews-score-count">z ${cnt} hodnocení</div>
          </div>
          <div class="reviews-bars">
            <div class="rbar-row"><span class="rbar-label">5★</span><div class="rbar-track"><div class="rbar-fill" style="width:${pct5}%"></div></div><span class="rbar-count">${Math.round(cnt * pct5 / 100)}</span></div>
            <div class="rbar-row"><span class="rbar-label">4★</span><div class="rbar-track"><div class="rbar-fill" style="width:${Math.round((100-pct5)*0.6)}%"></div></div><span class="rbar-count">${Math.round(cnt*(100-pct5)*0.006)}</span></div>
            <div class="rbar-row"><span class="rbar-label">3★</span><div class="rbar-track"><div class="rbar-fill" style="width:5%"></div></div><span class="rbar-count">${Math.max(0, Math.round(cnt*0.02))}</span></div>
            <div class="rbar-row"><span class="rbar-label">2★</span><div class="rbar-track"><div class="rbar-fill" style="width:2%"></div></div><span class="rbar-count">0</span></div>
            <div class="rbar-row"><span class="rbar-label">1★</span><div class="rbar-track"><div class="rbar-fill" style="width:1%"></div></div><span class="rbar-count">0</span></div>
          </div>
          <div class="reviews-source">
            <div class="reviews-source-logo">Zdroj</div>
            <a href="https://www.heureka.cz" class="reviews-source-link" rel="nofollow">heureka.cz →</a>
          </div>
        </div>
        ${reviewCards ? `<div class="reviews-grid">${reviewCards}</div>` : ''}
      </div>`
}

function buildReviewHtml(
  s: SuggestionRow,
  c: ReviewContent,
  heureka: HeurekaScrape | null,
  affiliateUrl: string,
  heroImagePath: string | null,
  slug: string,
): string {
  const country = s.origin_country ? (COUNTRY_NAMES[s.origin_country] ?? s.origin_country) : 'Řecko'
  const price = s.primary_offer_price != null ? Math.round(s.primary_offer_price) : null
  const pricePerLiter = price != null && s.volume_ml ? Math.round(price / (s.volume_ml / 1000)) : null
  const acidStr = s.acidity != null ? `${s.acidity.toFixed(2).replace('.', ',')} %` : null
  const isBio = s.name.toUpperCase().includes('BIO')
  const heroImgSrc = heroImagePath ?? s.image_url ?? ''

  const regionLine = [
    s.origin_region, country, s.variety ? `Odrůda ${s.variety}` : null, isBio ? 'BIO' : null,
  ].filter(Boolean).join(' · ')

  const faqHtml = c.faq.map(item => `
          <details class="faq-item">
            <summary class="faq-q">${item.q}</summary>
            <p class="faq-a">${item.a}</p>
          </details>`).join('')

  const sidebarSpecsHtml = [
    s.origin_region ? `<div class="sidebar-spec"><span class="sidebar-spec-label">Oblast</span><span class="sidebar-spec-value">${s.origin_region}${s.origin_region !== country ? `, ${country}` : ''}</span></div>` : '',
    s.variety ? `<div class="sidebar-spec"><span class="sidebar-spec-label">Odrůda</span><span class="sidebar-spec-value">${s.variety}</span></div>` : '',
    acidStr ? `<div class="sidebar-spec"><span class="sidebar-spec-label">Acidita</span><span class="sidebar-spec-value">${acidStr}</span></div>` : '',
    s.polyphenols ? `<div class="sidebar-spec"><span class="sidebar-spec-label">Polyfenoly</span><span class="sidebar-spec-value">${s.polyphenols} mg/kg</span></div>` : '',
    `<div class="sidebar-spec"><span class="sidebar-spec-label">Objem</span><span class="sidebar-spec-value">${s.volume_ml ?? 5000} ml · plech</span></div>`,
    isBio ? `<div class="sidebar-spec"><span class="sidebar-spec-label">Certifikace</span><span class="sidebar-spec-value">BIO/Ekologické</span></div>` : '',
  ].filter(Boolean).join('')

  const heurekaSummaryHtml = heureka ? buildHeurekaSummaryHtml(heureka, slug) : ''

  return `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Jost:wght@400;500;600&family=DM+Mono&display=swap" rel="stylesheet">
<style>${REVIEW_CSS}</style>
</head>
<body>
<nav>
  <a href="/" class="nav-logo">5litru<span>.cz</span></a>
  <a href="/nejlepsi-olivovy-olej-5l/" class="nav-link">← Srovnání olejů</a>
</nav>

<section class="review-hero">
  <div class="review-hero-inner">
    <div>
      <div class="hero-breadcrumb">
        <a href="/">5litru.cz</a> / <a href="/nejlepsi-olivovy-olej-5l/">Srovnání olejů</a> / Recenze
      </div>
      <div class="hero-region">🌊 ${regionLine}</div>
      <h1>${s.name.replace(/\s+5\s*l.*/i, '').replace(/Extra panenský olivový olej/i, '').replace(/\s+/g, ' ').trim()}</h1>
      <p class="hero-sub">${s.brand_slug ? `${s.brand_slug.charAt(0).toUpperCase()}${s.brand_slug.slice(1)} · ` : ''}Extra panenský olivový olej · Plech 5 litrů</p>
      <div class="hero-badges">
        ${acidStr ? `<span class="badge">⚗️ Acidita ${acidStr}</span>` : ''}
        <span class="badge">🫙 Plech 5 l</span>
        <span class="badge">🇬🇷 ${country}</span>
        ${isBio ? '<span class="badge badge-gold">🌿 BIO certifikát</span>' : ''}
        ${s.olivator_score != null ? `<span class="badge badge-gold">Olivator ${s.olivator_score}/100</span>` : ''}
      </div>
      <div class="hero-verdict">
        <div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0;gap:4px;">
          <div class="verdict-score">${s.olivator_score ?? '—'}</div>
          <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,0.3);">z 100 · Olivator</div>
        </div>
        <div>
          <div class="verdict-label">Skóre Olivatoru · olivator.cz</div>
          <div class="verdict-text">${c.schema_review_body}</div>
        </div>
      </div>
    </div>
    <div class="hero-product-img">
      <img src="${heroImgSrc}" alt="${s.name}" onerror="this.style.display='none'">
    </div>
  </div>
</section>

<div class="buy-bar">
  <div class="buy-bar-inner">
    <div class="buy-bar-name">${s.name.slice(0, 60)}</div>
    <div style="display:flex;align-items:baseline;gap:10px;">
      ${price != null ? `<div class="buy-bar-price">${price.toLocaleString('cs-CZ')} Kč</div>` : ''}
      ${pricePerLiter != null ? `<div class="buy-bar-per">${pricePerLiter} Kč/l · ověřte aktuální cenu</div>` : ''}
    </div>
    <a href="${affiliateUrl}" class="btn-buy-bar" rel="nofollow sponsored">Koupit na Reckonasbavi.cz →</a>
  </div>
</div>

<div class="review-content">
  <div class="content-grid">
    <div>

      <div class="content-section">
        <div class="section-label"><div class="section-label-line"></div><div class="section-label-text">Úvod</div></div>
        <h2 class="content-h2">${c.intro_heading}</h2>
        ${c.intro}
        <div class="pros-cons">
          <div class="pros">
            <div class="pros-cons-title">✓ Výhody</div>
            <ul class="pros-cons-list">${c.pros.map(p => `<li>${p}</li>`).join('')}</ul>
          </div>
          <div class="cons">
            <div class="pros-cons-title">— Nevýhody</div>
            <ul class="pros-cons-list">${c.cons.map(p => `<li>${p}</li>`).join('')}</ul>
          </div>
        </div>
      </div>

      <div class="content-section">
        <div class="section-label"><div class="section-label-line"></div><div class="section-label-text">Senzorický profil</div></div>
        <h2 class="content-h2">${c.sensory_heading}</h2>
        ${c.sensory}
      </div>

      <div class="content-section">
        <div class="section-label"><div class="section-label-line"></div><div class="section-label-text">Srovnání s alternativami</div></div>
        <h2 class="content-h2">Jak se ${s.brand_slug ? s.brand_slug.charAt(0).toUpperCase() + s.brand_slug.slice(1) : 'tento olej'} řadí?</h2>
        ${c.comparison}
      </div>

      ${heurekaSummaryHtml}

      <div class="content-section">
        <div class="section-label"><div class="section-label-line"></div><div class="section-label-text">Časté dotazy</div></div>
        <h2 class="content-h2">Otázky o ${s.name.split(' ').slice(0, 2).join(' ')}</h2>
        <div class="faq-list">${faqHtml}</div>
      </div>

      <div class="content-section">
        <div class="section-label"><div class="section-label-line"></div><div class="section-label-text">Závěr</div></div>
        ${c.conclusion}
      </div>

    </div>

    <aside class="sidebar">
      <div class="sidebar-card">
        <div class="sidebar-card-img">
          <img src="${heroImgSrc}" alt="${s.name}" onerror="this.style.opacity='0'">
        </div>
        <div class="sidebar-card-body">
          <div class="sidebar-product-name">${s.name.split(' ').slice(0, 3).join(' ')}</div>
          <div class="sidebar-product-sub">${s.brand_slug ? `${s.brand_slug} · ` : ''}Extra panenský · 5l</div>
          <div class="sidebar-specs">${sidebarSpecsHtml}</div>
          ${price != null ? `
          <div class="sidebar-price">${price.toLocaleString('cs-CZ')} Kč</div>
          ${pricePerLiter != null ? `<div class="sidebar-price-per">${pricePerLiter} Kč/l</div>` : ''}
          <div class="sidebar-price-note">Ověřte aktuální cenu před objednávkou</div>
          ` : ''}
          <a href="${affiliateUrl}" class="btn-buy-full" rel="nofollow sponsored">Koupit na Reckonasbavi.cz →</a>
          <div class="sidebar-disclaimer">Affiliate odkaz — při nákupu obdržíme provizi bez navýšení ceny pro vás.</div>
        </div>
      </div>
      <div class="compare-box">
        <div class="compare-box-title">Porovnat s dalšími</div>
        <a href="/nejlepsi-olivovy-olej-5l/" class="compare-item">
          <div><div class="compare-item-name">Srovnávací tabulka</div><div style="font-size:12px;color:var(--muted);">všechny 5L oleje v nabídce</div></div>
          <div style="display:flex;align-items:center;gap:12px;"><div class="compare-item-arr">→</div></div>
        </a>
      </div>
    </aside>

  </div>
</div>

<section class="cta-section">
  <div class="cta-inner">
    <div class="cta-title">Přesvědčeni?</div>
    <p class="cta-desc">Nebo chcete ještě srovnat? Tabulka všech 10 olejů s aciditami a cenami — výběr do 5 minut.</p>
    <div style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap;">
      <a href="${affiliateUrl}" class="btn-cta" rel="nofollow sponsored">Koupit →</a>
      <a href="/nejlepsi-olivovy-olej-5l/" class="btn-cta" style="background:transparent;border:1px solid rgba(255,255,255,0.3);color:#fff;">Srovnat oleje →</a>
    </div>
  </div>
</section>

<footer>
  <div class="footer-inner">
    <div class="footer-grid">
      <div>
        <div class="footer-logo">5litru.cz</div>
        <div class="footer-desc">Nezávislý průvodce výběrem olivového oleje v 5litrovém balení. Recenze a srovnání bez reklam.</div>
      </div>
      <div class="footer-col">
        <h4>Recenze</h4>
        <ul>
          <li><a href="/motakis-recenze/">Motakis Kréta</a></li>
          <li><a href="/nikolos-kalamata-recenze/">Nikolos Kalamata</a></li>
          <li><a href="/neotis-manaki-recenze/">Neotis Manaki</a></li>
          <li><a href="/nejlepsi-olivovy-olej-5l/">Všechny recenze →</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Průvodci</h4>
        <ul>
          <li><a href="/acidita-olivoveho-oleje/">Co je acidita?</a></li>
          <li><a href="/jak-skladovat-olivovy-olej/">Jak skladovat?</a></li>
          <li><a href="/olivovy-olej-na-smazeni/">Smažení?</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <div>© 2026 5litru.cz</div>
      <div class="affiliate-note">Některé odkazy jsou affiliate — při nákupu obdržíme provizi bez navýšení ceny pro vás. Hodnocení jsou vždy nezávislá.</div>
    </div>
  </div>
</footer>

</body></html>`
}

function buildMdx(
  s: SuggestionRow,
  c: ReviewContent,
  htmlBody: string,
  reviewSlug: string,
  affiliateUrl: string,
): string {
  const isBio = s.name.toUpperCase().includes('BIO')
  const year = new Date().getFullYear()

  const faqSchemas = c.faq.map(item => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a },
  }))

  const fm = {
    title: c.title,
    slug: reviewSlug,
    description: c.description,
    focus_keyword: `${s.brand_slug ?? ''} olivový olej`.trim(),
    og_image: null as string | null,
    published_at: null as string | null,
    word_count: Math.round(htmlBody.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(' ').length),
    category: 'review',
    seo_score: null,
    ai_generated: true,
    schemas: [
      {
        '@context': 'https://schema.org',
        '@type': 'Review',
        name: c.title,
        reviewBody: c.schema_review_body,
        author: { '@type': 'Organization', name: '5litru.cz' },
        itemReviewed: {
          '@type': 'Product',
          name: s.name,
          brand: s.brand_slug ? { '@type': 'Brand', name: s.brand_slug } : undefined,
          offers: {
            '@type': 'Offer',
            priceCurrency: 'CZK',
            price: s.primary_offer_price ?? undefined,
            availability: 'https://schema.org/InStock',
            url: affiliateUrl,
          },
        },
        reviewRating: { '@type': 'Rating', ratingValue: c.schema_rating.toFixed(1), bestRating: '5' },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqSchemas,
      },
    ],
  }

  // Serialize frontmatter as YAML (hand-rolled — no yaml dep needed for this shape)
  const schemaJson = JSON.stringify(fm.schemas, null, 2).split('\n').map(l => '  ' + l).join('\n')
  const yaml = `title: ${JSON.stringify(fm.title)}
slug: ${reviewSlug}
description: >-
  ${fm.description.replace(/\n/g, '\n  ')}
focus_keyword: ${fm.focus_keyword}
og_image: null
published_at: null
word_count: ${fm.word_count}
category: review
ai_generated: true
seo_score: null
schemas: ${schemaJson.replace(/^  /, '')}`

  return `---\n${yaml}\n---\n${htmlBody}`
}

// ─────────────────────────────────────────────────────────────
// Image download
// ─────────────────────────────────────────────────────────────

async function downloadHeroImage(imageUrl: string, slug: string): Promise<string | null> {
  try {
    const ext = imageUrl.match(/\.(webp|jpg|jpeg|png)/i)?.[1] ?? 'webp'
    const localPath = `/images/products/${slug}.${ext}`
    const absDir = join(process.cwd(), 'public', 'images', 'products')
    await mkdir(absDir, { recursive: true })
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buffer = Buffer.from(await res.arrayBuffer())
    await writeFile(join(process.cwd(), 'public', localPath), buffer)
    return localPath
  } catch (e) {
    console.warn('[ai-review] hero image download failed:', (e as Error).message)
    return null
  }
}

// ─────────────────────────────────────────────────────────────
// Slug helpers (same logic as suggestions/[id]/import/route.ts)
// ─────────────────────────────────────────────────────────────

function buildSlug(olivatorSlug: string): string {
  return olivatorSlug
    .replace(/-(bio|extra-panensky|olivovy-olej|nefiltrovany|bag-in-box|coupage|pet|plech)-?/g, '-')
    .replace(/-?5-?l-?/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || olivatorSlug.slice(0, 60)
}

async function resolveUniqueSlug(base: string, suffix: string = ''): Promise<string> {
  const candidate = suffix ? `${base}${suffix}` : base
  const { count } = await supabaseAdmin
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('slug', candidate)
  if ((count ?? 0) === 0) return candidate
  // Increment suffix
  const n = suffix ? parseInt(suffix.replace('-', '')) + 1 : 2
  return resolveUniqueSlug(base, `-${n}`)
}

async function resolveUniqueReviewSlug(base: string, suffix: string = ''): Promise<string> {
  const candidate = suffix ? `${base}${suffix}` : base
  const { count } = await supabaseAdmin
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('review_slug', candidate)
  if ((count ?? 0) === 0) return candidate
  const n = suffix ? parseInt(suffix.replace('-', '')) + 1 : 2
  return resolveUniqueReviewSlug(base, `-${n}`)
}

// ─────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────

export async function generateAiReviewDraft(suggestionId: string): Promise<ReviewDraftResult> {
  const warnings: string[] = []

  // 1. Load suggestion
  const { data: sugRaw, error: sugErr } = await supabaseAdmin
    .from('olivator_suggestions')
    .select('*')
    .eq('olivator_product_id', suggestionId)
    .single()
  if (sugErr || !sugRaw) throw new Error(`Suggestion not found: ${suggestionId}`)
  const s = sugRaw as unknown as SuggestionRow

  // 2. Load retailer for affiliate URL
  const { data: retailerRaw } = await supabaseAdmin
    .from('retailers')
    .select('*')
    .eq('slug', s.primary_retailer_slug)
    .maybeSingle()
  const retailer = retailerRaw as unknown as Retailer | null

  const affiliateUrl = retailer
    ? buildAffiliateUrl(s.primary_offer_url, retailer)
    : s.primary_offer_url

  // 3. Parallel: eshop scrape + style samples
  const [eshop, styleSamples] = await Promise.all([
    scrapeEshopPage(s.primary_offer_url),
    loadStyleSamples(),
  ])
  if (!eshop.description) warnings.push('eshop scrape: no description')

  // 4. Heureka (sequential — needs 5 s delay)
  let heureka: HeurekaScrape | null = null
  try {
    heureka = await scrapeHeureka(s.name)
    if (!heureka) warnings.push('heureka: no data')
  } catch {
    warnings.push('heureka: scrape failed')
  }

  // 5. Download hero image (in background while building prompt)
  const baseSlug = buildSlug(s.olivator_slug)
  const [slug, reviewSlug, heroImagePath] = await Promise.all([
    resolveUniqueSlug(baseSlug),
    resolveUniqueReviewSlug(`${baseSlug}-recenze`),
    s.image_url ? downloadHeroImage(s.image_url, baseSlug) : Promise.resolve(null),
  ])
  if (!heroImagePath) warnings.push('hero image: download failed')

  // 6. Call Claude
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const prompt = buildReviewPrompt(s, eshop, heureka, styleSamples)

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 6000,
    system: `Jsi zkušený copywriter pro 5litru.cz — český niche web o 5L olivových olejích.
Píšeš objektivní, detailní recenze v hlasu informovaného nadšence.
Výstup je VŽDY JSON v code blocku — nic jiného.`,
    messages: [{ role: 'user', content: prompt }],
  })

  const rawOutput = message.content.map(b => (b.type === 'text' ? b.text : '')).join('')
  const inputTokens = message.usage.input_tokens
  const outputTokens = message.usage.output_tokens
  const costUsd = inputTokens * COST_INPUT + outputTokens * COST_OUTPUT

  // 7. Parse Claude output
  const content = parseReviewContent(rawOutput)

  // 8. Assemble HTML + MDX
  const htmlBody = buildReviewHtml(s, content, heureka, affiliateUrl, heroImagePath, slug)
  const mdx = buildMdx(s, content, htmlBody, reviewSlug, affiliateUrl)

  // 9. Insert draft product (slug collision handled by resolveUniqueSlug above)
  const country = s.origin_country ? (COUNTRY_NAMES[s.origin_country] ?? s.origin_country) : 'Řecko'
  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from('products')
    .insert({
      slug,
      review_slug: reviewSlug,
      name: s.name.slice(0, 200),
      brand: s.brand_slug,
      origin_country: country,
      origin_region: s.origin_region,
      variety: s.variety,
      volume_ml: s.volume_ml ?? 5000,
      acidity_pct: s.acidity,
      packaging: s.name.toLowerCase().includes('plech') ? 'plech'
        : s.name.toLowerCase().includes('pet') ? 'pet' : 'plech',
      price_czk: s.primary_offer_price,
      retailer_id: retailer?.id ?? null,
      product_url: s.primary_offer_url,
      affiliate_url: affiliateUrl,
      hero_image: heroImagePath ?? s.image_url,
      status: 'draft',
      review_mdx: mdx,
      review_frontmatter: {
        title: content.title,
        description: content.description,
        slug: reviewSlug,
        ai_generated: true,
      },
    })
    .select('id')
    .single()

  if (insertErr || !inserted) throw new Error(`DB insert failed: ${insertErr?.message}`)
  const productId = (inserted as { id: string }).id

  // 10. Log ai_jobs
  const { data: jobRow } = await supabaseAdmin
    .from('ai_jobs')
    .insert({
      product_id: productId,
      job_type: 'review_draft',
      model: 'claude-sonnet-4-5',
      input: { suggestion_id: suggestionId, eshop_specs: eshop.specs.length, heureka_reviews: heureka?.reviews.length ?? 0 },
      output: { slug, review_slug: reviewSlug, input_tokens: inputTokens, output_tokens: outputTokens },
      status: 'completed',
      cost_usd: costUsd,
      completed_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  const jobId = (jobRow as { id: string } | null)?.id ?? 'unknown'

  // 11. Flip suggestion to imported
  await supabaseAdmin
    .from('olivator_suggestions')
    .update({ status: 'imported', imported_product_id: productId, decided_at: new Date().toISOString() })
    .eq('olivator_product_id', suggestionId)

  // 12. Email notification
  const recipient = process.env.ADMIN_NOTIFICATION_EMAIL
  if (recipient) {
    const editUrl = `https://5litru.cz/admin/products/${productId}/edit/`
    const html = renderAdminAlertHtml({
      title: `AI draft připraven: ${s.name.slice(0, 50)}`,
      bodyHtml: `
        <p>Nový AI draft recenze čeká na kontrolu a schválení před publikací.</p>
        <ul style="padding-left:20px;margin:12px 0;">
          <li><strong>Produkt:</strong> ${s.name}</li>
          <li><strong>Slug:</strong> <code>${slug}</code> / <code>${reviewSlug}</code></li>
          <li><strong>Náklady:</strong> $${costUsd.toFixed(4)} (${inputTokens}+${outputTokens} tokenů)</li>
          ${warnings.length ? `<li style="color:#8a5a20;"><strong>Varování:</strong> ${warnings.join(', ')}</li>` : ''}
        </ul>`,
      ctaLabel: 'Otevřít draft →',
      ctaUrl: editUrl,
    })
    await sendViaResend(recipient, `[5litru.cz] AI draft: ${s.name.slice(0, 40)}`, html, {
      replyTo: process.env.RESEND_REPLY_TO,
      tag: 'ai-draft-ready',
    }).catch(e => console.warn('[ai-review] email failed:', e))
  }

  // 13. Railway redeploy (non-blocking — redirect table picks up new affiliate slug at next deploy)
  const redeployWebhook = process.env.RAILWAY_REDEPLOY_WEBHOOK
  if (redeployWebhook) {
    fetch(redeployWebhook, { method: 'POST' }).catch(e =>
      console.warn('[ai-review] Railway redeploy webhook failed:', e)
    )
  }

  return { product_id: productId, job_id: jobId, slug, review_slug: reviewSlug, input_tokens: inputTokens, output_tokens: outputTokens, cost_usd: costUsd, warnings }
}
