import { u64LE, u32LE, i64LE, isAsciiIdent, readAscii } from '../binary'

interface BirthdayInfo {
  className: string
  level: number | null
  levelOffset: number | null
  birthdayDay: number | null
  birthdayOffset: number | null
}

/**
 * Find (class_name, birthday_day, birthday_off) in a decompressed cat blob.
 * Port of Python's find_birthday_info.
 *
 * Near the end of the blob: <u64 len><ASCII class name>, then 12 bytes later:
 * <i64 birthday_day><i64 -1 sentinel>
 */
export function findBirthdayInfo(dec: Uint8Array, currentDay?: number | null): BirthdayInfo {
  const n = dec.length
  if (n < 64) return { className: '', level: null, levelOffset: null, birthdayDay: null, birthdayOffset: null }

  const AGE_CAP = 500_000

  function accept(bday: number): boolean {
    if (currentDay == null) return true
    const age = currentDay - bday
    return age >= 0 && age <= AGE_CAP
  }

  function scanRange(start: number, end: number): BirthdayInfo | null {
    let best: BirthdayInfo | null = null

    for (let off = start; off < Math.max(start, end - 8); off++) {
      if (off + 8 > n) break

      const ln = Number(u64LE(dec, off))
      if (ln < 3 || ln > 64) continue

      const strOff = off + 8
      const strEnd = strOff + ln
      const bdayOff = strEnd + 12

      if (bdayOff + 16 > n) continue

      if (!isAsciiIdent(dec, strOff, ln)) continue

      const bday = Number(i64LE(dec, bdayOff))
      const sentinel = i64LE(dec, bdayOff + 8)
      if (sentinel !== -1n) continue

      if (!accept(bday)) continue

      const cls = readAscii(dec, strOff, ln)
      // Level is stored as i32 right after the class name string (4 bytes before the f64 xpFraction)
      const levelOffset = strEnd
      const level = strEnd + 4 <= n ? u32LE(dec, levelOffset) : null
      const cand: BirthdayInfo = { className: cls, level: level ?? null, levelOffset, birthdayDay: bday, birthdayOffset: bdayOff }

      // Prefer the last valid candidate (class block is very late in the blob)
      if (best === null || bdayOff > best.birthdayOffset!) {
        best = cand
      }
    }

    return best
  }

  // Prefer scanning near the end (faster + lower false-positive risk)
  const tail = 2048
  const found = scanRange(Math.max(0, n - tail), n)
  if (found) return found

  // Fallback: full scan
  const full = scanRange(0, n)
  if (full) return full

  return { className: '', level: null, levelOffset: null, birthdayDay: null, birthdayOffset: null }
}
