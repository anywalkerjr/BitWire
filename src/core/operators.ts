export type OperatorType =
  | 'NOT'
  | 'AND'
  | 'OR'
  | 'XOR'
  | 'NAND'
  | 'NOR'
  | 'XNOR'
  | 'IMP';

export interface OperatorDefinition {
  type: OperatorType;
  label: string;
  symbol: string;
  description: string;
  inputCount: 1 | 2;
  /** Pin labels rendered on the left input pins (top to bottom) */
  inputPinLabels: string[];
  /** True if order of inputs matters (e.g. IMP: A -> B) */
  nonCommutative: boolean;
  /** Pure BigInt evaluation strictly masked to the level's bit-width */
  evaluate: (inputs: bigint[], bits: number) => bigint;
}

export function bitMask(bits: number): bigint {
  if (!Number.isInteger(bits) || bits < 1) {
    throw new Error(`Invalid bit width: ${bits}`);
  }
  return (1n << BigInt(bits)) - 1n;
}

export const OPERATORS: Record<OperatorType, OperatorDefinition> = {
  NOT: {
    type: 'NOT',
    label: 'NOT',
    symbol: '~A',
    description: 'Bitwise inversion (flips every bit)',
    inputCount: 1,
    inputPinLabels: ['IN'],
    nonCommutative: false,
    evaluate: ([a], bits) => {
      const mask = bitMask(bits);
      return ~a & mask;
    },
  },
  AND: {
    type: 'AND',
    label: 'AND',
    symbol: 'A & B',
    description: 'Bitwise conjunction (1 only if both bits are 1)',
    inputCount: 2,
    inputPinLabels: ['1', '2'],
    nonCommutative: false,
    evaluate: ([a, b], bits) => {
      const mask = bitMask(bits);
      return a & b & mask;
    },
  },
  OR: {
    type: 'OR',
    label: 'OR',
    symbol: 'A | B',
    description: 'Bitwise disjunction (1 if either bit is 1)',
    inputCount: 2,
    inputPinLabels: ['1', '2'],
    nonCommutative: false,
    evaluate: ([a, b], bits) => {
      const mask = bitMask(bits);
      return (a | b) & mask;
    },
  },
  XOR: {
    type: 'XOR',
    label: 'XOR',
    symbol: 'A ^ B',
    description: 'Bitwise exclusive-OR (1 if bits differ)',
    inputCount: 2,
    inputPinLabels: ['1', '2'],
    nonCommutative: false,
    evaluate: ([a, b], bits) => {
      const mask = bitMask(bits);
      return (a ^ b) & mask;
    },
  },
  NAND: {
    type: 'NAND',
    label: 'NAND',
    symbol: '~(A & B)',
    description: 'Inverted AND (0 only if both bits are 1)',
    inputCount: 2,
    inputPinLabels: ['1', '2'],
    nonCommutative: false,
    evaluate: ([a, b], bits) => {
      const mask = bitMask(bits);
      return ~(a & b) & mask;
    },
  },
  NOR: {
    type: 'NOR',
    label: 'NOR',
    symbol: '~(A | B)',
    description: 'Inverted OR (1 only if both bits are 0)',
    inputCount: 2,
    inputPinLabels: ['1', '2'],
    nonCommutative: false,
    evaluate: ([a, b], bits) => {
      const mask = bitMask(bits);
      return ~(a | b) & mask;
    },
  },
  XNOR: {
    type: 'XNOR',
    label: 'XNOR',
    symbol: '~(A ^ B)',
    description: 'Bitwise equivalence (1 if bits match)',
    inputCount: 2,
    inputPinLabels: ['1', '2'],
    nonCommutative: false,
    evaluate: ([a, b], bits) => {
      const mask = bitMask(bits);
      return ~(a ^ b) & mask;
    },
  },
  IMP: {
    type: 'IMP',
    label: 'IMP',
    symbol: 'A -> B',
    description: 'Logical implication (~A | B; 0 only when A=1 and B=0)',
    inputCount: 2,
    inputPinLabels: ['A', 'B'],
    nonCommutative: true,
    evaluate: ([a, b], bits) => {
      const mask = bitMask(bits);
      return (~a | b) & mask;
    },
  },
};

export function evaluateOperator(
  type: OperatorType,
  inputs: bigint[],
  bits: number
): bigint {
  const def = OPERATORS[type];
  if (inputs.length !== def.inputCount) {
    throw new Error(
      `Operator ${type} requires ${def.inputCount} input(s), received ${inputs.length}`
    );
  }
  const mask = bitMask(bits);
  const maskedInputs = inputs.map((v) => v & mask);
  return def.evaluate(maskedInputs, bits) & mask;
}
