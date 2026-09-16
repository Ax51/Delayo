import {
  DelayedTabsRuntimeMessage,
  DelayedTabsRuntimeResponse,
  DelayedTabsTimeChange,
  RecurrencePattern,
} from '@types';
import { DelayedTabsError } from '@utils/delayedTabsErrors';

async function sendDelayedTabsMessage(
  message: DelayedTabsRuntimeMessage
): Promise<DelayedTabsRuntimeResponse> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    throw new DelayedTabsError(
      'extensionUnavailable',
      'Extension runtime unavailable'
    );
  }
  const response = await chrome.runtime
    .sendMessage<DelayedTabsRuntimeMessage, DelayedTabsRuntimeResponse>(message)
    .catch((error: unknown) => {
      if (
        error instanceof Error &&
        /Receiving end does not exist|message port closed|Extension context invalidated/i.test(
          error.message
        )
      ) {
        throw new DelayedTabsError('backgroundUnavailable', error.message);
      }
      throw error;
    });

  if (!response) {
    throw new DelayedTabsError(
      'backgroundUnavailable',
      'No response from the extension background'
    );
  }

  if (!response.success) {
    if (response.errorCode) {
      throw new DelayedTabsError(
        response.errorCode,
        response.error || 'Delayed tabs operation failed'
      );
    }
    throw new Error(response?.error || 'Delayed tabs operation failed');
  }

  return response;
}

export function scheduleTabs(
  tabs: chrome.tabs.Tab[],
  wakeTime: number,
  recurrencePattern?: RecurrencePattern,
  remindOnly = false
): Promise<DelayedTabsRuntimeResponse> {
  return sendDelayedTabsMessage({
    action: 'schedule-tabs',
    tabs,
    wakeTime,
    recurrencePattern,
    remindOnly,
  });
}

export function wakeTabs(
  tabIds: string[]
): Promise<DelayedTabsRuntimeResponse> {
  return sendDelayedTabsMessage({
    action: 'wake-tabs',
    tabIds,
  });
}

export function updateTabTime(
  tabId: string,
  wakeTime: number
): Promise<DelayedTabsRuntimeResponse> {
  return sendDelayedTabsMessage({
    action: 'update-tab-time',
    tabId,
    wakeTime,
  });
}

export function previewTab(tabId: string): Promise<DelayedTabsRuntimeResponse> {
  return sendDelayedTabsMessage({
    action: 'preview-tab',
    tabId,
  });
}

export function updateTabTitle(
  tabId: string,
  title: string
): Promise<DelayedTabsRuntimeResponse> {
  return sendDelayedTabsMessage({
    action: 'update-tab-title',
    tabId,
    title,
  });
}

export function removeTabs(
  tabIds: string[]
): Promise<DelayedTabsRuntimeResponse> {
  return sendDelayedTabsMessage({
    action: 'remove-tabs',
    tabIds,
  });
}

export function reconcileDelayedTabs(): Promise<DelayedTabsRuntimeResponse> {
  return sendDelayedTabsMessage({
    action: 'reconcile-delayed-tabs',
  });
}

export function updateTabsTime(
  tabIds: string[],
  change: DelayedTabsTimeChange
): Promise<DelayedTabsRuntimeResponse> {
  return sendDelayedTabsMessage({ action: 'update-tabs-time', tabIds, change });
}
