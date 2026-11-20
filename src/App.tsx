import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CircuitCanvas } from './components/CircuitCanvas';
import { InventoryDock } from './components/InventoryDock';
import { TopBar } from './components/TopBar';
import { VariablesDrawer } from './components/VariablesDrawer';
import {
  CircuitNode,
  CircuitWire,
  evaluateTestSuite,
  FAULTY_TARGET_DIMENSIONS,
  FAULTY_TARGET_DIMENSIONS_8BIT,
  getNodeDimensions,
  NODE_DIMENSIONS,
  NODE_DIMENSIONS_8BIT,
  wouldCreateCycle,
} from './core/graphEngine';
import { OperatorType } from './core/operators';
import {
  formatValue,
  Radix,
  validateVariableInput,
  VariableValidationResult,
} from './core/radix';
import {
  getLevelOutputs,
  LevelDefinition,
  LEVELS,
  VariableKey,
} from './data/levels';
import { soundEngine } from './utils/sound';

const ALL_VAR_KEYS: readonly VariableKey[] = ['A', 'B', 'C'] as const;

function buildInitialVarRaw(
  level: LevelDefinition,
  radix: Radix
): Record<VariableKey, string> {
  const zero = formatValue(0n, radix, level.bits);
  const result: Record<VariableKey, string> = {
    A: zero,
    B: zero,
    C: zero,
  };
  for (const v of level.variables) {
    result[v.key] = formatValue(v.initialValue, radix, level.bits);
  }
  return result;
}

function createInitialNodes(
  level: LevelDefinition,
  canvasWidth: number,
  canvasHeight: number
): CircuitNode[] {
  const safeW = Math.max(760, canvasWidth || 1280);
  const safeH = Math.max(380, canvasHeight || 580);
  const leftX = 64;
  const isWide = level.bits > 4;
  const outputs = getLevelOutputs(level);
  const hasFaultyTarget = outputs.some((o) => Boolean(o.outputFault));
  const targetWidth = hasFaultyTarget
    ? isWide
      ? FAULTY_TARGET_DIMENSIONS_8BIT.width
      : FAULTY_TARGET_DIMENSIONS.width
    : isWide
      ? NODE_DIMENSIONS_8BIT.target.width
      : NODE_DIMENSIONS.target.width;
  const rightX = Math.max(
    540,
    Math.round((safeW - targetWidth - 72) / 16) * 16
  );

  const hasTestSuite = Boolean(level.testCases && level.testCases.length > 0);
  const minTopY = hasTestSuite ? 144 : 96;
  const varCount = level.variables.length;
  const nodes: CircuitNode[] = [];

  // Position source variable nodes on the left
  let centerY = Math.max(minTopY + 64, Math.round((safeH * 0.5 - 48) / 16) * 16);
  if (varCount === 1) {
    const v = level.variables[0];
    nodes.push({
      id: `source-${v.key}`,
      kind: 'source',
      label: v.key,
      sourceKey: v.key,
      bits: level.bits,
      x: leftX,
      y: centerY,
    });
  } else if (varCount === 2) {
    level.variables.forEach((v, idx) => {
      nodes.push({
        id: `source-${v.key}`,
        kind: 'source',
        label: v.key,
        sourceKey: v.key,
        bits: level.bits,
        x: leftX,
        y: idx === 0 ? Math.max(minTopY, centerY - 64) : Math.max(minTopY + 112, centerY + 64),
      });
    });
  } else {
    const stepY = safeH < 520 ? 96 : 112;
    const totalSpan = stepY * 2 + NODE_DIMENSIONS.source.height;
    const topY = Math.max(minTopY, Math.round(((safeH - totalSpan) / 2 + 16) / 16) * 16);
    centerY = topY + stepY;
    level.variables.forEach((v, idx) => {
      nodes.push({
        id: `source-${v.key}`,
        kind: 'source',
        label: v.key,
        sourceKey: v.key,
        bits: level.bits,
        x: leftX,
        y: topY + idx * stepY,
      });
    });
  }

  // Position target output node(s) on the right (1 or 2 ports)
  if (outputs.length === 1) {
    const out = outputs[0];
    nodes.push({
      id: `target-${out.id}`,
      kind: 'target',
      label: out.label,
      targetKey: out.id,
      bits: level.bits,
      outputFault: out.outputFault,
      x: rightX,
      y: centerY,
    });
  } else {
    outputs.forEach((out, idx) => {
      nodes.push({
        id: `target-${out.id}`,
        kind: 'target',
        label: out.label,
        targetKey: out.id,
        bits: level.bits,
        outputFault: out.outputFault,
        x: rightX,
        y: idx === 0 ? Math.max(minTopY, centerY - 64) : Math.max(minTopY + 112, centerY + 64),
      });
    });
  }

  return nodes;
}

export default function App() {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const gateSerialRef = useRef(1);
  const wireSerialRef = useRef(1);
  const prevSolvedRef = useRef(false);

  const [levelIndex, setLevelIndex] = useState(0);
  const [activeTestIndex, setActiveTestIndex] = useState(0);
  const [radix, setRadix] = useState<Radix>('BIN');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scanlines, setScanlines] = useState(true);
  const [muted, setMuted] = useState(false);

  const level = LEVELS[levelIndex];

  const [nodes, setNodes] = useState<CircuitNode[]>(() =>
    createInitialNodes(
      LEVELS[0],
      typeof window !== 'undefined' ? window.innerWidth : 1280,
      560
    )
  );
  const [wires, setWires] = useState<CircuitWire[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [solvedLevelIds, setSolvedLevelIds] = useState<Set<string>>(() => new Set());
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [varRawByKey, setVarRawByKey] = useState<Record<VariableKey, string>>(() =>
    buildInitialVarRaw(LEVELS[0], 'BIN')
  );

  // Validate every editable variable for the current level
  const varValidations = useMemo(() => {
    const out: Record<VariableKey, VariableValidationResult> = {
      A: { valid: true, value: null, onesCount: 0, error: null },
      B: { valid: true, value: null, onesCount: 0, error: null },
      C: { valid: true, value: null, onesCount: 0, error: null },
    };

    for (const v of level.variables) {
      if (!v.editable) {
        out[v.key] = {
          valid: true,
          value: v.initialValue,
          onesCount: null,
          error: null,
        };
      } else {
        out[v.key] = validateVariableInput(
          varRawByKey[v.key],
          radix,
          level.bits,
          v.constraint
        );
      }
    }
    return out;
  }, [level, varRawByKey, radix]);

  const editableValues = useMemo<Partial<Record<VariableKey, bigint | null>>>(() => {
    const map: Partial<Record<VariableKey, bigint | null>> = {};
    for (const v of level.variables) {
      if (v.editable) {
        map[v.key] = varValidations[v.key].value;
      }
    }
    return map;
  }, [level, varValidations]);

  const sourceValidByKey = useMemo<Record<VariableKey, boolean>>(() => {
    return {
      A: varValidations.A.valid,
      B: varValidations.B.valid,
      C: varValidations.C.valid,
    };
  }, [varValidations]);

  const anyVarHasError = useMemo(
    () => level.variables.some((v) => v.editable && !varValidations[v.key].valid),
    [level, varValidations]
  );

  // Evaluate all test cases in real time (single-test levels run as a 1-case suite)
  const testSuite = useMemo(() => {
    return evaluateTestSuite({
      nodes,
      wires,
      level,
      editableValues,
      sourceValid: sourceValidByKey,
    });
  }, [nodes, wires, level, editableValues, sourceValidByKey]);

  const safeTestIndex = Math.min(activeTestIndex, Math.max(0, testSuite.testResults.length - 1));
  const activeTest = testSuite.testResults[safeTestIndex];
  const evaluation = activeTest.result;

  const activeTargetsForDrawer = useMemo(() => {
    const outputs = getLevelOutputs(level);
    return outputs.map((o) => ({
      id: o.id,
      label: o.label,
      value: activeTest.targetExpecteds[o.id] ?? o.targetValue,
    }));
  }, [level, activeTest]);

  useEffect(() => {
    document.body.dataset.state = testSuite.isSolved ? 'solved' : 'playing';
    if (testSuite.isSolved && !prevSolvedRef.current) {
      soundEngine.playVictory();
      setSolvedLevelIds((prev) => {
        if (prev.has(level.id)) return prev;
        const next = new Set(prev);
        next.add(level.id);
        return next;
      });
    }
    prevSolvedRef.current = testSuite.isSolved;
  }, [testSuite.isSolved, level.id]);

  // Keep nodes comfortably inside viewport on resize or Variables Drawer toggle
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const adjustBounds = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w <= 0 || h <= 0) return;
      setNodes((prev) =>
        prev.map((n) => {
          const dims = getNodeDimensions(n);
          const maxX = Math.max(32, w - dims.width - 32);
          const maxY = Math.max(64, h - dims.height - 16);
          if (n.x > maxX || n.y > maxY) {
            return {
              ...n,
              x: Math.min(n.x, Math.round(maxX / 16) * 16),
              y: Math.min(n.y, Math.round(maxY / 16) * 16),
            };
          }
          return n;
        })
      );
    };
    const ro = new ResizeObserver(adjustBounds);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const showStatus = useCallback((msg: string) => {
    setStatusMessage(msg);
  }, []);

  useEffect(() => {
    if (!statusMessage) return;
    const t = window.setTimeout(() => setStatusMessage(null), 2600);
    return () => window.clearTimeout(t);
  }, [statusMessage]);

  const loadLevel = useCallback(
    (nextIndex: number, targetRadix: Radix = radix) => {
      const nextLvl = LEVELS[nextIndex];
      const w = canvasRef.current?.clientWidth || window.innerWidth;
      const h = canvasRef.current?.clientHeight || 560;
      gateSerialRef.current = 1;
      prevSolvedRef.current = false;

      setLevelIndex(nextIndex);
      setActiveTestIndex(0);
      setNodes(createInitialNodes(nextLvl, w, h));
      setWires([]);
      setSelectedNodeId(null);
      setStatusMessage(null);
      setVarRawByKey(buildInitialVarRaw(nextLvl, targetRadix));
    },
    [radix]
  );

  // Switch radix while re-formatting all valid editable variables into the new radix
  const handleChangeRadix = useCallback(
    (nextRadix: Radix) => {
      setVarRawByKey((prev) => {
        const next = { ...prev };
        for (const key of ALL_VAR_KEYS) {
          const v = level.variables.find((item) => item.key === key);
          if (v?.editable && varValidations[key].value !== null) {
            next[key] = formatValue(varValidations[key].value, nextRadix, level.bits);
          }
        }
        return next;
      });
      setRadix(nextRadix);
    },
    [level, varValidations]
  );

  const handleVarInputChange = useCallback((key: VariableKey, raw: string) => {
    setVarRawByKey((prev) => ({ ...prev, [key]: raw }));
  }, []);

  const handleToggleVarBit = useCallback(
    (key: VariableKey, bitIndex: number) => {
      const cfg = level.variables.find((v) => v.key === key);
      if (!cfg?.editable) return;
      const baseVal = varValidations[key].value ?? 0n;
      const toggled = baseVal ^ (1n << BigInt(bitIndex));
      const nextFormatted = formatValue(toggled, radix, level.bits);
      setVarRawByKey((prev) => ({ ...prev, [key]: nextFormatted }));

      const check = validateVariableInput(
        nextFormatted,
        radix,
        level.bits,
        cfg.constraint
      );
      if (!check.valid) {
        soundEngine.playError();
      } else {
        soundEngine.playSpawn();
      }
    },
    [level, radix, varValidations]
  );

  const remainingCounts = useMemo(() => {
    const counts: Record<OperatorType, number> = {
      NOT: 0,
      AND: 0,
      OR: 0,
      XOR: 0,
      NAND: 0,
      NOR: 0,
      XNOR: 0,
      IMP: 0,
    };
    for (const item of level.inventory) {
      counts[item.type] = item.count;
    }
    for (const node of nodes) {
      if (node.kind === 'gate' && node.operator) {
        counts[node.operator] = Math.max(0, (counts[node.operator] ?? 0) - 1);
      }
    }
    return counts;
  }, [level.inventory, nodes]);

  const handleSpawnGate = useCallback(
    (type: OperatorType, dropCoords?: { x: number; y: number }) => {
      if ((remainingCounts[type] ?? 0) <= 0) return;

      const el = canvasRef.current;
      const w = el?.clientWidth || 1000;
      const h = el?.clientHeight || 520;
      const existingGates = nodes.filter((n) => n.kind === 'gate').length;

      const totalLevelGates = level.inventory.reduce((sum, item) => sum + item.count, 0);
      const hasDualOutputs = Boolean(level.outputs && level.outputs.length > 1);
      const hasTestSuite = Boolean(level.testCases && level.testCases.length > 0);
      const minSpawnY = hasTestSuite ? 144 : 112;
      const gateDims =
        level.bits > 4 ? NODE_DIMENSIONS_8BIT.gate : NODE_DIMENSIONS.gate;

      // Tailored spawn slots for 1-2 gates, dual-output circuits (LVL 19/20), and 4-gate diamonds (LVL 15)
      let presetSlots: { x: number; y: number }[];
      if (hasDualOutputs && totalLevelGates === 2) {
        presetSlots = [
          { x: Math.round((w * 0.42) / 16) * 16, y: Math.round((h * 0.34) / 16) * 16 },
          { x: Math.round((w * 0.42) / 16) * 16, y: Math.round((h * 0.58) / 16) * 16 },
        ];
      } else if (hasDualOutputs && totalLevelGates === 3) {
        presetSlots = [
          { x: Math.round((w * 0.34) / 16) * 16, y: Math.round((h * 0.32) / 16) * 16 },
          { x: Math.round((w * 0.34) / 16) * 16, y: Math.round((h * 0.60) / 16) * 16 },
          { x: Math.round((w * 0.55) / 16) * 16, y: Math.round((h * 0.60) / 16) * 16 },
        ];
      } else if (totalLevelGates <= 2) {
        presetSlots = [
          { x: Math.round((w * 0.35) / 16) * 16, y: Math.round((h * 0.45) / 16) * 16 },
          { x: Math.round((w * 0.55) / 16) * 16, y: Math.round((h * 0.45) / 16) * 16 },
        ];
      } else {
        presetSlots = [
          { x: Math.round((w * 0.25) / 16) * 16, y: Math.round((h * 0.42) / 16) * 16 },
          { x: Math.round((w * 0.45) / 16) * 16, y: Math.round((h * 0.24) / 16) * 16 },
          { x: Math.round((w * 0.45) / 16) * 16, y: Math.round((h * 0.58) / 16) * 16 },
          { x: Math.round((w * 0.65) / 16) * 16, y: Math.round((h * 0.42) / 16) * 16 },
        ];
      }
      const slot = presetSlots[existingGates % presetSlots.length];
      const defaultX = slot.x;
      const defaultY = Math.max(minSpawnY, slot.y);

      const rawX = dropCoords ? dropCoords.x : defaultX;
      const rawY = dropCoords ? dropCoords.y : defaultY;
      const clampedX = Math.max(
        32,
        Math.min(w - gateDims.width - 32, Math.round(rawX / 16) * 16)
      );
      const clampedY = Math.max(
        96,
        Math.min(h - gateDims.height - 16, Math.round(rawY / 16) * 16)
      );

      const serial = gateSerialRef.current++;
      const newNode: CircuitNode = {
        id: `gate-${type}-${serial}`,
        kind: 'gate',
        label: `${type}-${serial}`,
        operator: type,
        bits: level.bits,
        x: clampedX,
        y: clampedY,
      };

      setNodes((prev) => [...prev, newNode]);
      setSelectedNodeId(newNode.id);
      soundEngine.playSpawn();
    },
    [remainingCounts, nodes, level]
  );

  const handleMoveNode = useCallback((id: string, x: number, y: number) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, x, y } : n)));
  }, []);

  const handleDeleteGate = useCallback((id: string) => {
    setNodes((prev) => prev.filter((n) => !(n.id === id && n.kind === 'gate')));
    setWires((prev) => prev.filter((w) => w.fromNodeId !== id && w.toNodeId !== id));
    setSelectedNodeId((curr) => (curr === id ? null : curr));
    soundEngine.playWireCut();
  }, []);

  const handleConnectWire = useCallback(
    (fromNodeId: string, toNodeId: string, toInputIndex: number) => {
      if (wouldCreateCycle(nodes, wires, fromNodeId, toNodeId)) {
        soundEngine.playError();
        showStatus('[ERR] FEEDBACK LOOP BLOCKED // CIRCUIT MUST BE ACYCLIC');
        return;
      }

      setWires((prev) => {
        const filtered = prev.filter(
          (w) => !(w.toNodeId === toNodeId && w.toInputIndex === toInputIndex)
        );
        const wireId = `w-${fromNodeId}-to-${toNodeId}-${toInputIndex}-${wireSerialRef.current++}`;
        const newWire: CircuitWire = {
          id: wireId,
          fromNodeId,
          toNodeId,
          toInputIndex,
        };
        return [...filtered, newWire];
      });
      soundEngine.playWireConnect();
    },
    [nodes, wires, showStatus]
  );

  const handleDisconnectWire = useCallback((wireId: string) => {
    setWires((prev) => prev.filter((w) => w.id !== wireId));
    soundEngine.playWireCut();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'SELECT' ||
          target.tagName === 'TEXTAREA')
      ) {
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId) {
        const selected = nodes.find((n) => n.id === selectedNodeId);
        if (selected?.kind === 'gate') {
          e.preventDefault();
          handleDeleteGate(selectedNodeId);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedNodeId, nodes, handleDeleteGate]);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      return next;
    });
  }, []);

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-[#0B0E11] text-[#E6EDF3]">
      <TopBar
        levels={LEVELS}
        currentLevelIndex={levelIndex}
        solvedLevelIds={solvedLevelIds}
        radix={radix}
        drawerOpen={drawerOpen}
        anyVarHasError={anyVarHasError}
        scanlines={scanlines}
        muted={muted}
        onSelectLevel={(idx) => loadLevel(idx)}
        onChangeRadix={handleChangeRadix}
        onToggleDrawer={() => setDrawerOpen((o) => !o)}
        onResetLevel={() => loadLevel(levelIndex)}
        onToggleScanlines={() => setScanlines((s) => !s)}
        onToggleMute={handleToggleMute}
      />

      <VariablesDrawer
        open={drawerOpen}
        level={level}
        radix={radix}
        activeTestLabel={
          level.testCases && level.testCases.length > 0 ? activeTest.label : undefined
        }
        activeSourceValues={activeTest.sourceValues}
        activeTargets={activeTargetsForDrawer}
        varRawByKey={varRawByKey}
        varValidations={varValidations}
        onVarInputChange={handleVarInputChange}
        onToggleVarBit={handleToggleVarBit}
      />

      <CircuitCanvas
        level={level}
        hasNextLevel={levelIndex < LEVELS.length - 1}
        radix={radix}
        nodes={nodes}
        wires={wires}
        evaluation={evaluation}
        testSuite={testSuite}
        activeTestIndex={safeTestIndex}
        activeTargetExpecteds={activeTest.targetExpecteds}
        sourceValidByKey={sourceValidByKey}
        selectedNodeId={selectedNodeId}
        statusMessage={statusMessage}
        canvasRef={canvasRef}
        onSelectTestIndex={setActiveTestIndex}
        onSelectNode={setSelectedNodeId}
        onMoveNode={handleMoveNode}
        onDeleteGate={handleDeleteGate}
        onConnectWire={handleConnectWire}
        onDisconnectWire={handleDisconnectWire}
        onNextLevel={() => {
          if (levelIndex < LEVELS.length - 1) {
            loadLevel(levelIndex + 1);
          }
        }}
        onReplayFirstLevel={() => loadLevel(0)}
      />

      <InventoryDock
        inventory={level.inventory}
        remainingCounts={remainingCounts}
        onSpawnGate={handleSpawnGate}
        canvasRef={canvasRef}
      />

      {scanlines && (
        <div
          aria-hidden="true"
          data-testid="crt-scanlines"
          className="crt-scanlines fixed inset-0 z-50"
        />
      )}
    </div>
  );
}
