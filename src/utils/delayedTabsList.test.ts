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
  it.each([
    ['https://example.com/article#one', 'https://example.com/article#two'],
    ['https://example.com/article#one', 'https://example.com/article'],
    ['https://example.com/article', 'https://example.com/article#one'],
    ['https://example.com/article#', 'https://example.com/article'],
    ['https://example.com/article?a=1#one', 'https://example.com/article?a=1#two'],
    ['https://example.com/#/one', 'https://example.com/#/two'],
    ['https://example.com/article?a=1', 'https://example.com/article?a=2'],
    ['https://example.com/article?a=1', 'https://example.com/article'],
    ['https://example.com/article', 'https://example.com/article?a=1'],
    ['https://example.com/article?', 'https://example.com/article'],
    [
      'https://example.com/article?a=1&b=2',
      'https://example.com/article?b=2&a=1',
    ],
    [
      'https://example.com/article?a=1#one',
      'https://example.com/article?a=2#two',
    ],
    ['https://example.com/article#one', 'https://example.com/article?a=1'],
    [
      'https://example.com/article?q=a%23b%3Fc',
      'https://example.com/article?q=other',
    ],
  ])('reports %s as similar to %s', (selectedUrl, savedUrl) => {
    const selectedTab = createBrowserTab(1, selectedUrl);
    const delayedTab = createDelayedTab('saved', savedUrl, 2_000);
    const result = matchSelectedTabsToDelayedTabs([selectedTab], [delayedTab]);

    expect(result.matchCount).toBe(1);
    expect(result.similarMatchCount).toBe(1);
    expect(result.similarTabs).toEqual([delayedTab]);
    expect(result.activeMatch).toEqual({
      tab: selectedTab,
      delayedTab,
      kind: 'similar',
    });
  });

  it.each([
    'https://example.com/other?a=1#one',
    'https://other.example/article?a=1#one',
    'http://example.com/article?a=1#one',
    'https://example.com/article%23one?a=1',
    'https://example.com/article%3Fone?a=1',
  ])('does not treat a different base URL as similar: %s', (savedUrl) => {
    const result = matchSelectedTabsToDelayedTabs(
      [createBrowserTab(1, 'https://example.com/article?a=1#one')],
      [createDelayedTab('saved', savedUrl, 2_000)]
    );

    expect(result.matchCount).toBe(0);
    expect(result.similarMatchCount).toBe(0);
    expect(result.activeMatch).toBeUndefined();
  });

  it('prefers an exact URL over an earlier similar link', () => {
    const selectedTab = createBrowserTab(1, 'https://example.com/article#one');
    const result = matchSelectedTabsToDelayedTabs(
      [selectedTab],
      [
        createDelayedTab('similar', 'https://example.com/article#two', 1_000),
        createDelayedTab('exact', selectedTab.url, 5_000),
      ]
    );

    expect(result.matchCount).toBe(1);
    expect(result.similarMatchCount).toBe(0);
    expect(result.activeMatch?.kind).toBe('exact');
    expect(result.activeMatch?.delayedTab.id).toBe('exact');
    expect(result.similarTabs.map((tab) => tab.id)).toEqual(['similar']);
  });

  it('uses the earliest similar link and counts mixed selections once per tab', () => {
    const result = matchSelectedTabsToDelayedTabs(
      [
        createBrowserTab(1, 'https://example.com/article#new'),
        createBrowserTab(2, 'https://example.com/exact'),
        createBrowserTab(3, 'https://example.com/other'),
        createBrowserTab(4),
      ],
      [
        createDelayedTab('later', 'https://example.com/article#later', 5_000),
        createDelayedTab('earlier', 'https://example.com/article', 1_000),
        createDelayedTab('exact', 'https://example.com/exact', 2_000),
      ]
    );

    expect(result.matchCount).toBe(2);
    expect(result.similarMatchCount).toBe(1);
    expect(result.activeMatch?.delayedTab.id).toBe('earlier');
    expect(result.similarTabs.map((tab) => tab.id)).toEqual([
      'earlier',
      'later',
    ]);
  });

  it('lists each similar saved record once across a selection, sorted by time', () => {
    const early = createDelayedTab(
      'early',
      'https://example.com/article',
      1_000
    );
    const reminder = {
      ...createDelayedTab('reminder', 'https://example.com/article#two', 2_000),
      remindOnly: true,
    };
    const late = createDelayedTab(
      'late',
      'https://example.com/article#one',
      3_000
    );
    const result = matchSelectedTabsToDelayedTabs(
      [
        createBrowserTab(1, 'https://example.com/article#new'),
        createBrowserTab(2, 'https://example.com/article#another'),
      ],
      [
        late,
        createDelayedTab('unrelated', 'https://example.com/other', 500),
        reminder,
        early,
        createDelayedTab(
          'invalid',
          'https://example.com/article#bad',
          Number.NaN
        ),
      ]
    );

    expect(result.matchCount).toBe(2);
    expect(result.similarTabs).toEqual([early, reminder, late]);
  });

  it('keeps independent legacy schedules for the same similar URL visible', () => {
    const first = createDelayedTab(
      'first',
      'https://example.com/article',
      1_000
    );
    const second = createDelayedTab('second', first.url, 2_000);
    const result = matchSelectedTabsToDelayedTabs(
      [createBrowserTab(1, 'https://example.com/article#new')],
      [second, first]
    );

    expect(result.similarTabs).toEqual([first, second]);
  });

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
        kind: 'exact',
      },
    ]);
    expect(result.activeMatch).toEqual(result.matches[0]);
    expect(result.similarTabs.map((tab) => tab.id)).toEqual([
      'different-query',
    ]);
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
      similarMatchCount: 0,
      similarTabs: [],
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
