import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, Eye, X } from 'lucide-react';
import {
  CircuitNode,
  CircuitWire,
  computeOrthogonalPath,
  EvaluationResult,
  getInputCountForNode,
  getInputPinPosition,
  getNodeDimensions,
  getOutputPinPosition,
  getPolylineLabelPoint,
  PIN_PROTRUSION,
  Point,
  TestSuiteEvaluation,
} from '../core/graphEngine';
import { OPERATORS } from '../core/operators';
import { formatValue, Radix } from '../core/radix';
import { LevelDefinition, VariableKey } from '../data/levels';

interface PendingWire {
  originKind: 'output' | 'input';
  nodeId: string;
  inputIndex?: number;
  startPoint: Point;
  pointerPoint: Point;
  dragging: boolean;
}

interface CircuitCanvasProps {
  level: LevelDefinition;
  hasNextLevel: boolean;
  radix: Radix;
  nodes: CircuitNode[];
  wires: CircuitWire[];
  evaluation: EvaluationResult;
  testSuite: TestSuiteEvaluation;
  activeTestIndex: number;
  activeTargetExpecteds: Record<string, bigint>;
  sourceValidByKey: Record<VariableKey, boolean>;
  selectedNodeId: string | null;
  statusMessage: string | null;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  onSelectTestIndex: (index: number) => void;
  onSelectNode: (id: string | null) => void;
  onMoveNode: (id: string, x: number, y: number) => void;
  onDeleteGate: (id: string) => void;
  onConnectWire: (fromNodeId: string, toNodeId: string, toInputIndex: number) => void;
  onDisconnectWire: (wireId: string) => void;
  onNextLevel: () => void;
  onReplayFirstLevel: () => void;
}

const GRID_SNAP = 16;

function snapToGrid(val: number): number {
  return Math.round(val / GRID_SNAP) * GRID_SNAP;
}

function pointsToSvgAttr(points: Point[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(' ');
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export const CircuitCanvas: React.FC<CircuitCanvasProps> = ({
  level,
  hasNextLevel,
  radix,
  nodes,
  wires,
  evaluation,
  testSuite,
  activeTestIndex,
  activeTargetExpecteds,
  sourceValidByKey,
  selectedNodeId,
  statusMessage,
  canvasRef,
  onSelectTestIndex,
  onSelectNode,
  onMoveNode,
  onDeleteGate,
  onConnectWire,
  onDisconnectWire,
  onNextLevel,
  onReplayFirstLevel,
}) => {
  const [draggingNode, setDraggingNode] = useState<{
    id: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const [pendingWire, setPendingWire] = useState<PendingWire | null>(null);
  const [hoveredWireId, setHoveredWireId] = useState<string | null>(null);
  const [victoryDismissed, setVictoryDismissed] = useState(false);
  const pointerDownPosRef = useRef<Point | null>(null);

  // Automatically re-show victory banner whenever a level transitions to solved or changes
  useEffect(() => {
    setVictoryDismissed(false);
  }, [level.id, testSuite.isSolved]);

  const nodeById = new Map<string, CircuitNode>(nodes.map((n) => [n.id, n]));
  const varConfigByKey = new Map(level.variables.map((v) => [v.key, v]));

  const getLocalPoint = (clientX: number, clientY: number): Point => {
    const el = canvasRef.current;
    if (!el) return { x: clientX, y: clientY };
    const rect = el.getBoundingClientRect();
    return {
      x: Math.round(clientX - rect.left),
      y: Math.round(clientY - rect.top),
    };
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPendingWire(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!draggingNode && !pendingWire) return;

    const handlePointerMove = (e: PointerEvent) => {
      const pt = getLocalPoint(e.clientX, e.clientY);

      if (draggingNode) {
        const el = canvasRef.current;
        const maxW = el ? el.clientWidth : 1200;
        const maxH = el ? el.clientHeight : 600;
        const node = nodeById.get(draggingNode.id);
        const dims = node ? getNodeDimensions(node) : { width: 156, height: 100 };

        const rawX = pt.x - draggingNode.offsetX;
        const rawY = pt.y - draggingNode.offsetY;
        const clampedX = Math.max(24, Math.min(maxW - dims.width - 24, snapToGrid(rawX)));
        const clampedY = Math.max(48, Math.min(maxH - dims.height - 16, snapToGrid(rawY)));
        onMoveNode(draggingNode.id, clampedX, clampedY);
      }

      if (pendingWire) {
        const downPt = pointerDownPosRef.current;
        const movedFar =
          downPt !== null &&
          Math.hypot(e.clientX - downPt.x, e.clientY - downPt.y) > 8;
        setPendingWire((prev) =>
          prev
            ? {
                ...prev,
                pointerPoint: pt,
                dragging: prev.dragging || movedFar,
              }
            : null
        );
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (draggingNode) {
        setDraggingNode(null);
      }

      if (pendingWire && pendingWire.dragging) {
        const elAt = document.elementFromPoint(e.clientX, e.clientY);
        const pinEl = elAt?.closest('[data-pin-kind]') as HTMLElement | null;
        if (pinEl) {
          const targetKind = pinEl.dataset.pinKind as 'input' | 'output' | undefined;
          const targetNodeId = pinEl.dataset.nodeId;
          const targetInputIdx = pinEl.dataset.inputIndex
            ? Number(pinEl.dataset.inputIndex)
            : 0;

          if (targetNodeId && targetKind && targetKind !== pendingWire.originKind) {
            if (pendingWire.originKind === 'output' && targetKind === 'input') {
              onConnectWire(pendingWire.nodeId, targetNodeId, targetInputIdx);
            } else if (pendingWire.originKind === 'input' && targetKind === 'output') {
              onConnectWire(targetNodeId, pendingWire.nodeId, pendingWire.inputIndex ?? 0);
            }
          }
        }
        setPendingWire(null);
        pointerDownPosRef.current = null;
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [draggingNode, pendingWire, onMoveNode, onConnectWire, nodes]);

  const handleOutputPinPointerDown = (e: React.PointerEvent, node: CircuitNode) => {
    e.stopPropagation();
    const startPoint = getOutputPinPosition(node);
    pointerDownPosRef.current = { x: e.clientX, y: e.clientY };

    if (pendingWire && pendingWire.originKind === 'input') {
      onConnectWire(node.id, pendingWire.nodeId, pendingWire.inputIndex ?? 0);
      setPendingWire(null);
      pointerDownPosRef.current = null;
      return;
    }

    if (pendingWire && pendingWire.originKind === 'output' && pendingWire.nodeId === node.id) {
      setPendingWire(null);
      pointerDownPosRef.current = null;
      return;
    }

    setPendingWire({
      originKind: 'output',
      nodeId: node.id,
      startPoint,
      pointerPoint: startPoint,
      dragging: false,
    });
  };

  const handleInputPinPointerDown = (
    e: React.PointerEvent,
    node: CircuitNode,
    inputIndex: number
  ) => {
    e.stopPropagation();
    const startPoint = getInputPinPosition(node, inputIndex);
    pointerDownPosRef.current = { x: e.clientX, y: e.clientY };

    if (pendingWire && pendingWire.originKind === 'output') {
      onConnectWire(pendingWire.nodeId, node.id, inputIndex);
      setPendingWire(null);
      pointerDownPosRef.current = null;
      return;
    }

    if (
      pendingWire &&
      pendingWire.originKind === 'input' &&
      pendingWire.nodeId === node.id &&
      pendingWire.inputIndex === inputIndex
    ) {
      setPendingWire(null);
      pointerDownPosRef.current = null;
      return;
    }

    setPendingWire({
      originKind: 'input',
      nodeId: node.id,
      inputIndex,
      startPoint,
      pointerPoint: startPoint,
      dragging: false,
    });
  };

  const handleOutputPinClick = (e: React.MouseEvent, node: CircuitNode) => {
    e.stopPropagation();
    if (e.detail !== 0) return;
    const startPoint = getOutputPinPosition(node);
    if (pendingWire && pendingWire.originKind === 'input') {
      onConnectWire(node.id, pendingWire.nodeId, pendingWire.inputIndex ?? 0);
      setPendingWire(null);
      return;
    }
    setPendingWire({
      originKind: 'output',
      nodeId: node.id,
      startPoint,
      pointerPoint: startPoint,
      dragging: false,
    });
  };

  const handleInputPinClick = (
    e: React.MouseEvent,
    node: CircuitNode,
    inputIndex: number
  ) => {
    e.stopPropagation();
    if (e.detail !== 0) return;
    const startPoint = getInputPinPosition(node, inputIndex);
    if (pendingWire && pendingWire.originKind === 'output') {
      onConnectWire(pendingWire.nodeId, node.id, inputIndex);
      setPendingWire(null);
      return;
    }
    setPendingWire({
      originKind: 'input',
      nodeId: node.id,
      inputIndex,
      startPoint,
      pointerPoint: startPoint,
      dragging: false,
    });
  };

  const handleNodePointerDown = (e: React.PointerEvent, node: CircuitNode) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.stopPropagation();
    onSelectNode(node.id);
    const pt = getLocalPoint(e.clientX, e.clientY);
    setDraggingNode({
      id: node.id,
      offsetX: pt.x - node.x,
      offsetY: pt.y - node.y,
    });
  };

  const previewPoints = pendingWire
    ? pendingWire.originKind === 'output'
      ? computeOrthogonalPath(pendingWire.startPoint, pendingWire.pointerPoint)
      : computeOrthogonalPath(pendingWire.pointerPoint, pendingWire.startPoint)
    : null;

  const hasTestSuite = Boolean(level.testCases && level.testCases.length > 0);
  const is8BitBin = level.bits >= 8 && radix === 'BIN';
  const mandatoryWarningText = !testSuite.allGatesPlaced
    ? `[!] TARGET MATCHED — USE REMAINING GATES TO VERIFY (${testSuite.remainingGateCount} LEFT IN STOCK)`
    : '[!] TARGET MATCHED — CONNECT ALL PLACED GATES INTO CIRCUIT TO VERIFY';

  return (
    <main
      ref={canvasRef}
      data-testid="circuit-canvas"
      onPointerDown={() => {
        onSelectNode(null);
        setPendingWire(null);
      }}
      className="pcb-grid-bg relative flex-1 overflow-hidden select-none"
    >
      {/* Top Canvas HUD Stack: Level Objective + Optional Test Suite Bar */}
      <div className="pointer-events-none absolute top-3 left-4 right-4 z-20 flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="pointer-events-auto flex flex-wrap items-center gap-2 border border-[#2B323B] bg-[#0B0E11]/95 px-3 py-1.5 text-xs text-[#C9D1D9]">
            <span className="font-bold text-[#00FF66] whitespace-nowrap">
              CH{level.chapter} • LVL {pad2(level.number)}
            </span>
            <span className="text-[#4B5868]" aria-hidden="true">
              /
            </span>
            <span>{level.objective}</span>
            {level.bits >= 8 && (
              <span
                data-testid="badge-8bit"
                className="border border-[#38BDF8] bg-[#38BDF8]/15 px-1.5 py-0.5 font-mono text-[11px] font-bold tracking-wide text-[#38BDF8] whitespace-nowrap"
              >
                [8-BIT]
              </span>
            )}
            {level.mustUseAllGates && (
              <span
                data-testid="rule-use-all-gates"
                className="border border-[#FFB000] bg-[#FFB000]/15 px-1.5 py-0.5 font-mono text-[11px] font-bold tracking-wide text-[#FFB000] whitespace-nowrap"
              >
                [RULE: USE ALL GATES]
              </span>
            )}
            {level.outputFault === 'INVERT' && (
              <span
                data-testid="hint-output-fault"
                className="border border-[#FF5555] bg-[#FF5555]/15 px-1.5 py-0.5 font-mono text-[11px] font-bold tracking-wide text-[#FF5555] whitespace-nowrap"
              >
                [! FAULT: INVERTED OUT]
              </span>
            )}
          </div>

          <div className="pointer-events-auto flex items-center gap-2">
            {/* Transient error/status toast */}
            {statusMessage && (
              <div
                role="status"
                className="border border-[#FFB000] bg-[#0B0E11]/95 px-3 py-1.5 font-mono text-xs font-semibold text-[#FFB000]"
              >
                {statusMessage}
              </div>
            )}

            {/* Re-open toggle when user dismissed the Victory Banner */}
            {testSuite.isSolved && victoryDismissed && (
              <button
                type="button"
                data-testid="reopen-victory-banner"
                onClick={(e) => {
                  e.stopPropagation();
                  setVictoryDismissed(false);
                }}
                className="inline-flex h-8 items-center gap-1.5 rounded-[2px] border border-[#00FF66] bg-[#0B0E11]/95 px-3 font-mono text-xs font-bold text-[#00FF66] hover:bg-[#00FF66]/15 cursor-pointer whitespace-nowrap"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>[OK] VERIFIED — SHOW BANNER</span>
              </button>
            )}
          </div>
        </div>

        {/* Multi-Test Suite Bar (Clickable tabs switching live canvas preview) */}
        {hasTestSuite && (
          <div
            data-testid="test-suite-bar"
            onPointerDown={(e) => e.stopPropagation()}
            className="pointer-events-auto inline-flex w-fit flex-wrap items-center gap-1.5 border border-[#2B323B] bg-[#0B0E11]/95 px-2.5 py-1.5 font-mono text-xs"
            role="tablist"
            aria-label="Circuit verification test cases"
          >
            <span
              data-testid="test-suite-summary"
              className={`mr-1 font-bold tracking-wider whitespace-nowrap ${
                testSuite.allTestsPassed ? 'text-[#00FF66]' : 'text-[#8B98A8]'
              }`}
            >
              TESTS {testSuite.passedCount}/{testSuite.totalCount}:
            </span>
            {testSuite.testResults.map((tc, idx) => {
              const isActive = idx === activeTestIndex;
              return (
                <button
                  key={tc.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  data-testid={`test-tab-${idx}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectTestIndex(idx);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-[2px] border px-2.5 py-1 text-[11px] font-bold tracking-wide transition-colors cursor-pointer whitespace-nowrap ${
                    isActive
                      ? tc.passed
                        ? 'border-[#00FF66] bg-[#00FF66]/20 text-[#00FF66]'
                        : 'border-[#38BDF8] bg-[#38BDF8]/15 text-[#E6EDF3]'
                      : tc.passed
                        ? 'border-[#00FF66]/40 bg-[#0D1C14]/80 text-[#00FF66]/90 hover:border-[#00FF66]'
                        : 'border-[#2B323B] bg-[#11161C] text-[#8B98A8] hover:border-[#4B5868] hover:text-[#E6EDF3]'
                  }`}
                >
                  <span>{tc.label}</span>
                  <span
                    className={
                      tc.passed ? 'text-[#00FF66]' : 'text-[#FF5555]'
                    }
                  >
                    {tc.passed ? '[PASS]' : '[FAIL]'}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Mandatory Gates Incomplete Warning Banner (Top-Center, Non-Blocking) */}
      {testSuite.allTestsPassed && testSuite.missingMandatoryGates && (
        <div
          role="status"
          data-testid="mandatory-gates-banner"
          onPointerDown={(e) => e.stopPropagation()}
          className={`absolute ${
            hasTestSuite ? 'top-[92px]' : 'top-14'
          } left-1/2 z-30 flex max-w-[92vw] -translate-x-1/2 items-center gap-2.5 border-2 border-[#FFB000] bg-[#0B0E11]/95 px-4 py-2 font-mono text-xs font-bold tracking-wide text-[#FFB000] shadow-[4px_4px_0px_#000000]`}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="whitespace-nowrap">{mandatoryWarningText}</span>
        </div>
      )}

      {/* Compact Top-Center Victory Banner with Dismiss Button (Never overlaps VAR B/C or Test Suite Bar!) */}
      {testSuite.isSolved && !victoryDismissed && (
        <div
          role="status"
          data-testid="level-complete-banner"
          onPointerDown={(e) => e.stopPropagation()}
          className={`absolute ${
            hasTestSuite ? 'top-[92px]' : 'top-14'
          } left-1/2 z-30 flex max-w-[92vw] -translate-x-1/2 flex-wrap sm:flex-nowrap items-center justify-center gap-3 border-2 border-[#00FF66] bg-[#0B0E11]/95 px-4 py-2 shadow-[4px_4px_0px_#000000]`}
        >
          <span className="font-mono text-xs font-bold tracking-wide text-[#00FF66] whitespace-nowrap">
            [OK] CIRCUIT VERIFIED //{' '}
            {hasTestSuite
              ? `ALL ${testSuite.totalCount} TESTS PASSED`
              : 'TARGET MATCHED'}{' '}
            -&gt; {hasNextLevel ? 'NEXT LEVEL' : 'ALL CHAPTERS CLEARED'}
          </span>
          {hasNextLevel ? (
            <button
              type="button"
              onClick={onNextLevel}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[2px] bg-[#00FF66] px-3 text-[11px] font-bold tracking-wider text-[#0B0E11] hover:bg-[#33FF85] transition-colors cursor-pointer whitespace-nowrap"
              style={{ fontFamily: 'var(--font-pixel)' }}
            >
              <span>NEXT LEVEL</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onReplayFirstLevel}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[2px] bg-[#00FF66] px-3 text-[11px] font-bold tracking-wider text-[#0B0E11] hover:bg-[#33FF85] transition-colors cursor-pointer whitespace-nowrap"
              style={{ fontFamily: 'var(--font-pixel)' }}
            >
              <span>REPLAY LVL 01</span>
            </button>
          )}
          <button
            type="button"
            aria-label="Dismiss victory banner"
            title="Hide banner to inspect circuit"
            onClick={() => setVictoryDismissed(true)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[2px] border border-[#2B323B] text-[#8B98A8] hover:border-[#00FF66] hover:text-[#00FF66] transition-colors cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* SVG Layer: Strict 90-Degree Orthogonal Manhattan Wires */}
      <svg
        data-testid="wires-svg"
        className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible"
      >
        {wires.map((wire) => {
          const fromNode = nodeById.get(wire.fromNodeId);
          const toNode = nodeById.get(wire.toNodeId);
          if (!fromNode || !toNode) return null;

          // Detect parallel fan-out wires from the exact same output to both pins of the same gate
          const samePairWires = wires.filter(
            (w) => w.fromNodeId === wire.fromNodeId && w.toNodeId === wire.toNodeId
          );
          const laneOffset =
            samePairWires.length > 1 ? (wire.toInputIndex === 0 ? -14 : 14) : 0;

          const start = getOutputPinPosition(fromNode);
          const end = getInputPinPosition(toNode, wire.toInputIndex);
          const points = computeOrthogonalPath(start, end, laneOffset);
          const labelPt = getPolylineLabelPoint(points, laneOffset);
          const val = evaluation.wireValues[wire.id] ?? null;
          const isActive = val !== null;
          const isHovered = hoveredWireId === wire.id;

          const strokeColor = isHovered
            ? '#FFB000'
            : isActive
              ? '#00FF66'
              : '#2B323B';

          const formattedVal = formatValue(val, radix, level.bits);
          const toPinLabel =
            toNode.kind === 'gate' && toNode.operator
              ? OPERATORS[toNode.operator].inputPinLabels[wire.toInputIndex] ??
                String(wire.toInputIndex + 1)
              : 'IN';

          const displayText = isHovered ? `${formattedVal} ×` : formattedVal;
          const badgeWidth = Math.max(52, displayText.length * 8 + 16);
          const halfBadgeW = Math.round(badgeWidth / 2);

          const isTightParallelSecondary =
            samePairWires.length > 1 &&
            wire.id !== samePairWires[0].id &&
            !isHovered &&
            (points.length !== 4 || Math.abs(points[3].x - points[2].x) < badgeWidth + 4);

          return (
            <g key={wire.id} data-testid={`wire-${wire.id}`}>
              <polyline
                points={pointsToSvgAttr(points)}
                fill="none"
                stroke="transparent"
                strokeWidth={16}
                strokeLinejoin="miter"
                className="pointer-events-auto cursor-pointer"
                role="button"
                tabIndex={0}
                aria-label={`Disconnect wire from ${fromNode.label} to ${toNode.label} input ${toPinLabel} (value ${formattedVal})`}
                onPointerEnter={() => setHoveredWireId(wire.id)}
                onPointerLeave={() => setHoveredWireId(null)}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onDisconnectWire(wire.id);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDisconnectWire(wire.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ' || e.key === 'Delete' || e.key === 'Backspace') {
                    e.preventDefault();
                    onDisconnectWire(wire.id);
                  }
                }}
              />

              <polyline
                points={pointsToSvgAttr(points)}
                fill="none"
                stroke={strokeColor}
                strokeWidth={isHovered ? 3 : 2.5}
                strokeLinejoin="miter"
                strokeLinecap="square"
                strokeDasharray={!isActive && !isHovered ? '6 4' : undefined}
                className="pointer-events-none transition-colors"
              />

              <rect
                x={start.x - 3}
                y={start.y - 3}
                width={6}
                height={6}
                fill={strokeColor}
                className="pointer-events-none"
              />
              <rect
                x={end.x - 3}
                y={end.y - 3}
                width={6}
                height={6}
                fill={strokeColor}
                className="pointer-events-none"
              />

              {!isTightParallelSecondary && (
                <g
                  transform={`translate(${labelPt.x}, ${labelPt.y})`}
                  className="pointer-events-none"
                >
                  <rect
                    x={-halfBadgeW}
                    y={-11}
                    width={badgeWidth}
                    height={22}
                    rx={1}
                    fill="#0B0E11"
                    stroke={strokeColor}
                    strokeWidth={1.5}
                  />
                  <text
                    x={0}
                    y={4}
                    textAnchor="middle"
                    fill={isHovered ? '#FFB000' : isActive ? '#00FF66' : '#6E7A8A'}
                    fontSize="11"
                    fontWeight="700"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {displayText}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {previewPoints && (
          <polyline
            points={pointsToSvgAttr(previewPoints)}
            fill="none"
            stroke="#00FF66"
            strokeWidth={2}
            strokeDasharray="5 4"
            strokeLinejoin="miter"
            strokeLinecap="square"
            className="pointer-events-none"
          />
        )}
      </svg>

      {/* Interactive Nodes Layer */}
      {nodes.map((node) => {
        const dims = getNodeDimensions(node);
        const value = evaluation.nodeValues[node.id] ?? null;
        const formattedVal = formatValue(value, radix, level.bits);
        const isSelected = selectedNodeId === node.id;
        const inputCount = getInputCountForNode(node);

        const isSource = node.kind === 'source';
        const isGate = node.kind === 'gate';
        const isTarget = node.kind === 'target';
        const gateDef = isGate && node.operator ? OPERATORS[node.operator] : null;

        const sourceCfg = isSource && node.sourceKey ? varConfigByKey.get(node.sourceKey) : null;
        const isEditableSource = Boolean(sourceCfg?.editable);
        const isSourceInvalid =
          isSource && node.sourceKey ? !sourceValidByKey[node.sourceKey] : false;

        const targetKey = node.targetKey ?? 'OUT';
        const isTargetFaulty = isTarget && Boolean(node.outputFault);
        const isPortMatched = isTarget && evaluation.targetMatches[targetKey] === true;
        const isTargetPendingGates =
          isTarget && isPortMatched && testSuite.missingMandatoryGates;
        const isTargetMatchedVisual = isTarget && isPortMatched && !isTargetPendingGates;

        const borderClass = isTargetMatchedVisual
          ? 'border-[#00FF66] bg-[#0D1C14]'
          : isTargetPendingGates || isSourceInvalid
            ? 'border-[#FFB000] bg-[#1C160C]'
            : isTargetFaulty
              ? 'border-[#FF5555] bg-[#1D1113]'
              : isSelected
                ? 'border-[#00FF66] bg-[#141C24]'
                : 'border-[#394452] bg-[#141A22] hover:border-[#5A687A]';

        const connectedInputs = new Set(
          wires.filter((w) => w.toNodeId === node.id).map((w) => w.toInputIndex)
        );
        const hasOutgoing = wires.some((w) => w.fromNodeId === node.id);

        return (
          <div
            key={node.id}
            data-testid={`node-${node.id}`}
            onPointerDown={(e) => handleNodePointerDown(e, node)}
            style={{
              left: node.x,
              top: node.y,
              width: dims.width,
              height: dims.height,
            }}
            className={`absolute z-20 flex flex-col justify-between rounded-[2px] border-2 transition-colors cursor-grab active:cursor-grabbing ${borderClass}`}
          >
            {/* LEFT INPUT PINS */}
            {inputCount > 0 &&
              Array.from({ length: inputCount }).map((_, idx) => {
                const pinPos = getInputPinPosition(node, idx);
                const relY = pinPos.y - node.y - 2;
                const pinLabel = gateDef ? gateDef.inputPinLabels[idx] : 'IN';
                const isConnected = connectedInputs.has(idx);
                const isPendingOrigin =
                  pendingWire?.originKind === 'input' &&
                  pendingWire.nodeId === node.id &&
                  pendingWire.inputIndex === idx;
                const isCompatibleTarget = pendingWire?.originKind === 'output';

                return (
                  <React.Fragment key={idx}>
                    <button
                      type="button"
                      data-pin-kind="input"
                      data-node-id={node.id}
                      data-input-index={idx}
                      aria-label={`Input pin ${pinLabel} of ${node.label}`}
                      onPointerDown={(e) => handleInputPinPointerDown(e, node, idx)}
                      onClick={(e) => handleInputPinClick(e, node, idx)}
                      style={{
                        left: -PIN_PROTRUSION - 2,
                        top: relY - 8,
                        width: PIN_PROTRUSION,
                        height: 16,
                      }}
                      className={`absolute flex items-center justify-center bg-[#000000] border transition-colors cursor-crosshair ${
                        isPendingOrigin
                          ? 'border-[#00FF66] ring-2 ring-[#00FF66]/50'
                          : isCompatibleTarget
                            ? 'border-[#FFB000] hover:border-[#00FF66]'
                            : isConnected
                              ? 'border-[#00FF66]'
                              : 'border-[#6E7A8A] hover:border-[#E6EDF3]'
                      }`}
                    />
                    {isGate && (
                      <span
                        style={{ top: relY - 8 }}
                        className={`pointer-events-none absolute left-1.5 font-mono text-[11px] font-bold leading-4 ${
                          gateDef?.nonCommutative ? 'text-[#FFB000]' : 'text-[#8B98A8]'
                        }`}
                      >
                        {pinLabel}
                      </span>
                    )}
                  </React.Fragment>
                );
              })}

            {/* RIGHT OUTPUT PIN */}
            {!isTarget && (() => {
              const outPinPos = getOutputPinPosition(node);
              const outRelY = outPinPos.y - node.y - 2;
              return (
                <button
                  type="button"
                  data-pin-kind="output"
                  data-node-id={node.id}
                  aria-label={`Output pin of ${node.label}`}
                  onPointerDown={(e) => handleOutputPinPointerDown(e, node)}
                  onClick={(e) => handleOutputPinClick(e, node)}
                  style={{
                    right: -PIN_PROTRUSION - 2,
                    top: outRelY - 8,
                    width: PIN_PROTRUSION,
                    height: 16,
                  }}
                  className={`absolute flex items-center justify-center bg-[#000000] border transition-colors cursor-crosshair ${
                    pendingWire?.originKind === 'output' && pendingWire.nodeId === node.id
                      ? 'border-[#00FF66] ring-2 ring-[#00FF66]/50'
                      : pendingWire?.originKind === 'input'
                        ? 'border-[#FFB000] hover:border-[#00FF66]'
                        : hasOutgoing && value !== null
                          ? 'border-[#00FF66]'
                          : 'border-[#6E7A8A] hover:border-[#E6EDF3]'
                  }`}
                />
              );
            })()}

            {/* NODE HEADER BAR */}
            <div className="flex items-center justify-between gap-1 border-b border-[#2B323B] bg-[#0E1319] px-2.5 py-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className={`${
                    isTarget && node.label.length > 5 ? 'text-[9px]' : 'text-[10px]'
                  } tracking-wider truncate ${
                    isTargetMatchedVisual
                      ? 'text-[#00FF66]'
                      : isTargetPendingGates || isEditableSource
                        ? 'text-[#FFB000]'
                        : 'text-[#E6EDF3]'
                  }`}
                  style={{ fontFamily: 'var(--font-pixel)' }}
                >
                  {isSource ? `VAR ${node.sourceKey}` : isTarget ? node.label : gateDef?.label}
                </span>
              </div>

              {isSource && (
                <span
                  className={`font-mono text-[10px] font-semibold shrink-0 ${
                    isEditableSource ? 'text-[#FFB000]' : 'text-[#6E7A8A]'
                  }`}
                >
                  {isEditableSource ? (isSourceInvalid ? 'ERR' : 'EDIT') : 'FIX'}
                </span>
              )}

              {isTarget && (
                <span
                  className={`font-mono text-[10px] font-bold shrink-0 ${
                    isTargetMatchedVisual
                      ? 'text-[#00FF66]'
                      : isTargetPendingGates
                        ? 'text-[#FFB000]'
                        : isTargetFaulty
                          ? 'text-[#FF5555]'
                          : 'text-[#8B98A8]'
                  }`}
                >
                  {isTargetMatchedVisual
                    ? 'MATCH'
                    : isTargetPendingGates
                      ? 'GATES!'
                      : isTargetFaulty
                        ? 'FAULT'
                        : 'GOAL'}
                </span>
              )}

              {isGate && (
                <button
                  type="button"
                  aria-label={`Delete ${node.label} gate`}
                  title="Remove gate (refunds to inventory)"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteGate(node.id);
                  }}
                  className="flex h-5 w-5 items-center justify-center border border-transparent text-[#8B98A8] hover:border-[#FFB000] hover:text-[#FFB000] cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Hardware Fault Warning Strip on Faulty OUT Port */}
            {isTargetFaulty && (
              <div
                data-testid={targetKey === 'OUT' ? 'output-fault-badge' : `output-fault-badge-${targetKey}`}
                className="border-b border-[#FF5555]/50 bg-[#FF5555]/15 px-2 py-1 text-center font-mono text-[10px] font-bold tracking-wider text-[#FF7B7B]"
              >
                [! FAULT: INVERTED]
              </div>
            )}

            {/* NODE BODY */}
            <div className="flex flex-1 flex-col items-center justify-center px-3 py-1.5">
              {isSource && (
                <>
                  <div
                    data-testid={`value-${node.id}`}
                    className={`font-mono ${
                      is8BitBin ? 'text-sm tracking-wider' : 'text-lg tracking-widest'
                    } font-bold tabular-nums ${
                      isSourceInvalid
                        ? 'text-[#FFB000]'
                        : value !== null
                          ? 'text-[#00FF66]'
                          : 'text-[#6E7A8A]'
                    }`}
                  >
                    {isSourceInvalid ? 'ERR!' : formattedVal}
                  </div>
                  <div className="font-mono text-[10px] text-[#6E7A8A]">{radix}</div>
                </>
              )}

              {isGate && gateDef && (
                <>
                  <div
                    className={`font-mono text-[10px] font-semibold ${
                      gateDef.nonCommutative ? 'text-[#FFB000]' : 'text-[#8B98A8]'
                    }`}
                  >
                    {gateDef.symbol}
                  </div>
                  <div
                    data-testid={`value-${node.id}`}
                    className={`mt-0.5 font-mono ${
                      is8BitBin ? 'text-sm tracking-wider' : 'text-base tracking-widest'
                    } font-bold tabular-nums ${
                      value !== null ? 'text-[#00FF66]' : 'text-[#526071]'
                    }`}
                  >
                    {formattedVal}
                  </div>
                </>
              )}

              {isTarget && (() => {
                const expectedVal = activeTargetExpecteds[targetKey] ?? level.targetValue;
                const rawVal = evaluation.targetRawValues[targetKey] ?? null;
                return (
                  <div className="flex w-full flex-col gap-1 font-mono tabular-nums">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#8B98A8]">TGT</span>
                      <span
                        data-testid={
                          targetKey === 'OUT'
                            ? 'target-expected-value'
                            : `target-expected-${targetKey}`
                        }
                        className="font-bold tracking-wider text-[#E6EDF3]"
                      >
                        {formatValue(expectedVal, radix, level.bits)}
                      </span>
                    </div>
                    {isTargetFaulty && (
                      <div className="flex items-center justify-between border-t border-[#2B323B] pt-1 text-[11px]">
                        <span className="text-[#FF7B7B]">RAW</span>
                        <span
                          data-testid={
                            targetKey === 'OUT'
                              ? 'target-raw-value'
                              : `target-raw-${targetKey}`
                          }
                          className="font-bold tracking-wider text-[#FFB000]"
                        >
                          {formatValue(rawVal, radix, level.bits)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between border-t border-[#2B323B] pt-1 text-[11px]">
                      <span className="text-[#8B98A8]">
                        {isTargetFaulty ? 'IN (~RAW)' : 'IN'}
                      </span>
                      <span
                        data-testid={
                          targetKey === 'OUT'
                            ? 'target-actual-value'
                            : `target-actual-${targetKey}`
                        }
                        className={`font-bold tracking-wider ${
                          isTargetMatchedVisual
                            ? 'text-[#00FF66]'
                            : value !== null
                              ? 'text-[#FFB000]'
                              : 'text-[#526071]'
                        }`}
                      >
                        {formattedVal}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        );
      })}
    </main>
  );
};
