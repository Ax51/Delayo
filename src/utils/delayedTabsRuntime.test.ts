import { DelayedTabsRuntimeResponse } from '@types';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { updateTabsTime } from './delayedTabsRuntime';

const change = { mode: 'add' as const, durationMs: 20 * 60_000 };
const tabIds = ['one', 'two', 'three', 'four'];

function mockResponse(response: DelayedTabsRuntimeResponse | undefined) {
  const sendMessage = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('chrome', { runtime: { sendMessage } });
  return sendMessage;
}

afterEach(() => vi.unstubAllGlobals());

describe('bulk time runtime messages', () => {
  it('sends one bulk request for four tabs and returns the saved data', async () => {
    const response = { success: true, delayedTabs: [] };
    const sendMessage = mockResponse(response);
    expect(await updateTabsTime(tabIds, change)).toBe(response);
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith({
      action: 'update-tabs-time',
      tabIds,
      change,
    });
  });

  it('reports an old background that does not recognize bulk requests, without retrying an additive operation', async () => {
    const sendMessage = mockResponse(undefined);
    await expect(updateTabsTime(tabIds, change)).rejects.toMatchObject({
      code: 'backgroundUnavailable',
    });
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it('reports a missing connection to the background', async () => {
    const sendMessage = mockResponse(undefined);
    sendMessage.mockRejectedValueOnce(
      new Error('Could not establish connection. Receiving end does not exist.')
    );
    await expect(updateTabsTime(tabIds, change)).rejects.toMatchObject({
      code: 'backgroundUnavailable',
    });
  });

  it('preserves the actual Chrome failure so the UI can show its cause', async () => {
    mockResponse({ success: false, error: 'Alarm quota exceeded' });
    await expect(updateTabsTime(tabIds, change)).rejects.toThrow(
      'Alarm quota exceeded'
    );
  });

  it('preserves structured validation errors', async () => {
    mockResponse({
      success: false,
      errorCode: 'invalidTime',
      error: 'Wake time must be in the future',
    });
    await expect(updateTabsTime(tabIds, change)).rejects.toMatchObject({
      code: 'invalidTime',
    });
  });

  it('reports a page outside the extension', async () => {
    vi.stubGlobal('chrome', undefined);
    await expect(updateTabsTime(tabIds, change)).rejects.toMatchObject({
      code: 'extensionUnavailable',
    });
  });
});
