import sharp from 'sharp'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const APP_DIR = join(process.cwd(), 'app')

// SVG zdroj — "5L" monogram
// Tmavé olivové pozadí (#141a0d), "5" bílé, "L" zlaté
// Rounded corners (iOS styl), čitelné v 16px
// Dvě samostatné text vrstvy — "5" bílé, "L" zlaté, ručně centrováno
// viewBox 100x100: Arial Bold 58px "5" ≈ 33px wide, "L" ≈ 28px, mezera 1px → total ~62px → start x=19
const svg = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <rect width="100" height="100" rx="18" fill="#141a0d"/>
  <text x="19" y="72" font-family="Arial Black, Arial, Helvetica, sans-serif" font-weight="900" font-size="58" fill="#f8f6f0">5</text>
  <text x="51" y="72" font-family="Arial Black, Arial, Helvetica, sans-serif" font-weight="900" font-size="58" fill="#c4973e">L</text>
</svg>`

async function renderPng(svgBuf, size) {
  return sharp(svgBuf)
    .resize(size, size, { fit: 'fill' })
    .png()
    .toBuffer()
}

// ICO wrapper — jeden 32x32 PNG chunk
function pngToIco(pngBuf) {
  const dataOffset = 6 + 16  // ICONDIR header + 1 ICONDIRENTRY
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)   // reserved
  header.writeUInt16LE(1, 2)   // type: ICO
  header.writeUInt16LE(1, 4)   // count: 1 image

  const entry = Buffer.alloc(16)
  entry.writeUInt8(32, 0)       // width  (0 = 256)
  entry.writeUInt8(32, 1)       // height (0 = 256)
  entry.writeUInt8(0, 2)        // colorCount
  entry.writeUInt8(0, 3)        // reserved
  entry.writeUInt16LE(1, 4)    // planes
  entry.writeUInt16LE(32, 6)   // bitCount
  entry.writeUInt32LE(pngBuf.length, 8)  // bytesInRes
  entry.writeUInt32LE(dataOffset, 12)    // imageOffset

  return Buffer.concat([header, entry, pngBuf])
}

const svgBuf = Buffer.from(svg)

const [png32, png180, png192, png512] = await Promise.all([
  renderPng(svgBuf, 32),
  renderPng(svgBuf, 180),
  renderPng(svgBuf, 192),
  renderPng(svgBuf, 512),
])

const ico = pngToIco(png32)

writeFileSync(join(APP_DIR, 'favicon.ico'), ico)
writeFileSync(join(APP_DIR, 'apple-icon.png'), png180)
writeFileSync(join(APP_DIR, 'icon.png'), png192)
writeFileSync(join(APP_DIR, 'icon-512.png'), png512)

console.log('favicon.ico   :', ico.length, 'bytes')
console.log('apple-icon.png:', png180.length, 'bytes (180px)')
console.log('icon.png      :', png192.length, 'bytes (192px)')
console.log('icon-512.png  :', png512.length, 'bytes (512px)')
// OG image 1200x630
const ogSvg = `<svg viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#141a0d"/>
  <!-- zelený accent pruh vlevo -->
  <rect x="0" y="0" width="8" height="630" fill="#3d5220"/>
  <!-- velký monogram "5L" v pozadí — dekorativní ghost -->
  <text x="760" y="520" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="480" fill="#1e2a12" opacity="0.8">5L</text>
  <!-- hlavní text -->
  <text x="80" y="220" font-family="Georgia, Times New Roman, serif" font-weight="700" font-size="80" fill="#f8f6f0">5litru.cz</text>
  <text x="82" y="300" font-family="Arial, Helvetica, sans-serif" font-weight="400" font-size="32" fill="#c4973e" letter-spacing="3">OLIVOVÝ OLEJ V 5L BALENÍ</text>
  <line x1="80" y1="340" x2="480" y2="340" stroke="#3d5220" stroke-width="2"/>
  <text x="80" y="410" font-family="Georgia, Times New Roman, serif" font-weight="400" font-size="42" fill="#f8f6f0">Řecký extra panenský olivový olej.</text>
  <text x="80" y="470" font-family="Georgia, Times New Roman, serif" font-weight="400" font-size="42" fill="#7a8a65">Recenze, průvodce, aktuální ceny.</text>
</svg>`

const ogPng = await sharp(Buffer.from(ogSvg))
  .resize(1200, 630, { fit: 'fill' })
  .png()
  .toBuffer()

writeFileSync(join(APP_DIR, 'opengraph-image.png'), ogPng)
console.log('opengraph-image.png:', ogPng.length, 'bytes (1200×630)')
console.log('Done — soubory v app/')
