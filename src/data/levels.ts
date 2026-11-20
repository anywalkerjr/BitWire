import { OperatorType } from '../core/operators';
import { VariableConstraint } from '../core/radix';

export type VariableKey = 'A' | 'B' | 'C';
export type OutputFault = 'INVERT';

export interface InventoryAllowance {
  type: OperatorType;
  count: number;
}

export interface VariableConfig {
  key: VariableKey;
  initialValue: bigint;
  editable: boolean;
  constraint?: VariableConstraint;
}

export interface OutputPortSpec {
  id: string;
  label: string;
  shortLabel?: string;
  targetValue: bigint;
  outputFault?: OutputFault;
}

export interface LevelTestCase {
  id: string;
  label: string;
  inputs: Partial<Record<VariableKey, bigint>>;
  target?: bigint;
  targets?: Record<string, bigint>;
}

export interface LevelDefinition {
  id: string;
  chapter: 1 | 2 | 3 | 4;
  chapterTitle: string;
  number: number;
  title: string;
  objective: string;
  bits: number;
  variables: VariableConfig[];
  targetValue: bigint;
  outputs?: OutputPortSpec[];
  testCases?: LevelTestCase[];
  inventory: InventoryAllowance[];
  mustUseAllGates?: boolean;
  outputFault?: OutputFault;
}

export interface ChapterGroup {
  chapter: 1 | 2 | 3 | 4;
  heading: string;
  levels: LevelDefinition[];
}

export function getLevelOutputs(level: LevelDefinition): OutputPortSpec[] {
  if (level.outputs && level.outputs.length > 0) {
    return level.outputs;
  }
  return [
    {
      id: 'OUT',
      label: 'OUT',
      targetValue: level.targetValue,
      outputFault: level.outputFault,
    },
  ];
}

export function getExpectedTargetsForTest(
  level: LevelDefinition,
  testCase?: LevelTestCase
): Record<string, bigint> {
  const outputs = getLevelOutputs(level);
  const map: Record<string, bigint> = {};
  for (const out of outputs) {
    if (testCase?.targets && testCase.targets[out.id] !== undefined) {
      map[out.id] = testCase.targets[out.id];
    } else if (testCase?.target !== undefined && outputs.length === 1) {
      map[out.id] = testCase.target;
    } else {
      map[out.id] = out.targetValue;
    }
  }
  return map;
}

export const LEVELS: readonly LevelDefinition[] = [
  // =========================================================================
  // CHAPTER 1: BASICS & EDITABLE B (Levels 1-5)
  // =========================================================================
  {
    id: 'lvl-01',
    chapter: 1,
    chapterTitle: 'BASICS',
    number: 1,
    title: 'Inverter',
    objective: 'Invert input A to match OUT. Try switching radix modes in the top bar.',
    bits: 4,
    variables: [{ key: 'A', initialValue: 0b0110n, editable: false }],
    targetValue: 0b1001n,
    inventory: [{ type: 'NOT', count: 1 }],
  },
  {
    id: 'lvl-02',
    chapter: 1,
    chapterTitle: 'BASICS',
    number: 2,
    title: 'Bitwise OR',
    objective: 'Set editable variable B (max 1 active bit) in Variables and combine with OR.',
    bits: 4,
    variables: [
      { key: 'A', initialValue: 0b1010n, editable: false },
      {
        key: 'B',
        initialValue: 0b0000n,
        editable: true,
        constraint: {
          maxOnes: 1,
          description: 'MAX 1 BIT SET (popcount <= 1)',
        },
      },
    ],
    targetValue: 0b1110n,
    inventory: [{ type: 'OR', count: 1 }],
  },
  {
    id: 'lvl-03',
    chapter: 1,
    chapterTitle: 'BASICS',
    number: 3,
    title: 'Bitwise XOR',
    objective: 'Flip targeted bits of A using XOR with up to 2 active bits in B.',
    bits: 4,
    variables: [
      { key: 'A', initialValue: 0b1100n, editable: false },
      {
        key: 'B',
        initialValue: 0b0000n,
        editable: true,
        constraint: {
          maxOnes: 2,
          description: 'MAX 2 BITS SET (popcount <= 2)',
        },
      },
    ],
    targetValue: 0b0110n,
    inventory: [{ type: 'XOR', count: 1 }],
  },
  {
    id: 'lvl-04',
    chapter: 1,
    chapterTitle: 'BASICS',
    number: 4,
    title: 'Implication',
    objective: 'Wire A and B into IMP (A -> B is non-commutative: ~A | B).',
    bits: 4,
    variables: [
      { key: 'A', initialValue: 0b1010n, editable: false },
      {
        key: 'B',
        initialValue: 0b0000n,
        editable: true,
        constraint: {
          maxOnes: 1,
          description: 'MAX 1 BIT SET (popcount <= 1)',
        },
      },
    ],
    targetValue: 0b0111n,
    inventory: [
      { type: 'IMP', count: 1 },
      { type: 'NOT', count: 1 },
    ],
  },
  {
    id: 'lvl-05',
    chapter: 1,
    chapterTitle: 'BASICS',
    number: 5,
    title: 'Sheffer NAND',
    objective: 'Zero a single bit position with NAND using a 1-bit mask in B.',
    bits: 4,
    variables: [
      { key: 'A', initialValue: 0b1101n, editable: false },
      {
        key: 'B',
        initialValue: 0b0000n,
        editable: true,
        constraint: {
          maxOnes: 1,
          description: 'MAX 1 BIT SET (popcount <= 1)',
        },
      },
    ],
    targetValue: 0b1011n,
    inventory: [{ type: 'NAND', count: 1 }],
  },

  // =========================================================================
  // CHAPTER 2: CHAINS & CONSTRAINTS (Levels 6-10)
  // =========================================================================
  {
    id: 'lvl-06',
    chapter: 2,
    chapterTitle: 'CHAINS & CONSTRAINTS',
    number: 6,
    title: 'Locked Mask',
    objective: 'Both A and B are locked. Build a 2-gate chain to synthesize NAND from AND + NOT.',
    bits: 4,
    variables: [
      { key: 'A', initialValue: 0b1010n, editable: false },
      { key: 'B', initialValue: 0b1100n, editable: false },
    ],
    targetValue: 0b0111n,
    inventory: [
      { type: 'AND', count: 1 },
      { type: 'NOT', count: 1 },
    ],
    mustUseAllGates: true,
  },
  {
    id: 'lvl-07',
    chapter: 2,
    chapterTitle: 'CHAINS & CONSTRAINTS',
    number: 7,
    title: 'Three-Way Bus',
    objective: 'Combine three fixed registers A, B, and C through an AND -> OR cascade.',
    bits: 4,
    variables: [
      { key: 'A', initialValue: 0b1010n, editable: false },
      { key: 'B', initialValue: 0b1100n, editable: false },
      { key: 'C', initialValue: 0b0011n, editable: false },
    ],
    targetValue: 0b1011n,
    inventory: [
      { type: 'AND', count: 1 },
      { type: 'OR', count: 1 },
    ],
    mustUseAllGates: true,
  },
  {
    id: 'lvl-08',
    chapter: 2,
    chapterTitle: 'CHAINS & CONSTRAINTS',
    number: 8,
    title: 'Signal Filter',
    objective: 'Filter A ^ B using an inverted C mask across all three gates.',
    bits: 4,
    variables: [
      { key: 'A', initialValue: 0b1110n, editable: false },
      { key: 'B', initialValue: 0b0101n, editable: false },
      { key: 'C', initialValue: 0b0011n, editable: false },
    ],
    targetValue: 0b1000n,
    inventory: [
      { type: 'XOR', count: 1 },
      { type: 'AND', count: 1 },
      { type: 'NOT', count: 1 },
    ],
    mustUseAllGates: true,
  },
  {
    id: 'lvl-09',
    chapter: 2,
    chapterTitle: 'CHAINS & CONSTRAINTS',
    number: 9,
    title: 'NOR Injection',
    objective: 'Combine fixed A and B with NOR, then inject a 1-bit editable C via OR.',
    bits: 4,
    variables: [
      { key: 'A', initialValue: 0b1001n, editable: false },
      { key: 'B', initialValue: 0b0101n, editable: false },
      {
        key: 'C',
        initialValue: 0b0000n,
        editable: true,
        constraint: {
          maxOnes: 1,
          description: 'MAX 1 BIT SET (popcount <= 1)',
        },
      },
    ],
    targetValue: 0b1010n,
    inventory: [
      { type: 'NOR', count: 1 },
      { type: 'OR', count: 1 },
    ],
    mustUseAllGates: true,
  },
  {
    id: 'lvl-10',
    chapter: 2,
    chapterTitle: 'CHAINS & CONSTRAINTS',
    number: 10,
    title: 'Logic Chain',
    objective: 'Ch.2 Boss: Route fixed A, B, and C through an IMP and XOR chain to reach 1101.',
    bits: 4,
    variables: [
      { key: 'A', initialValue: 0b1100n, editable: false },
      { key: 'B', initialValue: 0b1010n, editable: false },
      { key: 'C', initialValue: 0b0110n, editable: false },
    ],
    targetValue: 0b1101n,
    inventory: [
      { type: 'IMP', count: 1 },
      { type: 'XOR', count: 1 },
    ],
    mustUseAllGates: true,
  },

  // =========================================================================
  // CHAPTER 3: UNIVERSAL BASES & FAULTS (Levels 11-15)
  // =========================================================================
  {
    id: 'lvl-11',
    chapter: 3,
    chapterTitle: 'UNIVERSAL BASES & FAULTS',
    number: 11,
    title: "Sheffer's Inverter",
    objective: 'Build NOT A using only a single NAND gate (wire A into both inputs).',
    bits: 4,
    variables: [{ key: 'A', initialValue: 0b1010n, editable: false }],
    targetValue: 0b0101n,
    inventory: [{ type: 'NAND', count: 1 }],
  },
  {
    id: 'lvl-12',
    chapter: 3,
    chapterTitle: 'UNIVERSAL BASES & FAULTS',
    number: 12,
    title: "Sheffer's AND",
    objective: 'Construct A AND B using only NAND gates.',
    bits: 4,
    variables: [
      { key: 'A', initialValue: 0b1101n, editable: false },
      { key: 'B', initialValue: 0b1011n, editable: false },
    ],
    targetValue: 0b1001n,
    inventory: [{ type: 'NAND', count: 2 }],
    mustUseAllGates: true,
  },
  {
    id: 'lvl-13',
    chapter: 3,
    chapterTitle: 'UNIVERSAL BASES & FAULTS',
    number: 13,
    title: "Peirce's OR",
    objective: 'Construct A OR B using only NOR gates.',
    bits: 4,
    variables: [
      { key: 'A', initialValue: 0b1001n, editable: false },
      { key: 'B', initialValue: 0b0011n, editable: false },
    ],
    targetValue: 0b1011n,
    inventory: [{ type: 'NOR', count: 2 }],
    mustUseAllGates: true,
  },
  {
    id: 'lvl-14',
    chapter: 3,
    chapterTitle: 'UNIVERSAL BASES & FAULTS',
    number: 14,
    title: 'Faulty Output Port',
    objective: 'OUT port is damaged and inverts incoming bits! Compensate for the fault.',
    bits: 4,
    variables: [
      { key: 'A', initialValue: 0b1100n, editable: false },
      { key: 'B', initialValue: 0b1010n, editable: false },
    ],
    targetValue: 0b1001n,
    outputFault: 'INVERT',
    inventory: [{ type: 'XOR', count: 1 }],
  },
  {
    id: 'lvl-15',
    chapter: 3,
    chapterTitle: 'UNIVERSAL BASES & FAULTS',
    number: 15,
    title: 'Universal XOR',
    objective: 'Classic discrete math challenge: build A XOR B using strictly 4 NAND gates.',
    bits: 4,
    variables: [
      { key: 'A', initialValue: 0b1100n, editable: false },
      { key: 'B', initialValue: 0b1010n, editable: false },
    ],
    targetValue: 0b0110n,
    inventory: [{ type: 'NAND', count: 4 }],
    mustUseAllGates: true,
  },

  // =========================================================================
  // CHAPTER 4: 8-BIT, MULTI-TEST & DUAL OUTPUTS (Levels 16-20)
  // =========================================================================
  {
    id: 'lvl-16',
    chapter: 4,
    chapterTitle: '8-BIT, MULTI-TEST & DUAL OUTPUTS',
    number: 16,
    title: 'Byte Inverter Mask',
    objective:
      '8-bit mode unlocked! Flip only the upper 4 bits of A using inverted B. Try switching to HEX.',
    bits: 8,
    variables: [
      { key: 'A', initialValue: 0b11001010n, editable: false },
      { key: 'B', initialValue: 0b00001111n, editable: false },
    ],
    targetValue: 0b00111010n,
    inventory: [
      { type: 'NOT', count: 1 },
      { type: 'XOR', count: 1 },
    ],
    mustUseAllGates: true,
  },
  {
    id: 'lvl-17',
    chapter: 4,
    chapterTitle: '8-BIT, MULTI-TEST & DUAL OUTPUTS',
    number: 17,
    title: 'Multi-Test Bit Setter',
    objective:
      'Set the least significant bit (LSB) to 1 across ALL 3 test cases using a constant mask B.',
    bits: 4,
    variables: [
      { key: 'A', initialValue: 0b0000n, editable: false },
      {
        key: 'B',
        initialValue: 0b0000n,
        editable: true,
        constraint: {
          maxOnes: 1,
          description: 'MAX 1 BIT SET (popcount <= 1)',
        },
      },
    ],
    targetValue: 0b0001n,
    testCases: [
      { id: 't1', label: 'TEST 1', inputs: { A: 0b0000n }, target: 0b0001n },
      { id: 't2', label: 'TEST 2', inputs: { A: 0b1010n }, target: 0b1011n },
      { id: 't3', label: 'TEST 3', inputs: { A: 0b0111n }, target: 0b0111n },
    ],
    inventory: [{ type: 'OR', count: 1 }],
  },
  {
    id: 'lvl-18',
    chapter: 4,
    chapterTitle: '8-BIT, MULTI-TEST & DUAL OUTPUTS',
    number: 18,
    title: 'Multi-Test Middle Flip',
    objective:
      'Invert ONLY the two middle bits of A across all 3 test cases using constant mask B.',
    bits: 4,
    variables: [
      { key: 'A', initialValue: 0b0000n, editable: false },
      {
        key: 'B',
        initialValue: 0b0000n,
        editable: true,
        constraint: {
          maxOnes: 2,
          description: 'MAX 2 BITS SET (popcount <= 2)',
        },
      },
    ],
    targetValue: 0b0110n,
    testCases: [
      { id: 't1', label: 'TEST 1', inputs: { A: 0b0000n }, target: 0b0110n },
      { id: 't2', label: 'TEST 2', inputs: { A: 0b1111n }, target: 0b1001n },
      { id: 't3', label: 'TEST 3', inputs: { A: 0b1010n }, target: 0b1100n },
    ],
    inventory: [{ type: 'XOR', count: 1 }],
  },
  {
    id: 'lvl-19',
    chapter: 4,
    chapterTitle: '8-BIT, MULTI-TEST & DUAL OUTPUTS',
    number: 19,
    title: 'Half Adder',
    objective:
      'Build a bitwise Half Adder: route SUM (A XOR B) to OUT 1 and CARRY (A AND B) to OUT 2.',
    bits: 4,
    variables: [
      { key: 'A', initialValue: 0b0101n, editable: false },
      { key: 'B', initialValue: 0b0011n, editable: false },
    ],
    targetValue: 0b0110n,
    outputs: [
      { id: 'OUT1', label: 'OUT 1 (SUM)', shortLabel: 'SUM', targetValue: 0b0110n },
      { id: 'OUT2', label: 'OUT 2 (CARRY)', shortLabel: 'CARRY', targetValue: 0b0001n },
    ],
    testCases: [
      {
        id: 't1',
        label: 'TEST 1',
        inputs: { A: 0b0101n, B: 0b0011n },
        targets: { OUT1: 0b0110n, OUT2: 0b0001n },
      },
      {
        id: 't2',
        label: 'TEST 2',
        inputs: { A: 0b1100n, B: 0b1010n },
        targets: { OUT1: 0b0110n, OUT2: 0b1000n },
      },
      {
        id: 't3',
        label: 'TEST 3',
        inputs: { A: 0b1111n, B: 0b1111n },
        targets: { OUT1: 0b0000n, OUT2: 0b1111n },
      },
    ],
    inventory: [
      { type: 'XOR', count: 1 },
      { type: 'AND', count: 1 },
    ],
    mustUseAllGates: true,
  },
  {
    id: 'lvl-20',
    chapter: 4,
    chapterTitle: '8-BIT, MULTI-TEST & DUAL OUTPUTS',
    number: 20,
    title: 'Byte Splitter',
    objective:
      'Split 8-bit A into two halves: route lower nibble to OUT 1 (LOW) and upper nibble to OUT 2 (HIGH).',
    bits: 8,
    variables: [
      { key: 'A', initialValue: 0b10101100n, editable: false },
      { key: 'B', initialValue: 0b00001111n, editable: false },
    ],
    targetValue: 0b00001100n,
    outputs: [
      { id: 'OUT1', label: 'OUT 1 (LOW)', shortLabel: 'LOW', targetValue: 0b00001100n },
      { id: 'OUT2', label: 'OUT 2 (HIGH)', shortLabel: 'HIGH', targetValue: 0b10100000n },
    ],
    testCases: [
      {
        id: 't1',
        label: 'TEST 1',
        inputs: { A: 0b10101100n, B: 0b00001111n },
        targets: { OUT1: 0b00001100n, OUT2: 0b10100000n },
      },
      {
        id: 't2',
        label: 'TEST 2',
        inputs: { A: 0b11110011n, B: 0b00001111n },
        targets: { OUT1: 0b00000011n, OUT2: 0b11110000n },
      },
    ],
    inventory: [
      { type: 'AND', count: 2 },
      { type: 'NOT', count: 1 },
    ],
    mustUseAllGates: true,
  },
] as const;

export const CHAPTER_GROUPS: readonly ChapterGroup[] = [
  {
    chapter: 1,
    heading: 'CHAPTER 1: BASICS',
    levels: LEVELS.filter((lvl) => lvl.chapter === 1),
  },
  {
    chapter: 2,
    heading: 'CHAPTER 2: CHAINS & CONSTRAINTS',
    levels: LEVELS.filter((lvl) => lvl.chapter === 2),
  },
  {
    chapter: 3,
    heading: 'CHAPTER 3: UNIVERSAL BASES & FAULTS',
    levels: LEVELS.filter((lvl) => lvl.chapter === 3),
  },
  {
    chapter: 4,
    heading: 'CHAPTER 4: 8-BIT, MULTI-TEST & DUAL OUTPUTS',
    levels: LEVELS.filter((lvl) => lvl.chapter === 4),
  },
];

export const LEVELS_BY_ID: Record<string, LevelDefinition> = Object.fromEntries(
  LEVELS.map((lvl) => [lvl.id, lvl])
);
