import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateOperator, OPERATORS, bitMask } from './operators';
import {
  formatValue,
  parseRadixString,
  countOnes,
  validateVariableInput,
} from './radix';
import {
  evaluateCircuit,
  evaluateTestSuite,
  wouldCreateCycle,
  computeOrthogonalPath,
  CircuitNode,
  CircuitWire,
} from './graphEngine';
import { CHAPTER_GROUPS, LEVELS } from '../data/levels';

test('operators: bitmasking and all 8 gates on 4-bit width', () => {
  assert.equal(bitMask(4), 0b1111n);
  assert.equal(bitMask(8), 0b11111111n);

  assert.equal(evaluateOperator('NOT', [0b0110n], 4), 0b1001n);
  assert.equal(evaluateOperator('AND', [0b1100n, 0b1010n], 4), 0b1000n);
  assert.equal(evaluateOperator('NAND', [0b1101n, 0b0100n], 4), 0b1011n);
  assert.equal(evaluateOperator('OR', [0b1010n, 0b0100n], 4), 0b1110n);
  assert.equal(evaluateOperator('NOR', [0b1001n, 0b0101n], 4), 0b0010n);
  assert.equal(evaluateOperator('XOR', [0b1100n, 0b1010n], 4), 0b0110n);
  assert.equal(evaluateOperator('XNOR', [0b1100n, 0b1010n], 4), 0b1001n);

  assert.equal(OPERATORS.IMP.nonCommutative, true);
  assert.deepEqual(OPERATORS.IMP.inputPinLabels, ['A', 'B']);
  assert.equal(evaluateOperator('IMP', [0b1010n, 0b0010n], 4), 0b0111n);
  assert.equal(evaluateOperator('IMP', [0b0010n, 0b1010n], 4), 0b1111n);
});

test('radix: formatting, parsing, popcount, and constraint validation', () => {
  assert.equal(formatValue(6n, 'BIN', 4), '0110');
  assert.equal(formatValue(6n, 'OCT', 4), '6');
  assert.equal(formatValue(6n, 'DEC', 4), '6');
  assert.equal(formatValue(14n, 'HEX', 4), 'E');
  assert.equal(formatValue(null, 'BIN', 4), '----');

  assert.equal(parseRadixString('0100', 'BIN'), 4n);
  assert.equal(parseRadixString('0b0100', 'BIN'), 4n);
  assert.equal(parseRadixString('14', 'OCT'), 12n);
  assert.equal(parseRadixString('14', 'DEC'), 14n);
  assert.equal(parseRadixString('0xE', 'HEX'), 14n);
  assert.equal(parseRadixString('102', 'BIN'), null);

  assert.equal(countOnes(0b0000n), 0);
  assert.equal(countOnes(0b0100n), 1);
  assert.equal(countOnes(0b1010n), 2);
  assert.equal(countOnes(0b1111n), 4);

  const validRes = validateVariableInput('0100', 'BIN', 4, {
    maxOnes: 1,
    description: 'max 1',
  });
  assert.equal(validRes.valid, true);
  assert.equal(validRes.value, 4n);

  const tooManyOnes = validateVariableInput('1100', 'BIN', 4, {
    maxOnes: 1,
    description: 'max 1',
  });
  assert.equal(tooManyOnes.valid, false);
  assert.match(tooManyOnes.error ?? '', /maxOnes/);
});

test('graphEngine: orthogonal routing produces strict 90-degree segments', () => {
  const forward = computeOrthogonalPath({ x: 100, y: 120 }, { x: 340, y: 260 });
  assert.equal(forward.length, 4);
  for (let i = 0; i < forward.length - 1; i++) {
    assert.ok(forward[i].x === forward[i + 1].x || forward[i].y === forward[i + 1].y);
  }

  const backward = computeOrthogonalPath({ x: 400, y: 200 }, { x: 120, y: 320 });
  assert.equal(backward.length, 6);
  for (let i = 0; i < backward.length - 1; i++) {
    assert.ok(backward[i].x === backward[i + 1].x || backward[i].y === backward[i + 1].y);
  }
});

test('graphEngine: cycle detection catches loops and mustUseAllGates blocks partial solutions', () => {
  const nodes: CircuitNode[] = [
    { id: 'source-A', kind: 'source', label: 'A', sourceKey: 'A', x: 0, y: 0 },
    { id: 'g1', kind: 'gate', label: 'NOT', operator: 'NOT', x: 200, y: 0 },
    { id: 'g2', kind: 'gate', label: 'NOT', operator: 'NOT', x: 400, y: 0 },
    { id: 'target-OUT', kind: 'target', label: 'OUT', x: 600, y: 0 },
  ];
  const wires: CircuitWire[] = [
    { id: 'w1', fromNodeId: 'g1', toNodeId: 'g2', toInputIndex: 0 },
  ];

  assert.equal(wouldCreateCycle(nodes, wires, 'g2', 'g1'), true);

  // mustUseAllGates: target matches via direct wire, but inventory gate NOT (x1) is unplaced -> NOT solved!
  const unplaced = evaluateCircuit({
    nodes: [
      { id: 'source-A', kind: 'source', label: 'A', sourceKey: 'A', x: 0, y: 0 },
      { id: 'target-OUT', kind: 'target', label: 'OUT', x: 400, y: 0 },
    ],
    wires: [{ id: 'w1', fromNodeId: 'source-A', toNodeId: 'target-OUT', toInputIndex: 0 }],
    sourceValues: { A: 0b0111n },
    targetExpected: 0b0111n,
    bits: 4,
    inventory: [{ type: 'NOT', count: 1 }],
    mustUseAllGates: true,
  });
  assert.equal(unplaced.targetMatched, true);
  assert.equal(unplaced.allGatesPlaced, false);
  assert.equal(unplaced.missingMandatoryGates, true);
  assert.equal(unplaced.isSolved, false);

  // mustUseAllGates: gate placed off to the side (unconnected to OUT) -> still NOT solved!
  const unconnected = evaluateCircuit({
    nodes: [
      { id: 'source-A', kind: 'source', label: 'A', sourceKey: 'A', x: 0, y: 0 },
      { id: 'g1', kind: 'gate', label: 'NOT-1', operator: 'NOT', x: 200, y: 200 },
      { id: 'target-OUT', kind: 'target', label: 'OUT', x: 400, y: 0 },
    ],
    wires: [{ id: 'w1', fromNodeId: 'source-A', toNodeId: 'target-OUT', toInputIndex: 0 }],
    sourceValues: { A: 0b0111n },
    targetExpected: 0b0111n,
    bits: 4,
    inventory: [{ type: 'NOT', count: 1 }],
    mustUseAllGates: true,
  });
  assert.equal(unconnected.targetMatched, true);
  assert.equal(unconnected.allGatesPlaced, true);
  assert.equal(unconnected.allGatesConnectedToOut, false);
  assert.equal(unconnected.missingMandatoryGates, true);
  assert.equal(unconnected.isSolved, false);
});

test('levels: all 20 levels across Chapters 1, 2, 3, and 4 are mathematically solvable', () => {
  assert.equal(LEVELS.length, 20);
  assert.equal(CHAPTER_GROUPS.length, 4);
  assert.equal(CHAPTER_GROUPS[0].levels.length, 5);
  assert.equal(CHAPTER_GROUPS[1].levels.length, 5);
  assert.equal(CHAPTER_GROUPS[2].levels.length, 5);
  assert.equal(CHAPTER_GROUPS[3].levels.length, 5);

  const getVarInit = (lvlIdx: number, key: 'A' | 'B' | 'C') =>
    LEVELS[lvlIdx].variables.find((v) => v.key === key)?.initialValue ?? null;

  // LVL 01: NOT(0110) = 1001
  assert.equal(
    evaluateCircuit({
      nodes: [
        { id: 'source-A', kind: 'source', label: 'A', sourceKey: 'A', x: 0, y: 0 },
        { id: 'g1', kind: 'gate', label: 'NOT-1', operator: 'NOT', x: 200, y: 0 },
        { id: 'target-OUT', kind: 'target', label: 'OUT', x: 400, y: 0 },
      ],
      wires: [
        { id: 'w1', fromNodeId: 'source-A', toNodeId: 'g1', toInputIndex: 0 },
        { id: 'w2', fromNodeId: 'g1', toNodeId: 'target-OUT', toInputIndex: 0 },
      ],
      sourceValues: { A: getVarInit(0, 'A') },
      targetExpected: LEVELS[0].targetValue,
      bits: 4,
      inventory: LEVELS[0].inventory,
      mustUseAllGates: LEVELS[0].mustUseAllGates,
    }).isSolved,
    true
  );

  // LVL 05 (Sheffer NAND): 1101 NAND 0100 = 1011
  assert.equal(countOnes(0b0100n), 1);
  assert.equal(
    evaluateCircuit({
      nodes: [
        { id: 'source-A', kind: 'source', label: 'A', sourceKey: 'A', x: 0, y: 0 },
        { id: 'source-B', kind: 'source', label: 'B', sourceKey: 'B', x: 0, y: 100 },
        { id: 'g1', kind: 'gate', label: 'NAND-1', operator: 'NAND', x: 200, y: 50 },
        { id: 'target-OUT', kind: 'target', label: 'OUT', x: 400, y: 50 },
      ],
      wires: [
        { id: 'w1', fromNodeId: 'source-A', toNodeId: 'g1', toInputIndex: 0 },
        { id: 'w2', fromNodeId: 'source-B', toNodeId: 'g1', toInputIndex: 1 },
        { id: 'w3', fromNodeId: 'g1', toNodeId: 'target-OUT', toInputIndex: 0 },
      ],
      sourceValues: { A: getVarInit(4, 'A'), B: 0b0100n },
      targetExpected: LEVELS[4].targetValue,
      bits: 4,
      inventory: LEVELS[4].inventory,
      mustUseAllGates: LEVELS[4].mustUseAllGates,
    }).isSolved,
    true
  );

  // LVL 06 (Locked Mask): NOT(A AND B) = NOT(1010 & 1100) = NOT(1000) = 0111
  assert.equal(
    evaluateCircuit({
      nodes: [
        { id: 'source-A', kind: 'source', label: 'A', sourceKey: 'A', x: 0, y: 0 },
        { id: 'source-B', kind: 'source', label: 'B', sourceKey: 'B', x: 0, y: 100 },
        { id: 'g1', kind: 'gate', label: 'AND-1', operator: 'AND', x: 200, y: 50 },
        { id: 'g2', kind: 'gate', label: 'NOT-1', operator: 'NOT', x: 400, y: 50 },
        { id: 'target-OUT', kind: 'target', label: 'OUT', x: 600, y: 50 },
      ],
      wires: [
        { id: 'w1', fromNodeId: 'source-A', toNodeId: 'g1', toInputIndex: 0 },
        { id: 'w2', fromNodeId: 'source-B', toNodeId: 'g1', toInputIndex: 1 },
        { id: 'w3', fromNodeId: 'g1', toNodeId: 'g2', toInputIndex: 0 },
        { id: 'w4', fromNodeId: 'g2', toNodeId: 'target-OUT', toInputIndex: 0 },
      ],
      sourceValues: { A: getVarInit(5, 'A'), B: getVarInit(5, 'B') },
      targetExpected: LEVELS[5].targetValue,
      bits: 4,
      inventory: LEVELS[5].inventory,
      mustUseAllGates: LEVELS[5].mustUseAllGates,
    }).isSolved,
    true
  );

  // LVL 07 (Three-Way Bus): (A AND B) OR C = (1010 & 1100) | 0011 = 1011
  assert.equal(
    evaluateCircuit({
      nodes: [
        { id: 'source-A', kind: 'source', label: 'A', sourceKey: 'A', x: 0, y: 0 },
        { id: 'source-B', kind: 'source', label: 'B', sourceKey: 'B', x: 0, y: 100 },
        { id: 'source-C', kind: 'source', label: 'C', sourceKey: 'C', x: 0, y: 200 },
        { id: 'g1', kind: 'gate', label: 'AND-1', operator: 'AND', x: 200, y: 50 },
        { id: 'g2', kind: 'gate', label: 'OR-1', operator: 'OR', x: 400, y: 100 },
        { id: 'target-OUT', kind: 'target', label: 'OUT', x: 600, y: 100 },
      ],
      wires: [
        { id: 'w1', fromNodeId: 'source-A', toNodeId: 'g1', toInputIndex: 0 },
        { id: 'w2', fromNodeId: 'source-B', toNodeId: 'g1', toInputIndex: 1 },
        { id: 'w3', fromNodeId: 'g1', toNodeId: 'g2', toInputIndex: 0 },
        { id: 'w4', fromNodeId: 'source-C', toNodeId: 'g2', toInputIndex: 1 },
        { id: 'w5', fromNodeId: 'g2', toNodeId: 'target-OUT', toInputIndex: 0 },
      ],
      sourceValues: {
        A: getVarInit(6, 'A'),
        B: getVarInit(6, 'B'),
        C: getVarInit(6, 'C'),
      },
      targetExpected: LEVELS[6].targetValue,
      bits: 4,
      inventory: LEVELS[6].inventory,
      mustUseAllGates: LEVELS[6].mustUseAllGates,
    }).isSolved,
    true
  );

  // LVL 08 (Signal Filter): (A XOR B) AND (NOT C) = 1000
  assert.equal(
    evaluateCircuit({
      nodes: [
        { id: 'source-A', kind: 'source', label: 'A', sourceKey: 'A', x: 0, y: 0 },
        { id: 'source-B', kind: 'source', label: 'B', sourceKey: 'B', x: 0, y: 100 },
        { id: 'source-C', kind: 'source', label: 'C', sourceKey: 'C', x: 0, y: 200 },
        { id: 'g1', kind: 'gate', label: 'XOR-1', operator: 'XOR', x: 200, y: 50 },
        { id: 'g2', kind: 'gate', label: 'NOT-1', operator: 'NOT', x: 200, y: 200 },
        { id: 'g3', kind: 'gate', label: 'AND-1', operator: 'AND', x: 400, y: 120 },
        { id: 'target-OUT', kind: 'target', label: 'OUT', x: 600, y: 120 },
      ],
      wires: [
        { id: 'w1', fromNodeId: 'source-A', toNodeId: 'g1', toInputIndex: 0 },
        { id: 'w2', fromNodeId: 'source-B', toNodeId: 'g1', toInputIndex: 1 },
        { id: 'w3', fromNodeId: 'source-C', toNodeId: 'g2', toInputIndex: 0 },
        { id: 'w4', fromNodeId: 'g1', toNodeId: 'g3', toInputIndex: 0 },
        { id: 'w5', fromNodeId: 'g2', toNodeId: 'g3', toInputIndex: 1 },
        { id: 'w6', fromNodeId: 'g3', toNodeId: 'target-OUT', toInputIndex: 0 },
      ],
      sourceValues: {
        A: getVarInit(7, 'A'),
        B: getVarInit(7, 'B'),
        C: getVarInit(7, 'C'),
      },
      targetExpected: LEVELS[7].targetValue,
      bits: 4,
      inventory: LEVELS[7].inventory,
      mustUseAllGates: LEVELS[7].mustUseAllGates,
    }).isSolved,
    true
  );

  // LVL 09 (NOR Injection): (A NOR B) OR C = 1010
  assert.equal(countOnes(0b1000n), 1);
  assert.equal(
    evaluateCircuit({
      nodes: [
        { id: 'source-A', kind: 'source', label: 'A', sourceKey: 'A', x: 0, y: 0 },
        { id: 'source-B', kind: 'source', label: 'B', sourceKey: 'B', x: 0, y: 100 },
        { id: 'source-C', kind: 'source', label: 'C', sourceKey: 'C', x: 0, y: 200 },
        { id: 'g1', kind: 'gate', label: 'NOR-1', operator: 'NOR', x: 200, y: 50 },
        { id: 'g2', kind: 'gate', label: 'OR-1', operator: 'OR', x: 400, y: 100 },
        { id: 'target-OUT', kind: 'target', label: 'OUT', x: 600, y: 100 },
      ],
      wires: [
        { id: 'w1', fromNodeId: 'source-A', toNodeId: 'g1', toInputIndex: 0 },
        { id: 'w2', fromNodeId: 'source-B', toNodeId: 'g1', toInputIndex: 1 },
        { id: 'w3', fromNodeId: 'g1', toNodeId: 'g2', toInputIndex: 0 },
        { id: 'w4', fromNodeId: 'source-C', toNodeId: 'g2', toInputIndex: 1 },
        { id: 'w5', fromNodeId: 'g2', toNodeId: 'target-OUT', toInputIndex: 0 },
      ],
      sourceValues: {
        A: getVarInit(8, 'A'),
        B: getVarInit(8, 'B'),
        C: 0b1000n,
      },
      targetExpected: LEVELS[8].targetValue,
      bits: 4,
      inventory: LEVELS[8].inventory,
      mustUseAllGates: LEVELS[8].mustUseAllGates,
    }).isSolved,
    true
  );

  // LVL 10 (Ch.2 Boss — Logic Chain): (A IMP B) XOR C = 1101
  assert.equal(
    evaluateCircuit({
      nodes: [
        { id: 'source-A', kind: 'source', label: 'A', sourceKey: 'A', x: 0, y: 0 },
        { id: 'source-B', kind: 'source', label: 'B', sourceKey: 'B', x: 0, y: 100 },
        { id: 'source-C', kind: 'source', label: 'C', sourceKey: 'C', x: 0, y: 200 },
        { id: 'g1', kind: 'gate', label: 'IMP-1', operator: 'IMP', x: 200, y: 50 },
        { id: 'g2', kind: 'gate', label: 'XOR-1', operator: 'XOR', x: 400, y: 100 },
        { id: 'target-OUT', kind: 'target', label: 'OUT', x: 600, y: 100 },
      ],
      wires: [
        { id: 'w1', fromNodeId: 'source-A', toNodeId: 'g1', toInputIndex: 0 },
        { id: 'w2', fromNodeId: 'source-B', toNodeId: 'g1', toInputIndex: 1 },
        { id: 'w3', fromNodeId: 'g1', toNodeId: 'g2', toInputIndex: 0 },
        { id: 'w4', fromNodeId: 'source-C', toNodeId: 'g2', toInputIndex: 1 },
        { id: 'w5', fromNodeId: 'g2', toNodeId: 'target-OUT', toInputIndex: 0 },
      ],
      sourceValues: {
        A: getVarInit(9, 'A'),
        B: getVarInit(9, 'B'),
        C: getVarInit(9, 'C'),
      },
      targetExpected: LEVELS[9].targetValue,
      bits: 4,
      inventory: LEVELS[9].inventory,
      mustUseAllGates: LEVELS[9].mustUseAllGates,
    }).isSolved,
    true
  );

  // LVL 11 (Sheffer's Inverter): Fan-out A to BOTH inputs of a single NAND -> ~A = 0101
  const r11 = evaluateCircuit({
    nodes: [
      { id: 'source-A', kind: 'source', label: 'A', sourceKey: 'A', x: 0, y: 0 },
      { id: 'g1', kind: 'gate', label: 'NAND-1', operator: 'NAND', x: 240, y: 0 },
      { id: 'target-OUT', kind: 'target', label: 'OUT', x: 480, y: 0 },
    ],
    wires: [
      { id: 'w1', fromNodeId: 'source-A', toNodeId: 'g1', toInputIndex: 0 },
      { id: 'w2', fromNodeId: 'source-A', toNodeId: 'g1', toInputIndex: 1 },
      { id: 'w3', fromNodeId: 'g1', toNodeId: 'target-OUT', toInputIndex: 0 },
    ],
    sourceValues: { A: getVarInit(10, 'A') },
    targetExpected: LEVELS[10].targetValue,
    bits: 4,
    inventory: LEVELS[10].inventory,
  });
  assert.equal(r11.isSolved, true);
  assert.equal(r11.targetValue, 0b0101n);

  // LVL 12 (Sheffer's AND): NAND(NAND(A, B), NAND(A, B)) = A & B = 1001
  const r12 = evaluateCircuit({
    nodes: [
      { id: 'source-A', kind: 'source', label: 'A', sourceKey: 'A', x: 0, y: 0 },
      { id: 'source-B', kind: 'source', label: 'B', sourceKey: 'B', x: 0, y: 100 },
      { id: 'g1', kind: 'gate', label: 'NAND-1', operator: 'NAND', x: 240, y: 50 },
      { id: 'g2', kind: 'gate', label: 'NAND-2', operator: 'NAND', x: 480, y: 50 },
      { id: 'target-OUT', kind: 'target', label: 'OUT', x: 720, y: 50 },
    ],
    wires: [
      { id: 'w1', fromNodeId: 'source-A', toNodeId: 'g1', toInputIndex: 0 },
      { id: 'w2', fromNodeId: 'source-B', toNodeId: 'g1', toInputIndex: 1 },
      { id: 'w3', fromNodeId: 'g1', toNodeId: 'g2', toInputIndex: 0 },
      { id: 'w4', fromNodeId: 'g1', toNodeId: 'g2', toInputIndex: 1 },
      { id: 'w5', fromNodeId: 'g2', toNodeId: 'target-OUT', toInputIndex: 0 },
    ],
    sourceValues: { A: getVarInit(11, 'A'), B: getVarInit(11, 'B') },
    targetExpected: LEVELS[11].targetValue,
    bits: 4,
    inventory: LEVELS[11].inventory,
    mustUseAllGates: LEVELS[11].mustUseAllGates,
  });
  assert.equal(r12.isSolved, true);
  assert.equal(r12.targetValue, 0b1001n);

  // LVL 13 (Peirce's OR): NOR(NOR(A, B), NOR(A, B)) = A | B = 1011
  const r13 = evaluateCircuit({
    nodes: [
      { id: 'source-A', kind: 'source', label: 'A', sourceKey: 'A', x: 0, y: 0 },
      { id: 'source-B', kind: 'source', label: 'B', sourceKey: 'B', x: 0, y: 100 },
      { id: 'g1', kind: 'gate', label: 'NOR-1', operator: 'NOR', x: 240, y: 50 },
      { id: 'g2', kind: 'gate', label: 'NOR-2', operator: 'NOR', x: 480, y: 50 },
      { id: 'target-OUT', kind: 'target', label: 'OUT', x: 720, y: 50 },
    ],
    wires: [
      { id: 'w1', fromNodeId: 'source-A', toNodeId: 'g1', toInputIndex: 0 },
      { id: 'w2', fromNodeId: 'source-B', toNodeId: 'g1', toInputIndex: 1 },
      { id: 'w3', fromNodeId: 'g1', toNodeId: 'g2', toInputIndex: 0 },
      { id: 'w4', fromNodeId: 'g1', toNodeId: 'g2', toInputIndex: 1 },
      { id: 'w5', fromNodeId: 'g2', toNodeId: 'target-OUT', toInputIndex: 0 },
    ],
    sourceValues: { A: getVarInit(12, 'A'), B: getVarInit(12, 'B') },
    targetExpected: LEVELS[12].targetValue,
    bits: 4,
    inventory: LEVELS[12].inventory,
    mustUseAllGates: LEVELS[12].mustUseAllGates,
  });
  assert.equal(r13.isSolved, true);
  assert.equal(r13.targetValue, 0b1011n);

  // LVL 14 (Faulty Output Port): XOR(1100, 1010) = 0110 RAW -> INVERT fault -> 1001 === TARGET
  const r14 = evaluateCircuit({
    nodes: [
      { id: 'source-A', kind: 'source', label: 'A', sourceKey: 'A', x: 0, y: 0 },
      { id: 'source-B', kind: 'source', label: 'B', sourceKey: 'B', x: 0, y: 100 },
      { id: 'g1', kind: 'gate', label: 'XOR-1', operator: 'XOR', x: 240, y: 50 },
      { id: 'target-OUT', kind: 'target', label: 'OUT', outputFault: 'INVERT', x: 480, y: 50 },
    ],
    wires: [
      { id: 'w1', fromNodeId: 'source-A', toNodeId: 'g1', toInputIndex: 0 },
      { id: 'w2', fromNodeId: 'source-B', toNodeId: 'g1', toInputIndex: 1 },
      { id: 'w3', fromNodeId: 'g1', toNodeId: 'target-OUT', toInputIndex: 0 },
    ],
    sourceValues: { A: getVarInit(13, 'A'), B: getVarInit(13, 'B') },
    targetExpected: LEVELS[13].targetValue,
    bits: 4,
    inventory: LEVELS[13].inventory,
    outputFault: LEVELS[13].outputFault,
  });
  assert.equal(r14.targetRawValue, 0b0110n);
  assert.equal(r14.targetValue, 0b1001n);
  assert.equal(r14.isSolved, true);

  // LVL 15 (Ch.3 Boss — Universal XOR): 4-NAND XOR(1100, 1010) = 0110
  const r15 = evaluateCircuit({
    nodes: [
      { id: 'source-A', kind: 'source', label: 'A', sourceKey: 'A', x: 0, y: 0 },
      { id: 'source-B', kind: 'source', label: 'B', sourceKey: 'B', x: 0, y: 200 },
      { id: 'g1', kind: 'gate', label: 'NAND-1', operator: 'NAND', x: 200, y: 100 },
      { id: 'g2', kind: 'gate', label: 'NAND-2', operator: 'NAND', x: 400, y: 20 },
      { id: 'g3', kind: 'gate', label: 'NAND-3', operator: 'NAND', x: 400, y: 180 },
      { id: 'g4', kind: 'gate', label: 'NAND-4', operator: 'NAND', x: 600, y: 100 },
      { id: 'target-OUT', kind: 'target', label: 'OUT', x: 800, y: 100 },
    ],
    wires: [
      { id: 'w1', fromNodeId: 'source-A', toNodeId: 'g1', toInputIndex: 0 },
      { id: 'w2', fromNodeId: 'source-B', toNodeId: 'g1', toInputIndex: 1 },
      { id: 'w3', fromNodeId: 'source-A', toNodeId: 'g2', toInputIndex: 0 },
      { id: 'w4', fromNodeId: 'g1', toNodeId: 'g2', toInputIndex: 1 },
      { id: 'w5', fromNodeId: 'g1', toNodeId: 'g3', toInputIndex: 0 },
      { id: 'w6', fromNodeId: 'source-B', toNodeId: 'g3', toInputIndex: 1 },
      { id: 'w7', fromNodeId: 'g2', toNodeId: 'g4', toInputIndex: 0 },
      { id: 'w8', fromNodeId: 'g3', toNodeId: 'g4', toInputIndex: 1 },
      { id: 'w9', fromNodeId: 'g4', toNodeId: 'target-OUT', toInputIndex: 0 },
    ],
    sourceValues: { A: getVarInit(14, 'A'), B: getVarInit(14, 'B') },
    targetExpected: LEVELS[14].targetValue,
    bits: 4,
    inventory: LEVELS[14].inventory,
    mustUseAllGates: LEVELS[14].mustUseAllGates,
  });
  assert.equal(r15.isSolved, true);
  assert.equal(r15.targetValue, 0b0110n);

  // LVL 16 (Byte Inverter Mask — 8-bit): A XOR (NOT B) = 0xCA ^ 0xF0 = 0x3A
  assert.equal(formatValue(0b10101100n, 'BIN', 8), '10101100');
  assert.equal(formatValue(0b10101100n, 'HEX', 8), 'AC');
  assert.equal(formatValue(0b00000011n, 'HEX', 8), '03');
  const lvl16 = LEVELS[15];
  const s16 = evaluateTestSuite({
    level: lvl16,
    editableValues: {},
    nodes: [
      { id: 'source-A', kind: 'source', label: 'A', sourceKey: 'A', bits: 8, x: 0, y: 0 },
      { id: 'source-B', kind: 'source', label: 'B', sourceKey: 'B', bits: 8, x: 0, y: 120 },
      { id: 'g1', kind: 'gate', label: 'NOT-1', operator: 'NOT', bits: 8, x: 240, y: 120 },
      { id: 'g2', kind: 'gate', label: 'XOR-1', operator: 'XOR', bits: 8, x: 460, y: 60 },
      { id: 'target-OUT', kind: 'target', label: 'OUT', targetKey: 'OUT', bits: 8, x: 700, y: 60 },
    ],
    wires: [
      { id: 'w1', fromNodeId: 'source-B', toNodeId: 'g1', toInputIndex: 0 },
      { id: 'w2', fromNodeId: 'source-A', toNodeId: 'g2', toInputIndex: 0 },
      { id: 'w3', fromNodeId: 'g1', toNodeId: 'g2', toInputIndex: 1 },
      { id: 'w4', fromNodeId: 'g2', toNodeId: 'target-OUT', toInputIndex: 0 },
    ],
  });
  assert.equal(s16.isSolved, true);
  assert.equal(s16.testResults[0].result.targetValue, 0x3an);

  // LVL 17 (Multi-Test Bit Setter): B=0000 passes only TEST 3; B=0001 passes all 3
  const lvl17 = LEVELS[16];
  const nodes17: CircuitNode[] = [
    { id: 'source-A', kind: 'source', label: 'A', sourceKey: 'A', bits: 4, x: 0, y: 0 },
    { id: 'source-B', kind: 'source', label: 'B', sourceKey: 'B', bits: 4, x: 0, y: 120 },
    { id: 'g1', kind: 'gate', label: 'OR-1', operator: 'OR', bits: 4, x: 240, y: 60 },
    { id: 'target-OUT', kind: 'target', label: 'OUT', targetKey: 'OUT', bits: 4, x: 480, y: 60 },
  ];
  const wires17: CircuitWire[] = [
    { id: 'w1', fromNodeId: 'source-A', toNodeId: 'g1', toInputIndex: 0 },
    { id: 'w2', fromNodeId: 'source-B', toNodeId: 'g1', toInputIndex: 1 },
    { id: 'w3', fromNodeId: 'g1', toNodeId: 'target-OUT', toInputIndex: 0 },
  ];
  const s17Partial = evaluateTestSuite({
    level: lvl17,
    editableValues: { B: 0b0000n },
    nodes: nodes17,
    wires: wires17,
  });
  assert.equal(s17Partial.passedCount, 1);
  assert.equal(s17Partial.testResults[0].passed, false);
  assert.equal(s17Partial.testResults[1].passed, false);
  assert.equal(s17Partial.testResults[2].passed, true);
  assert.equal(s17Partial.isSolved, false);

  const s17Solved = evaluateTestSuite({
    level: lvl17,
    editableValues: { B: 0b0001n },
    nodes: nodes17,
    wires: wires17,
  });
  assert.equal(s17Solved.passedCount, 3);
  assert.equal(s17Solved.allTestsPassed, true);
  assert.equal(s17Solved.isSolved, true);

  // LVL 18 (Multi-Test Middle Flip): B=0110 with XOR passes all 3 tests
  const lvl18 = LEVELS[17];
  const s18 = evaluateTestSuite({
    level: lvl18,
    editableValues: { B: 0b0110n },
    nodes: [
      { id: 'source-A', kind: 'source', label: 'A', sourceKey: 'A', bits: 4, x: 0, y: 0 },
      { id: 'source-B', kind: 'source', label: 'B', sourceKey: 'B', bits: 4, x: 0, y: 120 },
      { id: 'g1', kind: 'gate', label: 'XOR-1', operator: 'XOR', bits: 4, x: 240, y: 60 },
      { id: 'target-OUT', kind: 'target', label: 'OUT', targetKey: 'OUT', bits: 4, x: 480, y: 60 },
    ],
    wires: [
      { id: 'w1', fromNodeId: 'source-A', toNodeId: 'g1', toInputIndex: 0 },
      { id: 'w2', fromNodeId: 'source-B', toNodeId: 'g1', toInputIndex: 1 },
      { id: 'w3', fromNodeId: 'g1', toNodeId: 'target-OUT', toInputIndex: 0 },
    ],
  });
  assert.equal(s18.passedCount, 3);
  assert.equal(s18.isSolved, true);

  // LVL 19 (Half Adder — Dual Output + Multi-Test): SUM=A^B -> OUT1, CARRY=A&B -> OUT2
  const lvl19 = LEVELS[18];
  const s19 = evaluateTestSuite({
    level: lvl19,
    editableValues: {},
    nodes: [
      { id: 'source-A', kind: 'source', label: 'A', sourceKey: 'A', bits: 4, x: 0, y: 0 },
      { id: 'source-B', kind: 'source', label: 'B', sourceKey: 'B', bits: 4, x: 0, y: 120 },
      { id: 'g1', kind: 'gate', label: 'XOR-1', operator: 'XOR', bits: 4, x: 240, y: 0 },
      { id: 'g2', kind: 'gate', label: 'AND-1', operator: 'AND', bits: 4, x: 240, y: 120 },
      { id: 'target-OUT1', kind: 'target', label: 'OUT 1 (SUM)', targetKey: 'OUT1', bits: 4, x: 480, y: 0 },
      { id: 'target-OUT2', kind: 'target', label: 'OUT 2 (CARRY)', targetKey: 'OUT2', bits: 4, x: 480, y: 120 },
    ],
    wires: [
      { id: 'w1', fromNodeId: 'source-A', toNodeId: 'g1', toInputIndex: 0 },
      { id: 'w2', fromNodeId: 'source-B', toNodeId: 'g1', toInputIndex: 1 },
      { id: 'w3', fromNodeId: 'source-A', toNodeId: 'g2', toInputIndex: 0 },
      { id: 'w4', fromNodeId: 'source-B', toNodeId: 'g2', toInputIndex: 1 },
      { id: 'w5', fromNodeId: 'g1', toNodeId: 'target-OUT1', toInputIndex: 0 },
      { id: 'w6', fromNodeId: 'g2', toNodeId: 'target-OUT2', toInputIndex: 0 },
    ],
  });
  assert.equal(s19.passedCount, 3);
  assert.equal(s19.allGatesConnectedToOut, true);
  assert.equal(s19.isSolved, true);

  // LVL 20 (Ch.4 Boss — Byte Splitter — 8-bit, Dual Output + Multi-Test)
  const lvl20 = LEVELS[19];
  const s20 = evaluateTestSuite({
    level: lvl20,
    editableValues: {},
    nodes: [
      { id: 'source-A', kind: 'source', label: 'A', sourceKey: 'A', bits: 8, x: 0, y: 0 },
      { id: 'source-B', kind: 'source', label: 'B', sourceKey: 'B', bits: 8, x: 0, y: 120 },
      { id: 'g1', kind: 'gate', label: 'AND-1', operator: 'AND', bits: 8, x: 260, y: 0 },
      { id: 'g2', kind: 'gate', label: 'NOT-1', operator: 'NOT', bits: 8, x: 260, y: 120 },
      { id: 'g3', kind: 'gate', label: 'AND-2', operator: 'AND', bits: 8, x: 480, y: 120 },
      { id: 'target-OUT1', kind: 'target', label: 'OUT 1 (LOW)', targetKey: 'OUT1', bits: 8, x: 720, y: 0 },
      { id: 'target-OUT2', kind: 'target', label: 'OUT 2 (HIGH)', targetKey: 'OUT2', bits: 8, x: 720, y: 120 },
    ],
    wires: [
      { id: 'w1', fromNodeId: 'source-A', toNodeId: 'g1', toInputIndex: 0 },
      { id: 'w2', fromNodeId: 'source-B', toNodeId: 'g1', toInputIndex: 1 },
      { id: 'w3', fromNodeId: 'source-B', toNodeId: 'g2', toInputIndex: 0 },
      { id: 'w4', fromNodeId: 'source-A', toNodeId: 'g3', toInputIndex: 0 },
      { id: 'w5', fromNodeId: 'g2', toNodeId: 'g3', toInputIndex: 1 },
      { id: 'w6', fromNodeId: 'g1', toNodeId: 'target-OUT1', toInputIndex: 0 },
      { id: 'w7', fromNodeId: 'g3', toNodeId: 'target-OUT2', toInputIndex: 0 },
    ],
  });
  assert.equal(s20.passedCount, 2);
  assert.equal(s20.testResults[0].result.targetValues.OUT1, 0x0cn);
  assert.equal(s20.testResults[0].result.targetValues.OUT2, 0xa0n);
  assert.equal(s20.testResults[1].result.targetValues.OUT1, 0x03n);
  assert.equal(s20.testResults[1].result.targetValues.OUT2, 0xf0n);
  assert.equal(s20.isSolved, true);
});
