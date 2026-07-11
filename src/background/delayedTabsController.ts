import {
  DelayedTab,
  DelayedTabGroup,
  DelayedTabsRuntimeResponse,
  RecurrencePattern,
} from '@types';
import generateUniqueTabId from '@utils/generateUniqueTabId';
import normalizeDelayedTabs from '@utils/normalizeDelayedTabs';
import { calculateNextWakeTime } from '@utils/recurrence';

const DELAYED_TABS_STORAGE_KEY = 'delayedTabs';
const CONTEXT_MENU_ID = 'delay-tab';
const ALARM_PREFIX = 'delayed-tab-';
const NOTIFICATION_PREFIX = 'delayed-tab-wake-';
const NOTIFICATION_TARGETS_STORAGE_KEY = 'wakeNotificationTargets';
const NOTIFICATION_ICON_PATH = 'icons/icon128.png';
const TAB_GROUP_ID_NONE = -1;

type QueueJob<T> = () => Promise<T>;
type DelayedTabStatus = NonNullable<DelayedTab['status']>;
type NotificationPermissionLevel = 'granted' | 'denied';

interface WakeOptions {
  notify: boolean;
  rescheduleRecurring: boolean;
}

interface WakeNotificationTarget {
  tabId: number;
  windowId?: number;
}

function getAlarmName(tabId: string): string {
  return `${ALARM_PREFIX}${tabId}`;
}

function parseAlarmTabId(alarmName: string): string | null {
  if (!alarmName.startsWith(ALARM_PREFIX)) {
    return null;
  }

  return alarmName.slice(ALARM_PREFIX.length);
}

function getNotificationIconUrl(chromeApi: typeof chrome): string {
  return (
    chromeApi.runtime?.getURL?.(NOTIFICATION_ICON_PATH) ?? NOTIFICATION_ICON_PATH
  );
}

function getNotificationPermissionLevel(
  chromeApi: typeof chrome
): Promise<NotificationPermissionLevel> {
  return new Promise((resolve) => {
    chromeApi.notifications.getPermissionLevel((level) => {
      resolve(level === 'denied' ? 'denied' : 'granted');
    });
  });
}

function getNotifications(
  chromeApi: typeof chrome
): Promise<Record<string, boolean>> {
  return new Promise((resolve) => {
    chromeApi.notifications.getAll((notifications) => {
      resolve(notifications as Record<string, boolean>);
    });
  });
}

function clearNotification(
  chromeApi: typeof chrome,
  notificationId: string
): Promise<boolean> {
  return new Promise((resolve) => {
    chromeApi.notifications.clear(notificationId, resolve);
  });
}

function getDelayedTabStatus(status?: DelayedTab['status']): DelayedTabStatus {
  return status === 'waking' ? 'waking' : 'scheduled';
}

function isValidDelayedTab(tab: Partial<DelayedTab>): tab is DelayedTab {
  return (
    typeof tab.id === 'string' &&
    tab.id.length > 0 &&
    typeof tab.url === 'string' &&
    tab.url.length > 0 &&
    typeof tab.createdAt === 'number' &&
    Number.isFinite(tab.createdAt) &&
    typeof tab.wakeTime === 'number' &&
    Number.isFinite(tab.wakeTime)
  );
}

function hasStoredTabGroup(
  group?: DelayedTab['group']
): group is DelayedTabGroup {
  return Boolean(
    group &&
      (typeof group.id === 'number' ||
        typeof group.windowId === 'number' ||
        typeof group.title === 'string' ||
        typeof group.color === 'string' ||
        typeof group.collapsed === 'boolean')
  );
}

function toScheduledTab(tab: DelayedTab): DelayedTab {
  return {
    ...tab,
    status: 'scheduled',
  };
}

function toWakingTab(tab: DelayedTab): DelayedTab {
  return {
    ...tab,
    status: 'waking',
  };
}

function replaceTab(
  tabs: DelayedTab[],
  tabId: string,
  replacements: DelayedTab[]
): DelayedTab[] {
  return tabs
    .filter((tab) => tab.id !== tabId)
    .concat(replacements)
    .sort((a, b) => a.wakeTime - b.wakeTime);
}

function sanitizeDelayedTabs(tabs: DelayedTab[]): DelayedTab[] {
  const uniqueTabs = new Map<string, DelayedTab>();

  for (const tab of normalizeDelayedTabs(tabs)) {
    if (!isValidDelayedTab(tab)) {
      continue;
    }

    if (!uniqueTabs.has(tab.id)) {
      uniqueTabs.set(tab.id, {
        ...tab,
        id: String(tab.id),
        status: getDelayedTabStatus(tab.status),
      });
    }
  }

  return [...uniqueTabs.values()].sort((a, b) => a.wakeTime - b.wakeTime);
}

export interface DelayedTabsController {
  setupContextMenu: () => Promise<void>;
  initializeStorage: () => Promise<void>;
  scheduleTabs: (
    tabs: chrome.tabs.Tab[],
    wakeTime: number,
    recurrencePattern?: RecurrencePattern,
    remindOnly?: boolean
  ) => Promise<DelayedTabsRuntimeResponse>;
  wakeTabs: (tabIds: string[]) => Promise<DelayedTabsRuntimeResponse>;
  updateTabTime: (
    tabId: string,
    wakeTime: number
  ) => Promise<DelayedTabsRuntimeResponse>;
  updateTabTitle: (
    tabId: string,
    title: string
  ) => Promise<DelayedTabsRuntimeResponse>;
  removeTabs: (tabIds: string[]) => Promise<DelayedTabsRuntimeResponse>;
  handleAlarm: (alarm: chrome.alarms.Alarm) => Promise<void>;
  handleNotificationClick: (notificationId: string) => Promise<void>;
  handleNotificationClosed: (notificationId: string) => Promise<void>;
  reconcileDelayedTabs: () => Promise<DelayedTabsRuntimeResponse>;
}

export function createDelayedTabsController(
  chromeApi: typeof chrome = chrome
): DelayedTabsController {
  const queue: Array<() => Promise<void>> = [];
  let isProcessingQueue = false;

  async function processQueue(): Promise<void> {
    if (isProcessingQueue) {
      return;
    }

    isProcessingQueue = true;

    while (queue.length > 0) {
      const job = queue.shift();

      if (!job) {
        continue;
      }

      await job();
    }

    isProcessingQueue = false;
  }

  function enqueue<T>(job: QueueJob<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push(async () => {
        try {
          resolve(await job());
        } catch (error) {
          reject(error);
        }
      });

      void processQueue();
    });
  }

  async function loadDelayedTabs(): Promise<DelayedTab[]> {
    const { delayedTabs = [] } = await chromeApi.storage.local.get(
      DELAYED_TABS_STORAGE_KEY
    );

    return sanitizeDelayedTabs(delayedTabs as DelayedTab[]);
  }

  async function saveDelayedTabs(tabs: DelayedTab[]): Promise<DelayedTab[]> {
    const sanitizedTabs = sanitizeDelayedTabs(tabs);

    await chromeApi.storage.local.set({
      [DELAYED_TABS_STORAGE_KEY]: sanitizedTabs,
    });

    return sanitizedTabs;
  }

  async function loadWakeNotificationTargets(): Promise<
    Record<string, WakeNotificationTarget>
  > {
    const stored = await chromeApi.storage.session.get(
      NOTIFICATION_TARGETS_STORAGE_KEY
    );
    const targets = stored[NOTIFICATION_TARGETS_STORAGE_KEY];

    return targets && typeof targets === 'object'
      ? (targets as Record<string, WakeNotificationTarget>)
      : {};
  }

  async function saveWakeNotificationTarget(
    notificationId: string,
    target: WakeNotificationTarget
  ): Promise<void> {
    const targets = await loadWakeNotificationTargets();

    await chromeApi.storage.session.set({
      [NOTIFICATION_TARGETS_STORAGE_KEY]: {
        ...targets,
        [notificationId]: target,
      },
    });
  }

  async function removeWakeNotificationTarget(
    notificationId: string
  ): Promise<void> {
    const targets = await loadWakeNotificationTargets();

    if (!(notificationId in targets)) {
      return;
    }

    delete targets[notificationId];
    await chromeApi.storage.session.set({
      [NOTIFICATION_TARGETS_STORAGE_KEY]: targets,
    });
  }

  async function clearAlarms(tabIds: Iterable<string>): Promise<void> {
    for (const tabId of tabIds) {
      await chromeApi.alarms.clear(getAlarmName(tabId));
    }
  }

  async function createAlarm(tab: DelayedTab): Promise<void> {
    await chromeApi.alarms.create(getAlarmName(tab.id), {
      when: tab.wakeTime,
    });
  }

  async function createAlarms(tabs: DelayedTab[]): Promise<void> {
    for (const tab of tabs) {
      await createAlarm(tab);
    }
  }

  async function createWakeNotification(tab: DelayedTab): Promise<string | null> {
    try {
      const permissionLevel = await getNotificationPermissionLevel(chromeApi);

      if (permissionLevel === 'denied') {
        throw new Error('Notification permission is denied');
      }

      const notificationId = `${NOTIFICATION_PREFIX}${tab.id}`;

      await chromeApi.notifications.create(notificationId, {
        type: 'basic',
        iconUrl: getNotificationIconUrl(chromeApi),
        title: 'Tab Waking Up',
        message: `Your ${tab.isRecurring ? 'recurring' : 'delayed'} tab "${tab.title}" is ready. Click to view it.`,
        priority: 2,
        requireInteraction: true,
      });

      const notifications = await getNotifications(chromeApi);

      if (!(notificationId in notifications)) {
        throw new Error('Wake notification was not registered by Chrome');
      }

      return notificationId;
    } catch (error) {
      // Notification failures should not roll back the wake flow.
      console.warn('Failed to show wake notification:', error);
      return null;
    }
  }

  async function saveWakeNotificationTargetSafely(
    notificationId: string | null,
    openedTab: chrome.tabs.Tab
  ): Promise<void> {
    if (!notificationId || !openedTab.id) {
      return;
    }

    try {
      await saveWakeNotificationTarget(notificationId, {
        tabId: openedTab.id,
        windowId: openedTab.windowId,
      });
    } catch (error) {
      // A missing click target should not roll back an already opened tab.
      console.warn('Failed to save wake notification target:', error);
    }
  }

  async function openTab(
    tab: DelayedTab,
    { notify }: Pick<WakeOptions, 'notify'>
  ): Promise<chrome.tabs.Tab | null> {
    if (!tab.url) {
      return null;
    }

    const wakeNotificationId = notify ? await createWakeNotification(tab) : null;

    const group = hasStoredTabGroup(tab.group) ? tab.group : undefined;
    const targetWindowId = group?.windowId;
    const createProperties: chrome.tabs.CreateProperties = {
      url: tab.url,
      ...(notify ? { active: false } : {}),
    };
    let openedTab: chrome.tabs.Tab;

    if (typeof targetWindowId === 'number') {
      try {
        openedTab = await chromeApi.tabs.create({
          ...createProperties,
          windowId: targetWindowId,
        });
      } catch {
        openedTab = await chromeApi.tabs.create(createProperties);
      }
    } else {
      openedTab = await chromeApi.tabs.create(createProperties);
    }

    await saveWakeNotificationTargetSafely(wakeNotificationId, {
      ...openedTab,
      windowId: openedTab.windowId ?? targetWindowId,
    });

    if (!openedTab.id || !group) {
      return openedTab;
    }

    await restoreTabGroup(openedTab.id, group);

    return openedTab;
  }

  async function restoreTabGroup(
    tabId: number,
    group: DelayedTabGroup
  ): Promise<void> {
    try {
      if (typeof group.id === 'number') {
        await chromeApi.tabGroups.get(group.id);
        await chromeApi.tabs.group({
          groupId: group.id,
          tabIds: [tabId],
        });

        return;
      }
    } catch {
      // Fall through to recreate the group when the original no longer exists.
    }

    const groupId = await chromeApi.tabs.group({
      createProperties:
        typeof group.windowId === 'number'
          ? { windowId: group.windowId }
          : undefined,
      tabIds: [tabId],
    });

    const updateProperties: chrome.tabGroups.UpdateProperties = {};

    if (typeof group.title === 'string') {
      updateProperties.title = group.title;
    }

    if (typeof group.color === 'string') {
      updateProperties.color = group.color;
    }

    if (typeof group.collapsed === 'boolean') {
      updateProperties.collapsed = group.collapsed;
    }

    if (Object.keys(updateProperties).length === 0) {
      return;
    }

    await chromeApi.tabGroups.update(groupId, updateProperties);
  }

  async function captureTabGroup(
    tab: chrome.tabs.Tab
  ): Promise<DelayedTab['group']> {
    if (
      typeof tab.groupId !== 'number' ||
      tab.groupId === TAB_GROUP_ID_NONE ||
      !chromeApi.tabGroups?.get
    ) {
      return undefined;
    }

    try {
      const group = await chromeApi.tabGroups.get(tab.groupId);

      return {
        id: group.id,
        windowId: group.windowId,
        title: group.title,
        color: group.color,
        collapsed: group.collapsed,
      };
    } catch {
      return undefined;
    }
  }

  async function reopenBrowserTabs(tabs: chrome.tabs.Tab[]): Promise<void> {
    for (const tab of tabs) {
      if (!tab.url) {
        continue;
      }

      try {
        await chromeApi.tabs.create({ url: tab.url });
      } catch {
        // Best-effort rollback for tabs already closed during scheduling.
      }
    }
  }

  async function buildScheduledTab(
    tab: chrome.tabs.Tab,
    wakeTime: number,
    recurrencePattern?: RecurrencePattern,
    remindOnly = false
  ): Promise<DelayedTab | null> {
    if (!tab.id || !tab.url) {
      return null;
    }

    return {
      id: generateUniqueTabId(),
      url: tab.url,
      title: tab.title,
      favicon: tab.favIconUrl,
      createdAt: Date.now(),
      wakeTime,
      status: 'scheduled',
      isRecurring: Boolean(recurrencePattern),
      recurrencePattern,
      remindOnly,
      sourceTabId: remindOnly ? tab.id : undefined,
      group: await captureTabGroup(tab),
    };
  }

  function buildRecurringReschedule(
    tab: DelayedTab,
    sourceTabId?: number
  ): DelayedTab | null {
    if (!tab.isRecurring || !tab.recurrencePattern) {
      return null;
    }

    const nextWakeTime = calculateNextWakeTime(tab.recurrencePattern);

    if (!nextWakeTime) {
      return null;
    }

    return {
      ...tab,
      id: generateUniqueTabId(),
      wakeTime: nextWakeTime,
      status: 'scheduled',
      isRecurring: true,
      sourceTabId: tab.remindOnly ? sourceTabId ?? tab.sourceTabId : undefined,
    };
  }

  async function notifyExistingTab(
    tab: DelayedTab,
    existingTab: chrome.tabs.Tab,
    notify: boolean
  ): Promise<chrome.tabs.Tab> {
    const notificationId = notify ? await createWakeNotification(tab) : null;
    await saveWakeNotificationTargetSafely(notificationId, existingTab);

    return existingTab;
  }

  async function wakeReminderOrOpenTab(
    tab: DelayedTab,
    notify: boolean
  ): Promise<chrome.tabs.Tab | null> {
    if (tab.remindOnly && typeof tab.sourceTabId === 'number') {
      try {
        const existingTab = await chromeApi.tabs.get(tab.sourceTabId);

        return notifyExistingTab(tab, existingTab, notify);
      } catch {
        // The source tab was closed, so recreate it below.
      }
    }

    return openTab(tab, { notify });
  }

  async function processWakeTarget(
    currentTabs: DelayedTab[],
    tab: DelayedTab,
    options: WakeOptions
  ): Promise<DelayedTab[]> {
    const originalTab = toScheduledTab(tab);
    const wakingTab = toWakingTab(originalTab);
    let workingTabs = await saveDelayedTabs(
      replaceTab(currentTabs, originalTab.id, [wakingTab])
    );
    let wokenTab: chrome.tabs.Tab | null;

    try {
      wokenTab = await wakeReminderOrOpenTab(originalTab, options.notify);
    } catch {
      return saveDelayedTabs(replaceTab(workingTabs, originalTab.id, [originalTab]));
    }

    let replacementTabs: DelayedTab[] = [];
    let clearOriginalAlarm = true;
    let createdRecurringAlarmId: string | null = null;

    if (options.rescheduleRecurring) {
      const rescheduledTab = buildRecurringReschedule(originalTab, wokenTab?.id);

      if (rescheduledTab) {
        try {
          await createAlarm(rescheduledTab);
          createdRecurringAlarmId = rescheduledTab.id;
          replacementTabs = [rescheduledTab];
        } catch {
          replacementTabs = [originalTab];
          clearOriginalAlarm = false;
        }
      }
    }

    const finalizedTabs = replaceTab(workingTabs, originalTab.id, replacementTabs);

    try {
      workingTabs = await saveDelayedTabs(finalizedTabs);

      if (clearOriginalAlarm) {
        await clearAlarms([originalTab.id]);
      }

      return workingTabs;
    } catch {
      if (createdRecurringAlarmId) {
        await clearAlarms([createdRecurringAlarmId]);
      }

      return saveDelayedTabs(replaceTab(workingTabs, originalTab.id, [originalTab]));
    }
  }

  async function wakeStoredTabs(
    tabIds: string[],
    options: WakeOptions
  ): Promise<DelayedTabsRuntimeResponse> {
    return enqueue(async () => {
      const requestedIds = new Set(tabIds.map(String));
      const delayedTabs = await loadDelayedTabs();
      const tabsToWake = delayedTabs.filter((tab) => requestedIds.has(tab.id));

      let currentTabs = delayedTabs;

      for (const tab of tabsToWake) {
        const latestTab = currentTabs.find((currentTab) => currentTab.id === tab.id);

        if (!latestTab) {
          continue;
        }

        currentTabs = await processWakeTarget(currentTabs, latestTab, options);
      }

      return {
        success: true,
        delayedTabs: currentTabs,
      };
    });
  }

  async function synchronizeAlarms(persistedTabs: DelayedTab[]): Promise<void> {
    const alarms = await chromeApi.alarms.getAll();
    const now = Date.now();
    const futureTabs = persistedTabs.filter(
      (tab) => tab.status !== 'waking' && tab.wakeTime > now
    );
    const futureTabIds = new Set(futureTabs.map((tab) => tab.id));
    const alarmTabIds = new Set<string>();

    for (const alarm of alarms) {
      const tabId = parseAlarmTabId(alarm.name);

      if (!tabId) {
        continue;
      }

      alarmTabIds.add(tabId);

      if (!futureTabIds.has(tabId)) {
        await chromeApi.alarms.clear(alarm.name);
      }
    }

    const missingAlarms = futureTabs.filter((tab) => !alarmTabIds.has(tab.id));
    await createAlarms(missingAlarms);
  }

  async function setupContextMenu(): Promise<void> {
    await chromeApi.contextMenus.removeAll();
    await chromeApi.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: 'Delay this tab',
      contexts: ['page'],
    });
  }

  async function initializeStorage(): Promise<void> {
    const { delayedTabs } = await chromeApi.storage.local.get(
      DELAYED_TABS_STORAGE_KEY
    );

    if (!Array.isArray(delayedTabs)) {
      await chromeApi.storage.local.set({ [DELAYED_TABS_STORAGE_KEY]: [] });
    }
  }

  async function scheduleTabs(
    tabs: chrome.tabs.Tab[],
    wakeTime: number,
    recurrencePattern?: RecurrencePattern,
    remindOnly = false
  ): Promise<DelayedTabsRuntimeResponse> {
    return enqueue(async () => {
      const delayedTabs = await loadDelayedTabs();
      const builtTabs = await Promise.all(
        tabs.map((tab) =>
          buildScheduledTab(tab, wakeTime, recurrencePattern, remindOnly)
        )
      );
      const newDelayedTabs = builtTabs.filter(
        (tab): tab is DelayedTab => tab !== null
      );

      if (newDelayedTabs.length === 0) {
        return {
          success: true,
          delayedTabs,
        };
      }

      const createdAlarmIds: string[] = [];
      const removedTabs: chrome.tabs.Tab[] = [];

      try {
        for (const delayedTab of newDelayedTabs) {
          await createAlarm(delayedTab);
          createdAlarmIds.push(delayedTab.id);
        }

        if (!remindOnly) {
          for (const tab of tabs) {
            if (!tab.id || !tab.url) {
              continue;
            }

            await chromeApi.tabs.remove(tab.id);
            removedTabs.push(tab);
          }
        }

        const persistedTabs = await saveDelayedTabs(delayedTabs.concat(newDelayedTabs));

        return {
          success: true,
          delayedTabs: persistedTabs,
        };
      } catch (error) {
        if (createdAlarmIds.length > 0) {
          await clearAlarms(createdAlarmIds);
        }

        if (removedTabs.length > 0) {
          await reopenBrowserTabs(removedTabs);
        }

        throw error;
      }
    });
  }

  async function removeTabs(
    tabIds: string[]
  ): Promise<DelayedTabsRuntimeResponse> {
    return enqueue(async () => {
      const removedIds = new Set(tabIds.map(String));
      const delayedTabs = await loadDelayedTabs();
      const updatedTabs = delayedTabs.filter((tab) => !removedIds.has(tab.id));
      const persistedTabs = await saveDelayedTabs(updatedTabs);

      await clearAlarms(removedIds);

      return {
        success: true,
        delayedTabs: persistedTabs,
      };
    });
  }

  async function updateTabTime(
    tabId: string,
    wakeTime: number
  ): Promise<DelayedTabsRuntimeResponse> {
    return enqueue(async () => {
      const delayedTabs = await loadDelayedTabs();
      const targetTab = delayedTabs.find((tab) => tab.id === String(tabId));

      if (!targetTab) {
        throw new Error('Delayed tab not found');
      }

      const updatedTab: DelayedTab = {
        ...targetTab,
        wakeTime,
        status: 'scheduled',
      };
      const updatedTabs = replaceTab(delayedTabs, targetTab.id, [updatedTab]);

      await createAlarm(updatedTab);

      try {
        const persistedTabs = await saveDelayedTabs(updatedTabs);

        return {
          success: true,
          delayedTabs: persistedTabs,
        };
      } catch (error) {
        await createAlarm(targetTab);
        throw error;
      }
    });
  }

  async function updateTabTitle(
    tabId: string,
    title: string
  ): Promise<DelayedTabsRuntimeResponse> {
    return enqueue(async () => {
      const delayedTabs = await loadDelayedTabs();
      const targetTab = delayedTabs.find((tab) => tab.id === String(tabId));

      if (!targetTab) {
        throw new Error('Delayed tab not found');
      }

      const updatedTab: DelayedTab = {
        ...targetTab,
        title: title.trim(),
      };
      const persistedTabs = await saveDelayedTabs(
        replaceTab(delayedTabs, targetTab.id, [updatedTab])
      );

      return { success: true, delayedTabs: persistedTabs };
    });
  }

  async function handleAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
    const tabId = parseAlarmTabId(alarm.name);

    if (!tabId) {
      return;
    }

    await wakeStoredTabs([tabId], {
      notify: true,
      rescheduleRecurring: true,
    });
  }

  async function handleNotificationClick(
    notificationId: string
  ): Promise<void> {
    if (!notificationId.startsWith(NOTIFICATION_PREFIX)) {
      return;
    }

    return enqueue(async () => {
      try {
        const targets = await loadWakeNotificationTargets();
        const target = targets[notificationId];

        if (!target) {
          return;
        }

        await clearNotification(chromeApi, notificationId);

        const activatedTab = await chromeApi.tabs.update(target.tabId, {
          active: true,
        });
        const windowId = target.windowId ?? activatedTab?.windowId;

        if (typeof windowId === 'number') {
          await chromeApi.windows.update(windowId, { focused: true });
        }

        await removeWakeNotificationTarget(notificationId);
      } catch (error) {
        console.warn('Failed to activate tab from wake notification:', error);
      }
    });
  }

  async function handleNotificationClosed(
    notificationId: string
  ): Promise<void> {
    if (!notificationId.startsWith(NOTIFICATION_PREFIX)) {
      return;
    }

    return enqueue(() => removeWakeNotificationTarget(notificationId));
  }

  async function reconcileDelayedTabs(): Promise<DelayedTabsRuntimeResponse> {
    return enqueue(async () => {
      const delayedTabs = await loadDelayedTabs();
      const recoveredTabs = delayedTabs.map((tab) =>
        tab.status === 'waking' ? toScheduledTab(tab) : tab
      );
      const needsRecovery = recoveredTabs.some(
        (tab, index) => tab.status !== delayedTabs[index]?.status
      );

      let currentTabs = needsRecovery
        ? await saveDelayedTabs(recoveredTabs)
        : recoveredTabs;
      const now = Date.now();
      const dueTabIds = currentTabs
        .filter((tab) => tab.wakeTime <= now && tab.status !== 'waking')
        .map((tab) => tab.id);

      for (const tabId of dueTabIds) {
        const currentTab = currentTabs.find((tab) => tab.id === tabId);

        if (!currentTab || currentTab.wakeTime > now) {
          continue;
        }

        currentTabs = await processWakeTarget(currentTabs, currentTab, {
          notify: true,
          rescheduleRecurring: true,
        });
      }

      const persistedTabs = await saveDelayedTabs(currentTabs);
      await synchronizeAlarms(persistedTabs);

      return {
        success: true,
        delayedTabs: persistedTabs,
      };
    });
  }

  return {
    setupContextMenu,
    initializeStorage,
    scheduleTabs,
    wakeTabs: (tabIds) =>
      wakeStoredTabs(tabIds, {
        notify: false,
        rescheduleRecurring: false,
      }),
    updateTabTime,
    updateTabTitle,
    removeTabs,
    handleAlarm,
    handleNotificationClick,
    handleNotificationClosed,
    reconcileDelayedTabs,
  };
}
