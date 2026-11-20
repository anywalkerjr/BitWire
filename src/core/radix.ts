import { bitMask } from './operators';

export type Radix = 'BIN' | 'OCT' | 'DEC' | 'HEX';

export const RADIX_OPTIONS: readonly Radix[] = ['BIN', 'OCT', 'DEC', 'HEX'] as const;

export const RADIX_BASE: Record<Radix, number> = {
  BIN: 2,
  OCT: 8,
  DEC: 10,
  HEX: 16,
};

export const RADIX_PREFIX: Record<Radix, string> = {
  BIN: '0b',
  OCT: '0o',
  DEC: '',
  HEX: '0x',
};

const RADIX_REGEX: Record<Radix, RegExp> = {
  BIN: /^[01]+$/,
  OCT: /^[0-7]+$/,
  DEC: /^[0-9]+$/,
  HEX: /^[0-9a-fA-F]+$/,
};

export interface VariableConstraint {
  maxOnes?: number;
  maxBits?: number;
  description: string;
}

export interface VariableValidationResult {
  valid: boolean;
  value: bigint | null;
  onesCount: number | null;
  error: string | null;
}

/** Formats a BigInt value in the requested radix, zero-padding BIN to `bits` width. */
export function formatValue(value: bigint | null, radix: Radix, bits: number): string {
  if (value === null) {
    return radix === 'BIN' ? '-'.repeat(bits) : '--';
  }
  const masked = value & bitMask(bits);
  switch (radix) {
    case 'BIN':
      return masked.toString(2).padStart(bits, '0');
    case 'OCT':
      return masked.toString(8);
    case 'DEC':
      return masked.toString(10);
    case 'HEX':
      return masked.toString(16).toUpperCase().padStart(Math.ceil(bits / 4), '0');
  }
}

/** Counts the number of `1` bits (Hamming weight / popcount) in a non-negative BigInt. */
export function countOnes(value: bigint): number {
  let n = value < 0n ? 0n : value;
  let count = 0;
  while (n > 0n) {
    if ((n & 1n) === 1n) count += 1;
    n >>= 1n;
  }
  return count;
}

/** Returns minimum number of bits required to represent `value` (0 takes 0 bits). */
export function bitLength(value: bigint): number {
  if (value <= 0n) return 0;
  return value.toString(2).length;
}

/** Parses a string in the specified radix into a BigInt, or returns null if invalid syntax. */
export function parseRadixString(raw: string, radix: Radix): bigint | null {
  let cleaned = raw.trim().replace(/[\s_]/g, '');
  if (!cleaned) return null;

  // Strip optional standard radix prefix if user typed it
  if (radix === 'BIN' && /^0[bB]/.test(cleaned)) cleaned = cleaned.slice(2);
  if (radix === 'OCT' && /^0[oO]/.test(cleaned)) cleaned = cleaned.slice(2);
  if (radix === 'HEX' && /^0[xX]/.test(cleaned)) cleaned = cleaned.slice(2);

  if (!cleaned || !RADIX_REGEX[radix].test(cleaned)) {
    return null;
  }

  try {
    if (radix === 'BIN') return BigInt('0b' + cleaned);
    if (radix === 'OCT') return BigInt('0o' + cleaned);
    if (radix === 'HEX') return BigInt('0x' + cleaned);
    return BigInt(cleaned);
  } catch {
    return null;
  }
}

/** Validates player input for editable Variable B against radix syntax, bit-width, and level constraints. */
export function validateVariableInput(
  raw: string,
  radix: Radix,
  bits: number,
  constraint?: VariableConstraint
): VariableValidationResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      valid: false,
      value: null,
      onesCount: null,
      error: `Enter a ${radix} value (0 to ${formatValue(bitMask(bits), radix, bits)}).`,
    };
  }

  const parsed = parseRadixString(trimmed, radix);
  if (parsed === null) {
    const allowed: Record<Radix, string> = {
      BIN: '0-1',
      OCT: '0-7',
      DEC: '0-9',
      HEX: '0-9, A-F',
    };
    return {
      valid: false,
      value: null,
      onesCount: null,
      error: `Invalid ${radix} syntax. Allowed digits: ${allowed[radix]}.`,
    };
  }

  const maxAllowed = bitMask(bits);
  if (parsed < 0n || parsed > maxAllowed) {
    return {
      valid: false,
      value: null,
      onesCount: null,
      error: `Out of ${bits}-bit range (max ${formatValue(maxAllowed, radix, bits)} in ${radix}).`,
    };
  }

  const ones = countOnes(parsed);

  if (constraint?.maxBits !== undefined && bitLength(parsed) > constraint.maxBits) {
    return {
      valid: false,
      value: parsed,
      onesCount: ones,
      error: `Constraint violated: exceeds ${constraint.maxBits}-bit limit (max ${formatValue(bitMask(constraint.maxBits), radix, bits)}).`,
    };
  }

  if (constraint?.maxOnes !== undefined && ones > constraint.maxOnes) {
    return {
      valid: false,
      value: parsed,
      onesCount: ones,
      error: `Constraint violated: ${ones} active 1-bits exceeds maxOnes (${constraint.maxOnes}).`,
    };
  }

  return {
    valid: true,
    value: parsed,
    onesCount: ones,
    error: null,
  };
}
