// サンプルテクスチャ (PoC 動作確認用) を public/textures/samples/ に生成する。
// 実運用では Arch-LOG 等の実テクスチャ画像に差し替える。
//   node scripts/generate-sample-textures.mjs

import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SIZE = 256
const outDir = join(dirname(fileURLToPath(import.meta.url)), '../public/textures/samples')
mkdirSync(outDir, { recursive: true })

function crc32(buf) {
  let table = crc32.table
  if (!table) {
    table = crc32.table = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      table[n] = c
    }
  }
  let crc = -1
  for (const b of buf) crc = (crc >>> 8) ^ table[(crc ^ b) & 0xff]
  return (crc ^ -1) >>> 0
}

function chunk(type, data) {
  const buf = Buffer.alloc(8 + data.length + 4)
  buf.writeUInt32BE(data.length, 0)
  buf.write(type, 4, 'ascii')
  data.copy(buf, 8)
  buf.writeUInt32BE(crc32(buf.subarray(4, 8 + data.length)), 8 + data.length)
  return buf
}

function writePng(path, pixelFn) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(SIZE, 0)
  ihdr.writeUInt32BE(SIZE, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type: RGB
  const raw = Buffer.alloc(SIZE * (SIZE * 3 + 1))
  for (let y = 0; y < SIZE; y++) {
    const rowStart = y * (SIZE * 3 + 1)
    raw[rowStart] = 0 // filter: none
    for (let x = 0; x < SIZE; x++) {
      const [r, g, b] = pixelFn(x, y)
      const i = rowStart + 1 + x * 3
      raw[i] = r
      raw[i + 1] = g
      raw[i + 2] = b
    }
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ])
  writeFileSync(path, png)
  console.log(`generated: ${path}`)
}

// 擬似乱数 (シード固定で再現可能に)
let seed = 42
function rand() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed / 0x7fffffff
}

// コンクリート: グレーのノイズ
writePng(join(outDir, 'concrete.png'), () => {
  const v = 150 + Math.floor(rand() * 40)
  return [v, v, v - 4]
})

// 木材: 茶系の縦縞 + ゆらぎ
writePng(join(outDir, 'wood.png'), (x, y) => {
  const wave = Math.sin(x * 0.25 + Math.sin(y * 0.02) * 3) * 18
  const base = 120 + wave + rand() * 12
  return [Math.floor(base), Math.floor(base * 0.62), Math.floor(base * 0.34)]
})

// れんが: 目地入りのレンガパターン
writePng(join(outDir, 'brick.png'), (x, y) => {
  const brickH = 32
  const brickW = 64
  const row = Math.floor(y / brickH)
  const offsetX = row % 2 === 0 ? 0 : brickW / 2
  const inJointY = y % brickH < 3
  const inJointX = (x + offsetX) % brickW < 3
  if (inJointY || inJointX) return [200, 195, 188]
  const v = rand() * 20
  return [165 + v, 75 + v * 0.5, 55]
})
