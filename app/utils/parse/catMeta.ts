import { u16LE, u32LE, readUtf16LE } from '../binary'
import { SEX_MAP } from '~/types/save'
import type { CatSex, CatFlags } from '~/types/save'

interface NameSexResult {
  nameLen: number
  nameEndRaw: number
  name: string
  sex: CatSex
}

/**
 * Detect name and sex from a decompressed cat blob.
 * Port of Python's detect_name_end_and_sex.
 *
 * name_len can be at offset 0x0C or 0x10. Name is UTF-16LE at 0x14.
 * Sex is a duplicated u16 enum at name_end + 8 and name_end + 12.
 */
export function detectNameEndAndSex(dec: Uint8Array): NameSexResult {
  let best: { score: number, nameLen: number, nameEndRaw: number, name: string, sex: CatSex } | null = null

  for (const offLen of [0x0C, 0x10]) {
    if (offLen + 4 > dec.length) continue

    const nl = u32LE(dec, offLen)
    if (nl > 128) continue

    const start = 0x14
    const end = start + nl * 2
    if (end > dec.length) continue

    const name = readUtf16LE(dec, start, nl)

    let sex: CatSex = 'Unknown'
    let score = 0

    const offA = end + 8
    const offB = end + 12
    if (offB + 2 <= dec.length) {
      const a = u16LE(dec, offA)
      const b = u16LE(dec, offB)

      if (a === b && a in SEX_MAP) {
        sex = SEX_MAP[a]!
        score += 4
      } else if (a in SEX_MAP || b in SEX_MAP) {
        sex = SEX_MAP[a] ?? SEX_MAP[b] ?? 'Unknown'
        score += 2
      }
    }

    if (name) score += 1

    if (best === null || score > best.score) {
      best = { score, nameLen: nl, nameEndRaw: end, name, sex }
    }
  }

  if (!best) {
    return { nameLen: 0, nameEndRaw: 0x14, name: '', sex: 'Unknown' }
  }
  return { nameLen: best.nameLen, nameEndRaw: best.nameEndRaw, name: best.name, sex: best.sex }
}

/**
 * Read status flags from a decompressed cat blob.
 * Port of Python's read_status_flags.
 */
export function readStatusFlags(dec: Uint8Array, nameEndRaw: number): CatFlags {
  const flagsOff = nameEndRaw + 0x10
  if (flagsOff + 2 > dec.length) {
    return { raw: -1, offset: flagsOff, retired: false, dead: false, donated: false }
  }

  const flags = u16LE(dec, flagsOff)
  return {
    raw: flags,
    offset: flagsOff,
    retired: !!(flags & 0x0002),
    dead: !!(flags & 0x0020),
    donated: !!(flags & 0x4000)
  }
}
