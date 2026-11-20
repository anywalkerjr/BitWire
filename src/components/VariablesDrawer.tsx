import React from 'react';
import { AlertTriangle, Check, Lock } from 'lucide-react';
import {
  countOnes,
  formatValue,
  Radix,
  VariableValidationResult,
} from '../core/radix';
import { LevelDefinition, VariableKey } from '../data/levels';

interface ActiveTargetInfo {
  id: string;
  label: string;
  value: bigint;
}

interface VariablesDrawerProps {
  open: boolean;
  level: LevelDefinition;
  radix: Radix;
  activeTestLabel?: string;
  activeSourceValues: Partial<Record<VariableKey, bigint | null>>;
  activeTargets: ActiveTargetInfo[];
  varRawByKey: Record<VariableKey, string>;
  varValidations: Record<VariableKey, VariableValidationResult>;
  onVarInputChange: (key: VariableKey, raw: string) => void;
  onToggleVarBit: (key: VariableKey, bitIndex: number) => void;
}

export const VariablesDrawer: React.FC<VariablesDrawerProps> = ({
  open,
  level,
  radix,
  activeTestLabel,
  activeSourceValues,
  activeTargets,
  varRawByKey,
  varValidations,
  onVarInputChange,
  onToggleVarBit,
}) => {
  if (!open) return null;

  const activeErrors = level.variables
    .filter((v) => v.editable && varValidations[v.key]?.error)
    .map((v) => ({ key: v.key, error: varValidations[v.key].error! }));

  const isMultiTest = Boolean(level.testCases && level.testCases.length > 0);
  const is8Bit = level.bits >= 8;

  return (
    <section
      id="variables-drawer"
      aria-label="Level variables table"
      className="relative z-20 border-b-2 border-[#2B323B] bg-[#0F141A] px-5 py-3 text-xs"
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold tracking-wider text-[#8B98A8]">
            INPUT REGISTER TABLE · {level.bits}-BIT UNSIGNED · ACTIVE RADIX: {radix}
            {activeTestLabel ? ` · PREVIEWING ${activeTestLabel}` : ''}
          </span>
          <span className="flex flex-wrap items-center gap-3 text-[#8B98A8]">
            {activeTargets.map((t) => (
              <span key={t.id}>
                {t.label} ={' '}
                <strong className="font-mono tabular-nums text-[#00FF66]">
                  {formatValue(t.value, radix, level.bits)}
                </strong>{' '}
                ({radix})
              </span>
            ))}
          </span>
        </div>

        <div className="overflow-x-auto border border-[#2B323B] bg-[#0B0E11]">
          <table className="w-full border-collapse text-left font-mono tabular-nums">
            <thead>
              <tr className="border-b border-[#2B323B] bg-[#141A22] text-[11px] text-[#8B98A8]">
                <th className="px-3 py-1.5 font-semibold">VAR</th>
                <th className="px-3 py-1.5 font-semibold">ACCESS</th>
                <th className="px-3 py-1.5 font-semibold">VALUE ({radix})</th>
                <th className="px-3 py-1.5 font-semibold">BITS ({level.bits}-BIT)</th>
                <th className="px-3 py-1.5 font-semibold">CONSTRAINT / STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2630]">
              {level.variables.map((v) => {
                const keyLower = v.key.toLowerCase();

                if (!v.editable) {
                  const val = activeSourceValues[v.key] ?? v.initialValue;
                  const formatted = formatValue(val, radix, level.bits);
                  const binary = formatValue(val, 'BIN', level.bits);

                  return (
                    <tr key={v.key}>
                      <td className="px-3 py-2 font-bold text-[#E6EDF3]">{v.key}</td>
                      <td className="px-3 py-2 text-[#8B98A8]">
                        <span className="inline-flex items-center gap-1">
                          <Lock className="h-3 w-3" />
                          {isMultiTest ? 'TEST INPUT' : 'FIXED'}
                        </span>
                      </td>
                      <td
                        className="px-3 py-2 text-sm font-bold text-[#00FF66]"
                        data-testid={`drawer-var-${keyLower}-value`}
                      >
                        {formatted}
                      </td>
                      <td className="px-3 py-2">
                        <div className="inline-flex items-center gap-1">
                          {binary.split('').map((bit, idx) => (
                            <span
                              key={idx}
                              className={`inline-flex h-6 w-6 items-center justify-center border text-xs font-bold ${
                                is8Bit && idx === 3 ? 'mr-1.5' : ''
                              } ${
                                bit === '1'
                                  ? 'border-[#00FF66]/60 bg-[#00FF66]/10 text-[#00FF66]'
                                  : 'border-[#2B323B] bg-[#11161C] text-[#6E7A8A]'
                              }`}
                            >
                              {bit}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-[#8B98A8]">
                        {isMultiTest
                          ? `DRIVEN BY ${activeTestLabel ?? 'TEST SUITE'}`
                          : 'LOCKED BY LEVEL SPEC'}
                      </td>
                    </tr>
                  );
                }

                const validation = varValidations[v.key];
                const rawVal = varRawByKey[v.key];
                const parsedVal = validation?.value ?? null;
                const binary =
                  parsedVal !== null
                    ? formatValue(parsedVal, 'BIN', level.bits)
                    : '-'.repeat(level.bits);
                const onesCount = parsedVal !== null ? countOnes(parsedVal) : null;

                return (
                  <tr key={v.key} className={!validation.valid ? 'bg-[#FFB000]/5' : ''}>
                    <td className="px-3 py-2 font-bold text-[#FFB000]">{v.key}</td>
                    <td className="px-3 py-2 font-semibold text-[#FFB000]">
                      {isMultiTest ? 'CONST MASK' : 'EDITABLE'}
                    </td>
                    <td className="px-3 py-2">
                      <label htmlFor={`var-${keyLower}-input`} className="sr-only">
                        Variable {v.key} value in {radix}
                      </label>
                      <input
                        id={`var-${keyLower}-input`}
                        data-testid={`var-${keyLower}-input`}
                        type="text"
                        value={rawVal}
                        onChange={(e) => onVarInputChange(v.key, e.target.value)}
                        spellCheck={false}
                        autoComplete="off"
                        aria-invalid={!validation.valid}
                        aria-describedby={
                          validation.error ? `var-${keyLower}-error` : `var-${keyLower}-rule`
                        }
                        className={`h-7 ${is8Bit ? 'w-36' : 'w-32'} rounded-[2px] border bg-[#11161C] px-2 font-mono text-sm font-bold tracking-wider transition-colors ${
                          validation.valid
                            ? 'border-[#2B323B] text-[#E6EDF3] focus:border-[#00FF66]'
                            : 'border-[#FFB000] text-[#FFB000] focus:border-[#FFB000]'
                        }`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div
                        className="inline-flex items-center gap-1"
                        role="group"
                        aria-label={`Toggle individual bits of ${v.key}`}
                      >
                        {Array.from({ length: level.bits }).map((_, i) => {
                          const bitPos = level.bits - 1 - i;
                          const bitChar = binary[i] ?? '0';
                          const isOn = bitChar === '1';
                          return (
                            <button
                              key={bitPos}
                              type="button"
                              onClick={() => onToggleVarBit(v.key, bitPos)}
                              aria-label={`Toggle bit ${bitPos} of variable ${v.key} (currently ${bitChar})`}
                              aria-pressed={isOn}
                              className={`inline-flex h-6 w-6 items-center justify-center border text-xs font-bold transition-colors cursor-pointer ${
                                is8Bit && i === 3 ? 'mr-1.5' : ''
                              } ${
                                isOn
                                  ? 'border-[#FFB000] bg-[#FFB000]/20 text-[#FFB000] hover:bg-[#FFB000]/30'
                                  : 'border-[#2B323B] bg-[#11161C] text-[#8B98A8] hover:border-[#4B5868] hover:text-[#E6EDF3]'
                              }`}
                            >
                              {bitChar}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-3 py-2" id={`var-${keyLower}-rule`}>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="font-semibold text-[#FFB000]">
                          {v.constraint?.description ?? 'UNCONSTRAINED'}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px]">
                          {validation.valid ? (
                            <>
                              <Check className="h-3 w-3 text-[#00FF66]" />
                              <span className="text-[#00FF66]">
                                VALID ({onesCount} / {v.constraint?.maxOnes ?? level.bits} ONES)
                              </span>
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="h-3 w-3 text-[#FFB000]" />
                              <span className="text-[#FFB000]">INVALID</span>
                            </>
                          )}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Explicit validation warnings for any editable variable */}
        {activeErrors.map(({ key, error }) => (
          <div
            key={key}
            id={`var-${key.toLowerCase()}-error`}
            role="alert"
            data-testid={`var-${key.toLowerCase()}-error`}
            className="mt-2 flex items-center gap-2 border border-[#FFB000] bg-[#FFB000]/12 px-3 py-1.5 font-mono text-xs font-semibold text-[#FFB000]"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              [WARN {key}] {error}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
};
