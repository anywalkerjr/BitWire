import React from 'react';
import { OPERATORS, OperatorType } from '../core/operators';
import { InventoryAllowance } from '../data/levels';

interface InventoryDockProps {
  inventory: InventoryAllowance[];
  remainingCounts: Record<OperatorType, number>;
  onSpawnGate: (type: OperatorType, dropCoords?: { x: number; y: number }) => void;
  canvasRef: React.RefObject<HTMLDivElement | null>;
}

export const InventoryDock: React.FC<InventoryDockProps> = ({
  inventory,
  remainingCounts,
  onSpawnGate,
  canvasRef,
}) => {
  const handleDragStart = (
    e: React.PointerEvent<HTMLButtonElement>,
    type: OperatorType,
    remaining: number
  ) => {
    if (remaining <= 0) return;

    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;

    const onMove = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > 10) {
        moved = true;
      }
    };

    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);

      if (moved && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        if (
          ev.clientX >= rect.left &&
          ev.clientX <= rect.right &&
          ev.clientY >= rect.top &&
          ev.clientY <= rect.bottom
        ) {
          onSpawnGate(type, {
            x: Math.round(ev.clientX - rect.left - 76),
            y: Math.round(ev.clientY - rect.top - 48),
          });
        }
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <footer
      aria-label="Logic gate inventory dock"
      className="relative z-30 flex flex-wrap items-center justify-between gap-4 border-t-2 border-[#2B323B] bg-[#11161C] px-5 py-3 select-none"
    >
      <div className="flex items-center gap-3 overflow-x-auto">
        <span className="font-mono text-[11px] font-bold tracking-wider text-[#8B98A8] whitespace-nowrap">
          GATE STOCK:
        </span>

        {inventory.map((item) => {
          const def = OPERATORS[item.type];
          const remaining = remainingCounts[item.type] ?? 0;
          const depleted = remaining <= 0;

          return (
            <button
              key={item.type}
              type="button"
              disabled={depleted}
              data-testid={`dock-gate-${item.type}`}
              aria-label={`Spawn ${def.label} gate (${remaining} remaining)`}
              onPointerDown={(e) => handleDragStart(e, item.type, remaining)}
              onClick={() => onSpawnGate(item.type)}
              className={`group flex items-center gap-3 rounded-[2px] border-2 px-3.5 py-2 text-left transition-colors whitespace-nowrap ${
                depleted
                  ? 'cursor-not-allowed border-[#1F262E] bg-[#0B0E11] opacity-45'
                  : 'cursor-pointer border-[#394452] bg-[#141A22] hover:border-[#00FF66] hover:bg-[#16231C]'
              }`}
            >
              {/* Miniature chip pin icon */}
              <div className="relative flex h-7 w-10 items-center justify-center border border-[#4B5868] bg-[#0B0E11]">
                {def.inputCount === 1 ? (
                  <span className="absolute -left-1.5 h-2 w-1.5 bg-[#000000] border border-[#6E7A8A]" />
                ) : (
                  <>
                    <span className="absolute -left-1.5 top-1 h-1.5 w-1.5 bg-[#000000] border border-[#6E7A8A]" />
                    <span className="absolute -left-1.5 bottom-1 h-1.5 w-1.5 bg-[#000000] border border-[#6E7A8A]" />
                  </>
                )}
                <span className="absolute -right-1.5 h-2 w-1.5 bg-[#000000] border border-[#6E7A8A]" />
                <span
                  className="text-[8px] text-[#E6EDF3]"
                  style={{ fontFamily: 'var(--font-pixel)' }}
                >
                  {def.label}
                </span>
              </div>

              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[11px] ${
                      depleted ? 'text-[#6E7A8A]' : 'text-[#E6EDF3] group-hover:text-[#00FF66]'
                    }`}
                    style={{ fontFamily: 'var(--font-pixel)' }}
                  >
                    {def.label}
                  </span>
                  <span
                    data-testid={`dock-count-${item.type}`}
                    className={`font-mono text-xs font-bold tabular-nums ${
                      depleted ? 'text-[#6E7A8A]' : 'text-[#00FF66]'
                    }`}
                  >
                    (x{remaining})
                  </span>
                </div>
                <span className="font-mono text-[10px] text-[#8B98A8]">{def.symbol}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="hidden lg:flex items-center gap-3 font-mono text-[11px] text-[#6E7A8A] whitespace-nowrap">
        <span>CLICK OR DRAG GATE TO PLACE</span>
        <span aria-hidden="true">·</span>
        <span>CONNECT PINS TO WIRE</span>
        <span aria-hidden="true">·</span>
        <span>CLICK WIRE TO CUT</span>
        <span aria-hidden="true">·</span>
        <span>DEL REMOVES GATE</span>
      </div>
    </footer>
  );
};
