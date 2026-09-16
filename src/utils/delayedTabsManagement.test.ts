import { DelayedTab } from '@types';
import { describe, expect, it } from 'vitest';

import {
  changeDelayedTabsTime,
  filterDelayedTabs,
  matchesDelayedTabPeriod,
} from './delayedTabsManagement';

const now = new Date(2026, 8, 16, 12).getTime();
const hour = 60 * 60 * 1000;
const day = 24 * hour;
const tab = (id: string, wakeTime: number): DelayedTab => ({
  id,
  wakeTime,
  createdAt: now,
});

describe('delayed tab period filters', () => {
  it('includes exactly three hours, excluding past and later times', () => {
    expect(matchesDelayedTabPeriod(now, 'threeHours', now)).toBe(true);
    expect(matchesDelayedTabPeriod(now + 3 * hour, 'threeHours', now)).toBe(
      true
    );
    expect(matchesDelayedTabPeriod(now - 1, 'threeHours', now)).toBe(false);
    expect(matchesDelayedTabPeriod(now + 3 * hour + 1, 'threeHours', now)).toBe(
      false
    );
  });

  it('uses local midnight for today', () => {
    expect(
      matchesDelayedTabPeriod(new Date(2026, 8, 16).getTime(), 'today', now)
    ).toBe(true);
    expect(
      matchesDelayedTabPeriod(new Date(2026, 8, 17).getTime() - 1, 'today', now)
    ).toBe(true);
    expect(
      matchesDelayedTabPeriod(new Date(2026, 8, 17).getTime(), 'today', now)
    ).toBe(false);
  });

  it('ends this week at Monday and includes the following Sunday in next week', () => {
    const monday = new Date(2026, 8, 21).getTime();
    const followingMonday = new Date(2026, 8, 28).getTime();
    expect(matchesDelayedTabPeriod(monday - 1, 'thisWeek', now)).toBe(true);
    expect(matchesDelayedTabPeriod(monday, 'thisWeek', now)).toBe(false);
    expect(matchesDelayedTabPeriod(monday, 'nextWeek', now)).toBe(true);
    expect(matchesDelayedTabPeriod(followingMonday - 1, 'nextWeek', now)).toBe(
      true
    );
    expect(matchesDelayedTabPeriod(followingMonday, 'nextWeek', now)).toBe(
      false
    );
  });

  it('handles Sunday, Monday, year changes and a daylight-saving week', () => {
    for (const [reference, nextMonday] of [
      [new Date(2026, 8, 20, 12), new Date(2026, 8, 21)],
      [new Date(2026, 8, 21, 12), new Date(2026, 8, 28)],
      [new Date(2026, 11, 31, 12), new Date(2027, 0, 4)],
      [new Date(2026, 2, 4, 12), new Date(2026, 2, 9)],
    ]) {
      expect(
        matchesDelayedTabPeriod(
          nextMonday.getTime() - 1,
          'thisWeek',
          reference.getTime()
        )
      ).toBe(true);
      expect(
        matchesDelayedTabPeriod(
          nextMonday.getTime(),
          'nextWeek',
          reference.getTime()
        )
      ).toBe(true);
    }
  });

  it('counts more than a week as strictly more than seven days from now', () => {
    expect(matchesDelayedTabPeriod(now + 7 * day, 'beyondWeek', now)).toBe(
      false
    );
    expect(matchesDelayedTabPeriod(now + 7 * day + 1, 'beyondWeek', now)).toBe(
      true
    );
  });

  it('unions active groups without duplicates and returns everything when cleared', () => {
    const tabs = [
      tab('soon', now + hour),
      tab('tomorrow', now + day),
      tab('next', now + 6 * day),
      tab('later', now + 20 * day),
    ];
    expect(
      filterDelayedTabs(tabs, ['threeHours', 'today', 'nextWeek'], now).map(
        ({ id }) => id
      )
    ).toEqual(['soon', 'next']);
    expect(filterDelayedTabs(tabs, [], now)).toEqual(tabs);
    expect(filterDelayedTabs([], ['today'], now)).toEqual([]);
  });
});

describe('bulk time changes', () => {
  const tabs = [
    tab('one', now + 15 * 60_000),
    tab('two', now + 2 * hour),
    tab('untouched', now + day),
  ];

  it('adds twenty minutes to each existing wake time, once per selected ID', () => {
    const updated = changeDelayedTabsTime(
      tabs,
      ['one', 'two', 'one', 'missing'],
      { mode: 'add', durationMs: 20 * 60_000 },
      now
    );
    expect(updated.map(({ wakeTime }) => wakeTime)).toEqual([
      now + 35 * 60_000,
      now + 2 * hour + 20 * 60_000,
      now + day,
    ]);
    expect(updated[2]).toBe(tabs[2]);
    expect(tabs[0].wakeTime).toBe(now + 15 * 60_000);
  });

  it('assigns the same absolute time and preserves other metadata', () => {
    const recurring = {
      ...tabs[0],
      isRecurring: true,
      recurrencePattern: { type: 'daily' as const, time: '09:00' },
      remindOnly: true,
    };
    const updated = changeDelayedTabsTime(
      [recurring, tabs[1]],
      ['one', 'two'],
      { mode: 'set', wakeTime: now + day },
      now
    );
    expect(updated.map(({ wakeTime }) => wakeTime)).toEqual([
      now + day,
      now + day,
    ]);
    expect(updated[0]).toEqual({
      ...recurring,
      wakeTime: now + day,
      status: 'scheduled',
    });
  });

  it('rejects invalid durations and dates before changing anything', () => {
    for (const durationMs of [0, -1, NaN, Infinity, 0.5, Number.MAX_VALUE]) {
      expect(() =>
        changeDelayedTabsTime(tabs, ['one'], { mode: 'add', durationMs }, now)
      ).toThrow();
    }
    for (const wakeTime of [now, now - 1, NaN, Infinity, Number.MAX_VALUE]) {
      expect(() =>
        changeDelayedTabsTime(tabs, ['one'], { mode: 'set', wakeTime }, now)
      ).toThrow();
    }
  });
});
