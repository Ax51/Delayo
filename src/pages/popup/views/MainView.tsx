import { faHourglassHalf } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Link } from '@tanstack/react-router';
import useDelaySettings from '@hooks/useDelaySettings';
import useTabSelection from '@hooks/useTabSelection';
import { DelayOption, PresetButtonId, TabSelectionMode } from '@types';
import { scheduleTabs } from '@utils/delayedTabsRuntime';
import { createPresetDelayOptions } from '@utils/delayPresets';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import useTheme from '../../../utils/useTheme';

function MainView(): React.ReactElement {
  const { i18n, t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const { loading: settingsLoading, settings } = useDelaySettings();
  const {
    activeTab,
    allWindowTabs,
    highlightedTabs,
    loading: tabsLoading,
    persistSelectedMode,
    selectedMode,
    setSelectedMode,
    tabsToDelay,
  } = useTabSelection();

  const loading = settingsLoading || tabsLoading;
  const locale =
    i18n.language || document.documentElement.lang || navigator.language || 'en';
  const translate = useCallback(
    (key: string, options?: Record<string, unknown>): string =>
      t(key, options) as string,
    [t]
  );

  const delayOptions = useMemo<DelayOption[]>(
    () =>
      createPresetDelayOptions({
        locale,
        settings,
        translate,
      }),
    [locale, settings, translate]
  );
  const delayOptionsById = useMemo(
    () =>
      new Map(
        delayOptions.map((option) => [option.id as PresetButtonId, option] as const)
      ),
    [delayOptions]
  );
  const totalQuickActions = settings.visiblePresetButtons.length;
  const quickActionRows = Math.ceil(totalQuickActions / 3);
  const isCompactLayout = quickActionRows >= 4;

  const handleDelay = async (option: DelayOption): Promise<void> => {
    if (tabsToDelay.length === 0) {
      return;
    }

    await persistSelectedMode();

    const wakeTime =
      option.calculateTime?.() ??
      Date.now() +
        (option.hours ? option.hours * 60 * 60 * 1000 : 0) +
        (option.minutes ? option.minutes * 60 * 1000 : 0) +
        (option.days ? option.days * 24 * 60 * 60 * 1000 : 0);

    await scheduleTabs(tabsToDelay, wakeTime);
    window.close();
  };

  const handleModeChange = (mode: TabSelectionMode): void => {
    setSelectedMode(mode);
  };

  const handleOpenSettings = async (): Promise<void> => {
    const settingsUrl = chrome.runtime.getURL('public/html/options.html#settings');
    await chrome.tabs.create({ url: settingsUrl });
    window.close();
  };

  if (loading) {
    return (
      <div className='flex min-h-[300px] items-center justify-center'>
        <span className='loading loading-spinner loading-lg' />
      </div>
    );
  }

  return (
    <div className='card max-h-[600px] w-[40rem] overflow-hidden rounded-none bg-base-300 shadow-md'>
      <div className={`card-body ${isCompactLayout ? 'p-5' : 'p-6'}`}>
        <div
          className={`flex items-center justify-between ${isCompactLayout ? 'mb-4' : 'mb-5'}`}
        >
          <h2 className='card-title flex items-center font-bold text-delayo-orange'>
            <FontAwesomeIcon
              icon={faHourglassHalf}
              className='mr-2 h-5 w-5 text-delayo-orange'
            />
            Delayo
          </h2>
          <div className='flex items-center space-x-2'>
            <button
              type='button'
              className='btn btn-circle btn-ghost btn-sm transition-all duration-200 hover:bg-base-100'
              aria-label={t('popup.actions.openSettings')}
              onClick={() => {
                void handleOpenSettings();
              }}
            >
              <FontAwesomeIcon
                icon='gear'
                className='text-neutral-400 hover:text-delayo-orange'
              />
            </button>
            <button
              type='button'
              className='btn btn-circle btn-ghost btn-sm transition-all duration-200 hover:bg-base-100'
              onClick={toggleTheme}
              aria-label={t('common.theme.toggle', {
                theme:
                  theme === 'light'
                    ? t('common.theme.dark')
                    : t('common.theme.light'),
              })}
            >
              <FontAwesomeIcon
                icon={theme === 'light' ? 'moon' : 'sun'}
                className={
                  theme === 'light'
                    ? 'text-delayo-purple'
                    : 'text-delayo-yellow'
                }
              />
            </button>
          </div>
        </div>

        <div
          className={`flex flex-col ${isCompactLayout ? 'mb-4 space-y-2' : 'mb-5 space-y-3'}`}
        >
          <div className='flex items-center justify-between'>
            <div className='text-sm font-medium text-base-content/80'>
              {t('popup.delay')}:
            </div>
            <div className='flex space-x-2'>
              <button
                type='button'
                className={`btn btn-sm ${selectedMode === 'active' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => handleModeChange('active')}
              >
                {t('popup.tabs.active')}
              </button>
              <button
                type='button'
                className={`btn btn-sm ${selectedMode === 'highlighted' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => handleModeChange('highlighted')}
                disabled={highlightedTabs.length <= 1}
              >
                {t('popup.tabs.highlighted')}{' '}
                {highlightedTabs.length > 1 ? `(${highlightedTabs.length})` : ''}
              </button>
              <button
                type='button'
                className={`btn btn-sm ${selectedMode === 'window' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => handleModeChange('window')}
              >
                {t('popup.tabs.window')}{' '}
                {allWindowTabs.length > 0 ? `(${allWindowTabs.length})` : ''}
              </button>
            </div>
          </div>

          <div
            className={`rounded-lg bg-base-100/70 shadow-sm transition-all duration-200 hover:bg-base-100 ${isCompactLayout ? 'p-3' : 'p-4'}`}
          >
            {selectedMode === 'active' && activeTab && (
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
                <div className='truncate text-sm font-medium text-base-content/80'>
                  {activeTab.title}
                </div>
              </div>
            )}

            {selectedMode === 'highlighted' && (
              <div className='text-sm font-medium text-base-content/80'>
                {highlightedTabs.length}{' '}
                {highlightedTabs.length === 1
                  ? t('common.tabs.singular')
                  : t('common.tabs')}{' '}
                {t('popup.selected')}
              </div>
            )}

            {selectedMode === 'window' && (
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

        <div className={`grid grid-cols-3 ${isCompactLayout ? 'gap-2' : 'gap-2.5'}`}>
          {settings.visiblePresetButtons.map((buttonId) => {
            const option = delayOptionsById.get(buttonId);

            if (option) {
              return (
                <div key={option.id} className='card'>
                  <button
                    type='button'
                    className={`group btn flex-col items-center justify-center rounded-xl border-none bg-base-100/70 shadow-sm transition-all duration-200 hover:bg-base-100 ${isCompactLayout ? 'h-20 p-2.5' : 'h-24 p-3'}`}
                    onClick={() => void handleDelay(option)}
                  >
                    <FontAwesomeIcon
                      icon={option.icon ?? 'clock'}
                      className={`transform text-neutral-400 transition-all duration-300 ease-in-out group-hover:scale-110 group-hover:text-delayo-orange ${isCompactLayout ? 'mb-2 h-4 w-4' : 'mb-3 h-5 w-5'}`}
                    />
                    <span
                      className={`text-center font-medium text-base-content/80 group-hover:text-base-content ${isCompactLayout ? 'text-[11px] leading-tight' : 'text-xs'}`}
                    >
                      {option.label}
                    </span>
                  </button>
                </div>
              );
            }

            if (buttonId === 'custom_date_time') {
              return (
                <div key={buttonId} className='card'>
                  <Link
                    to='/custom-delay'
                    search={{ tabId: undefined }}
                    className={`group btn flex-col items-center justify-center rounded-xl border-none bg-base-100/70 shadow-sm transition-all duration-200 hover:bg-base-100 ${isCompactLayout ? 'h-20 p-2.5' : 'h-24 p-3'}`}
                    onClick={() => {
                      void persistSelectedMode();
                    }}
                  >
                    <FontAwesomeIcon
                      icon='calendar-days'
                      className={`transform text-neutral-400 transition-all duration-300 ease-in-out group-hover:scale-110 group-hover:text-delayo-orange ${isCompactLayout ? 'mb-2 h-4 w-4' : 'mb-3 h-5 w-5'}`}
                    />
                    <span
                      className={`text-center font-medium text-base-content/80 group-hover:text-base-content ${isCompactLayout ? 'text-[11px] leading-tight' : 'text-xs'}`}
                    >
                      {t('popup.delayOptions.custom')}
                    </span>
                  </Link>
                </div>
              );
            }

            if (buttonId === 'recurring') {
              return (
                <div key={buttonId} className='card'>
                  <Link
                    to='/recurring-delay'
                    className={`group btn flex-col items-center justify-center rounded-xl border-none bg-base-100/70 shadow-sm transition-all duration-200 hover:bg-base-100 ${isCompactLayout ? 'h-20 p-2.5' : 'h-24 p-3'}`}
                    onClick={() => {
                      void persistSelectedMode();
                    }}
                  >
                    <FontAwesomeIcon
                      icon='repeat'
                      className={`transform text-neutral-400 transition-all duration-300 ease-in-out group-hover:scale-110 group-hover:text-delayo-orange ${isCompactLayout ? 'mb-2 h-4 w-4' : 'mb-3 h-5 w-5'}`}
                    />
                    <span
                      className={`text-center font-medium text-base-content/80 group-hover:text-base-content ${isCompactLayout ? 'text-[11px] leading-tight' : 'text-xs'}`}
                    >
                      {t('popup.delayOptions.recurring')}
                    </span>
                  </Link>
                </div>
              );
            }

            return null;
          })}
        </div>

        <div className={`flex justify-center ${isCompactLayout ? 'mt-4' : 'mt-6'}`}>
          <Link
            to='/manage-tabs'
            className='btn btn-ghost btn-sm text-sm font-medium text-base-content/70 transition-all duration-200 hover:text-delayo-orange'
          >
            <FontAwesomeIcon icon='list-ul' className='mr-2 h-4 w-4' />
            {t('popup.actions.manageTabs')}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default MainView;
