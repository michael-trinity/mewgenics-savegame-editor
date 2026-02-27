import { u32LE, u64LE, isAsciiIdent, readAscii } from '../binary'
import type { U64Str, U64StrTier, AbilitySlot } from '~/types/save'

const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/

/**
 * Parse a contiguous run of [u64 len][ASCII bytes] entries.
 * Port of Python's _parse_u64_run.
 */
export function parseU64Run(dec: Uint8Array, start: number, maxLen = 96, maxItems = 64): { items: U64Str[], end: number } {
  const items: U64Str[] = []
  let i = start
  const n = dec.length

  for (let count = 0; count < maxItems; count++) {
    if (i + 8 > n) break

    const ln = Number(u64LE(dec, i))
    if (ln <= 0 || ln > maxLen || i + 8 + ln > n) break

    if (!isAsciiIdent(dec, i + 8, ln)) break

    const s = readAscii(dec, i + 8, ln)
    if (!IDENT_RE.test(s)) break

    items.push({ offset: i, byteLength: ln, value: s })
    i += 8 + ln
  }

  return { items, end: i }
}

/**
 * Parse consecutive [u64 len][ASCII][u32 tier] entries.
 * Port of Python's parse_u64_tier_entries.
 */
export function parseU64TierEntries(dec: Uint8Array, startOff: number, count = 3, maxLen = 96): U64StrTier[] {
  const out: U64StrTier[] = []
  let o = startOff
  const n = dec.length

  for (let i = 0; i < count; i++) {
    if (o + 8 > n) break

    const ln = Number(u64LE(dec, o))
    if (ln <= 0 || ln > maxLen || o + 8 + ln + 4 > n) break

    if (!isAsciiIdent(dec, o + 8, ln)) break
    const s = readAscii(dec, o + 8, ln)

    const tier = u32LE(dec, o + 8 + ln)
    if (tier <= 0 || tier > 50) break

    out.push({ offset: o, byteLength: ln, value: s, tier })
    o = o + 8 + ln + 4
  }

  return out
}

/**
 * Find the primary ability run and parse ability slots.
 * Port of Python's find_primary_ability_run.
 *
 * Pattern: contiguous u64-string run starting with "DefaultMove", length >= 11,
 * followed by u32 Passive1 tier, then 3 tail entries [u64 len][ASCII][u32 tier].
 */
export function findPrimaryAbilityRun(dec: Uint8Array): {
  runItems: U64Str[]
  runEnd: number
  passive1Tier: number
  tailEntries: U64StrTier[]
} | null {
  const n = dec.length

  for (let start = 0; start < n - 32; start++) {
    const { items, end } = parseU64Run(dec, start, 96, 32)
    if (items.length < 11) continue
    if (items[0]!.value !== 'DefaultMove') continue

    // Passive1 tier immediately after the run
    if (end + 4 > n) continue
    const p1Tier = u32LE(dec, end)
    if (p1Tier <= 0 || p1Tier > 50) continue

    const tail = parseU64TierEntries(dec, end + 4, 3, 96)
    if (tail.length !== 3) continue

    return { runItems: items, runEnd: end, passive1Tier: p1Tier, tailEntries: tail }
  }

  return null
}

/**
 * Build the ability slot list from the primary run + tail entries.
 */
export function buildAbilitySlots(dec: Uint8Array): AbilitySlot[] {
  const result = findPrimaryAbilityRun(dec)
  if (!result) return []

  const { runItems, runEnd, passive1Tier, tailEntries } = result
  const runStart = runItems[0]!.offset
  const slots: AbilitySlot[] = []

  // Active1-6: items[0..5]
  const activeLabels = ['Active1 (DefaultMove)', 'Active2 (BasicAttack)', 'Active3', 'Active4', 'Active5', 'Active6']
  for (let i = 0; i < 6 && i < runItems.length; i++) {
    slots.push({
      label: activeLabels[i]!,
      kind: 'u64run',
      abilityId: runItems[i]!.value,
      runStart,
      runEnd,
      runIndex: i
    })
  }

  // Passive1: item[10] from the run
  if (runItems.length > 10) {
    slots.push({
      label: 'Passive1',
      kind: 'u64run',
      abilityId: runItems[10]!.value,
      tier: passive1Tier,
      runStart,
      runEnd,
      runIndex: 10
    })
  }

  // Tail entries: Passive2, Disorder1, Disorder2
  const tailLabels = ['Passive2', 'Disorder1', 'Disorder2']
  for (let i = 0; i < tailEntries.length; i++) {
    const entry = tailEntries[i]!
    slots.push({
      label: tailLabels[i]!,
      kind: 'u64tier',
      abilityId: entry.value,
      tier: entry.tier,
      recordOffset: entry.offset,
      byteLength: entry.byteLength
    })
  }

  return slots
}
