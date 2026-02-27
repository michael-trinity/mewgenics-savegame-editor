// All reads are little-endian, matching the Mewgenics save format.

const decoder = new TextDecoder('utf-16le')
const asciiDecoder = new TextDecoder('ascii')

export function u16LE(buf: Uint8Array, off: number): number {
  return buf[off]! | (buf[off + 1]! << 8)
}

export function u32LE(buf: Uint8Array, off: number): number {
  return (
    buf[off]!
    | (buf[off + 1]! << 8)
    | (buf[off + 2]! << 16)
    | ((buf[off + 3]! << 24) >>> 0)
  ) >>> 0
}

export function u64LE(buf: Uint8Array, off: number): bigint {
  const lo = BigInt(u32LE(buf, off))
  const hi = BigInt(u32LE(buf, off + 4))
  return lo | (hi << 32n)
}

export function i64LE(buf: Uint8Array, off: number): bigint {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  return view.getBigInt64(off, true)
}

export function f32LE(buf: Uint8Array, off: number): number {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  return view.getFloat32(off, true)
}

export function f64LE(buf: Uint8Array, off: number): number {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  return view.getFloat64(off, true)
}

// Write helpers

export function writeU16LE(buf: Uint8Array, off: number, val: number): void {
  buf[off] = val & 0xFF
  buf[off + 1] = (val >> 8) & 0xFF
}

export function writeU32LE(buf: Uint8Array, off: number, val: number): void {
  buf[off] = val & 0xFF
  buf[off + 1] = (val >> 8) & 0xFF
  buf[off + 2] = (val >> 16) & 0xFF
  buf[off + 3] = (val >> 24) & 0xFF
}

export function writeI32LE(buf: Uint8Array, off: number, val: number): void {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  view.setInt32(off, val, true)
}

export function writeU64LE(buf: Uint8Array, off: number, val: bigint): void {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  view.setBigUint64(off, val, true)
}

export function writeI64LE(buf: Uint8Array, off: number, val: bigint): void {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  view.setBigInt64(off, val, true)
}

// String helpers

export function readUtf16LE(buf: Uint8Array, off: number, codeUnits: number): string {
  const slice = buf.slice(off, off + codeUnits * 2)
  return decoder.decode(slice).replace(/\0+$/, '')
}

export function readAscii(buf: Uint8Array, off: number, len: number): string {
  const slice = buf.slice(off, off + len)
  return asciiDecoder.decode(slice)
}

export function isAsciiIdent(buf: Uint8Array, off: number, len: number): boolean {
  if (len <= 0) return false
  for (let i = 0; i < len; i++) {
    const c = buf[off + i]!
    if (c < 32 || c >= 127) return false
    if (c === 0) return false
  }
  try {
    const s = readAscii(buf, off, len)
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(s)
  } catch {
    return false
  }
}

// Pack helpers — return new Uint8Array

export function packU32(val: number): Uint8Array {
  const buf = new Uint8Array(4)
  writeU32LE(buf, 0, val)
  return buf
}

export function packU64(val: bigint): Uint8Array {
  const buf = new Uint8Array(8)
  writeU64LE(buf, 0, val)
  return buf
}

export function packI32x7(values: number[]): Uint8Array {
  const buf = new Uint8Array(28)
  for (let i = 0; i < 7; i++) {
    writeI32LE(buf, i * 4, values[i]!)
  }
  return buf
}

// Concatenate multiple Uint8Arrays
export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLen = arrays.reduce((acc, a) => acc + a.length, 0)
  const result = new Uint8Array(totalLen)
  let offset = 0
  for (const arr of arrays) {
    result.set(arr, offset)
    offset += arr.length
  }
  return result
}

// Find byte pattern in buffer (like Python bytes.find)
export function findBytes(haystack: Uint8Array, needle: Uint8Array, start = 0): number {
  const hLen = haystack.length
  const nLen = needle.length
  if (nLen === 0) return start
  const end = hLen - nLen
  outer:
  for (let i = start; i <= end; i++) {
    for (let j = 0; j < nLen; j++) {
      if (haystack[i + j] !== needle[j]) continue outer
    }
    return i
  }
  return -1
}

// Slice comparison
export function bytesEqual(a: Uint8Array, b: Uint8Array, aOff: number, bOff: number, len: number): boolean {
  for (let i = 0; i < len; i++) {
    if (a[aOff + i] !== b[bOff + i]) return false
  }
  return true
}
