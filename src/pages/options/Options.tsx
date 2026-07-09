import useDelayedTabs from '@hooks/useDelayedTabs';
import { formatDateTime, formatTimeLeft } from '@utils/dateTime';
import { getTabGroupBadgeStyle } from '@utils/tabGroupBadge';
import useTheme from '@utils/useTheme';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../../components/LanguageSelector';
import '../../i18n';

import DelaySettingsComponent from './DelaySettings';
import './options.css';

function getInitialActiveTab(): 'tabs' | 'settings' {
  return window.location.hash === '#settings' ? 'settings' : 'tabs';
}

function Options(): React.ReactElement {
  const { delayedTabs, loading, removeDelayedTabs, wakeDelayedTabs } =
    useDelayedTabs();
  const [activeTab, setActiveTab] = useState<'tabs' | 'settings'>(
    getInitialActiveTab
  );
  const [selectedTabs, setSelectedTabs] = useState<string[]>([]);
  const { theme, toggleTheme } = useTheme();
  const { t, i18n } = useTranslation();

  const locale =
    i18n.language || document.documentElement.lang || navigator.language || 'en';
  const timeLeftLabels = useMemo(
    () => ({
      day: t('manageTabs.timeUnits.day'),
      hour: t('manageTabs.timeUnits.hour'),
      minute: t('manageTabs.timeUnits.minute'),
      now: t('manageTabs.now'),
    }),
    [t]
  );

  const wakeTabNow = async (tabId: string): Promise<void> => {
    await wakeDelayedTabs([tabId]);
    setSelectedTabs((current) => current.filter((id) => id !== tabId));
  };

  const removeTab = async (tabId: string): Promise<void> => {
    await removeDelayedTabs([tabId]);
    setSelectedTabs((current) => current.filter((id) => id !== tabId));
  };

  const wakeSelectedTabs = async (): Promise<void> => {
    await wakeDelayedTabs(selectedTabs);
    setSelectedTabs([]);
  };

  const toggleTabSelection = (tabId: string): void => {
    setSelectedTabs((current) =>
      current.includes(tabId)
        ? current.filter((id) => id !== tabId)
        : [...current, tabId]
    );
  };

  const handleTabChange = (tab: 'tabs' | 'settings'): void => {
    setActiveTab(tab);
    window.location.hash = tab === 'settings' ? 'settings' : 'tabs';
  };

  const renderLoading = (): React.ReactElement => (
    <div className='p-8 text-center'>
      <span className='loading loading-spinner loading-lg' />
    </div>
  );

  const renderEmptyState = (): React.ReactElement => (
    <div className='card w-full border border-base-300 bg-base-300 shadow-sm transition-shadow duration-300 hover:shadow-md'>
      <div className='card-body text-center'>
        <h2 className='card-title justify-center'>{t('manageTabs.noTabs')}</h2>
        <p>{t('manageTabs.noDelayedTabs')}</p>
      </div>
    </div>
  );

  const renderTabsTable = (): React.ReactElement => (
    <div className='card w-full border border-base-300 bg-base-300 shadow-sm transition-shadow duration-300 hover:shadow-md'>
      <div className='card-body p-0'>
        <div className='w-full overflow-x-auto'>
          <table className='table w-full [&>tbody>tr:nth-child(odd)]:bg-base-100 [&>tbody>tr:nth-child(even)]:bg-base-300 [&>tbody>tr:hover]:bg-base-100'>
            <thead>
              <tr>
                <th className='w-12'>
                  <label>
                    <span className='sr-only'>{t('manageTabs.selectAll')}</span>
                    <input
                      type='checkbox'
                      className='checkbox'
                      checked={
                        selectedTabs.length === delayedTabs.length &&
                        delayedTabs.length > 0
                      }
                      onChange={() =>
                        setSelectedTabs(
                          selectedTabs.length === delayedTabs.length
                            ? []
                            : delayedTabs.map((tab) => tab.id)
                        )
                      }
                    />
                  </label>
                </th>
                <th className='w-1/4'>{t('common.tabs')}</th>
                <th className='w-1/4'>{t('manageTabs.delayedUntil')}</th>
                <th className='w-1/6'>{t('manageTabs.timeLeft')}</th>
                <th className='w-1/3'>{t('manageTabs.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {delayedTabs.map((tab) => (
                <tr key={tab.id}>
                  <td>
                    <label>
                      <span className='sr-only'>
                        {t('manageTabs.toggleSelection')}
                      </span>
                      <input
                        type='checkbox'
                        className='checkbox'
                        aria-label={t('manageTabs.toggleSelection')}
                        checked={selectedTabs.includes(tab.id)}
                        onChange={() => toggleTabSelection(tab.id)}
                      />
                    </label>
                  </td>
                  <td>
                    <div className='flex items-center space-x-2'>
                      {tab.favicon && (
                        <img
                          src={tab.favicon}
                          alt={t('common.faviconAlt')}
                          className='h-5 w-5 flex-shrink-0'
                          onError={(event) => {
                            event.currentTarget.style.display = 'none';
                          }}
                        />
                      )}
                      <div className='min-w-0'>
                        <div
                          className='max-w-[160px] truncate sm:max-w-[220px]'
                          title={tab.title || tab.url}
                        >
                          {tab.title || tab.url || t('manageTabs.unknownTab')}
                        </div>
                        {tab.group && (
                          <div className='mt-1'>
                            <span
                              className='badge badge-sm max-w-[160px] truncate border text-[10px] font-medium sm:max-w-[220px]'
                              style={getTabGroupBadgeStyle(tab.group)}
                            >
                              {t('manageTabs.groupBadge', {
                                name:
                                  tab.group.title?.trim() ||
                                  t('manageTabs.unnamedGroup'),
                              })}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className='whitespace-normal'>
                    {formatDateTime(tab.wakeTime, locale)}
                  </td>
                  <td>{formatTimeLeft(tab.wakeTime, timeLeftLabels)}</td>
                  <td>
                    <div className='flex space-x-2'>
                      <button
                        type='button'
                        className='btn btn-sm'
                        style={{ backgroundColor: '#ffb26f', color: '#3B1B00' }}
                        onClick={() => void wakeTabNow(tab.id)}
                      >
                        {t('manageTabs.wakeUp')}
                      </button>
                      <button
                        type='button'
                        className='btn btn-outline btn-error btn-sm'
                        onClick={() => void removeTab(tab.id)}
                      >
                        {t('common.delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {selectedTabs.length > 0 && (
            <div className='flex justify-end p-4'>
              <button
                type='button'
                className='btn btn-primary'
                onClick={() => void wakeSelectedTabs()}
              >
                {t('manageTabs.actionsWakeNow', {
                  count: selectedTabs.length,
                  label:
                    selectedTabs.length === 1
                      ? t('common.tabs.singular')
                      : t('common.tabs'),
                })}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  let content: React.ReactElement;

  if (loading) {
    content = renderLoading();
  } else if (delayedTabs.length === 0) {
    content = renderEmptyState();
  } else {
    content = renderTabsTable();
  }

  return (
    <div className='container mx-auto max-w-5xl p-4'>
      <div className='mb-6 flex items-center justify-between'>
        <h1 className='text-2xl font-bold'>{t('manageTabs.title')}</h1>
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
          <svg
            xmlns='http://www.w3.org/2000/svg'
            viewBox={theme === 'light' ? '0 0 384 512' : '0 0 512 512'}
            className='h-5 w-5'
            fill={theme === 'light' ? '#8A05BE' : '#FFD700'}
          >
            {theme === 'light' ? (
              <path d='M223.5 32C100 32 0 132.3 0 256S100 480 223.5 480c60.6 0 115.5-24.2 155.8-63.4c5-4.9 6.3-12.5 3.1-18.7s-10.1-9.7-17-8.5c-9.8 1.7-19.8 2.6-30.1 2.6c-96.9 0-175.5-78.8-175.5-176c0-65.8 36-123.1 89.3-153.3c6.1-3.5 9.2-10.5 7.7-17.3s-7.3-11.9-14.3-12.5c-6.3-.5-12.6-.8-19-.8z' />
            ) : (
              <path d='M361.5 1.2c5 2.1 8.6 6.6 9.6 11.9L391 121l107.9 19.8c5.3 1 9.8 4.6 11.9 9.6s1.5 10.7-1.6 15.2L446.9 256l62.3 90.3c3.1 4.5 3.7 10.2 1.6 15.2s-6.6 8.6-11.9 9.6L391 391 371.1 498.9c-1 5.3-4.6 9.8-9.6 11.9s-10.7 1.5-15.2-1.6L256 446.9l-90.3 62.3c-4.5 3.1-10.2 3.7-15.2 1.6s-8.6-6.6-9.6-11.9L121 391 13.1 371.1c-5.3-1-9.8-4.6-11.9-9.6s-1.5-10.7 1.6-15.2L65.1 256 2.8 165.7c-3.1-4.5-3.7-10.2-1.6-15.2s6.6-8.6 11.9-9.6L121 121 140.9 13.1c1-5.3 4.6-9.8 9.6-11.9s10.7-1.5 15.2 1.6L256 65.1 346.3 2.8c4.5-3.1 10.2-3.7 15.2-1.6zM160 256a96 96 0 1 1 192 0 96 96 0 1 1 -192 0zm224 0a128 128 0 1 0 -256 0 128 128 0 1 0 256 0z' />
            )}
          </svg>
        </button>
      </div>

      <div className='options-content-width'>
        <div className='tabs mb-6 w-full'>
        <button
          type='button'
          className={`tab tab-bordered flex-1 ${activeTab === 'tabs' ? 'tab-active !border-delayo-orange !border-b-[3px]' : ''}`}
          onClick={() => handleTabChange('tabs')}
        >
          <span className='font-bold'>{t('manageTabs.tabsDelayed')}</span>
        </button>
        <button
          type='button'
          className={`tab tab-bordered flex-1 ${activeTab === 'settings' ? 'tab-active !border-delayo-orange !border-b-[3px]' : ''}`}
          onClick={() => handleTabChange('settings')}
        >
          <span className='font-bold'>{t('common.settings')}</span>
        </button>
        </div>

        {activeTab === 'tabs' ? (
          content
        ) : (
          <DelaySettingsComponent
            isPopup={false}
            topContent={
              <div className='form-control'>
                <label className='label'>
                  <span className='label-text font-medium'>
                    {t('settings.language')}
                  </span>
                </label>
                <LanguageSelector />
              </div>
            }
          />
        )}
        </div>
    </div>
  );
}

export default Options;
