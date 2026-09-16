import React, { useEffect, useState } from 'react';
import BulkTimeEditor from '@components/BulkTimeEditor';
import DelayedTabCard from '@components/DelayedTabCard';
import ScrollArea from '@components/ScrollArea';
import { faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import useDelayedTabs from '@hooks/useDelayedTabs';
import { Link, useNavigate } from '@tanstack/react-router';
import { DelayedTabsError } from '@utils/delayedTabsErrors';
import {
  DelayedTabPeriod,
  delayedTabPeriods,
  filterDelayedTabs,
  matchesDelayedTabPeriod,
} from '@utils/delayedTabsManagement';
import { getManageTabsPageUrl, isManageTabsPage } from '@utils/manageTabsPage';
import useTheme from '@utils/useTheme';
import { useTranslation } from 'react-i18next';

function ManageTabsView(): React.ReactElement {
  const { t } = useTranslation();
  const {
    delayedTabs,
    loading,
    removeDelayedTabs,
    updateDelayedTabTitle,
    updateDelayedTabsTime,
    wakeDelayedTabs,
  } = useDelayedTabs();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [periods, setPeriods] = useState<DelayedTabPeriod[]>([]);
  const [now, setNow] = useState(Date.now);
  const [showBulkEditor, setShowBulkEditor] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    const updateNow = (): void => setNow(Date.now());
    window.addEventListener('focus', updateNow);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', updateNow);
    };
  }, []);

  const visibleTabs = filterDelayedTabs(delayedTabs, periods, now);
  const selectedTabs = visibleTabs
    .filter((tab) => selectedIds.includes(tab.id))
    .map((tab) => tab.id);
  const allSelected =
    visibleTabs.length > 0 && selectedTabs.length === visibleTabs.length;

  const runAction = async (
    action: () => Promise<void>,
    clearSelection = true
  ): Promise<void> => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await action();
      if (clearSelection) {
        setSelectedIds([]);
        setShowBulkEditor(false);
      }
    } catch (cause) {
      console.error('Delayed tabs operation failed:', cause);
      setError(
        cause instanceof DelayedTabsError
          ? t(`manageTabs.errors.${cause.code}`)
          : cause instanceof Error && cause.message
            ? t('manageTabs.operationFailedDetails', { message: cause.message })
            : t('manageTabs.operationFailed')
      );
    } finally {
      setNow(Date.now());
      setPending(false);
    }
  };

  const togglePeriod = (period?: DelayedTabPeriod): void => {
    setPeriods((current) =>
      !period
        ? []
        : current.includes(period)
          ? current.filter((value) => value !== period)
          : [...current, period]
    );
    setSelectedIds([]);
    setShowBulkEditor(false);
    setNow(Date.now());
  };

  if (loading) {
    return (
      <div className='flex min-h-[300px] items-center justify-center'>
        <span className='loading loading-spinner loading-lg' />
      </div>
    );
  }

  return (
    <div
      className={`card overflow-hidden bg-base-300 shadow-md ${isManageTabsPage ? 'h-[calc(100dvh-3rem)] w-full max-w-6xl' : 'max-h-[600px] w-[40rem] rounded-none'}`}
    >
      <div className='card-body min-h-0 p-6'>
        <div className='flex shrink-0 items-center justify-between gap-3'>
          <div className='flex items-center'>
            {!isManageTabsPage && (
              <Link
                to='/'
                search={{ remindOnly: false }}
                className='btn btn-circle btn-ghost btn-sm mr-3'
                aria-label={t('common.back')}
              >
                <FontAwesomeIcon icon='arrow-left' />
              </Link>
            )}
            <h2 className='card-title font-bold text-delayo-orange'>
              {t('manageTabs.title')}
            </h2>
          </div>
          <div className='flex items-center gap-2'>
            {!isManageTabsPage && (
              <a
                href={getManageTabsPageUrl()}
                target='_blank'
                rel='noreferrer'
                className='btn btn-ghost btn-sm'
                title={t('manageTabs.openFullList')}
              >
                <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
                {t('manageTabs.openFullList')}
              </a>
            )}
            <button
              type='button'
              className='btn btn-circle btn-ghost btn-sm'
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
          className='my-3 grid shrink-0 grid-cols-3 gap-2'
          role='group'
          aria-label={t('manageTabs.filters.label')}
        >
          {(['all', ...delayedTabPeriods] as const).map((period) => {
            const active =
              period === 'all'
                ? periods.length === 0
                : periods.includes(period);
            const count =
              period === 'all'
                ? delayedTabs.length
                : delayedTabs.filter((tab) =>
                    matchesDelayedTabPeriod(tab.wakeTime, period, now)
                  ).length;
            return (
              <button
                key={period}
                type='button'
                disabled={pending}
                aria-pressed={active}
                title={t(`manageTabs.filters.${period}Hint`)}
                onClick={() =>
                  togglePeriod(period === 'all' ? undefined : period)
                }
                className={`flex min-h-16 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors disabled:opacity-50 ${active ? 'border-delayo-orange bg-delayo-orange/20' : 'border-transparent bg-base-100/70 hover:bg-base-100'}`}
              >
                <span>{t(`manageTabs.filters.${period}`)}</span>
                <span className='text-lg font-bold tabular-nums'>{count}</span>
              </button>
            );
          })}
        </div>

        {error && (
          <p role='alert' className='mb-2 shrink-0 text-sm text-error'>
            {error}
          </p>
        )}
        <ScrollArea contentClassName='space-y-3' fadeSize='large'>
          {delayedTabs.length === 0 ? (
            <div className='p-8 text-center'>
              <FontAwesomeIcon
                icon='hourglass-empty'
                className='mb-4 h-12 w-12 text-neutral-400'
              />
              <h3 className='mb-2 text-lg font-medium'>
                {t('manageTabs.noTabs')}
              </h3>
              <p className='text-sm text-base-content/70'>
                {t('manageTabs.noDelayedTabs')}
              </p>
            </div>
          ) : (
            <>
              <fieldset
                disabled={pending}
                className='flex flex-wrap items-center gap-2'
              >
                <button
                  type='button'
                  className={`btn btn-sm ${selectMode ? 'btn-outline' : 'btn-primary'}`}
                  onClick={() => {
                    setSelectMode(!selectMode);
                    setSelectedIds([]);
                    setShowBulkEditor(false);
                  }}
                >
                  <FontAwesomeIcon
                    icon={selectMode ? 'times' : 'check-square'}
                  />
                  {selectMode ? t('manageTabs.cancel') : t('manageTabs.select')}
                </button>
                {selectMode && (
                  <button
                    type='button'
                    className='btn btn-ghost btn-sm'
                    disabled={visibleTabs.length === 0}
                    onClick={() =>
                      setSelectedIds(
                        allSelected ? [] : visibleTabs.map((tab) => tab.id)
                      )
                    }
                  >
                    {allSelected
                      ? t('manageTabs.deselectAll')
                      : t('manageTabs.selectAll')}
                  </button>
                )}
                {selectMode && selectedTabs.length > 0 && (
                  <>
                    <span className='text-xs text-base-content/70'>
                      {t('manageTabs.selectedCount', {
                        count: selectedTabs.length,
                      })}
                    </span>
                    <div className='ml-auto flex flex-wrap gap-2'>
                      <button
                        type='button'
                        className='btn btn-primary btn-sm'
                        onClick={() => setShowBulkEditor(!showBulkEditor)}
                        aria-expanded={showBulkEditor}
                      >
                        {t('manageTabs.bulk.edit')}
                      </button>
                      <button
                        type='button'
                        className='btn btn-sm'
                        onClick={() =>
                          void runAction(() => wakeDelayedTabs(selectedTabs))
                        }
                      >
                        {t('manageTabs.wakeUp')}
                      </button>
                      <button
                        type='button'
                        className='btn btn-outline btn-error btn-sm'
                        onClick={() =>
                          void runAction(() => removeDelayedTabs(selectedTabs))
                        }
                      >
                        {t('manageTabs.remove')}
                      </button>
                    </div>
                  </>
                )}
              </fieldset>
              {selectMode && selectedTabs.length > 0 && showBulkEditor && (
                <BulkTimeEditor
                  count={selectedTabs.length}
                  pending={pending}
                  onCancel={() => setShowBulkEditor(false)}
                  onApply={(change) =>
                    runAction(() => updateDelayedTabsTime(selectedTabs, change))
                  }
                />
              )}
              {visibleTabs.length === 0 && (
                <p className='py-8 text-center text-sm text-base-content/70'>
                  {t('manageTabs.noMatchingTabs')}
                </p>
              )}
              <fieldset disabled={pending} className='space-y-3'>
                {visibleTabs.map((tab) => (
                  <DelayedTabCard
                    key={tab.id}
                    tab={tab}
                    wrapDetails={isManageTabsPage}
                    onTitleChange={(id, title) =>
                      runAction(() => updateDelayedTabTitle(id, title), false)
                    }
                    actions={
                      selectMode
                        ? undefined
                        : {
                            onEdit: async (tabId) => {
                              await navigate({
                                to: '/custom-delay',
                                search: { tabId, remindOnly: false },
                              });
                            },
                            onWake: (target) =>
                              runAction(() => wakeDelayedTabs([target.id])),
                            onRemove: (target) =>
                              runAction(() => removeDelayedTabs([target.id])),
                          }
                    }
                    selection={
                      selectMode && (
                        <input
                          type='checkbox'
                          className='checkbox-primary checkbox checkbox-sm mr-3 shrink-0'
                          checked={selectedTabs.includes(tab.id)}
                          aria-label={t('manageTabs.toggleSelection')}
                          onChange={() =>
                            setSelectedIds((current) =>
                              current.includes(tab.id)
                                ? current.filter((id) => id !== tab.id)
                                : [...current, tab.id]
                            )
                          }
                        />
                      )
                    }
                  />
                ))}
              </fieldset>
            </>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}

export default ManageTabsView;
