import { NextResponse } from 'next/server'

// Railway healthcheck target (railway.toml: healthcheckPath = "/api/health/").
// Vrací identifikaci nasazení: SHA commitu (Railway: RAILWAY_GIT_COMMIT_SHA za běhu,
// BUILD_COMMIT_SHA zapečené při buildu v next.config.ts) a čas buildu (BUILD_TIME z next.config.ts).
// Bez DB — zůstává rychlý i když je Supabase pomalé. Dynamicky, aby timestamp byl aktuální.
export const dynamic = 'force-dynamic'

export function GET() {
  const sha = process.env.RAILWAY_GIT_COMMIT_SHA || process.env.BUILD_COMMIT_SHA || null
  return NextResponse.json({
    status: 'ok',
    service: '5litru-cz',
    node: process.version,
    timestamp: new Date().toISOString(),
    commit: sha,
    commitShort: sha ? sha.slice(0, 7) : null,
    builtAt: process.env.BUILD_TIME || null,
  })
}
