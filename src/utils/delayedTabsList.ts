import { DelayedTab } from '@types';
import normalizeDelayedTabs from '@utils/normalizeDelayedTabs';

import { getDelayedTabs } from './extensionStorage';

export interface DelayedTabMatch {
  tab: chrome.tabs.Tab;
  delayedTab: DelayedTab;
}

export interface DelayedTabSelectionMatches {
  matches: DelayedTabMatch[];
  matchCount: number;
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
  }

  const matches = selectedTabs.flatMap((tab) => {
    if (typeof tab.url !== 'string' || tab.url.length === 0) {
      return [];
    }

    const delayedTab = earliestDelayedTabByUrl.get(tab.url);

    return delayedTab ? [{ tab, delayedTab }] : [];
  });
  const firstSelectedTab = selectedTabs[0];
  const activeMatch = firstSelectedTab
    ? matches.find((match) => match.tab === firstSelectedTab)
    : undefined;

  return {
    matches,
    matchCount: matches.length,
    activeMatch,
  };
}

export async function loadSortedDelayedTabs(): Promise<DelayedTab[]> {
  return sortDelayedTabs(await getDelayedTabs());
}
