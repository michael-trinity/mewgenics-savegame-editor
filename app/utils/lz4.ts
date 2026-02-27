import { u32LE, writeU32LE } from './binary'
import type { LZ4Variant } from '~/types/save'

// lz4-wasm: Rust lz4_flex compiled to WASM — spec-compliant LZ4 block format.
// compress() returns [u32 LE uncompLen][raw_lz4_block]
// decompress() expects [u32 LE uncompLen][raw_lz4_block]
// This matches our Variant A format exactly.
import { compress as lz4Compress, decompress as lz4Decompress } from 'lz4-wasm'

export interface DecompressResult {
  data: Uint8Array
  variant: LZ4Variant
}

/**
 * Detect LZ4 variant and decompress a cat blob.
 *
 * Variant A: [u32 uncompressed_len][lz4_stream...]
 * Variant B: [u32 uncompressed_len][u32 compressed_len][lz4_stream(compressed_len)]
 */
export async function decompressCatBlob(wrapped: Uint8Array): Promise<DecompressResult> {
  if (wrapped.length < 4) {
    throw new Error('Wrapped blob too small')
  }

  const uncompLen = u32LE(wrapped, 0)

  // Try variant B first: [u32 uncomp][u32 comp][stream]
  if (wrapped.length >= 8) {
    const compLen = u32LE(wrapped, 4)
    if (compLen > 0 && compLen <= wrapped.length - 8) {
      try {
        // Build a variant-A style buffer for lz4-wasm: [u32 uncompLen][stream]
        const lz4Input = new Uint8Array(4 + compLen)
        writeU32LE(lz4Input, 0, uncompLen)
        lz4Input.set(wrapped.subarray(8, 8 + compLen), 4)
        const data = lz4Decompress(lz4Input)
        if (data.length === uncompLen) {
          return { data, variant: 'B' }
        }
      } catch {
        // Fall through to variant A
      }
    }
  }

  // Variant A: [u32 uncomp][stream] — already in lz4-wasm format
  const data = lz4Decompress(wrapped)
  if (data.length !== uncompLen) {
    throw new Error('LZ4 decompression failed: size mismatch')
  }
  return { data, variant: 'A' }
}

/**
 * Recompress a decompressed cat blob back to the original variant format.
 *
 * Uses lz4-wasm (Rust lz4_flex) which produces spec-compliant LZ4 block output,
 * compatible with C#/.NET LZ4 decompressors (K4os, lz4net, etc.).
 */
export async function recompressCatBlob(dec: Uint8Array, variant: LZ4Variant): Promise<Uint8Array> {
  // lz4-wasm compress returns [u32 LE uncompLen][raw_lz4_block]
  const compressed = lz4Compress(dec)

  if (variant === 'A') {
    // Variant A is exactly the lz4-wasm output format: [u32 uncompLen][stream]
    return compressed
  }

  // Variant B: [u32 uncompLen][u32 compLen][stream]
  // Extract the raw stream from the lz4-wasm output (skip the prepended u32 uncompLen)
  const rawStream = compressed.subarray(4)
  const result = new Uint8Array(8 + rawStream.length)
  writeU32LE(result, 0, dec.length)
  writeU32LE(result, 4, rawStream.length)
  result.set(rawStream, 8)
  return result
}
