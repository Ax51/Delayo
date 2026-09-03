import { DelayedTab } from '@types';
import { describe, expect, it } from 'vitest';

import { matchSelectedTabsToDelayedTabs } from './delayedTabsList';

function createBrowserTab(id: number, url?: string): chrome.tabs.Tab {
  return { id, url } as chrome.tabs.Tab;
}

function createDelayedTab(
  id: string,
  url: string | undefined,
  wakeTime: number
): DelayedTab {
  return {
    id,
    url,
    createdAt: 1,
    wakeTime,
  };
}

describe('matchSelectedTabsToDelayedTabs', () => {
  it('matches selected tabs by exact URL and reports the first tab match', () => {
    const firstTab = createBrowserTab(1, 'https://example.com/article?a=1');
    const secondTab = createBrowserTab(2, 'https://example.com/other');
    const result = matchSelectedTabsToDelayedTabs(
      [firstTab, secondTab],
      [
        createDelayedTab('exact', 'https://example.com/article?a=1', 2_000),
        createDelayedTab(
          'different-query',
          'https://example.com/article?a=2',
          1_000
        ),
      ]
    );

    expect(result.matchCount).toBe(1);
    expect(result.matches).toEqual([
      {
        tab: firstTab,
        delayedTab: expect.objectContaining({ id: 'exact' }),
      },
    ]);
    expect(result.activeMatch).toEqual(result.matches[0]);
  });

  it('does not use another selected tab as the active match', () => {
    const firstTab = createBrowserTab(1, 'https://example.com/not-delayed');
    const secondTab = createBrowserTab(2, 'https://example.com/delayed');
    const result = matchSelectedTabsToDelayedTabs(
      [firstTab, secondTab],
      [createDelayedTab('delayed', secondTab.url, 2_000)]
    );

    expect(result.matchCount).toBe(1);
    expect(result.matches[0]?.tab).toBe(secondTab);
    expect(result.activeMatch).toBeUndefined();
  });

  it('uses the earliest wake time for legacy duplicate URLs', () => {
    const selectedTab = createBrowserTab(1, 'https://example.com/article');
    const wakingTab = {
      ...createDelayedTab('waking', selectedTab.url, -1_000),
      status: 'waking' as const,
    };
    const result = matchSelectedTabsToDelayedTabs(
      [selectedTab],
      [
        createDelayedTab('later', selectedTab.url, 5_000),
        wakingTab,
        createDelayedTab('middle', selectedTab.url, 2_000),
      ]
    );

    expect(result.matchCount).toBe(1);
    expect(result.activeMatch?.delayedTab).toBe(wakingTab);
  });

  it('ignores delayed records with invalid URLs or wake times', () => {
    const selectedTab = createBrowserTab(1, 'https://example.com/article');
    const result = matchSelectedTabsToDelayedTabs(
      [selectedTab],
      [
        createDelayedTab('missing-url', undefined, 1_000),
        createDelayedTab('empty-url', '', 1_000),
        createDelayedTab('nan', selectedTab.url, Number.NaN),
        createDelayedTab('infinite', selectedTab.url, Number.POSITIVE_INFINITY),
      ]
    );

    expect(result).toEqual({
      matches: [],
      matchCount: 0,
      activeMatch: undefined,
    });
  });

  it('returns at most one match for each selected tab', () => {
    const firstTab = createBrowserTab(1, 'https://example.com/article');
    const secondTab = createBrowserTab(2, firstTab.url);
    const result = matchSelectedTabsToDelayedTabs(
      [firstTab, secondTab],
      [
        createDelayedTab('later', firstTab.url, 2_000),
        createDelayedTab('earlier', firstTab.url, 1_000),
      ]
    );

    expect(result.matchCount).toBe(2);
    expect(result.matches).toHaveLength(2);
    expect(
      result.matches.every((match) => match.delayedTab.id === 'earlier')
    ).toBe(true);
  });
});
