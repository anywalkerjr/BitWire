import { evaluateOperator, OperatorType, OPERATORS, bitMask } from './operators';
import {
  getExpectedTargetsForTest,
  getLevelOutputs,
  InventoryAllowance,
  LevelDefinition,
  OutputFault,
  VariableKey,
} from '../data/levels';

export type NodeKind = 'source' | 'gate' | 'target';

export interface CircuitNode {
  id: string;
  kind: NodeKind;
  label: string;
  x: number;
  y: number;
  /** Bit width of the level (used to widen nodes cleanly in 8-bit mode) */
  bits?: number;
  /** Only set for kind === 'gate' */
  operator?: OperatorType;
  /** Only set for kind === 'source' */
  sourceKey?: VariableKey;
  /** Only set for kind === 'target' (defaults to 'OUT', or 'OUT1'/'OUT2' for dual outputs) */
  targetKey?: string;
  /** Optional hardware fault attached to kind === 'target' */
  outputFault?: OutputFault;
}

export interface CircuitWire {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  toInputIndex: number;
}

export interface EvaluationResult {
  nodeValues: Record<string, bigint | null>;
  wireValues: Record<string, bigint | null>;
  hasCycle: boolean;
  cycleNodeIds: string[];
  /** Raw signal arriving at primary OUT before any hardware fault transform */
  targetRawValue: bigint | null;
  /** Final value at primary OUT after applying any outputFault (e.g. INVERT) */
  targetValue: bigint | null;
  /** Raw signal per output port ID (e.g. 'OUT', 'OUT1', 'OUT2') */
  targetRawValues: Record<string, bigint | null>;
  /** Post-fault signal per output port ID */
  targetValues: Record<string, bigint | null>;
  /** Match status per output port ID */
  targetMatches: Record<string, boolean>;
  /** True when ALL output targets match expected, no cycles, and all variables are valid */
  targetMatched: boolean;
  /** True when every required gate from inventory is placed on the canvas */
  allGatesPlaced: boolean;
  /** True when every placed gate is actively wired into a path feeding at least one OUT */
  allGatesConnectedToOut: boolean;
  /** Number of inventory gates not yet placed on the canvas */
  remainingGateCount: number;
  /** Number of placed gates not connected into any OUT */
  unconnectedGateCount: number;
  /** True when mustUseAllGates is active and gates are unplaced or not wired to OUT */
  missingMandatoryGates: boolean;
  /** Final victory state for this single evaluation */
  isSolved: boolean;
}

export interface TestCaseEvaluation {
  id: string;
  label: string;
  sourceValues: Partial<Record<VariableKey, bigint | null>>;
  targetExpecteds: Record<string, bigint>;
  result: EvaluationResult;
  passed: boolean;
}

export interface TestSuiteEvaluation {
  testResults: TestCaseEvaluation[];
  allTestsPassed: boolean;
  passedCount: number;
  totalCount: number;
  allGatesPlaced: boolean;
  allGatesConnectedToOut: boolean;
  remainingGateCount: number;
  unconnectedGateCount: number;
  missingMandatoryGates: boolean;
  isSolved: boolean;
}

export interface Point {
  x: number;
  y: number;
}

/** Fixed geometric dimensions for pixel-accurate pin placement and orthogonal routing */
export const NODE_DIMENSIONS: Record<NodeKind, { width: number; height: number }> = {
  source: { width: 136, height: 84 },
  gate: { width: 156, height: 100 },
  target: { width: 156, height: 96 },
};

export const NODE_DIMENSIONS_8BIT: Record<NodeKind, { width: number; height: number }> = {
  source: { width: 164, height: 84 },
  gate: { width: 176, height: 100 },
  target: { width: 192, height: 96 },
};

export const FAULTY_TARGET_DIMENSIONS = { width: 180, height: 134 };
export const FAULTY_TARGET_DIMENSIONS_8BIT = { width: 204, height: 134 };

export const PIN_PROTRUSION = 12;

export function getNodeDimensions(node: CircuitNode): { width: number; height: number } {
  const isWide = (node.bits ?? 4) > 4;
  if (node.kind === 'target' && node.outputFault) {
    return isWide ? FAULTY_TARGET_DIMENSIONS_8BIT : FAULTY_TARGET_DIMENSIONS;
  }
  return isWide ? NODE_DIMENSIONS_8BIT[node.kind] : NODE_DIMENSIONS[node.kind];
}

export function getInputCountForNode(node: CircuitNode): number {
  if (node.kind === 'source') return 0;
  if (node.kind === 'target') return 1;
  if (node.kind === 'gate' && node.operator) {
    return OPERATORS[node.operator].inputCount;
  }
  return 0;
}

export function getOutputPinPosition(node: CircuitNode): Point {
  const { width, height } = getNodeDimensions(node);
  const offsetY = node.kind === 'source' ? 56 : Math.round((height + 28) / 2);
  return {
    x: node.x + width + PIN_PROTRUSION,
    y: node.y + offsetY,
  };
}

export function getInputPinPosition(node: CircuitNode, inputIndex: number): Point {
  const { height } = getNodeDimensions(node);
  const count = getInputCountForNode(node);
  let offsetY = node.kind === 'target' && node.outputFault
    ? Math.round((height + 48) / 2)
    : Math.round((height + 28) / 2);
  if (count === 2) {
    // Evenly positioned inside the 72px chip body below the 28px header
    offsetY = inputIndex === 0 ? 48 : 80;
  }
  return {
    x: node.x - PIN_PROTRUSION,
    y: node.y + offsetY,
  };
}

/**
 * Computes a strict 90-degree orthogonal Manhattan polyline from an output pin to an input pin.
 * Always exits horizontally to the right and enters horizontally from the left.
 * Optional `laneOffset` separates parallel fan-out wires targeting the same gate.
 */
export function computeOrthogonalPath(
  start: Point,
  end: Point,
  laneOffset = 0
): Point[] {
  const stub = 24;
  if (end.x >= start.x + stub * 2) {
    const rawMidX = Math.round((start.x + end.x) / 2) + laneOffset;
    const midX = Math.max(start.x + 14, Math.min(end.x - 14, rawMidX));
    if (start.y === end.y) {
      return [start, end];
    }
    return [
      start,
      { x: midX, y: start.y },
      { x: midX, y: end.y },
      end,
    ];
  }

  // Wrap-around orthogonal routing when target pin is left of or very close to source pin
  const outX = start.x + stub + Math.max(0, laneOffset);
  const inX = end.x - stub + Math.min(0, laneOffset);
  const midY =
    start.y === end.y
      ? start.y - 68 - Math.abs(laneOffset)
      : Math.round((start.y + end.y) / 2) + Math.round(laneOffset / 2);

  return [
    start,
    { x: outX, y: start.y },
    { x: outX, y: midY },
    { x: inX, y: midY },
    { x: inX, y: end.y },
    end,
  ];
}

/** Returns a readable anchor point along a polyline for placing a signal label. */
export function getPolylineLabelPoint(points: Point[], laneOffset = 0): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];
  if (points.length === 2) {
    return {
      x: Math.round((points[0].x + points[1].x) / 2),
      y: Math.round((points[0].y + points[1].y) / 2),
    };
  }
  // When fanning out to both inputs of the same gate, place badges on each pin's horizontal entry leg (32px vertical gap)
  if (laneOffset !== 0 && points.length === 4) {
    const a = points[2];
    const b = points[3];
    if (Math.abs(b.x - a.x) >= 56) {
      return {
        x: Math.round((a.x + b.x) / 2),
        y: a.y,
      };
    }
  }
  const midSegIdx = Math.floor((points.length - 1) / 2);
  const a = points[midSegIdx];
  const b = points[midSegIdx + 1];
  return {
    x: Math.round((a.x + b.x) / 2),
    y: Math.round((a.y + b.y) / 2),
  };
}

/** Checks if adding a wire from `fromNodeId` to `toNodeId` would introduce a cycle. */
export function wouldCreateCycle(
  nodes: CircuitNode[],
  wires: CircuitWire[],
  fromNodeId: string,
  toNodeId: string
): boolean {
  if (fromNodeId === toNodeId) return true;
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const w of wires) {
    const list = adj.get(w.fromNodeId);
    if (list) list.push(w.toNodeId);
  }

  const visited = new Set<string>();
  const stack = [toNodeId];
  while (stack.length > 0) {
    const curr = stack.pop()!;
    if (curr === fromNodeId) return true;
    if (visited.has(curr)) continue;
    visited.add(curr);
    const neighbors = adj.get(curr) ?? [];
    for (const next of neighbors) {
      if (!visited.has(next)) stack.push(next);
    }
  }
  return false;
}

/**
 * Evaluates the circuit directed acyclic graph using Kahn's topological sort.
 * Supports arbitrary bit widths (4-bit, 8-bit, etc.), full pin fan-out (including both inputs
 * of the same gate), single or dual/multi output ports, hardware outputFault transforms,
 * cycle detection, and mustUseAllGates enforcement.
 */
export function evaluateCircuit(params: {
  nodes: CircuitNode[];
  wires: CircuitWire[];
  sourceValues: Partial<Record<VariableKey, bigint | null>>;
  sourceValid?: Partial<Record<VariableKey, boolean>>;
  targetExpected?: bigint;
  targetExpecteds?: Record<string, bigint>;
  bits: number;
  inventory?: readonly InventoryAllowance[];
  mustUseAllGates?: boolean;
  outputFault?: OutputFault;
}): EvaluationResult {
  const {
    nodes,
    wires,
    sourceValues,
    sourceValid = {},
    targetExpected,
    targetExpecteds,
    bits,
    inventory = [],
    mustUseAllGates = false,
    outputFault,
  } = params;
  const mask = bitMask(bits);

  const nodeMap = new Map<string, CircuitNode>();
  const inDegree = new Map<string, number>();
  const outgoing = new Map<string, CircuitWire[]>();
  const incoming = new Map<string, CircuitWire[]>();

  for (const node of nodes) {
    nodeMap.set(node.id, node);
    inDegree.set(node.id, 0);
    outgoing.set(node.id, []);
    incoming.set(node.id, []);
  }

  // Deduplicate edges strictly per (toNodeId, toInputIndex) so fan-out to both inputs (0 & 1) of the SAME gate works!
  const pinSlotMap = new Map<string, CircuitWire>();
  for (const wire of wires) {
    if (!nodeMap.has(wire.fromNodeId) || !nodeMap.has(wire.toNodeId)) continue;
    pinSlotMap.set(`${wire.toNodeId}:${wire.toInputIndex}`, wire);
  }
  for (const wire of pinSlotMap.values()) {
    outgoing.get(wire.fromNodeId)!.push(wire);
    incoming.get(wire.toNodeId)!.push(wire);
    inDegree.set(wire.toNodeId, (inDegree.get(wire.toNodeId) ?? 0) + 1);
  }

  // Kahn's topological sort
  const queue: string[] = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(id);
  }

  const topoOrder: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    topoOrder.push(id);
    for (const edge of outgoing.get(id) ?? []) {
      const nextDeg = (inDegree.get(edge.toNodeId) ?? 0) - 1;
      inDegree.set(edge.toNodeId, nextDeg);
      if (nextDeg === 0) {
        queue.push(edge.toNodeId);
      }
    }
  }

  const processedSet = new Set(topoOrder);
  const cycleNodeIds = nodes
    .filter((n) => !processedSet.has(n.id))
    .map((n) => n.id);
  const hasCycle = cycleNodeIds.length > 0;

  const nodeValues: Record<string, bigint | null> = {};
  const wireValues: Record<string, bigint | null> = {};

  for (const n of nodes) {
    nodeValues[n.id] = null;
  }
  for (const w of wires) {
    wireValues[w.id] = null;
  }

  const allSourcesValid = nodes
    .filter((n) => n.kind === 'source' && n.sourceKey)
    .every((n) => sourceValid[n.sourceKey!] !== false);

  const targetRawValues: Record<string, bigint | null> = {};
  const targetValues: Record<string, bigint | null> = {};

  for (const nodeId of topoOrder) {
    const node = nodeMap.get(nodeId)!;

    if (node.kind === 'source' && node.sourceKey) {
      const key = node.sourceKey;
      const isValid = sourceValid[key] !== false;
      const rawVal = sourceValues[key] ?? null;
      nodeValues[node.id] = isValid && rawVal !== null ? rawVal & mask : null;
    } else if (node.kind === 'gate' && node.operator) {
      const def = OPERATORS[node.operator];
      const inWires = incoming.get(node.id) ?? [];
      const inputs: (bigint | null)[] = Array(def.inputCount).fill(null);

      for (const w of inWires) {
        if (w.toInputIndex >= 0 && w.toInputIndex < def.inputCount) {
          inputs[w.toInputIndex] = nodeValues[w.fromNodeId] ?? null;
        }
      }

      if (inputs.every((v): v is bigint => v !== null)) {
        nodeValues[node.id] = evaluateOperator(node.operator, inputs, bits);
      } else {
        nodeValues[node.id] = null;
      }
    } else if (node.kind === 'target') {
      const tKey = node.targetKey ?? 'OUT';
      const inWires = incoming.get(node.id) ?? [];
      const primaryWire = inWires.find((w) => w.toInputIndex === 0);
      const rawIn = primaryWire ? (nodeValues[primaryWire.fromNodeId] ?? null) : null;
      targetRawValues[tKey] = rawIn;

      const activeFault = node.outputFault ?? outputFault;
      const finalVal =
        rawIn !== null && activeFault === 'INVERT' ? ~rawIn & mask : rawIn;
      nodeValues[node.id] = finalVal;
      targetValues[tKey] = finalVal;
    }

    const outVal = nodeValues[node.id];
    for (const w of outgoing.get(node.id) ?? []) {
      wireValues[w.id] = outVal;
    }
  }

  // Check mandatory gate placement & connectivity to any target OUT
  const placedGates = nodes.filter((n) => n.kind === 'gate');
  const placedCounts = new Map<OperatorType, number>();
  for (const g of placedGates) {
    if (g.operator) {
      placedCounts.set(g.operator, (placedCounts.get(g.operator) ?? 0) + 1);
    }
  }

  let remainingGateCount = 0;
  for (const item of inventory) {
    const placed = placedCounts.get(item.type) ?? 0;
    if (placed < item.count) {
      remainingGateCount += item.count - placed;
    }
  }
  const allGatesPlaced = remainingGateCount === 0;

  // Reverse BFS from ALL target OUT nodes along incoming edges to verify every placed gate feeds an OUT
  const targetNodes = nodes.filter((n) => n.kind === 'target');
  const reachableToOut = new Set<string>();
  const revStack = targetNodes.map((t) => t.id);
  while (revStack.length > 0) {
    const curr = revStack.pop()!;
    if (reachableToOut.has(curr)) continue;
    reachableToOut.add(curr);
    for (const w of incoming.get(curr) ?? []) {
      if (!reachableToOut.has(w.fromNodeId)) {
        revStack.push(w.fromNodeId);
      }
    }
  }

  const unconnectedGateCount = placedGates.filter(
    (g) => !reachableToOut.has(g.id) || nodeValues[g.id] === null
  ).length;
  const allGatesConnectedToOut = unconnectedGateCount === 0;

  // Evaluate each target port against its expected target value
  const targetMatches: Record<string, boolean> = {};
  for (const tNode of targetNodes) {
    const tKey = tNode.targetKey ?? 'OUT';
    const actual = nodeValues[tNode.id] ?? null;
    if (!(tKey in targetRawValues)) targetRawValues[tKey] = null;
    if (!(tKey in targetValues)) targetValues[tKey] = actual;

    const expected =
      targetExpecteds && targetExpecteds[tKey] !== undefined
        ? targetExpecteds[tKey]
        : targetExpected;
    targetMatches[tKey] =
      !hasCycle &&
      allSourcesValid &&
      actual !== null &&
      expected !== undefined &&
      actual === (expected & mask);
  }

  const primaryTargetNode = targetNodes[0];
  const primaryKey = primaryTargetNode?.targetKey ?? 'OUT';
  const targetRawValue = primaryTargetNode ? (targetRawValues[primaryKey] ?? null) : null;
  const targetValue = primaryTargetNode ? (targetValues[primaryKey] ?? null) : null;

  const targetMatched =
    !hasCycle &&
    allSourcesValid &&
    targetNodes.length > 0 &&
    targetNodes.every((t) => targetMatches[t.targetKey ?? 'OUT'] === true);

  const missingMandatoryGates =
    mustUseAllGates && (!allGatesPlaced || !allGatesConnectedToOut);

  const isSolved = targetMatched && !missingMandatoryGates;

  return {
    nodeValues,
    wireValues,
    hasCycle,
    cycleNodeIds,
    targetRawValue,
    targetValue,
    targetRawValues,
    targetValues,
    targetMatches,
    targetMatched,
    allGatesPlaced,
    allGatesConnectedToOut,
    remainingGateCount,
    unconnectedGateCount,
    missingMandatoryGates,
    isSolved,
  };
}

/**
 * Evaluates a level across all defined testCases (or a single default case when testCases is omitted).
 * Player-chosen values for editable variables stay constant across every test case.
 */
export function evaluateTestSuite(params: {
  nodes: CircuitNode[];
  wires: CircuitWire[];
  level: LevelDefinition;
  editableValues: Partial<Record<VariableKey, bigint | null>>;
  sourceValid?: Partial<Record<VariableKey, boolean>>;
}): TestSuiteEvaluation {
  const { nodes, wires, level, editableValues, sourceValid = {} } = params;
  const outputs = getLevelOutputs(level);

  const cases =
    level.testCases && level.testCases.length > 0
      ? level.testCases
      : [
          {
            id: 'default',
            label: 'TEST 1',
            inputs: Object.fromEntries(
              level.variables
                .filter((v) => !v.editable)
                .map((v) => [v.key, v.initialValue])
            ) as Partial<Record<VariableKey, bigint>>,
            targets: Object.fromEntries(outputs.map((o) => [o.id, o.targetValue])),
          },
        ];

  const testResults: TestCaseEvaluation[] = cases.map((tc) => {
    const sourceValues: Partial<Record<VariableKey, bigint | null>> = {};
    for (const v of level.variables) {
      if (v.editable) {
        sourceValues[v.key] = editableValues[v.key] ?? null;
      } else {
        sourceValues[v.key] = tc.inputs[v.key] ?? v.initialValue;
      }
    }

    const targetExpecteds = getExpectedTargetsForTest(level, tc);
    const result = evaluateCircuit({
      nodes,
      wires,
      sourceValues,
      sourceValid,
      targetExpected: level.targetValue,
      targetExpecteds,
      bits: level.bits,
      inventory: level.inventory,
      mustUseAllGates: level.mustUseAllGates,
      outputFault: level.outputFault,
    });

    return {
      id: tc.id,
      label: tc.label,
      sourceValues,
      targetExpecteds,
      result,
      passed: result.targetMatched,
    };
  });

  const passedCount = testResults.filter((t) => t.passed).length;
  const totalCount = testResults.length;
  const allTestsPassed = totalCount > 0 && passedCount === totalCount;

  const first = testResults[0]?.result;
  const allGatesPlaced = first ? first.allGatesPlaced : true;
  const allGatesConnectedToOut = first ? first.allGatesConnectedToOut : true;
  const remainingGateCount = first ? first.remainingGateCount : 0;
  const unconnectedGateCount = first ? first.unconnectedGateCount : 0;
  const missingMandatoryGates =
    Boolean(level.mustUseAllGates) && (!allGatesPlaced || !allGatesConnectedToOut);

  const isSolved = allTestsPassed && !missingMandatoryGates;

  return {
    testResults,
    allTestsPassed,
    passedCount,
    totalCount,
    allGatesPlaced,
    allGatesConnectedToOut,
    remainingGateCount,
    unconnectedGateCount,
    missingMandatoryGates,
    isSolved,
  };
}
