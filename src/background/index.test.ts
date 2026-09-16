import { DelayedTabsRuntimeResponse } from '@types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const controller = vi.hoisted(() => ({
  initializeStorage: vi.fn().mockResolvedValue(undefined),
  reconcileDelayedTabs: vi.fn().mockResolvedValue({ success: true }),
  updateTabsTime: vi.fn(),
}));

vi.mock('./delayedTabsController', () => ({
  createDelayedTabsController: () => controller,
}));

type MessageListener = Parameters<
  typeof chrome.runtime.onMessage.addListener
>[0];
let onMessage: MessageListener;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  const event = () => ({ addListener: vi.fn() });
  vi.stubGlobal('chrome', {
    runtime: {
      onInstalled: event(),
      onStartup: event(),
      onMessage: {
        addListener: (listener: MessageListener) => {
          onMessage = listener;
        },
      },
    },
    contextMenus: { onClicked: event() },
    alarms: { onAlarm: event() },
    notifications: { onClicked: event(), onClosed: event() },
  });
  await import('./index');
});

afterEach(() => vi.unstubAllGlobals());

function sendBulkMessage(): Promise<DelayedTabsRuntimeResponse> {
  return new Promise((resolve) => {
    const keepPortOpen = onMessage(
      {
        action: 'update-tabs-time',
        tabIds: ['one', 'two', 'three', 'four'],
        change: { mode: 'add', durationMs: 20 * 60_000 },
      },
      {},
      resolve
    );
    expect(keepPortOpen).toBe(true);
  });
}

describe('background bulk request handler', () => {
  it('routes the four-tab request and keeps the response port open', async () => {
    controller.updateTabsTime.mockResolvedValueOnce({
      success: true,
      delayedTabs: [],
    });
    expect(await sendBulkMessage()).toEqual({ success: true, delayedTabs: [] });
    expect(controller.updateTabsTime).toHaveBeenCalledWith(
      ['one', 'two', 'three', 'four'],
      { mode: 'add', durationMs: 20 * 60_000 }
    );
  });

  it('returns the original storage or alarm error to the popup', async () => {
    controller.updateTabsTime.mockRejectedValueOnce(
      new Error('Failed to create alarm')
    );
    expect(await sendBulkMessage()).toMatchObject({
      success: false,
      error: 'Failed to create alarm',
    });
  });

  it('returns a validation code with the failed response', async () => {
    const { DelayedTabsError } = await import('@utils/delayedTabsErrors');
    controller.updateTabsTime.mockRejectedValueOnce(
      new DelayedTabsError('invalidTime', 'Wake time must be in the future')
    );
    expect(await sendBulkMessage()).toMatchObject({
      success: false,
      errorCode: 'invalidTime',
    });
  });
});
