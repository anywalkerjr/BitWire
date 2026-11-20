import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronUp, RotateCcw, Tv, Volume2, VolumeX } from 'lucide-react';
import { Radix, RADIX_OPTIONS } from '../core/radix';
import { CHAPTER_GROUPS, LevelDefinition } from '../data/levels';

interface TopBarProps {
  levels: readonly LevelDefinition[];
  currentLevelIndex: number;
  solvedLevelIds: Set<string>;
  radix: Radix;
  drawerOpen: boolean;
  anyVarHasError: boolean;
  scanlines: boolean;
  muted: boolean;
  onSelectLevel: (index: number) => void;
  onChangeRadix: (radix: Radix) => void;
  onToggleDrawer: () => void;
  onResetLevel: () => void;
  onToggleScanlines: () => void;
  onToggleMute: () => void;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export const TopBar: React.FC<TopBarProps> = ({
  levels,
  currentLevelIndex,
  solvedLevelIds,
  radix,
  drawerOpen,
  anyVarHasError,
  scanlines,
  muted,
  onSelectLevel,
  onChangeRadix,
  onToggleDrawer,
  onResetLevel,
  onToggleScanlines,
  onToggleMute,
}) => {
  const currentLevel = levels[currentLevelIndex];
  const [levelMenuOpen, setLevelMenuOpen] = useState(false);
  const levelSelectorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!levelMenuOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (levelSelectorRef.current && !levelSelectorRef.current.contains(e.target as Node)) {
        setLevelMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLevelMenuOpen(false);
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [levelMenuOpen]);

  const handleLevelKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!levelMenuOpen) {
        setLevelMenuOpen(true);
      } else {
        onSelectLevel((currentLevelIndex + 1) % levels.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!levelMenuOpen) {
        setLevelMenuOpen(true);
      } else {
        onSelectLevel((currentLevelIndex - 1 + levels.length) % levels.length);
      }
    }
  };

  const currentSolved = solvedLevelIds.has(currentLevel.id);
  const activeVarKeys = currentLevel.variables.map((v) => v.key).join(', ');

  return (
    <header className="relative z-30 flex items-center justify-between gap-2.5 border-b-2 border-[#2B323B] bg-[#11161C] px-3.5 py-2.5 select-none">
      {/* Left: Brand Title & Fixed-Width Compact Level Selector */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="flex items-center gap-2 shrink-0">
          <div
            aria-hidden="true"
            className="flex h-7 w-7 items-center justify-center border-2 border-[#00FF66] bg-[#0B0E11] text-[10px] font-bold text-[#00FF66]"
          >
            01
          </div>
          <h1
            className="text-xs xl:text-sm tracking-wider text-[#00FF66] whitespace-nowrap"
            style={{ fontFamily: 'var(--font-pixel)' }}
          >
            BitWire
          </h1>
        </div>

        <div className="h-5 w-[2px] bg-[#2B323B] shrink-0" aria-hidden="true" />

        <div ref={levelSelectorRef} className="relative w-[248px] xl:w-[340px] shrink-0">
          <button
            id="level-selector"
            type="button"
            role="combobox"
            aria-label="Select level"
            aria-haspopup="listbox"
            aria-expanded={levelMenuOpen}
            aria-controls="level-selector-listbox"
            onClick={() => setLevelMenuOpen((open) => !open)}
            onKeyDown={handleLevelKeyDown}
            className={`flex h-9 w-full cursor-pointer items-stretch overflow-hidden rounded-[2px] border-2 bg-[#0B0E11] text-left transition-colors ${
              levelMenuOpen
                ? 'border-[#00FF66] shadow-[0_0_0_1px_rgba(0,255,102,0.2)]'
                : 'border-[#2B323B] hover:border-[#4B5868]'
            }`}
          >
            <span className="flex min-w-0 flex-1 items-center justify-between gap-1 px-2">
              <span className="flex min-w-0 items-center gap-1.5 font-mono text-xs whitespace-nowrap">
                <span className="font-bold text-[#00FF66]">
                  <span className="hidden xl:inline">
                    CH{currentLevel.chapter} • LVL {pad2(currentLevel.number)}:
                  </span>
                  <span className="xl:hidden">
                    CH{currentLevel.chapter}•{pad2(currentLevel.number)}:
                  </span>
                </span>
                <span className="truncate font-semibold text-[#E6EDF3]">
                  {currentLevel.title}
                </span>
              </span>
              {currentSolved && (
                <span className="shrink-0 font-mono text-[10px] font-bold text-[#00FF66]">
                  [OK]
                </span>
              )}
            </span>
            <span
              className={`flex w-7 shrink-0 items-center justify-center border-l border-[#2B323B] bg-[#141A22] transition-colors ${
                levelMenuOpen ? 'text-[#00FF66]' : 'text-[#8B98A8]'
              }`}
            >
              {levelMenuOpen ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </span>
          </button>

          {levelMenuOpen && (
            <div
              id="level-selector-listbox"
              role="listbox"
              aria-label="Available levels"
              className="absolute top-[calc(100%+4px)] left-0 z-50 max-h-[540px] w-[320px] overflow-y-auto rounded-[2px] border-2 border-[#00FF66] bg-[#0B0E11] shadow-[4px_4px_0px_#000000]"
            >
              {CHAPTER_GROUPS.map((group) => (
                <div key={group.chapter} role="group" aria-label={group.heading}>
                  <div className="sticky top-0 z-10 border-y border-[#2B323B] bg-[#141A22] px-2.5 py-1.5 font-mono text-[10px] font-bold tracking-wider text-[#FFB000] first:border-t-0">
                    {group.heading}
                  </div>
                  <ul>
                    {group.levels.map((lvl) => {
                      const idx = levels.findIndex((item) => item.id === lvl.id);
                      const isSelected = idx === currentLevelIndex;
                      const isSolved = solvedLevelIds.has(lvl.id);
                      return (
                        <li key={lvl.id} role="option" aria-selected={isSelected}>
                          <button
                            type="button"
                            onClick={() => {
                              onSelectLevel(idx);
                              setLevelMenuOpen(false);
                            }}
                            className={`flex w-full cursor-pointer items-center justify-between gap-2 border-b border-[#1D242D] px-2.5 py-2 text-left font-mono text-xs transition-colors last:border-b-0 ${
                              isSelected
                                ? 'bg-[#00FF66]/15 font-bold text-[#00FF66]'
                                : 'text-[#C9D1D9] hover:bg-[#141A22] hover:text-[#E6EDF3]'
                            }`}
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <span
                                className={`shrink-0 text-[9px] ${
                                  isSelected ? 'text-[#00FF66]' : 'text-[#6E7A8A]'
                                }`}
                                style={{ fontFamily: 'var(--font-pixel)' }}
                              >
                                {pad2(lvl.number)}
                              </span>
                              <span className="truncate">{lvl.title}</span>
                            </span>
                            <span className="flex shrink-0 items-center gap-1.5">
                              {lvl.bits >= 8 && !isSolved && (
                                <span className="text-[10px] font-bold text-[#38BDF8]">
                                  8B
                                </span>
                              )}
                              {lvl.outputs && lvl.outputs.length > 1 && !isSolved && (
                                <span className="text-[10px] font-bold text-[#C084FC]">
                                  2OUT
                                </span>
                              )}
                              {lvl.outputFault && !isSolved && (
                                <span className="text-[10px] font-bold text-[#FF5555]">
                                  FLT
                                </span>
                              )}
                              {lvl.mustUseAllGates && !isSolved && (
                                <span className="text-[10px] font-semibold text-[#FFB000]">
                                  ALL
                                </span>
                              )}
                              {isSolved && (
                                <span className="text-[10px] font-bold text-[#00FF66]">[OK]</span>
                              )}
                              {isSelected && <Check className="h-3.5 w-3.5 text-[#00FF66]" />}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Center: Number System (Radix) Switcher */}
      <div
        role="group"
        aria-label="Number system radix switcher"
        className="flex items-center border border-[#2B323B] bg-[#0B0E11] p-0.5 shrink-0"
      >
        {RADIX_OPTIONS.map((opt) => {
          const active = radix === opt;
          return (
            <button
              key={opt}
              type="button"
              aria-pressed={active}
              onClick={() => onChangeRadix(opt)}
              className={`h-8 px-2.5 xl:px-3 text-xs font-bold tracking-wider transition-colors whitespace-nowrap cursor-pointer ${
                active
                  ? 'bg-[#00FF66] text-[#0B0E11]'
                  : 'text-[#8B98A8] hover:bg-[#19212B] hover:text-[#E6EDF3]'
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {/* Right: Variables Drawer Toggle + Workspace Controls */}
      <div className="flex items-center gap-1.5 xl:gap-2 shrink-0">
        <button
          type="button"
          aria-expanded={drawerOpen}
          aria-controls="variables-drawer"
          onClick={onToggleDrawer}
          className={`flex h-9 items-center gap-1.5 rounded-[2px] border px-2.5 xl:px-3 text-xs font-semibold tracking-wide transition-colors whitespace-nowrap cursor-pointer ${
            anyVarHasError
              ? 'border-[#FFB000] bg-[#FFB000]/15 text-[#FFB000]'
              : drawerOpen
                ? 'border-[#00FF66] bg-[#00FF66]/10 text-[#00FF66]'
                : 'border-[#2B323B] bg-[#0B0E11] text-[#E6EDF3] hover:border-[#4B5868]'
          }`}
        >
          <span>
            <span className="hidden xl:inline">VARIABLES</span>
            <span className="xl:hidden">VARS</span> ({activeVarKeys})
            {anyVarHasError ? ' [!]' : ''}
          </span>
          {drawerOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>

        <button
          type="button"
          onClick={onResetLevel}
          title="Reset current circuit"
          aria-label="Reset current level"
          className="flex h-9 items-center gap-1.5 rounded-[2px] border border-[#2B323B] bg-[#0B0E11] px-2.5 text-xs font-semibold text-[#C9D1D9] hover:border-[#4B5868] hover:text-[#E6EDF3] transition-colors whitespace-nowrap cursor-pointer"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">RESET</span>
        </button>

        <button
          type="button"
          aria-pressed={scanlines}
          onClick={onToggleScanlines}
          title="Toggle CRT scanline overlay"
          aria-label="Toggle CRT scanlines"
          className={`flex h-9 items-center gap-1.5 rounded-[2px] border px-2.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
            scanlines
              ? 'border-[#00FF66]/70 bg-[#00FF66]/10 text-[#00FF66]'
              : 'border-[#2B323B] bg-[#0B0E11] text-[#8B98A8] hover:border-[#4B5868] hover:text-[#E6EDF3]'
          }`}
        >
          <Tv className="h-3.5 w-3.5" />
          <span className="hidden xl:inline">CRT</span>
        </button>

        <button
          type="button"
          aria-pressed={muted}
          onClick={onToggleMute}
          title={muted ? 'Unmute terminal audio' : 'Mute terminal audio'}
          aria-label={muted ? 'Unmute audio' : 'Mute audio'}
          className="flex h-9 w-9 items-center justify-center rounded-[2px] border border-[#2B323B] bg-[#0B0E11] text-[#8B98A8] hover:border-[#4B5868] hover:text-[#E6EDF3] transition-colors cursor-pointer"
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
};
