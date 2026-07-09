import { DelayedTab } from '@types';

export default function normalizeDelayedTabs(tabs: DelayedTab[]): DelayedTab[] {
  return tabs.map((tab) => ({
    ...tab,
    id: String(tab.id),
    group: tab.group
      ? {
          ...tab.group,
          id:
            typeof tab.group.id === 'number' && Number.isFinite(tab.group.id)
              ? tab.group.id
              : undefined,
          windowId:
            typeof tab.group.windowId === 'number' &&
            Number.isFinite(tab.group.windowId)
              ? tab.group.windowId
              : undefined,
        }
      : undefined,
  }));
}
