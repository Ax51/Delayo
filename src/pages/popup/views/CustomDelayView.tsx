import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import useDelayedTabs from '@hooks/useDelayedTabs';
import useTabSelection from '@hooks/useTabSelection';
import type { RelativeDelayValues } from '@utils/dateTime';
import { scheduleTabs } from '@utils/delayedTabsRuntime';
import {
  formatDateTimeLocalInput,
  getDateFromRelativeDelay,
  getMinimumCustomDelayDate,
  getRelativeDelayValues,
} from '@utils/dateTime';
import React, { useEffect, useMemo, useState } from 'react';
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
  const { tabId } = useSearch({ from: '/custom-delay' });
  const {
    activeTab,
    allWindowTabs,
    highlightedTabs,
    loading: tabSelectionLoading,
    persistSelectedMode,
    selectedMode,
    tabsToDelay,
  } = useTabSelection();
  const { delayedTabs, loading: delayedTabsLoading, updateDelayedTabTime } =
    useDelayedTabs();
  const initialDate = getMinimumCustomDelayDate(new Date());
  const [customDate, setCustomDate] = useState(
    formatDateTimeLocalInput(initialDate)
  );
  const [relativeDelay, setRelativeDelay] = useState<RelativeDelayInputValues>(
    toRelativeDelayInputValues(getRelativeDelayValues(initialDate, new Date()))
  );
  const [dateError, setDateError] = useState<string | null>(null);
  const [hasInitializedEditDate, setHasInitializedEditDate] = useState(false);
  const editingTab = useMemo(
    () => delayedTabs.find((tab) => tab.id === tabId),
    [delayedTabs, tabId]
  );
  const isEditing = typeof tabId === 'string' && tabId.length > 0;

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
    setHasInitializedEditDate(true);
  }, [editingTab, hasInitializedEditDate, isEditing]);

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
    await scheduleTabs(tabsToDelay, nextDate.getTime());
    window.close();
  };

  const selectedDate = new Date(customDate);
  const isCustomDateValid = isDateValid(selectedDate);
  const minimumCustomDate = getMinimumCustomDelayDate(new Date());
  const canDelay =
    (isEditing ? Boolean(editingTab) : tabsToDelay.length > 0) &&
    isCustomDateValid &&
    selectedDate.getTime() >= minimumCustomDate.getTime();
  const isLoading = tabSelectionLoading || (isEditing && delayedTabsLoading);

  if (isLoading) {
    return (
      <div className='flex min-h-[300px] items-center justify-center'>
        <span className='loading loading-spinner loading-lg' />
      </div>
    );
  }

  return (
    <div className='card w-80 rounded-none bg-base-300 shadow-md'>
      <div className='card-body p-6'>
        <div className='mb-5 flex items-center'>
          <Link
            to={isEditing ? '/manage-tabs' : '/'}
            className='btn btn-circle btn-ghost btn-sm mr-3 transition-all duration-200 hover:bg-base-100'
            aria-label={t('common.back')}
          >
            <FontAwesomeIcon icon='arrow-left' />
          </Link>
          <h2 className='card-title font-bold text-delayo-orange'>
            {isEditing ? t('customDelay.editTitle') : t('customDelay.title')}
          </h2>
        </div>

        <div className='mb-5'>
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
                <div className='overflow-hidden'>
                  <div className='truncate text-sm font-medium text-base-content/80'>
                    {editingTab.title || editingTab.url || t('manageTabs.unknownTab')}
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
                <div className='overflow-hidden'>
                  <div className='truncate text-sm font-medium text-base-content/80'>
                    {activeTab.title}
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
          </div>
        </div>

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
            type='button'
            className='btn btn-primary border-none shadow-sm transition-all duration-200 hover:shadow'
            onClick={() => void handleDelay()}
            disabled={!canDelay}
          >
            {isEditing ? t('customDelay.updateTab') : t('customDelay.delayTab')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CustomDelayView;
