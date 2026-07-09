import {
  CustomDelayButtonSettings,
  DelaySettings,
  PresetButtonId,
} from '@types';

const DEFAULT_VISIBLE_PRESET_BUTTONS: PresetButtonId[] = [
  'later_today',
  'tonight',
  'tomorrow',
  'weekend',
  'next_week',
  'next_month',
  'someday',
  'custom_date_time',
  'recurring',
];

const DEFAULT_CUSTOM_BUTTONS: [
  CustomDelayButtonSettings,
  CustomDelayButtonSettings,
  CustomDelayButtonSettings,
] = [
  {
    enabled: false,
    label: 'In 1 hour',
    hours: 1,
    minutes: 0,
  },
  {
    enabled: false,
    label: 'In 3 hours',
    hours: 3,
    minutes: 0,
  },
  {
    enabled: false,
    label: 'Focus block',
    hours: 0,
    minutes: 45,
  },
];

const VALID_PRESET_BUTTON_IDS = new Set<PresetButtonId>([
  'later_today',
  'tonight',
  'tomorrow',
  'weekend',
  'next_week',
  'next_month',
  'someday',
  'custom_date_time',
  'recurring',
  'custom_1',
  'custom_2',
  'custom_3',
]);

export const defaultDelaySettings: DelaySettings = {
  laterToday: 3,
  laterTodayMinutes: 0,
  tonightTime: '18:00',
  tomorrowTime: '09:00',
  weekendDay: 'saturday',
  weekendTime: '09:00',
  nextWeekSameDay: false,
  nextWeekDay: 1,
  nextWeekTime: '09:00',
  nextMonthSameDay: true,
  somedayMinMonths: 3,
  somedayMaxMonths: 12,
  visiblePresetButtons: DEFAULT_VISIBLE_PRESET_BUTTONS,
  customButtons: DEFAULT_CUSTOM_BUTTONS,
};

function clampNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(value), min), max);
}

function normalizeCustomButton(
  value: unknown,
  fallback: CustomDelayButtonSettings
): CustomDelayButtonSettings {
  const candidate =
    value && typeof value === 'object'
      ? (value as Partial<CustomDelayButtonSettings>)
      : undefined;

  return {
    enabled:
      typeof candidate?.enabled === 'boolean'
        ? candidate.enabled
        : fallback.enabled,
    label:
      typeof candidate?.label === 'string' && candidate.label.trim().length > 0
        ? candidate.label.trim()
        : fallback.label,
    hours: clampNumber(candidate?.hours, fallback.hours, 0, 24),
    minutes: clampNumber(candidate?.minutes, fallback.minutes, 0, 59),
  };
}

export function normalizeDelaySettings(
  settings?: Partial<DelaySettings> | null
): DelaySettings {
  const laterToday = clampNumber(
    settings?.laterToday,
    defaultDelaySettings.laterToday,
    0,
    12
  );
  const laterTodayMinutes = clampNumber(
    settings?.laterTodayMinutes,
    defaultDelaySettings.laterTodayMinutes,
    0,
    59
  );
  const visiblePresetButtons = Array.isArray(settings?.visiblePresetButtons)
    ? settings.visiblePresetButtons.filter(
        (buttonId): buttonId is PresetButtonId =>
          typeof buttonId === 'string' && VALID_PRESET_BUTTON_IDS.has(buttonId as PresetButtonId)
      )
    : defaultDelaySettings.visiblePresetButtons;
  const rawCustomButtons = Array.isArray(settings?.customButtons)
    ? settings.customButtons
    : defaultDelaySettings.customButtons;
  const customButtons = DEFAULT_CUSTOM_BUTTONS.map((button, index) =>
    normalizeCustomButton(rawCustomButtons[index], button)
  ) as DelaySettings['customButtons'];

  return {
    ...defaultDelaySettings,
    ...settings,
    laterToday: laterToday === 0 && laterTodayMinutes === 0 ? 0 : laterToday,
    laterTodayMinutes:
      laterToday === 0 && laterTodayMinutes === 0 ? 1 : laterTodayMinutes,
    visiblePresetButtons,
    customButtons,
  };
}
