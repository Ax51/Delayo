import { DelayedTab, RecurrencePattern } from '@types';
import { calculateNextWakeTime } from '@utils/recurrence';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDelayedTabsController } from './delayedTabsController';

interface ChromeMock {
  chromeApi: typeof chrome;
  getStoredTabs: () => DelayedTab[];
  getAlarmNames: () => string[];
  tabsCreate: ReturnType<typeof vi.fn>;
  tabsGet: ReturnType<typeof vi.fn>;
  tabsUpdate: ReturnType<typeof vi.fn>;
  tabsRemove: ReturnType<typeof vi.fn>;
  tabsGroup: ReturnType<typeof vi.fn>;
  alarmsCreate: ReturnType<typeof vi.fn>;
  alarmsClear: ReturnType<typeof vi.fn>;
  notificationsCreate: ReturnType<typeof vi.fn>;
  notificationsClear: ReturnType<typeof vi.fn>;
  notificationsGetAll: ReturnType<typeof vi.fn>;
  notificationsGetPermissionLevel: ReturnType<typeof vi.fn>;
  windowsUpdate: ReturnType<typeof vi.fn>;
  tabGroupsGet: ReturnType<typeof vi.fn>;
  tabGroupsUpdate: ReturnType<typeof vi.fn>;
  setOpenTab: (tab: chrome.tabs.Tab) => void;
}

function createChromeMock(
  initialTabs: DelayedTab[] = [],
  initialAlarmNames: string[] = []
): ChromeMock {
  let storedTabs = [...initialTabs];
  let sessionStorage: Record<string, unknown> = {};
  const openTabs = new Map<number, chrome.tabs.Tab>();
  const alarms = new Map<string, chrome.alarms.Alarm>();

  for (const name of initialAlarmNames) {
    alarms.set(name, {
      name,
      scheduledTime: Date.now(),
    } as chrome.alarms.Alarm);
  }

  const tabsCreate = vi.fn(async () => {
    const tab = { id: 999, windowId: 321 } as chrome.tabs.Tab;
    openTabs.set(999, tab);
    return tab;
  });
  const tabsGet = vi.fn(async (tabId: number) => {
    const tab = openTabs.get(tabId);

    if (!tab) {
      throw new Error('Tab not found');
    }

    return tab;
  });
  const tabsUpdate = vi.fn(
    async (tabId: number) => ({ id: tabId, windowId: 321 }) as chrome.tabs.Tab
  );
  const tabsRemove = vi.fn(async () => undefined);
  const tabsGroup = vi.fn(
    async ({ groupId }: chrome.tabs.GroupOptions) => groupId ?? 456
  );
  const notifications = new Set<string>();
  const notificationsCreate = vi.fn(async (notificationId: string) => {
    notifications.add(notificationId);
    return notificationId;
  });
  const notificationsClear = vi.fn(
    (notificationId: string, callback: (wasCleared: boolean) => void) => {
      callback(notifications.delete(notificationId));
    }
  );
  const notificationsGetAll = vi.fn(
    (callback: (notifications: Record<string, boolean>) => void) => {
      callback(Object.fromEntries([...notifications].map((id) => [id, true])));
    }
  );
  const notificationsGetPermissionLevel = vi.fn(
    (callback: (level: 'granted' | 'denied') => void) => {
      callback('granted');
    }
  );
  const windowsUpdate = vi.fn(
    async (windowId: number) => ({ id: windowId }) as chrome.windows.Window
  );
  const tabGroupsGet = vi.fn(
    async (groupId: number) =>
      ({
        id: groupId,
        windowId: 321,
        title: 'Work',
        color: 'blue',
        collapsed: true,
      }) as chrome.tabGroups.TabGroup
  );
  const tabGroupsUpdate = vi.fn(
    async (groupId: number) =>
      ({
        id: groupId,
      }) as chrome.tabGroups.TabGroup
  );
  const alarmsCreate = vi.fn(
    async (name: string, info: chrome.alarms.AlarmCreateInfo) => {
      alarms.set(name, {
        name,
        scheduledTime: info.when ?? Date.now(),
      } as chrome.alarms.Alarm);
    }
  );
  const alarmsClear = vi.fn(async (name?: string) => {
    if (!name) {
      return false;
    }

    return alarms.delete(name);
  });

  const chromeApi = {
    storage: {
      local: {
        get: vi.fn(async () => ({ delayedTabs: storedTabs })),
        set: vi.fn(async (value: { delayedTabs?: DelayedTab[] }) => {
          if (Array.isArray(value.delayedTabs)) {
            storedTabs = value.delayedTabs;
          }
        }),
      },
      session: {
        get: vi.fn(async () => ({ ...sessionStorage })),
        set: vi.fn(async (value: Record<string, unknown>) => {
          sessionStorage = { ...sessionStorage, ...value };
        }),
      },
    },
    alarms: {
      create: alarmsCreate,
      clear: alarmsClear,
      getAll: vi.fn(async () => [...alarms.values()]),
    },
    tabs: {
      create: tabsCreate,
      get: tabsGet,
      update: tabsUpdate,
      remove: tabsRemove,
      group: tabsGroup,
    },
    tabGroups: {
      get: tabGroupsGet,
      update: tabGroupsUpdate,
    },
    notifications: {
      create: notificationsCreate,
      clear: notificationsClear,
      getAll: notificationsGetAll,
      getPermissionLevel: notificationsGetPermissionLevel,
    },
    windows: {
      update: windowsUpdate,
    },
    contextMenus: {
      removeAll: vi.fn(async () => undefined),
      create: vi.fn(async () => undefined),
    },
    runtime: {
      getURL: vi.fn((path: string) => `chrome-extension://delayo/${path}`),
      lastError: undefined,
    },
    action: {
      openPopup: vi.fn(async () => undefined),
    },
  } as unknown as typeof chrome;

  return {
    chromeApi,
    getStoredTabs: () => storedTabs,
    getAlarmNames: () => [...alarms.keys()],
    tabsCreate,
    tabsGet,
    tabsUpdate,
    tabsRemove,
    tabsGroup,
    alarmsCreate,
    alarmsClear,
    notificationsCreate,
    notificationsClear,
    notificationsGetAll,
    notificationsGetPermissionLevel,
    windowsUpdate,
    tabGroupsGet,
    tabGroupsUpdate,
    setOpenTab: (tab) => {
      if (typeof tab.id === 'number') {
        openTabs.set(tab.id, tab);
      }
    },
  };
}

function createDelayedTab(overrides: Partial<DelayedTab> = {}): DelayedTab {
  return {
    id: 'tab-1',
    url: 'https://example.com',
    title: 'Example',
    favicon: 'https://example.com/favicon.ico',
    createdAt: Date.now() - 5_000,
    wakeTime: Date.now() - 1_000,
    status: 'scheduled',
    ...overrides,
  };
}

describe('delayedTabsController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-18T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('opens an overdue tab only once when reconcile and alarm overlap', async () => {
    const overdueTab = createDelayedTab();
    const mock = createChromeMock(
      [overdueTab],
      [`delayed-tab-${overdueTab.id}`]
    );
    const controller = createDelayedTabsController(mock.chromeApi);

    const wakePromise = Promise.all([
      controller.reconcileDelayedTabs(),
      controller.handleAlarm({
        name: `delayed-tab-${overdueTab.id}`,
        scheduledTime: overdueTab.wakeTime,
      } as chrome.alarms.Alarm),
    ]);
    await wakePromise;

    expect(mock.tabsCreate).toHaveBeenCalledTimes(1);
    expect(mock.getStoredTabs()).toEqual([]);
  });

  it('opens an overdue tab only once when manual wake and alarm overlap', async () => {
    const overdueTab = createDelayedTab();
    const mock = createChromeMock(
      [overdueTab],
      [`delayed-tab-${overdueTab.id}`]
    );
    const controller = createDelayedTabsController(mock.chromeApi);

    await Promise.all([
      controller.wakeTabs([overdueTab.id]),
      controller.handleAlarm({
        name: `delayed-tab-${overdueTab.id}`,
        scheduledTime: overdueTab.wakeTime,
      } as chrome.alarms.Alarm),
    ]);

    expect(mock.tabsCreate).toHaveBeenCalledTimes(1);
    expect(mock.getStoredTabs()).toEqual([]);
  });

  it('wakes two overdue tabs without duplicating or losing state', async () => {
    const firstTab = createDelayedTab({
      id: 'tab-1',
      url: 'https://one.example',
    });
    const secondTab = createDelayedTab({
      id: 'tab-2',
      url: 'https://two.example',
      title: 'Second',
    });
    const mock = createChromeMock(
      [firstTab, secondTab],
      [`delayed-tab-${firstTab.id}`, `delayed-tab-${secondTab.id}`]
    );
    const controller = createDelayedTabsController(mock.chromeApi);

    const wakePromise = Promise.all([
      controller.handleAlarm({
        name: `delayed-tab-${firstTab.id}`,
        scheduledTime: firstTab.wakeTime,
      } as chrome.alarms.Alarm),
      controller.handleAlarm({
        name: `delayed-tab-${secondTab.id}`,
        scheduledTime: secondTab.wakeTime,
      } as chrome.alarms.Alarm),
    ]);
    await wakePromise;

    expect(mock.tabsCreate).toHaveBeenCalledTimes(2);
    expect(mock.getStoredTabs()).toEqual([]);
  });

  it('shows a native notification when a scheduled alarm wakes a tab', async () => {
    const overdueTab = createDelayedTab({
      favicon: 'https://example.com/favicon.ico',
    });
    const mock = createChromeMock(
      [overdueTab],
      [`delayed-tab-${overdueTab.id}`]
    );
    const controller = createDelayedTabsController(mock.chromeApi);

    const wakePromise = controller.handleAlarm({
      name: `delayed-tab-${overdueTab.id}`,
      scheduledTime: overdueTab.wakeTime,
    } as chrome.alarms.Alarm);
    await wakePromise;

    expect(mock.notificationsGetPermissionLevel).toHaveBeenCalledOnce();
    expect(mock.notificationsCreate).toHaveBeenCalledWith(
      `delayed-tab-wake-${overdueTab.id}`,
      {
        type: 'basic',
        iconUrl: 'chrome-extension://delayo/icons/icon128.png',
        title: 'Tab Waking Up',
        message: 'Your delayed tab "Example" is ready. Click to view it.',
        priority: 2,
        requireInteraction: true,
      }
    );
    expect(mock.notificationsGetAll).toHaveBeenCalledOnce();
    expect(mock.notificationsCreate.mock.invocationCallOrder[0]).toBeLessThan(
      mock.tabsCreate.mock.invocationCallOrder[0]
    );
    expect(mock.tabsCreate).toHaveBeenCalledWith({
      url: overdueTab.url,
      active: false,
    });
  });

  it('keeps manually woken tabs active', async () => {
    const overdueTab = createDelayedTab();
    const mock = createChromeMock(
      [overdueTab],
      [`delayed-tab-${overdueTab.id}`]
    );
    const controller = createDelayedTabsController(mock.chromeApi);

    await controller.wakeTabs([overdueTab.id]);

    expect(mock.tabsCreate).toHaveBeenCalledWith({ url: overdueTab.url });
  });

  it('focuses the reopened tab and browser window when its notification is clicked', async () => {
    const overdueTab = createDelayedTab();
    const notificationId = `delayed-tab-wake-${overdueTab.id}`;
    const mock = createChromeMock(
      [overdueTab],
      [`delayed-tab-${overdueTab.id}`]
    );
    const controller = createDelayedTabsController(mock.chromeApi);

    const wakePromise = controller.handleAlarm({
      name: `delayed-tab-${overdueTab.id}`,
      scheduledTime: overdueTab.wakeTime,
    } as chrome.alarms.Alarm);
    await wakePromise;

    const restartedController = createDelayedTabsController(mock.chromeApi);
    await restartedController.handleNotificationClick(notificationId);

    expect(mock.tabsUpdate).toHaveBeenCalledWith(999, { active: true });
    expect(mock.windowsUpdate).toHaveBeenCalledWith(321, { focused: true });
    expect(mock.notificationsClear).toHaveBeenCalledWith(
      notificationId,
      expect.any(Function)
    );
    expect(mock.notificationsClear.mock.invocationCallOrder[0]).toBeLessThan(
      mock.tabsUpdate.mock.invocationCallOrder[0]
    );
    expect(mock.tabsUpdate.mock.invocationCallOrder[0]).toBeLessThan(
      mock.windowsUpdate.mock.invocationCallOrder[0]
    );
  });

  it('handles a notification click queued while the tab is still opening', async () => {
    const overdueTab = createDelayedTab();
    const notificationId = `delayed-tab-wake-${overdueTab.id}`;
    const mock = createChromeMock(
      [overdueTab],
      [`delayed-tab-${overdueTab.id}`]
    );
    const controller = createDelayedTabsController(mock.chromeApi);

    const wakePromise = controller.handleAlarm({
      name: `delayed-tab-${overdueTab.id}`,
      scheduledTime: overdueTab.wakeTime,
    } as chrome.alarms.Alarm);
    const clickPromise = controller.handleNotificationClick(notificationId);

    await Promise.all([wakePromise, clickPromise]);

    expect(mock.tabsCreate).toHaveBeenCalledWith({
      url: overdueTab.url,
      active: false,
    });
    expect(mock.tabsUpdate).toHaveBeenCalledWith(999, { active: true });
    expect(mock.windowsUpdate).toHaveBeenCalledWith(321, { focused: true });
  });

  it('does not show a notification when a tab is manually woken', async () => {
    const overdueTab = createDelayedTab();
    const mock = createChromeMock(
      [overdueTab],
      [`delayed-tab-${overdueTab.id}`]
    );
    const controller = createDelayedTabsController(mock.chromeApi);

    await controller.wakeTabs([overdueTab.id]);

    expect(mock.tabsCreate).toHaveBeenCalledTimes(1);
    expect(mock.notificationsCreate).not.toHaveBeenCalled();
  });

  it('keeps the tab scheduled when manual wake fails to reopen it', async () => {
    const futureTab = createDelayedTab({
      id: 'future-1',
      wakeTime: Date.now() + 60_000,
    });
    const mock = createChromeMock([futureTab], [`delayed-tab-${futureTab.id}`]);
    mock.tabsCreate.mockRejectedValueOnce(new Error('Failed to reopen tab'));
    const controller = createDelayedTabsController(mock.chromeApi);

    const response = await controller.wakeTabs([futureTab.id]);

    expect(response.success).toBe(true);
    expect(mock.getStoredTabs()).toEqual([
      expect.objectContaining({
        id: futureTab.id,
        status: 'scheduled',
      }),
    ]);
    expect(mock.getAlarmNames()).toContain(`delayed-tab-${futureTab.id}`);
  });

  it('stores the original tab group metadata when scheduling a grouped tab', async () => {
    const browserTab = {
      id: 123,
      groupId: 77,
      windowId: 321,
      url: 'https://grouped.example',
      title: 'Grouped',
      favIconUrl: 'https://grouped.example/favicon.ico',
    } as chrome.tabs.Tab;
    const mock = createChromeMock();
    const controller = createDelayedTabsController(mock.chromeApi);

    await controller.scheduleTabs([browserTab], Date.now() + 60_000);

    expect(mock.tabGroupsGet).toHaveBeenCalledWith(77);
    expect(mock.getStoredTabs()).toEqual([
      expect.objectContaining({
        group: {
          id: 77,
          windowId: 321,
          title: 'Work',
          color: 'blue',
          collapsed: true,
        },
      }),
    ]);
  });

  it('reopens a delayed tab back into its existing tab group', async () => {
    const groupedTab = createDelayedTab({
      group: {
        id: 77,
        windowId: 321,
        title: 'Work',
        color: 'blue',
        collapsed: true,
      },
    });
    const mock = createChromeMock(
      [groupedTab],
      [`delayed-tab-${groupedTab.id}`]
    );
    const controller = createDelayedTabsController(mock.chromeApi);

    await controller.wakeTabs([groupedTab.id]);

    expect(mock.tabsCreate).toHaveBeenCalledWith({
      url: groupedTab.url,
      windowId: 321,
    });
    expect(mock.tabGroupsGet).toHaveBeenCalledWith(77);
    expect(mock.tabsGroup).toHaveBeenCalledWith({
      groupId: 77,
      tabIds: [999],
    });
    expect(mock.tabGroupsUpdate).not.toHaveBeenCalled();
  });

  it('recreates the tab group when the original group no longer exists', async () => {
    const groupedTab = createDelayedTab({
      group: {
        id: 77,
        windowId: 321,
        title: 'Work',
        color: 'blue',
        collapsed: true,
      },
    });
    const mock = createChromeMock(
      [groupedTab],
      [`delayed-tab-${groupedTab.id}`]
    );
    mock.tabGroupsGet.mockRejectedValueOnce(new Error('Group not found'));
    const controller = createDelayedTabsController(mock.chromeApi);

    await controller.wakeTabs([groupedTab.id]);

    expect(mock.tabsGroup).toHaveBeenCalledWith({
      createProperties: {
        windowId: 321,
      },
      tabIds: [999],
    });
    expect(mock.tabGroupsUpdate).toHaveBeenCalledWith(456, {
      title: 'Work',
      color: 'blue',
      collapsed: true,
    });
  });

  it('keeps an overdue tab stored when reconcile fails to reopen it', async () => {
    const overdueTab = createDelayedTab({ id: 'overdue-1' });
    const mock = createChromeMock(
      [overdueTab],
      [`delayed-tab-${overdueTab.id}`]
    );
    mock.tabsCreate.mockRejectedValueOnce(new Error('Failed to reopen tab'));
    const controller = createDelayedTabsController(mock.chromeApi);

    const reconcilePromise = controller.reconcileDelayedTabs();
    await reconcilePromise;

    expect(mock.getStoredTabs()).toEqual([
      expect.objectContaining({
        id: overdueTab.id,
        status: 'scheduled',
      }),
    ]);
    expect(mock.getAlarmNames()).not.toContain(`delayed-tab-${overdueTab.id}`);
  });

  it('shows a notification when startup reconcile wakes overdue tabs', async () => {
    const overdueTab = createDelayedTab();
    const mock = createChromeMock(
      [overdueTab],
      [`delayed-tab-${overdueTab.id}`]
    );
    const controller = createDelayedTabsController(mock.chromeApi);

    const reconcilePromise = controller.reconcileDelayedTabs();
    await reconcilePromise;

    expect(mock.tabsCreate).toHaveBeenCalledTimes(1);
    expect(mock.notificationsCreate).toHaveBeenCalledTimes(1);
    expect(mock.tabsCreate).toHaveBeenCalledWith({
      url: overdueTab.url,
      active: false,
    });
  });

  it('reverts stale waking tabs and recreates missing alarms during reconcile', async () => {
    const futureTab = createDelayedTab({
      id: 'future-1',
      wakeTime: Date.now() + 60_000,
      status: 'waking',
    });
    const mock = createChromeMock([futureTab]);
    const controller = createDelayedTabsController(mock.chromeApi);

    await controller.reconcileDelayedTabs();

    expect(mock.getStoredTabs()).toEqual([
      expect.objectContaining({
        id: futureTab.id,
        status: 'scheduled',
      }),
    ]);
    expect(mock.getAlarmNames()).toContain(`delayed-tab-${futureTab.id}`);
  });

  it('removes the old record before allowing the same tab to be delayed again', async () => {
    const browserTab = {
      id: 123,
      url: 'https://repeat.example',
      title: 'Repeat',
      favIconUrl: 'https://repeat.example/favicon.ico',
    } as chrome.tabs.Tab;
    const mock = createChromeMock();
    const controller = createDelayedTabsController(mock.chromeApi);

    await controller.scheduleTabs([browserTab], Date.now() + 60_000);

    const [firstScheduledTab] = mock.getStoredTabs();
    expect(firstScheduledTab).toBeDefined();

    await controller.wakeTabs([firstScheduledTab.id]);
    expect(mock.getStoredTabs()).toEqual([]);

    await controller.scheduleTabs([browserTab], Date.now() + 120_000);

    const storedTabs = mock.getStoredTabs();
    expect(storedTabs).toHaveLength(1);
    expect(storedTabs[0].id).not.toBe(firstScheduledTab.id);
    expect(storedTabs[0].url).toBe(browserTab.url);
  });

  it('updates an existing delayed tab when scheduling the same URL again', async () => {
    const originalWakeTime = Date.now() + 60_000;
    const existingTab = createDelayedTab({
      id: 'existing-tab',
      url: 'https://repeat.example/article',
      title: 'Original description',
      wakeTime: originalWakeTime,
    });
    const browserTab = {
      id: 123,
      url: existingTab.url,
      title: 'Updated description',
      favIconUrl: 'https://repeat.example/favicon.ico',
    } as chrome.tabs.Tab;
    const mock = createChromeMock(
      [existingTab],
      [`delayed-tab-${existingTab.id}`]
    );
    const controller = createDelayedTabsController(mock.chromeApi);
    const updatedWakeTime = Date.now() + 120_000;

    const response = await controller.scheduleTabs(
      [browserTab],
      updatedWakeTime
    );

    expect(response.success).toBe(true);
    expect(mock.getStoredTabs()).toEqual([
      expect.objectContaining({
        id: existingTab.id,
        url: existingTab.url,
        title: browserTab.title,
        createdAt: existingTab.createdAt,
        wakeTime: updatedWakeTime,
      }),
    ]);
    expect(mock.getAlarmNames()).toEqual([`delayed-tab-${existingTab.id}`]);
    expect(mock.alarmsCreate).toHaveBeenLastCalledWith(
      `delayed-tab-${existingTab.id}`,
      { when: updatedWakeTime }
    );
  });

  it('stores only one delayed tab when the same URL is selected twice', async () => {
    const tabs = [
      {
        id: 123,
        url: 'https://repeat.example/article',
        title: 'First description',
      },
      {
        id: 456,
        url: 'https://repeat.example/article',
        title: 'Latest description',
      },
    ] as chrome.tabs.Tab[];
    const mock = createChromeMock();
    const controller = createDelayedTabsController(mock.chromeApi);
    const wakeTime = Date.now() + 60_000;

    await controller.scheduleTabs(tabs, wakeTime);

    expect(mock.getStoredTabs()).toEqual([
      expect.objectContaining({
        url: tabs[0].url,
        title: tabs[1].title,
        wakeTime,
      }),
    ]);
    expect(mock.tabsRemove).toHaveBeenCalledTimes(2);
    expect(mock.getAlarmNames()).toHaveLength(1);
  });

  it('restores the previous alarm if rescheduling the same URL fails', async () => {
    const existingTab = createDelayedTab({
      id: 'existing-tab',
      url: 'https://repeat.example/article',
      title: 'Original description',
      wakeTime: Date.now() + 60_000,
    });
    const browserTab = {
      id: 123,
      url: existingTab.url,
      title: 'Updated description',
    } as chrome.tabs.Tab;
    const mock = createChromeMock(
      [existingTab],
      [`delayed-tab-${existingTab.id}`]
    );
    mock.tabsRemove.mockRejectedValueOnce(new Error('Failed to close tab'));
    const controller = createDelayedTabsController(mock.chromeApi);

    await expect(
      controller.scheduleTabs([browserTab], Date.now() + 120_000)
    ).rejects.toThrow('Failed to close tab');

    expect(mock.getStoredTabs()).toEqual([existingTab]);
    expect(mock.alarmsCreate).toHaveBeenLastCalledWith(
      `delayed-tab-${existingTab.id}`,
      { when: existingTab.wakeTime }
    );
  });

  it('updates the wake time for an existing delayed tab', async () => {
    const futureTab = createDelayedTab({
      id: 'future-1',
      wakeTime: Date.now() + 60_000,
    });
    const mock = createChromeMock([futureTab], [`delayed-tab-${futureTab.id}`]);
    const controller = createDelayedTabsController(mock.chromeApi);
    const updatedWakeTime = Date.now() + 120_000;

    const response = await controller.updateTabTime(
      futureTab.id,
      updatedWakeTime
    );

    expect(response.success).toBe(true);
    expect(mock.getStoredTabs()).toEqual([
      expect.objectContaining({
        id: futureTab.id,
        wakeTime: updatedWakeTime,
        status: 'scheduled',
      }),
    ]);
    expect(mock.alarmsCreate).toHaveBeenCalledWith(
      `delayed-tab-${futureTab.id}`,
      {
        when: updatedWakeTime,
      }
    );
  });

  it('throws when updating a missing delayed tab', async () => {
    const mock = createChromeMock();
    const controller = createDelayedTabsController(mock.chromeApi);

    await expect(
      controller.updateTabTime('missing-tab', Date.now() + 60_000)
    ).rejects.toThrow('Delayed tab not found');
  });

  it('updates the title for an existing delayed tab', async () => {
    const delayedTab = createDelayedTab({
      id: 'tab-title',
      title: 'Original title',
    });
    const mock = createChromeMock(
      [delayedTab],
      [`delayed-tab-${delayedTab.id}`]
    );
    const controller = createDelayedTabsController(mock.chromeApi);

    const response = await controller.updateTabTitle(
      delayedTab.id,
      '  Updated title  '
    );

    expect(response.delayedTabs?.[0].title).toBe('Updated title');
  });

  it('reschedules recurring tabs with a new id after wake', async () => {
    const recurrencePattern: RecurrencePattern = {
      type: 'daily',
      time: '09:00',
    };
    const recurringTab = createDelayedTab({
      id: 'recurring-1',
      wakeTime: Date.now() - 1_000,
      isRecurring: true,
      recurrencePattern,
    });
    const mock = createChromeMock(
      [recurringTab],
      [`delayed-tab-${recurringTab.id}`]
    );
    const controller = createDelayedTabsController(mock.chromeApi);

    const wakePromise = controller.handleAlarm({
      name: `delayed-tab-${recurringTab.id}`,
      scheduledTime: recurringTab.wakeTime,
    } as chrome.alarms.Alarm);
    await wakePromise;

    const storedTabs = mock.getStoredTabs();
    expect(mock.tabsCreate).toHaveBeenCalledTimes(1);
    expect(storedTabs).toHaveLength(1);
    expect(storedTabs[0].id).not.toBe(recurringTab.id);
    expect(storedTabs[0].wakeTime).toBeGreaterThan(Date.now());
    expect(mock.getAlarmNames()).toContain(`delayed-tab-${storedTabs[0].id}`);
  });

  it('keeps the original recurring schedule if creating the next alarm fails', async () => {
    const recurrencePattern: RecurrencePattern = {
      type: 'daily',
      time: '09:00',
    };
    const recurringTab = createDelayedTab({
      id: 'recurring-1',
      wakeTime: Date.now() + 60_000,
      isRecurring: true,
      recurrencePattern,
    });
    const mock = createChromeMock(
      [recurringTab],
      [`delayed-tab-${recurringTab.id}`]
    );
    mock.alarmsCreate.mockRejectedValueOnce(
      new Error('Failed to create next alarm')
    );
    const controller = createDelayedTabsController(mock.chromeApi);

    const wakePromise = controller.handleAlarm({
      name: `delayed-tab-${recurringTab.id}`,
      scheduledTime: recurringTab.wakeTime,
    } as chrome.alarms.Alarm);
    await wakePromise;

    expect(mock.tabsCreate).toHaveBeenCalledTimes(1);
    expect(mock.getStoredTabs()).toEqual([
      expect.objectContaining({
        id: recurringTab.id,
        status: 'scheduled',
      }),
    ]);
    expect(mock.getAlarmNames()).toContain(`delayed-tab-${recurringTab.id}`);
  });

  it('does not persist delayed tabs when creating alarms fails during schedule', async () => {
    const browserTab = {
      id: 123,
      url: 'https://repeat.example',
      title: 'Repeat',
      favIconUrl: 'https://repeat.example/favicon.ico',
    } as chrome.tabs.Tab;
    const mock = createChromeMock();
    mock.alarmsCreate.mockRejectedValueOnce(
      new Error('Failed to create alarm')
    );
    const controller = createDelayedTabsController(mock.chromeApi);

    await expect(
      controller.scheduleTabs([browserTab], Date.now() + 60_000)
    ).rejects.toThrow('Failed to create alarm');

    expect(mock.getStoredTabs()).toEqual([]);
    expect(mock.tabsRemove).not.toHaveBeenCalled();
    expect(mock.getAlarmNames()).toEqual([]);
  });

  it('keeps a tab open when scheduling a reminder', async () => {
    const browserTab = {
      id: 123,
      windowId: 321,
      url: 'https://example.com',
      title: 'Example',
    } as chrome.tabs.Tab;
    const mock = createChromeMock();
    const controller = createDelayedTabsController(mock.chromeApi);

    await controller.scheduleTabs(
      [browserTab],
      Date.now() + 60_000,
      undefined,
      true
    );

    expect(mock.tabsRemove).not.toHaveBeenCalled();
    expect(mock.getStoredTabs()).toEqual([
      expect.objectContaining({
        remindOnly: true,
        sourceTabId: browserTab.id,
      }),
    ]);
  });

  it('notifies about an open reminder tab without reopening it', async () => {
    const reminderTab = createDelayedTab({
      remindOnly: true,
      sourceTabId: 123,
    });
    const mock = createChromeMock(
      [reminderTab],
      [`delayed-tab-${reminderTab.id}`]
    );
    mock.setOpenTab({
      id: 123,
      windowId: 321,
      url: reminderTab.url,
      title: reminderTab.title,
    } as chrome.tabs.Tab);
    const controller = createDelayedTabsController(mock.chromeApi);

    await controller.handleAlarm({
      name: `delayed-tab-${reminderTab.id}`,
      scheduledTime: reminderTab.wakeTime,
    } as chrome.alarms.Alarm);

    expect(mock.tabsGet).toHaveBeenCalledWith(123);
    expect(mock.tabsCreate).not.toHaveBeenCalled();
    expect(mock.notificationsCreate).toHaveBeenCalledTimes(1);

    await controller.handleNotificationClick(
      `delayed-tab-wake-${reminderTab.id}`
    );

    expect(mock.tabsUpdate).toHaveBeenCalledWith(123, { active: true });
  });

  it('reopens a reminder tab that was closed before its alarm', async () => {
    const reminderTab = createDelayedTab({
      remindOnly: true,
      sourceTabId: 123,
    });
    const mock = createChromeMock(
      [reminderTab],
      [`delayed-tab-${reminderTab.id}`]
    );
    const controller = createDelayedTabsController(mock.chromeApi);

    await controller.handleAlarm({
      name: `delayed-tab-${reminderTab.id}`,
      scheduledTime: reminderTab.wakeTime,
    } as chrome.alarms.Alarm);

    expect(mock.tabsGet).toHaveBeenCalledWith(123);
    expect(mock.tabsCreate).toHaveBeenCalledWith({
      url: reminderTab.url,
      active: false,
    });

    await controller.handleNotificationClick(
      `delayed-tab-wake-${reminderTab.id}`
    );

    expect(mock.tabsUpdate).toHaveBeenCalledWith(999, { active: true });
  });

  it('clears created alarms and avoids persistence when closing tabs fails during schedule', async () => {
    const browserTab = {
      id: 123,
      url: 'https://repeat.example',
      title: 'Repeat',
      favIconUrl: 'https://repeat.example/favicon.ico',
    } as chrome.tabs.Tab;
    const mock = createChromeMock();
    mock.tabsRemove.mockRejectedValueOnce(new Error('Failed to close tab'));
    const controller = createDelayedTabsController(mock.chromeApi);

    await expect(
      controller.scheduleTabs([browserTab], Date.now() + 60_000)
    ).rejects.toThrow('Failed to close tab');

    expect(mock.getStoredTabs()).toEqual([]);
    expect(mock.getAlarmNames()).toEqual([]);
  });

  it('reopens tabs already closed if scheduling fails midway through removal', async () => {
    const firstBrowserTab = {
      id: 123,
      url: 'https://one.example',
      title: 'One',
      favIconUrl: 'https://one.example/favicon.ico',
    } as chrome.tabs.Tab;
    const secondBrowserTab = {
      id: 456,
      url: 'https://two.example',
      title: 'Two',
      favIconUrl: 'https://two.example/favicon.ico',
    } as chrome.tabs.Tab;
    const mock = createChromeMock();
    mock.tabsRemove
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Failed to close second tab'));
    const controller = createDelayedTabsController(mock.chromeApi);

    await expect(
      controller.scheduleTabs(
        [firstBrowserTab, secondBrowserTab],
        Date.now() + 60_000
      )
    ).rejects.toThrow('Failed to close second tab');

    expect(mock.getStoredTabs()).toEqual([]);
    expect(mock.getAlarmNames()).toEqual([]);
    expect(mock.tabsCreate).toHaveBeenCalledWith({ url: firstBrowserTab.url });
  });

  it('clamps monthly recurrence to the last valid day of the month', () => {
    vi.setSystemTime(new Date('2026-02-01T10:00:00.000Z'));

    const nextWakeTime = calculateNextWakeTime({
      type: 'monthly',
      time: '09:00',
      dayOfMonth: 31,
    });

    expect(nextWakeTime).not.toBeNull();
    const nextWakeDate = new Date(nextWakeTime as number);
    expect(nextWakeDate.getFullYear()).toBe(2026);
    expect(nextWakeDate.getMonth()).toBe(1);
    expect(nextWakeDate.getDate()).toBe(28);
    expect(nextWakeDate.getHours()).toBe(9);
    expect(nextWakeDate.getMinutes()).toBe(0);
  });

  it('recreates missing alarms and clears orphan alarms during reconcile', async () => {
    const futureTab = createDelayedTab({
      id: 'future-1',
      wakeTime: Date.now() + 60_000,
    });
    const mock = createChromeMock([futureTab], ['delayed-tab-orphan']);
    const controller = createDelayedTabsController(mock.chromeApi);

    await controller.reconcileDelayedTabs();

    expect(mock.tabsCreate).not.toHaveBeenCalled();
    expect(mock.alarmsCreate).toHaveBeenCalledWith(
      `delayed-tab-${futureTab.id}`,
      expect.objectContaining({ when: futureTab.wakeTime })
    );
    expect(mock.alarmsClear).toHaveBeenCalledWith('delayed-tab-orphan');
    expect(mock.getAlarmNames()).toContain(`delayed-tab-${futureTab.id}`);
    expect(mock.getAlarmNames()).not.toContain('delayed-tab-orphan');
  });
});
