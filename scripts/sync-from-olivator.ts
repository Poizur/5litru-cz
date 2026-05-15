// CLI wrapper for one-off testing of the Olivator sync.
// Run: env -u ANTHROPIC_API_KEY npx tsx --env-file=.env.local \
//      scripts/sync-from-olivator.ts

import { runOlivatorSync } from '../lib/olivator-sync'

async function main() {
  console.log('Triggering Olivator sync (cli_test)...\n')
  const summary = await runOlivatorSync('cli_test')
  console.log(JSON.stringify(summary, null, 2))
  process.exit(summary.ok ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
