import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { RelativeDelayValues } from '@utils/dateTime';
import ExistingDelayBadge from '@components/ExistingDelayBadge';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import useDelayedTabs from '@hooks/useDelayedTabs';
import useTabSelection from '@hooks/useTabSelection';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import {
  formatDateTimeLocalInput,
  getDateFromRelativeDelay,
  getMinimumCustomDelayDate,
  getRelativeDelayValues,
} from '@utils/dateTime';
import { matchSelectedTabsToDelayedTabs } from '@utils/delayedTabsList';
import { scheduleTabs } from '@utils/delayedTabsRuntime';
import { useTranslation } from 'react-i18next';

interface RelativeDelayInputValues {
  days: string;
  hours: string;
  minutes: string;
}

const relativeDelayFields: Array<keyof RelativeDelayInputValues> = [
  'days',
  'hours',
  'minutes',
];

function toRelativeDelayInputValues(
  values: RelativeDelayValues
): RelativeDelayInputValues {
  return {
    days: String(values.days),
    hours: String(values.hours),
    minutes: String(values.minutes),
  };
}

function parseRelativeDelayValue(value: string): number {
  const parsedValue = Number.parseInt(value, 10);

  if (Number.isNaN(parsedValue) || parsedValue < 0) {
    return 0;
  }

  return parsedValue;
}

function isDateValid(date: Date): boolean {
  return !Number.isNaN(date.getTime());
}

function CustomDelayView(): React.ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { remindOnly, tabId } = useSearch({
    from: '/custom-delay',
  });
  const {
    activeTab,
    allWindowTabs,
    highlightedTabs,
    loading: tabSelectionLoading,
    persistSelectedMode,
    selectedMode,
    tabsToDelay,
  } = useTabSelection();
  const {
    delayedTabs,
    loading: delayedTabsLoading,
    updateDelayedTabTime,
    updateDelayedTabTitle,
  } = useDelayedTabs();
  const initialDate = getMinimumCustomDelayDate(new Date());
  const [customDate, setCustomDate] = useState(
    formatDateTimeLocalInput(initialDate)
  );
  const [relativeDelay, setRelativeDelay] = useState<RelativeDelayInputValues>(
    toRelativeDelayInputValues(getRelativeDelayValues(initialDate, new Date()))
  );
  const [dateError, setDateError] = useState<string | null>(null);
  const [hasInitializedEditDate, setHasInitializedEditDate] = useState(false);
  const [reminderSaved, setReminderSaved] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const titleDraftRef = useRef('');
  const savedTitleRef = useRef('');
  const editingTab = useMemo(
    () => delayedTabs.find((tab) => tab.id === tabId),
    [delayedTabs, tabId]
  );
  const isEditing = typeof tabId === 'string' && tabId.length > 0;
  const delayedSelectionMatches = useMemo(
    () => matchSelectedTabsToDelayedTabs(tabsToDelay, delayedTabs),
    [delayedTabs, tabsToDelay]
  );
  const selectedDelayedTab =
    !isEditing && tabsToDelay.length === 1
      ? delayedSelectionMatches.activeMatch?.delayedTab
      : undefined;

  const syncFromDate = (nextDate: Date): void => {
    const now = new Date();
    const normalizedDate = new Date(
      Math.max(nextDate.getTime(), getMinimumCustomDelayDate(now).getTime())
    );

    setCustomDate(formatDateTimeLocalInput(normalizedDate));
    setRelativeDelay(
      toRelativeDelayInputValues(getRelativeDelayValues(normalizedDate, now))
    );
  };

  useEffect(() => {
    if (!isEditing || !editingTab || hasInitializedEditDate) {
      return;
    }

    syncFromDate(new Date(editingTab.wakeTime));
    const initialTitle = editingTab.title ?? '';
    titleDraftRef.current = initialTitle;
    savedTitleRef.current = initialTitle;
    setTitleDraft(initialTitle);
    setHasInitializedEditDate(true);
  }, [editingTab, hasInitializedEditDate, isEditing]);

  useEffect(() => {
    if (!isEditing && tabsToDelay.length === 1) {
      const initialTitle = tabsToDelay[0].title ?? '';
      titleDraftRef.current = initialTitle;
      setTitleDraft(initialTitle);
    }
  }, [isEditing, tabsToDelay]);

  const saveTitleOnBlur = (): void => {
    const title = titleDraftRef.current.trim();
    titleDraftRef.current = title;
    setTitleDraft(title);

    if (!isEditing || !editingTab || title === savedTitleRef.current) {
      return;
    }

    const previousTitle = savedTitleRef.current;
    savedTitleRef.current = title;

    void updateDelayedTabTitle(editingTab.id, title).catch(() => {
      savedTitleRef.current = previousTitle;
    });
  };

  const handleDateChange = (value: string): void => {
    setCustomDate(value);
    setDateError(null);

    const nextDate = new Date(value);

    if (!isDateValid(nextDate)) {
      return;
    }

    setRelativeDelay(
      toRelativeDelayInputValues(getRelativeDelayValues(nextDate, new Date()))
    );
  };

  const handleDateBlur = (): void => {
    const nextDate = new Date(customDate);
    const minimumDate = getMinimumCustomDelayDate(new Date());

    if (!isDateValid(nextDate)) {
      setDateError(t('customDelay.invalidDate'));
      return;
    }

    if (nextDate.getTime() < minimumDate.getTime()) {
      setDateError(t('customDelay.invalidDate'));
      return;
    }

    setDateError(null);
    syncFromDate(nextDate);
  };

  const handleRelativeDelayChange = (
    field: keyof RelativeDelayInputValues,
    value: string
  ): void => {
    setDateError(null);

    const sanitizedValue = value.replace(/\D/g, '');
    const nextRelativeDelay = {
      ...relativeDelay,
      [field]: sanitizedValue,
    };
    const nextDate = getDateFromRelativeDelay(
      {
        days: parseRelativeDelayValue(nextRelativeDelay.days),
        hours: parseRelativeDelayValue(nextRelativeDelay.hours),
        minutes: parseRelativeDelayValue(nextRelativeDelay.minutes),
      },
      new Date()
    );

    syncFromDate(nextDate);
  };

  const handleDelay = async (): Promise<void> => {
    const nextDate = new Date(customDate);

    if (
      !isDateValid(nextDate) ||
      nextDate.getTime() < getMinimumCustomDelayDate(new Date()).getTime()
    ) {
      return;
    }

    if (isEditing) {
      if (!editingTab) {
        return;
      }

      await updateDelayedTabTime(editingTab.id, nextDate.getTime());
      await navigate({ to: '/manage-tabs' });
      return;
    }

    if (tabsToDelay.length === 0) {
      return;
    }

    await persistSelectedMode();
    const tabsWithTitle =
      tabsToDelay.length === 1
        ? tabsToDelay.map((tab) => ({
            ...tab,
            title: titleDraftRef.current.trim(),
          }))
        : tabsToDelay;

    await scheduleTabs(
      tabsWithTitle,
      nextDate.getTime(),
      undefined,
      remindOnly
    );

    if (remindOnly) {
      setReminderSaved(true);
      window.setTimeout(() => window.close(), 1_500);
      return;
    }

    window.close();
  };

  const selectedDate = new Date(customDate);
  const isCustomDateValid = isDateValid(selectedDate);
  const minimumCustomDate = getMinimumCustomDelayDate(new Date());
  const canDelay =
    (isEditing ? Boolean(editingTab) : tabsToDelay.length > 0) &&
    isCustomDateValid &&
    selectedDate.getTime() >= minimumCustomDate.getTime();
  const isLoading = tabSelectionLoading || delayedTabsLoading;

  if (isLoading) {
    return (
      <div className='flex min-h-[300px] items-center justify-center'>
        <span className='loading loading-spinner loading-lg' />
      </div>
    );
  }

  return (
    <div className='card max-h-[600px] w-80 overflow-y-auto overflow-x-hidden rounded-none bg-base-300 shadow-md'>
      <div className='card-body p-6'>
        <div className='mb-5 flex items-center'>
          <Link
            to={isEditing ? '/manage-tabs' : '/'}
            search={isEditing ? undefined : { remindOnly }}
            className='btn btn-circle btn-ghost btn-sm mr-3 transition-all duration-200 hover:bg-base-100'
            aria-label={t('common.back')}
          >
            <FontAwesomeIcon icon='arrow-left' />
          </Link>
          <h2 className='card-title font-bold text-delayo-orange'>
            {isEditing ? t('customDelay.editTitle') : t('customDelay.title')}
          </h2>
        </div>

        <div className='mb-4'>
          <div className='mb-2 text-sm font-medium text-base-content/80'>
            {isEditing ? `${t('common.edit')}:` : `${t('popup.delay')}:`}
          </div>
          <div className='rounded-lg bg-base-100/70 p-4 shadow-sm transition-all duration-200 hover:bg-base-100'>
            {isEditing && editingTab && (
              <div className='flex items-center'>
                {editingTab.favicon && (
                  <img
                    src={editingTab.favicon}
                    alt={t('common.faviconAlt')}
                    className='mr-3 h-5 w-5 rounded-sm'
                    onError={(event) => {
                      event.currentTarget.style.display = 'none';
                    }}
                  />
                )}
                <div className='min-w-0 overflow-hidden'>
                  <div
                    className='truncate text-sm font-medium text-base-content/80 outline-none'
                    key={editingTab.id}
                    contentEditable
                    suppressContentEditableWarning
                    role='textbox'
                    aria-label={t('customDelay.tabTitle')}
                    onFocus={(event) => {
                      if (!titleDraftRef.current) {
                        event.currentTarget.textContent = '';
                      }
                    }}
                    onInput={(event) => {
                      titleDraftRef.current =
                        event.currentTarget.textContent ?? '';
                    }}
                    onBlur={saveTitleOnBlur}
                  >
                    {titleDraft || editingTab.url || t('manageTabs.unknownTab')}
                  </div>
                  <div className='truncate text-xs text-base-content/60'>
                    {editingTab.url}
                  </div>
                </div>
              </div>
            )}

            {!isEditing && selectedMode === 'active' && activeTab && (
              <div className='flex items-center'>
                {activeTab.favIconUrl && (
                  <img
                    src={activeTab.favIconUrl}
                    alt={t('common.faviconAlt')}
                    className='mr-3 h-5 w-5 rounded-sm'
                    onError={(event) => {
                      event.currentTarget.style.display = 'none';
                    }}
                  />
                )}
                <div className='min-w-0 overflow-hidden'>
                  <div
                    className='truncate text-sm font-medium text-base-content/80 outline-none'
                    key={activeTab.id}
                    contentEditable
                    suppressContentEditableWarning
                    role='textbox'
                    aria-label={t('customDelay.tabTitle')}
                    onFocus={(event) => {
                      if (!titleDraftRef.current) {
                        event.currentTarget.textContent = '';
                      }
                    }}
                    onInput={(event) => {
                      titleDraftRef.current =
                        event.currentTarget.textContent ?? '';
                    }}
                    onBlur={saveTitleOnBlur}
                  >
                    {titleDraft || t('manageTabs.untitledTab')}
                  </div>
                  <div className='truncate text-xs text-base-content/60'>
                    {activeTab.url}
                  </div>
                </div>
              </div>
            )}

            {!isEditing && selectedMode === 'highlighted' && (
              <div className='text-sm font-medium text-base-content/80'>
                {highlightedTabs.length}{' '}
                {highlightedTabs.length === 1
                  ? t('common.tabs.singular')
                  : t('common.tabs')}{' '}
                {t('popup.selected')}
              </div>
            )}

            {!isEditing && selectedMode === 'window' && (
              <div className='text-sm font-medium text-base-content/80'>
                {allWindowTabs.length}{' '}
                {allWindowTabs.length === 1
                  ? t('common.tabs.singular')
                  : t('common.tabs')}{' '}
                {t('popup.inWindow')}
              </div>
            )}

            {selectedDelayedTab && (
              <ExistingDelayBadge delayedTab={selectedDelayedTab} stacked />
            )}

            {!isEditing &&
              !selectedDelayedTab &&
              selectedMode !== 'active' &&
              delayedSelectionMatches.matchCount > 0 && (
                <div className='mt-2 flex items-center gap-1.5 text-xs font-medium text-base-content/70'>
                  <span
                    className='h-1.5 w-1.5 flex-shrink-0 rounded-full bg-success'
                    aria-hidden='true'
                  />
                  {t('popup.existingDelay.selectionCount', {
                    count: delayedSelectionMatches.matchCount,
                    total: tabsToDelay.length,
                  })}
                </div>
              )}
          </div>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleDelay();
          }}
        >
          <div className='form-control'>
            <label className='label'>
              <span className='label-text font-medium'>
                {t('customDelay.selectDateTime')}
              </span>
            </label>
            <input
              type='datetime-local'
              className={`input input-bordered w-full border-none bg-base-100/50 shadow-sm transition-all duration-200 focus:bg-base-100/80 ${dateError ? 'input-error' : ''}`}
              value={customDate}
              onChange={(event) => handleDateChange(event.target.value)}
              onBlur={handleDateBlur}
              min={formatDateTimeLocalInput(minimumCustomDate)}
            />
            {dateError && (
              <span className='mt-2 text-xs text-error'>{dateError}</span>
            )}
          </div>

          <div className='my-4 flex items-center gap-3'>
            <div className='h-px flex-1 bg-base-content/10' />
            <span className='text-xs font-medium uppercase tracking-wide text-base-content/50'>
              {t('customDelay.or')}
            </span>
            <div className='h-px flex-1 bg-base-content/10' />
          </div>

          <div>
            <label className='label'>
              <span className='label-text font-medium'>
                {t('customDelay.delayFor')}
              </span>
            </label>
            <div className='grid grid-cols-3 gap-2'>
              {relativeDelayFields.map((field) => (
                <label key={field} className='form-control'>
                  <span className='mb-2 text-xs font-medium text-base-content/70'>
                    {t(`customDelay.relative.${field}`)}
                  </span>
                  <input
                    type='number'
                    min='0'
                    inputMode='numeric'
                    className='input input-bordered w-full border-none bg-base-100/50 text-center shadow-sm transition-all duration-200 focus:bg-base-100/80'
                    value={relativeDelay[field]}
                    onFocus={(event) => event.currentTarget.select()}
                    onClick={(event) => event.currentTarget.select()}
                    onChange={(event) =>
                      handleRelativeDelayChange(field, event.target.value)
                    }
                  />
                </label>
              ))}
            </div>
          </div>

          <div className='card-actions mt-6 justify-end'>
            <button
              type='submit'
              className='btn btn-primary border-none shadow-sm transition-all duration-200 hover:shadow'
              disabled={!canDelay || reminderSaved}
            >
              {isEditing || selectedDelayedTab
                ? t('customDelay.updateTab')
                : t('customDelay.delayTab')}
            </button>
          </div>
        </form>
      </div>
      {reminderSaved && (
        <div className='toast toast-center toast-top z-10'>
          <div className='alert alert-success shadow-lg'>
            <span>{t('popup.reminder.saved')}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomDelayView;
