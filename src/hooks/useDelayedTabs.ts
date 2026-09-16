import { useCallback, useEffect, useState } from 'react';
import { DelayedTab, DelayedTabsTimeChange } from '@types';
import { loadSortedDelayedTabs, sortDelayedTabs } from '@utils/delayedTabsList';
import {
  removeTabs,
  updateTabsTime,
  updateTabTime,
  updateTabTitle,
  wakeTabs,
} from '@utils/delayedTabsRuntime';
import { subscribeToStorageKey } from '@utils/extensionStorage';

export default function useDelayedTabs(): {
  delayedTabs: DelayedTab[];
  loading: boolean;
  refresh: () => Promise<void>;
  removeDelayedTabs: (tabIds: string[]) => Promise<void>;
  updateDelayedTabsTime: (
    tabIds: string[],
    change: DelayedTabsTimeChange
  ) => Promise<void>;
  updateDelayedTabTime: (tabId: string, wakeTime: number) => Promise<void>;
  updateDelayedTabTitle: (tabId: string, title: string) => Promise<void>;
  wakeDelayedTabs: (tabIds: string[]) => Promise<void>;
} {
  const [delayedTabs, setDelayedTabs] = useState<DelayedTab[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);

    try {
      setDelayedTabs(await loadSortedDelayedTabs());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    return subscribeToStorageKey('delayedTabs', (storedTabs) => {
      setDelayedTabs(sortDelayedTabs(storedTabs ?? []));
      setLoading(false);
    });
  }, []);

  const wakeDelayedTabs = useCallback(
    async (tabIds: string[]): Promise<void> => {
      const response = await wakeTabs(tabIds);
      setDelayedTabs(sortDelayedTabs(response.delayedTabs ?? []));
    },
    []
  );

  const removeDelayedTabs = useCallback(
    async (tabIds: string[]): Promise<void> => {
      const response = await removeTabs(tabIds);
      setDelayedTabs(sortDelayedTabs(response.delayedTabs ?? []));
    },
    []
  );

  const updateDelayedTabTime = useCallback(
    async (tabId: string, wakeTime: number): Promise<void> => {
      const response = await updateTabTime(tabId, wakeTime);
      setDelayedTabs(sortDelayedTabs(response.delayedTabs ?? []));
    },
    []
  );

  const updateDelayedTabsTime = useCallback(
    async (tabIds: string[], change: DelayedTabsTimeChange): Promise<void> => {
      const response = await updateTabsTime(tabIds, change);
      setDelayedTabs(sortDelayedTabs(response.delayedTabs ?? []));
    },
    []
  );

  const updateDelayedTabTitle = useCallback(
    async (tabId: string, title: string): Promise<void> => {
      const response = await updateTabTitle(tabId, title);
      setDelayedTabs(sortDelayedTabs(response.delayedTabs ?? []));
    },
    []
  );

  return {
    delayedTabs,
    loading,
    refresh,
    removeDelayedTabs,
    updateDelayedTabTime,
    updateDelayedTabsTime,
    updateDelayedTabTitle,
    wakeDelayedTabs,
  };
}
