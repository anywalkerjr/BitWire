import type { Radix, VariableConstraint, VariableValidationResult } from './core/radix';
import { bitMask } from './core/operators';
import { formatValue } from './core/radix';
import type { ChapterGroup, LevelDefinition } from './data/levels';

export type Language = 'en' | 'ru';

export const LANGUAGE_STORAGE_KEY = 'bitwire-lang';

export function getInitialLanguage(): Language {
  if (typeof window === 'undefined') return 'en';
  try {
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved === 'en' || saved === 'ru') return saved;
  } catch {
    // Ignore storage access errors in sandboxed iframes
  }
  return 'en';
}

export function saveLanguage(lang: Language): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch {
    // Ignore storage access errors
  }
}

export interface UIStrings {
  // TopBar
  chapterShort: string;
  levelShort: string;
  selectLevelAria: string;
  availableLevelsAria: string;
  radixSwitcherAria: string;
  langSwitcherAria: string;
  variablesFull: string;
  variablesCompact: string;
  resetLabel: string;
  resetTitle: string;
  resetAria: string;
  crtTitle: string;
  crtAria: string;
  muteTitle: string;
  unmuteTitle: string;
  muteAria: string;
  unmuteAria: string;
  tag8Bit: string;
  tagDualOut: string;
  tagFault: string;
  tagAllGates: string;

  // Variables Drawer
  drawerAria: string;
  drawerTitle: string;
  unsignedLabel: string;
  activeRadixLabel: string;
  previewingLabel: string;
  colVar: string;
  colAccess: string;
  colValue: string;
  colBits: string;
  colConstraint: string;
  accessFixed: string;
  accessTestInput: string;
  accessEditable: string;
  accessConstMask: string;
  lockedBySpec: string;
  drivenByPrefix: string;
  testSuiteFallback: string;
  unconstrained: string;
  statusValid: string;
  statusInvalid: string;
  onesUnit: string;
  warnPrefix: string;
  bitLabelSuffix: string;

  // Canvas HUD & Banners
  badge8Bit: string;
  badgeUseAllGates: string;
  badgeFaultyOutHint: string;
  badgeFaultyOutNode: string;
  reopenBanner: string;
  testsSummaryPrefix: string;
  testCasePrefix: string;
  testPassBadge: string;
  testFailBadge: string;
  mandatoryUnplaced: (remaining: number) => string;
  mandatoryUnconnected: string;
  victoryAllTests: (total: number) => string;
  victoryTargetMatched: string;
  victoryNextSuffix: string;
  victoryAllClearedSuffix: string;
  nextLevelBtn: string;
  replayBtn: string;
  dismissBannerAria: string;
  dismissBannerTitle: string;
  feedbackLoopError: string;

  // Node labels
  nodeFix: string;
  nodeEdit: string;
  nodeErr: string;
  nodeMatch: string;
  nodeGates: string;
  nodeFault: string;
  nodeGoal: string;
  rowTarget: string;
  rowRaw: string;
  rowInFaulty: string;
  rowIn: string;
  removeGateTitle: string;

  // Inventory Dock
  dockAria: string;
  gateStockLabel: string;
  spawnGateAria: (gate: string, remaining: number) => string;
  tipPlace: string;
  tipConnect: string;
  tipCut: string;
  tipDelete: string;
}

export const UI_STRINGS: Record<Language, UIStrings> = {
  en: {
    chapterShort: 'CH',
    levelShort: 'LVL',
    selectLevelAria: 'Select level',
    availableLevelsAria: 'Available levels',
    radixSwitcherAria: 'Number system radix switcher',
    langSwitcherAria: 'Interface language switcher',
    variablesFull: 'VARIABLES',
    variablesCompact: 'VARS',
    resetLabel: 'RESET',
    resetTitle: 'Reset current circuit',
    resetAria: 'Reset current level',
    crtTitle: 'Toggle CRT scanline overlay',
    crtAria: 'Toggle CRT scanlines',
    muteTitle: 'Mute terminal audio',
    unmuteTitle: 'Unmute terminal audio',
    muteAria: 'Mute audio',
    unmuteAria: 'Unmute audio',
    tag8Bit: '8B',
    tagDualOut: '2OUT',
    tagFault: 'FLT',
    tagAllGates: 'ALL',

    drawerAria: 'Level variables table',
    drawerTitle: 'INPUT REGISTER TABLE',
    unsignedLabel: 'UNSIGNED',
    activeRadixLabel: 'ACTIVE RADIX',
    previewingLabel: 'PREVIEWING',
    colVar: 'VAR',
    colAccess: 'ACCESS',
    colValue: 'VALUE',
    colBits: 'BITS',
    colConstraint: 'CONSTRAINT / STATUS',
    accessFixed: 'FIXED',
    accessTestInput: 'TEST INPUT',
    accessEditable: 'EDITABLE',
    accessConstMask: 'CONST MASK',
    lockedBySpec: 'LOCKED BY LEVEL SPEC',
    drivenByPrefix: 'DRIVEN BY',
    testSuiteFallback: 'TEST SUITE',
    unconstrained: 'UNCONSTRAINED',
    statusValid: 'VALID',
    statusInvalid: 'INVALID',
    onesUnit: 'ONES',
    warnPrefix: 'WARN',
    bitLabelSuffix: '-BIT',

    badge8Bit: '[8-BIT]',
    badgeUseAllGates: '[RULE: USE ALL GATES]',
    badgeFaultyOutHint: '[! FAULT: INVERTED OUT]',
    badgeFaultyOutNode: '[! FAULT: INVERTED]',
    reopenBanner: '[OK] VERIFIED — SHOW BANNER',
    testsSummaryPrefix: 'TESTS',
    testCasePrefix: 'TEST',
    testPassBadge: '[PASS]',
    testFailBadge: '[FAIL]',
    mandatoryUnplaced: (remaining) =>
      `[!] TARGET MATCHED — USE REMAINING GATES TO VERIFY (${remaining} LEFT IN STOCK)`,
    mandatoryUnconnected:
      '[!] TARGET MATCHED — CONNECT ALL PLACED GATES INTO CIRCUIT TO VERIFY',
    victoryAllTests: (total) => `[OK] CIRCUIT VERIFIED // ALL ${total} TESTS PASSED`,
    victoryTargetMatched: '[OK] CIRCUIT VERIFIED // TARGET MATCHED',
    victoryNextSuffix: 'NEXT LEVEL',
    victoryAllClearedSuffix: 'ALL CHAPTERS CLEARED',
    nextLevelBtn: 'NEXT LEVEL',
    replayBtn: 'REPLAY LVL 01',
    dismissBannerAria: 'Dismiss victory banner',
    dismissBannerTitle: 'Hide banner to inspect circuit',
    feedbackLoopError: '[ERR] FEEDBACK LOOP BLOCKED // CIRCUIT MUST BE ACYCLIC',

    nodeFix: 'FIX',
    nodeEdit: 'EDIT',
    nodeErr: 'ERR',
    nodeMatch: 'MATCH',
    nodeGates: 'GATES!',
    nodeFault: 'FAULT',
    nodeGoal: 'GOAL',
    rowTarget: 'TGT',
    rowRaw: 'RAW',
    rowInFaulty: 'IN (~RAW)',
    rowIn: 'IN',
    removeGateTitle: 'Remove gate (refunds to inventory)',

    dockAria: 'Logic gate inventory dock',
    gateStockLabel: 'GATE STOCK:',
    spawnGateAria: (gate, remaining) => `Spawn ${gate} gate (${remaining} remaining)`,
    tipPlace: 'CLICK OR DRAG GATE TO PLACE',
    tipConnect: 'CONNECT PINS TO WIRE',
    tipCut: 'CLICK WIRE TO CUT',
    tipDelete: 'DEL REMOVES GATE',
  },
  ru: {
    chapterShort: 'ГЛ',
    levelShort: 'УР',
    selectLevelAria: 'Выбор уровня',
    availableLevelsAria: 'Список уровней',
    radixSwitcherAria: 'Переключатель системы счисления',
    langSwitcherAria: 'Переключатель языка интерфейса',
    variablesFull: 'ПЕРЕМ.',
    variablesCompact: 'ПЕР.',
    resetLabel: 'СБРОС',
    resetTitle: 'Сбросить текущую схему',
    resetAria: 'Сбросить текущий уровень',
    crtTitle: 'Вкл/выкл эффект CRT-строк',
    crtAria: 'Переключить CRT-эффект',
    muteTitle: 'Выключить звук',
    unmuteTitle: 'Включить звук',
    muteAria: 'Выключить звук',
    unmuteAria: 'Включить звук',
    tag8Bit: '8Б',
    tagDualOut: '2ВЫХ',
    tagFault: 'СБОЙ',
    tagAllGates: 'ВСЕ',

    drawerAria: 'Таблица переменных уровня',
    drawerTitle: 'ТАБЛИЦА ВХОДНЫХ РЕГИСТРОВ',
    unsignedLabel: 'БЕЗ ЗНАКА',
    activeRadixLabel: 'СИСТЕМА',
    previewingLabel: 'ПРОСМОТР',
    colVar: 'ПЕРЕМ.',
    colAccess: 'ДОСТУП',
    colValue: 'ЗНАЧЕНИЕ',
    colBits: 'БИТЫ',
    colConstraint: 'ОГРАНИЧЕНИЕ / СТАТУС',
    accessFixed: 'ФИКС.',
    accessTestInput: 'ВХОД ТЕСТА',
    accessEditable: 'РЕДАКТ.',
    accessConstMask: 'МАСКА',
    lockedBySpec: 'ЗАДАНО УСЛОВИЕМ УРОВНЯ',
    drivenByPrefix: 'ЗАДАЁТСЯ',
    testSuiteFallback: 'НАБОРОМ ТЕСТОВ',
    unconstrained: 'БЕЗ ОГРАНИЧЕНИЙ',
    statusValid: 'ОК',
    statusInvalid: 'ОШИБКА',
    onesUnit: 'ЕД.',
    warnPrefix: 'ВНИМ.',
    bitLabelSuffix: '-БИТ',

    badge8Bit: '[8-БИТ]',
    badgeUseAllGates: '[ПРАВИЛО: ВСЕ ВЕНТИЛИ]',
    badgeFaultyOutHint: '[! СБОЙ: ИНВЕРСИЯ OUT]',
    badgeFaultyOutNode: '[! СБОЙ: ИНВЕРСИЯ]',
    reopenBanner: '[OK] ПРОВЕРЕНО — ПОКАЗАТЬ',
    testsSummaryPrefix: 'ТЕСТЫ',
    testCasePrefix: 'ТЕСТ',
    testPassBadge: '[ОК]',
    testFailBadge: '[ОШИБКА]',
    mandatoryUnplaced: (remaining) =>
      `[!] ЦЕЛЬ ДОСТИГНУТА — ИСПОЛЬЗУЙТЕ ВСЕ ВЕНТИЛИ (ОСТАЛОСЬ: ${remaining})`,
    mandatoryUnconnected:
      '[!] ЦЕЛЬ ДОСТИГНУТА — ПОДКЛЮЧИТЕ ВСЕ ВЕНТИЛИ В СХЕМУ',
    victoryAllTests: (total) => {
      const noun =
        total % 10 === 1 && total % 100 !== 11
          ? 'ТЕСТ ПРОЙДЕН'
          : total % 10 >= 2 && total % 10 <= 4 && (total % 100 < 10 || total % 100 >= 20)
            ? 'ТЕСТА ПРОЙДЕНЫ'
            : 'ТЕСТОВ ПРОЙДЕНЫ';
      return `[OK] СХЕМА ПРОВЕРЕНА // ВСЕ ${total} ${noun}`;
    },
    victoryTargetMatched: '[OK] СХЕМА ПРОВЕРЕНА // ЦЕЛЬ ДОСТИГНУТА',
    victoryNextSuffix: 'ДАЛЕЕ',
    victoryAllClearedSuffix: 'ВСЕ ГЛАВЫ ПРОЙДЕНЫ',
    nextLevelBtn: 'ДАЛЕЕ',
    replayBtn: 'ЗАНОВО УР 01',
    dismissBannerAria: 'Скрыть баннер победы',
    dismissBannerTitle: 'Скрыть баннер, чтобы осмотреть схему',
    feedbackLoopError: '[ОШ.] ЗАМКНУТЫЙ КОНТУР ЗАБЛОКИРОВАН // СХЕМА ДОЛЖНА БЫТЬ АЦИКЛИЧНОЙ',

    nodeFix: 'ФИКС',
    nodeEdit: 'РЕД.',
    nodeErr: 'ОШ.',
    nodeMatch: 'ОК',
    nodeGates: 'ВЕНТ.!',
    nodeFault: 'СБОЙ',
    nodeGoal: 'ЦЕЛЬ',
    rowTarget: 'ЦЕЛЬ',
    rowRaw: 'ВХОД',
    rowInFaulty: 'ИТОГ (~)',
    rowIn: 'ФАКТ',
    removeGateTitle: 'Удалить вентиль (вернётся на склад)',

    dockAria: 'Панель логических вентилей',
    gateStockLabel: 'СКЛАД:',
    spawnGateAria: (gate, remaining) => `Добавить вентиль ${gate} (осталось ${remaining})`,
    tipPlace: 'КЛИК/ПЕРЕТАСКИВАНИЕ — ВЕНТИЛЬ',
    tipConnect: 'СОЕДИНЯЙТЕ ПИНЫ',
    tipCut: 'КЛИК ПО ПРОВОДУ — РАЗРЫВ',
    tipDelete: 'DEL — УДАЛИТЬ',
  },
};

export const CHAPTER_HEADINGS: Record<Language, Record<ChapterGroup['chapter'], string>> = {
  en: {
    1: 'CHAPTER 1: BASICS',
    2: 'CHAPTER 2: CHAINS & CONSTRAINTS',
    3: 'CHAPTER 3: UNIVERSAL BASES & FAULTS',
    4: 'CHAPTER 4: 8-BIT, MULTI-TEST & DUAL OUTPUTS',
  },
  ru: {
    1: 'ГЛАВА 1: ОСНОВЫ',
    2: 'ГЛАВА 2: ЦЕПОЧКИ И ОГРАНИЧЕНИЯ',
    3: 'ГЛАВА 3: БАЗИСЫ И СБОИ',
    4: 'ГЛАВА 4: 8-БИТ, ТЕСТЫ И 2 ВЫХОДА',
  },
};

export interface LevelTranslation {
  title: string;
  objective: string;
}

export const LEVEL_TRANSLATIONS_RU: Record<string, LevelTranslation> = {
  'lvl-01': {
    title: 'Инвертор',
    objective: 'Инвертируйте вход A, чтобы получить OUT. Попробуйте переключить BIN/HEX сверху.',
  },
  'lvl-02': {
    title: 'Побитовое OR',
    objective: 'Задайте переменную B (макс. 1 единица) в таблице и объедините с A через OR.',
  },
  'lvl-03': {
    title: 'Побитовое XOR',
    objective: 'Инвертируйте нужные биты A с помощью XOR и маски B (до 2 единиц).',
  },
  'lvl-04': {
    title: 'Импликация',
    objective: 'Подайте A и B на IMP (A -> B некоммутативна: ~A | B).',
  },
  'lvl-05': {
    title: 'Штрих Шеффера',
    objective: 'Обнулите один разряд с помощью NAND и 1-битной маски B.',
  },
  'lvl-06': {
    title: 'Запертая маска',
    objective: 'A и B зафиксированы. Соберите цепочку из AND и NOT для имитации NAND.',
  },
  'lvl-07': {
    title: 'Шина из 3 входов',
    objective: 'Объедините фиксированные регистры A, B и C каскадом AND -> OR.',
  },
  'lvl-08': {
    title: 'Фильтр сигнала',
    objective: 'Отфильтруйте A ^ B с помощью инвертированной маски C, задействовав все 3 вентиля.',
  },
  'lvl-09': {
    title: 'Инъекция NOR',
    objective: 'Объедините A и B через NOR, затем добавьте 1-битную маску C с помощью OR.',
  },
  'lvl-10': {
    title: 'Логическая цепь',
    objective: 'Босс Гл.2: проведите A, B и C через цепочку IMP и XOR, чтобы получить 1101.',
  },
  'lvl-11': {
    title: 'Инвертор Шеффера',
    objective: 'Соберите NOT A из одного вентиля NAND (подключите A к обоим входам).',
  },
  'lvl-12': {
    title: 'AND из NAND',
    objective: 'Постройте A AND B, используя исключительно вентили NAND.',
  },
  'lvl-13': {
    title: 'OR из NOR',
    objective: 'Постройте A OR B, используя исключительно вентили NOR.',
  },
  'lvl-14': {
    title: 'Неисправный OUT',
    objective: 'Порт OUT повреждён и инвертирует входящие биты! Скомпенсируйте сбой.',
  },
  'lvl-15': {
    title: 'Универсальный XOR',
    objective: 'Классика дискретной математики: соберите A XOR B строго на 4 вентилях NAND.',
  },
  'lvl-16': {
    title: 'Инверсия полубайта',
    objective: 'Открыт 8-битный режим! Инвертируйте только старшие 4 бита A через инверсию B. Попробуйте HEX.',
  },
  'lvl-17': {
    title: 'Установка LSB',
    objective: 'Установите младший бит (LSB) в 1 на ВСЕХ 3 тестах, задав постоянную маску B.',
  },
  'lvl-18': {
    title: 'Средние биты',
    objective: 'Инвертируйте ТОЛЬКО два средних бита A на всех 3 тестах с помощью маски B.',
  },
  'lvl-19': {
    title: 'Полусумматор',
    objective: 'Соберите побитовый полусумматор: SUM (A XOR B) на OUT 1 и CARRY (A AND B) на OUT 2.',
  },
  'lvl-20': {
    title: 'Разделитель байта',
    objective: 'Разделите 8-битное A пополам: младший полубайт на OUT 1 (LOW), старший на OUT 2 (HIGH).',
  },
};

export function getLevelText(level: LevelDefinition, lang: Language): LevelTranslation {
  if (lang === 'ru') {
    const tr = LEVEL_TRANSLATIONS_RU[level.id];
    if (tr) return tr;
  }
  return { title: level.title, objective: level.objective };
}

export function getChapterHeading(
  chapter: ChapterGroup['chapter'],
  lang: Language
): string {
  return CHAPTER_HEADINGS[lang][chapter];
}

export function formatTestCaseLabel(index: number, lang: Language): string {
  return `${UI_STRINGS[lang].testCasePrefix} ${index + 1}`;
}

export function formatConstraintDescription(
  constraint: VariableConstraint | undefined,
  lang: Language
): string {
  if (!constraint) return UI_STRINGS[lang].unconstrained;
  if (lang === 'en') return constraint.description;
  if (constraint.maxOnes !== undefined) {
    const noun = constraint.maxOnes === 1 ? 'ЕДИНИЦА' : 'ЕДИНИЦЫ';
    return `МАКС. ${constraint.maxOnes} ${noun} (popcount <= ${constraint.maxOnes})`;
  }
  if (constraint.maxBits !== undefined) {
    return `МАКС. ${constraint.maxBits} БИТ`;
  }
  return constraint.description;
}

export function formatValidationError(
  validation: VariableValidationResult,
  raw: string,
  radix: Radix,
  bits: number,
  constraint: VariableConstraint | undefined,
  lang: Language
): string | null {
  if (validation.valid || !validation.error) return null;
  if (lang === 'en') return validation.error;

  const trimmed = raw.trim();
  const maxStr = formatValue(bitMask(bits), radix, bits);
  if (!trimmed) {
    return `Введите значение в ${radix} (от 0 до ${maxStr}).`;
  }
  if (validation.error.startsWith('Invalid')) {
    const allowed: Record<Radix, string> = {
      BIN: '0–1',
      OCT: '0–7',
      DEC: '0–9',
      HEX: '0–9, A–F',
    };
    return `Неверный формат ${radix}. Допустимые символы: ${allowed[radix]}.`;
  }
  if (validation.error.startsWith('Out of')) {
    return `Выход за пределы ${bits} бит (макс. ${maxStr} в ${radix}).`;
  }
  if (constraint?.maxOnes !== undefined && validation.onesCount !== null) {
    return `Нарушено ограничение: ${validation.onesCount} ед. превышает лимит (${constraint.maxOnes}).`;
  }
  if (constraint?.maxBits !== undefined) {
    return `Нарушено ограничение: превышен лимит ${constraint.maxBits} бит.`;
  }
  return validation.error;
}
