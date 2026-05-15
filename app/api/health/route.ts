import { NextResponse } from 'next/server'

// Railway healthcheck target (railway.toml: healthcheckPath = "/api/health").
// Returns 200 with build/runtime info — no DB query so it stays fast even
// when Supabase is sluggish.
export const dynamic = 'force-static'

export function GET() {
  return NextResponse.json({
    status: 'ok',
    service: '5litru-cz',
    node: process.version,
    timestamp: new Date().toISOString(),
  })
}
