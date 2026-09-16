import { DelayedTab } from '@types';
import normalizeDelayedTabs from '@utils/normalizeDelayedTabs';

import { getDelayedTabs } from './extensionStorage';

export interface DelayedTabMatch {
  tab: chrome.tabs.Tab;
  delayedTab: DelayedTab;
  kind: 'exact' | 'similar';
}

export interface DelayedTabSelectionMatches {
  matches: DelayedTabMatch[];
  matchCount: number;
  similarMatchCount: number;
  similarTabs: DelayedTab[];
  activeMatch?: DelayedTabMatch;
}

export function sortDelayedTabs(tabs: DelayedTab[]): DelayedTab[] {
  return [...normalizeDelayedTabs(tabs)].sort(
    (a, b) => a.wakeTime - b.wakeTime
  );
}

export function matchSelectedTabsToDelayedTabs(
  selectedTabs: chrome.tabs.Tab[],
  delayedTabs: DelayedTab[]
): DelayedTabSelectionMatches {
  const earliestDelayedTabByUrl = new Map<string, DelayedTab>();
  const delayedTabsByBaseUrl = new Map<string, DelayedTab[]>();
  const similarTabsById = new Map<string, DelayedTab>();

  for (const delayedTab of delayedTabs) {
    if (
      typeof delayedTab.url !== 'string' ||
      delayedTab.url.length === 0 ||
      typeof delayedTab.wakeTime !== 'number' ||
      !Number.isFinite(delayedTab.wakeTime)
    ) {
      continue;
    }

    const existingMatch = earliestDelayedTabByUrl.get(delayedTab.url);

    if (!existingMatch || delayedTab.wakeTime < existingMatch.wakeTime) {
      earliestDelayedTabByUrl.set(delayedTab.url, delayedTab);
    }

    const baseUrl = delayedTab.url.split(/[?#]/, 1)[0];
    if (baseUrl) {
      const baseMatches = delayedTabsByBaseUrl.get(baseUrl) ?? [];
      baseMatches.push(delayedTab);
      delayedTabsByBaseUrl.set(baseUrl, baseMatches);
    }
  }

  for (const baseMatches of delayedTabsByBaseUrl.values()) {
    baseMatches.sort((a, b) => a.wakeTime - b.wakeTime);
  }

  const matches = selectedTabs.flatMap<DelayedTabMatch>((tab) => {
    if (typeof tab.url !== 'string' || tab.url.length === 0) {
      return [];
    }

    const delayedTab = earliestDelayedTabByUrl.get(tab.url);
    const similarTabs = (
      delayedTabsByBaseUrl.get(tab.url.split(/[?#]/, 1)[0]) ?? []
    ).filter((savedTab) => savedTab.url !== tab.url);

    for (const similarTab of similarTabs) {
      similarTabsById.set(similarTab.id, similarTab);
    }

    if (delayedTab) {
      return [{ tab, delayedTab, kind: 'exact' }];
    }

    const similarTab = similarTabs[0];

    return similarTab
      ? [{ tab, delayedTab: similarTab, kind: 'similar' }]
      : [];
  });
  const firstSelectedTab = selectedTabs[0];
  const activeMatch = firstSelectedTab
    ? matches.find((match) => match.tab === firstSelectedTab)
    : undefined;

  return {
    matches,
    matchCount: matches.length,
    similarMatchCount: matches.filter((match) => match.kind === 'similar')
      .length,
    similarTabs: [...similarTabsById.values()].sort(
      (a, b) => a.wakeTime - b.wakeTime
    ),
    activeMatch,
  };
}

export async function loadSortedDelayedTabs(): Promise<DelayedTab[]> {
  return sortDelayedTabs(await getDelayedTabs());
}
