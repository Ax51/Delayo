import { IconProp } from '@fortawesome/fontawesome-svg-core';

export const SUPPORTED_LANGUAGES = ['en', 'pt', 'es'] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export type TabSelectionMode = 'active' | 'highlighted' | 'window';
export type ThemePreference = 'light' | 'dark';
export type PresetButtonId =
  | 'later_today'
  | 'tonight'
  | 'tomorrow'
  | 'weekend'
  | 'next_week'
  | 'next_month'
  | 'someday'
  | 'custom_date_time'
  | 'recurring'
  | 'custom_1'
  | 'custom_2'
  | 'custom_3';

export interface CustomDelayButtonSettings {
  enabled: boolean;
  label: string;
  hours: number;
  minutes: number;
}

export interface DelaySettings {
  laterToday: number;
  laterTodayMinutes: number;
  tonightTime: string;
  tomorrowTime: string;
  weekendDay: 'saturday' | 'sunday';
  weekendTime: string;
  nextWeekSameDay: boolean;
  nextWeekDay: number;
  nextWeekTime: string;
  nextMonthSameDay: boolean;
  somedayMinMonths: number;
  somedayMaxMonths: number;
  visiblePresetButtons: PresetButtonId[];
  customButtons: [
    CustomDelayButtonSettings,
    CustomDelayButtonSettings,
    CustomDelayButtonSettings,
  ];
}

export interface DelayOption {
  id: string;
  label: string;
  icon?: IconProp;
  hours?: number;
  minutes?: number;
  days?: number;
  custom?: boolean;
  calculateTime?: () => number;
}

export interface RecurrencePattern {
  type: 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'custom';
  daysOfWeek?: number[];
  dayOfMonth?: number;
  time: string;
  endDate?: number;
}

export interface DelayedTabGroup {
  id?: number;
  windowId?: number;
  title?: string;
  color?: chrome.tabGroups.ColorEnum;
  collapsed?: boolean;
}

export interface DelayedTab {
  id: string;
  url?: string;
  title?: string;
  favicon?: string;
  createdAt: number;
  wakeTime: number;
  status?: 'scheduled' | 'waking';
  isRecurring?: boolean;
  recurrencePattern?: RecurrencePattern;
  group?: DelayedTabGroup;
}

export interface ScheduleTabsMessage {
  action: 'schedule-tabs';
  tabs: chrome.tabs.Tab[];
  wakeTime: number;
  recurrencePattern?: RecurrencePattern;
}

export interface WakeTabsMessage {
  action: 'wake-tabs';
  tabIds: string[];
}

export interface UpdateTabTimeMessage {
  action: 'update-tab-time';
  tabId: string;
  wakeTime: number;
}

export interface RemoveTabsMessage {
  action: 'remove-tabs';
  tabIds: string[];
}

export interface ReconcileDelayedTabsMessage {
  action: 'reconcile-delayed-tabs';
}

export type DelayedTabsRuntimeMessage =
  | ScheduleTabsMessage
  | WakeTabsMessage
  | UpdateTabTimeMessage
  | RemoveTabsMessage
  | ReconcileDelayedTabsMessage;

export interface DelayedTabsRuntimeResponse {
  success: boolean;
  delayedTabs?: DelayedTab[];
  error?: string;
}

export interface ExtensionStorageSchema {
  delayedTabs: DelayedTab[];
  delaySettings: DelaySettings;
  selectedMode: TabSelectionMode;
  savedLanguage: SupportedLanguage;
  theme: ThemePreference;
  onboardingCompleted: boolean;
}
