import { DelayedTab, DelayedTabsTimeChange } from '@types';
import { DelayedTabsError } from '@utils/delayedTabsErrors';

export const delayedTabPeriods = [
  'threeHours',
  'today',
  'thisWeek',
  'nextWeek',
  'beyondWeek',
] as const;

export type DelayedTabPeriod = (typeof delayedTabPeriods)[number];

export function matchesDelayedTabPeriod(
  wakeTime: number,
  period: DelayedTabPeriod,
  now: number
): boolean {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + (8 - (today.getDay() || 7)));
  const followingMonday = new Date(nextMonday);
  followingMonday.setDate(followingMonday.getDate() + 7);

  switch (period) {
    case 'threeHours':
      return wakeTime >= now && wakeTime <= now + 3 * 60 * 60 * 1000;
    case 'today':
      return wakeTime >= today.getTime() && wakeTime < tomorrow.getTime();
    case 'thisWeek':
      return wakeTime >= today.getTime() && wakeTime < nextMonday.getTime();
    case 'nextWeek':
      return (
        wakeTime >= nextMonday.getTime() && wakeTime < followingMonday.getTime()
      );
    case 'beyondWeek':
      return wakeTime > now + 7 * 24 * 60 * 60 * 1000;
  }
}

export function filterDelayedTabs(
  tabs: DelayedTab[],
  periods: DelayedTabPeriod[],
  now: number
): DelayedTab[] {
  return tabs.filter(
    (tab) =>
      periods.length === 0 ||
      periods.some((period) =>
        matchesDelayedTabPeriod(tab.wakeTime, period, now)
      )
  );
}

export function changeDelayedTabsTime(
  tabs: DelayedTab[],
  tabIds: string[],
  change: DelayedTabsTimeChange,
  now: number
): DelayedTab[] {
  if (
    !change ||
    (change.mode !== 'add' && change.mode !== 'set') ||
    (change.mode === 'add' &&
      (!Number.isSafeInteger(change.durationMs) || change.durationMs <= 0)) ||
    (change.mode === 'set' && !Number.isFinite(change.wakeTime))
  ) {
    throw new DelayedTabsError('invalidDuration', 'Invalid time change');
  }

  const selectedIds = new Set(tabIds);
  return tabs.map((tab) => {
    if (!selectedIds.has(tab.id)) {
      return tab;
    }
    const wakeTime =
      change.mode === 'add'
        ? tab.wakeTime + change.durationMs
        : change.wakeTime;
    if (!Number.isFinite(new Date(wakeTime).getTime()) || wakeTime <= now) {
      throw new DelayedTabsError(
        'invalidTime',
        'Wake time must be in the future'
      );
    }
    return { ...tab, wakeTime, status: 'scheduled' };
  });
}
